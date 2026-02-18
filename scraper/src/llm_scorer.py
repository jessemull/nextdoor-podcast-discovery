"""LLM scoring for Nextdoor posts using Claude Haiku."""

__all__ = ["LLMScorer", "PostScore", "SCORING_DIMENSIONS"]

import json
import logging
import statistics
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

from anthropic import Anthropic
from supabase import Client
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import (
    CLAUDE_MODEL,
    ENSEMBLE_RUNS,
    ENSEMBLE_TEMPERATURE,
    log_supabase_error,
)
from src.llm_prompts import (
    BATCH_SCORING_PROMPT,
    BATCH_SCORING_RETRY_PROMPT,
    BATCH_SIZE,
    MAX_POST_LENGTH,
    MAX_SUMMARY_LENGTH,
    PROMPT_VERSION,
    RUBRIC_SCALE,
    SCORING_DIMENSIONS,
    SCORING_PROMPT,
    SINGLE_DIMENSION_SCORING_PROMPT,
    SINGLE_DIMENSION_SCORING_RETRY_PROMPT,
    TOPIC_CATEGORIES,
)
from src.novelty import calculate_novelty

logger = logging.getLogger(__name__)


def _strip_json_from_markdown(text: str) -> str:
    """Try to extract JSON from markdown code blocks (e.g. ```json ... ```)."""
    if not text:
        return ""
    text = text.strip()
    for start in ("```json", "```"):
        if text.startswith(start):
            text = text[len(start) :].strip()
            if text.endswith("```"):
                text = text[:-3].strip()
            return text
    return text


def _aggregate_ensemble_results(
    run_results: list[list["PostScore"]],
) -> list["PostScore"]:
    """Aggregate multiple scoring runs into one result per post.

    Uses median per dimension, majority vote for categories, and picks
    summary/why from the run whose podcast_worthy is closest to median.
    """
    if not run_results:
        return []

    num_posts = len(run_results[0])
    aggregated: list[PostScore] = []

    for post_idx in range(num_posts):
        post_id = run_results[0][post_idx].post_id
        runs_for_post = [run[post_idx] for run in run_results]

        # Skip runs with errors
        valid_runs = [r for r in runs_for_post if not r.error and r.scores]

        if not valid_runs:
            err_run = runs_for_post[0]
            aggregated.append(
                PostScore(
                    post_id=post_id,
                    scores={},
                    categories=[],
                    summary="",
                    error=err_run.error or "No valid runs",
                )
            )
            continue

        # Median per dimension
        aggregated_scores: dict[str, float] = {}
        for dim in SCORING_DIMENSIONS:
            # Missing dimension defaults to 5.0; see docs on new dimension backfill
            values = [
                r.scores.get(dim, 5.0)
                for r in valid_runs
                if isinstance(r.scores.get(dim), (int, float))
            ]
            if values:
                med = statistics.median(values)
                aggregated_scores[dim] = min(10.0, max(1.0, float(med)))
            else:
                aggregated_scores[dim] = 5.0

        # Majority vote for categories
        cat_counts: dict[str, int] = {}
        for r in valid_runs:
            for c in r.categories:
                if c in TOPIC_CATEGORIES:
                    cat_counts[c] = cat_counts.get(c, 0) + 1
        sorted_cats = sorted(
            cat_counts.items(),
            key=lambda x: (-x[1], x[0]),
        )
        categories = [c for c, _ in sorted_cats[:3]]

        # Summary and why_podcast_worthy from run closest to median podcast_worthy
        # Missing podcast_worthy defaults to 5.0; see docs on new dimension backfill
        median_pw = statistics.median(
            r.scores.get("podcast_worthy", 5.0) for r in valid_runs
        )
        best_run = min(
            valid_runs,
            key=lambda r: abs(r.scores.get("podcast_worthy", 5.0) - median_pw),
        )
        summary = (best_run.summary or "")[:MAX_SUMMARY_LENGTH]
        why_podcast_worthy = (best_run.why_podcast_worthy or "")[
            :MAX_SUMMARY_LENGTH
        ].strip() or None

        aggregated.append(
            PostScore(
                post_id=post_id,
                scores=aggregated_scores,
                categories=categories,
                summary=summary,
                why_podcast_worthy=why_podcast_worthy,
            )
        )

    return aggregated


@dataclass
class PostScore:
    """Scoring result for a single post."""

    post_id: str
    scores: dict[str, float]
    categories: list[str]
    summary: str

    # Computed after applying weights and novelty

    final_score: float | None = None

    # Podcast-worthiness (LLM-generated)

    why_podcast_worthy: str | None = None

    # Metadata

    error: str | None = None
    raw_response: str | None = field(default=None, repr=False)


class LLMScorer:
    """Scores posts using Claude Haiku."""

    def __init__(self, anthropic_client: Anthropic, supabase: Client) -> None:
        """Initialize the scorer.

        Args:
            anthropic_client: Anthropic API client.
            supabase: Supabase client for storing scores.
        """
        self.anthropic = anthropic_client
        self.supabase = supabase
        self._weights: dict[str, float] | None = None
        self._novelty_config: dict[str, Any] | None = None

    def score_posts(self, posts: list[dict[str, Any]]) -> list[PostScore]:
        """Score multiple posts in batches for efficiency.

        Args:
            posts: List of post dicts with 'id' and 'text' keys.

        Returns:
            List of PostScore results.
        """
        results: list[PostScore] = []
        total_batches = (len(posts) + BATCH_SIZE - 1) // BATCH_SIZE

        for i in range(0, len(posts), BATCH_SIZE):
            batch = posts[i : i + BATCH_SIZE]
            batch_index = (i // BATCH_SIZE) + 1
            post_ids = [p.get("id", "?") for p in batch]
            logger.info(
                "Scoring batch %d/%d (post_ids=%s)",
                batch_index,
                total_batches,
                post_ids,
            )
            try:
                batch_results = self._score_batch(batch)
                results.extend(batch_results)
            except Exception as e:
                # Batch-level failure: log and continue; tenacity on _score_batch
                # handles per-call retries; we do not retry the whole batch here.
                logger.error(
                    "Error scoring batch %d (post_ids=%s): %s",
                    batch_index,
                    post_ids,
                    e,
                )
                for post in batch:
                    results.append(
                        PostScore(
                            post_id=post.get("id", "unknown"),
                            scores={},
                            categories=[],
                            summary="",
                            error=str(e),
                        )
                    )

        return results

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _score_batch(self, posts: list[dict[str, Any]]) -> list[PostScore]:
        """Score a batch of posts using ensemble (3 runs, median aggregation)."""
        if len(posts) == 1:
            pt = posts[0].get("text", "")
            if not pt or not pt.strip():
                return [
                    PostScore(
                        post_id=posts[0].get("id", "unknown"),
                        scores={},
                        categories=[],
                        summary="",
                        error="Empty post text",
                    )
                ]

        successful_runs: list[list[PostScore]] = []
        last_error: Exception | None = None

        for _ in range(ENSEMBLE_RUNS):
            try:
                run_result = self._score_batch_single_run(posts, ENSEMBLE_TEMPERATURE)
                successful_runs.append(run_result)
            except Exception as e:
                logger.warning("Ensemble run failed: %s", e)
                last_error = e

        if not successful_runs:
            return [
                PostScore(
                    post_id=p.get("id", "unknown"),
                    scores={},
                    categories=[],
                    summary="",
                    error=str(last_error) if last_error else "All ensemble runs failed",
                )
                for p in posts
            ]

        return _aggregate_ensemble_results(successful_runs)

    def _score_batch_single_run(
        self,
        posts: list[dict[str, Any]],
        temperature: float,
    ) -> list[PostScore]:
        """Score a batch in one API call. Raises on failure."""
        dimension_desc = "\n".join(
            f"- {dim}: {desc}" for dim, desc in SCORING_DIMENSIONS.items()
        )

        def _truncate_with_signal(text: str) -> str:
            t = text[:MAX_POST_LENGTH]
            if len(text) > MAX_POST_LENGTH:
                t += f"\n[Text truncated at {MAX_POST_LENGTH} characters]"
            return t

        posts_text = "\n\n".join(
            f"[Post {i}] (id={p.get('id')})\n{_truncate_with_signal(p.get('text', ''))}"
            for i, p in enumerate(posts)
        )
        prompt = BATCH_SCORING_PROMPT.format(
            categories=", ".join(TOPIC_CATEGORIES),
            dimension_descriptions=dimension_desc,
            posts_text=posts_text,
            rubric_scale=RUBRIC_SCALE,
        )

        max_attempts = 3
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        parsed: Any = None
        raw_response = ""

        for attempt in range(max_attempts):
            response = self.anthropic.messages.create(
                max_tokens=500 * len(posts),
                model=CLAUDE_MODEL,
                messages=cast("Any", messages),
                temperature=temperature,
            )

            content_block = response.content[0]
            raw_response = getattr(content_block, "text", "")

            parse_error: json.JSONDecodeError | None = None
            for text_to_parse in (
                raw_response,
                _strip_json_from_markdown(raw_response),
            ):
                if not text_to_parse:
                    continue
                try:
                    parsed = json.loads(text_to_parse)
                    parse_error = None
                    break
                except json.JSONDecodeError as e:
                    parse_error = e
                    continue
            else:
                err = parse_error or json.JSONDecodeError(
                    "Invalid JSON", raw_response, 0
                )
                if attempt < max_attempts - 1:
                    logger.warning(
                        "Batch JSON parse error (attempt %d/%d, retrying with feedback): %s",
                        attempt + 1,
                        max_attempts,
                        err,
                    )
                    messages.append({"role": "assistant", "content": raw_response})
                    messages.append(
                        {
                            "role": "user",
                            "content": BATCH_SCORING_RETRY_PROMPT.format(
                                error=str(err)
                            ),
                        }
                    )
                else:
                    raise ValueError(
                        f"JSON parse error after {max_attempts} attempts: {err}"
                    ) from err
                continue

            break

        if not isinstance(parsed, list):
            raise ValueError("Invalid batch response format: not a list")

        results = []
        parsed_by_index: dict[int, dict[str, Any]] = {
            int(item.get("post_index", idx)): item
            for idx, item in enumerate(parsed)
            if isinstance(item, dict)
        }

        for i, post in enumerate(posts):
            item = parsed_by_index.get(i)
            if not item:
                raise ValueError(f"Missing result in batch response for post index {i}")

            scores = item.get("scores", {})
            validated_scores = {}
            for dim in SCORING_DIMENSIONS:
                s = scores.get(dim)
                validated_scores[dim] = (
                    float(s) if isinstance(s, (int, float)) and 1 <= s <= 10 else 5.0
                )
            pw = scores.get("podcast_worthy")
            if isinstance(pw, (int, float)) and 1 <= pw <= 10:
                validated_scores["podcast_worthy"] = float(pw)

            raw_cats = item.get("categories", [])
            categories = [c for c in raw_cats if c in TOPIC_CATEGORIES]
            summary = (item.get("summary") or "")[:MAX_SUMMARY_LENGTH]
            why_podcast_worthy = (item.get("why_podcast_worthy") or "")[
                :MAX_SUMMARY_LENGTH
            ].strip() or None

            results.append(
                PostScore(
                    post_id=post.get("id", "unknown"),
                    scores=validated_scores,
                    categories=categories,
                    summary=summary,
                    why_podcast_worthy=why_podcast_worthy,
                )
            )

        return results

    def score_single_dimension(
        self,
        posts: list[dict[str, Any]],
        dimension: str,
    ) -> list[tuple[str, float]]:
        """Score only one dimension for each post (for backfill). Does not write to DB.

        Args:
            posts: List of dicts with 'id' and 'text' keys.
            dimension: Dimension key (must be in SCORING_DIMENSIONS).

        Returns:
            List of (post_id, value) with value in [1, 10].
        """
        if dimension not in SCORING_DIMENSIONS:
            raise ValueError(
                f"Unknown dimension: {dimension}. Must be one of {list(SCORING_DIMENSIONS)}"
            )
        results: list[tuple[str, float]] = []
        for i in range(0, len(posts), BATCH_SIZE):
            batch = posts[i : i + BATCH_SIZE]
            batch_results = self._score_single_dimension_batch(batch, dimension)
            results.extend(batch_results)
        return results

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _score_single_dimension_batch(
        self,
        posts: list[dict[str, Any]],
        dimension: str,
    ) -> list[tuple[str, float]]:
        """Score one dimension for a batch of posts. Raises on parse failure after retries."""
        def _truncate_with_signal(text: str) -> str:
            t = text[:MAX_POST_LENGTH]
            if len(text) > MAX_POST_LENGTH:
                t += f"\n[Text truncated at {MAX_POST_LENGTH} characters]"
            return t

        description = SCORING_DIMENSIONS[dimension]
        if isinstance(description, tuple):
            description = description[0] if description else ""
        else:
            description = str(description)
        posts_text = "\n\n".join(
            f"[Post {i}] (id={p.get('id')})\n{_truncate_with_signal(p.get('text', ''))}"
            for i, p in enumerate(posts)
        )
        prompt = SINGLE_DIMENSION_SCORING_PROMPT.format(
            dimension=dimension,
            description=description,
            posts_text=posts_text,
            rubric_scale=RUBRIC_SCALE,
        )

        max_attempts = 3
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        parsed: Any = None
        raw_response = ""

        for attempt in range(max_attempts):
            response = self.anthropic.messages.create(
                max_tokens=500 * len(posts),
                model=CLAUDE_MODEL,
                messages=cast("Any", messages),
                temperature=0,
            )
            content_block = response.content[0]
            raw_response = getattr(content_block, "text", "")

            parse_error: json.JSONDecodeError | None = None
            for text_to_parse in (
                raw_response,
                _strip_json_from_markdown(raw_response),
            ):
                if not text_to_parse:
                    continue
                try:
                    parsed = json.loads(text_to_parse)
                    parse_error = None
                    break
                except json.JSONDecodeError as e:
                    parse_error = e
                    continue
            else:
                err = parse_error or json.JSONDecodeError(
                    "Invalid JSON", raw_response, 0
                )
                if attempt < max_attempts - 1:
                    logger.warning(
                        "Single-dimension batch JSON parse error (attempt %d/%d): %s",
                        attempt + 1,
                        max_attempts,
                        err,
                    )
                    messages.append({"role": "assistant", "content": raw_response})
                    messages.append(
                        {
                            "role": "user",
                            "content": SINGLE_DIMENSION_SCORING_RETRY_PROMPT.format(
                                error=str(err),
                                dimension=dimension,
                            ),
                        },
                    )
                else:
                    raise ValueError(
                        f"JSON parse error after {max_attempts} attempts: {err}"
                    ) from err
                continue

            break

        if not isinstance(parsed, list):
            raise ValueError("Invalid single-dimension response: not a list")

        parsed_by_index: dict[int, dict[str, Any]] = {
            int(item.get("post_index", idx)): item
            for idx, item in enumerate(parsed)
            if isinstance(item, dict)
        }
        out: list[tuple[str, float]] = []
        for i, post in enumerate(posts):
            item = parsed_by_index.get(i)
            if not item:
                raise ValueError(
                    f"Missing result in single-dimension response for post index {i}"
                )
            scores = item.get("scores") or {}
            raw = scores.get(dimension)
            if isinstance(raw, (int, float)) and 1 <= raw <= 10:
                value = float(raw)
            else:
                value = 5.0
            out.append((post.get("id", "unknown"), value))
        return out

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _score_single_post(self, post: dict[str, Any]) -> PostScore:
        """Score a single post using Claude.

        Args:
            post: Post dict with 'id' and 'text' keys.

        Returns:
            PostScore with scores, categories, and summary.
        """
        post_id = post.get("id", "unknown")
        post_text = post.get("text", "")

        if not post_text or not post_text.strip():
            return PostScore(
                post_id=post_id,
                scores={},
                categories=[],
                summary="",
                error="Empty post text",
            )

        # Build the prompt with truncation signal when text is cut

        sliced = post_text[:MAX_POST_LENGTH]
        if len(post_text) > MAX_POST_LENGTH:
            sliced += f"\n[Text truncated at {MAX_POST_LENGTH} characters]"

        dimension_desc = "\n".join(
            f"- {dim}: {desc}" for dim, desc in SCORING_DIMENSIONS.items()
        )
        prompt = SCORING_PROMPT.format(
            categories=", ".join(TOPIC_CATEGORIES),
            dimension_descriptions=dimension_desc,
            post_text=sliced,
            rubric_scale=RUBRIC_SCALE,
        )

        # Call Claude

        response = self.anthropic.messages.create(
            max_tokens=500,
            model=CLAUDE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,  # Deterministic scoring for reproducibility
        )

        # Extract text from response (first content block)

        content_block = response.content[0]
        raw_response = getattr(content_block, "text", "")

        # Parse JSON response

        try:
            data = json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse JSON for post %s: %s", post_id, e)
            return PostScore(
                post_id=post_id,
                scores={},
                categories=[],
                summary="",
                error=f"JSON parse error: {e}",
                raw_response=raw_response,
            )

        # Extract and validate scores

        scores = data.get("scores", {})
        validated_scores = {}

        for dim in SCORING_DIMENSIONS:
            score = scores.get(dim)
            if isinstance(score, (int, float)) and 1 <= score <= 10:
                validated_scores[dim] = float(score)
            else:
                validated_scores[dim] = 5.0  # Default to middle

        # Optional podcast_worthy in scores

        pw = scores.get("podcast_worthy")
        if isinstance(pw, (int, float)) and 1 <= pw <= 10:
            validated_scores["podcast_worthy"] = float(pw)

        # Extract categories

        raw_categories = data.get("categories", [])
        categories = [c for c in raw_categories if c in TOPIC_CATEGORIES]

        # Extract summary and why_podcast_worthy

        summary = data.get("summary", "")[:MAX_SUMMARY_LENGTH]
        why_podcast_worthy = (data.get("why_podcast_worthy") or "")[
            :MAX_SUMMARY_LENGTH
        ].strip() or None

        return PostScore(
            post_id=post_id,
            scores=validated_scores,
            categories=categories,
            summary=summary,
            why_podcast_worthy=why_podcast_worthy,
            raw_response=raw_response,
        )

    def calculate_final_scores(self, results: list[PostScore]) -> list[PostScore]:
        """Calculate final scores with weights and novelty adjustment.

        Args:
            results: List of PostScore objects with raw scores.

        Returns:
            Same list with final_score populated.
        """
        weights = self._get_weights()
        frequencies = self._get_topic_frequencies()
        total_scored_count = self._get_scored_count()

        for result in results:
            if result.error or not result.scores:
                continue

            # Calculate weighted score; missing dimension defaults to 5.0 (see docs)
            weighted_sum = sum(
                result.scores.get(dim, 5.0) * weights.get(dim, 1.0)
                for dim in SCORING_DIMENSIONS
            )
            max_possible = sum(10 * weights.get(dim, 1.0) for dim in SCORING_DIMENSIONS)
            normalized = (weighted_sum / max_possible) * 10

            # Calculate novelty multiplier based on categories

            config = self._get_novelty_config()
            novelty = calculate_novelty(
                result.categories,
                frequencies,
                config,
                total_scored_count=total_scored_count,
            )

            raw_score = normalized * novelty
            result.final_score = min(10.0, max(0.0, raw_score))

        return results

    def save_scores(self, results: list[PostScore]) -> dict[str, int]:
        """Save scores to Supabase (llm_scores and post_scores for active config).

        Args:
            results: List of PostScore objects to save.

        Returns:
            Dict with counts: {"saved": N, "skipped": N, "errors": N}
        """
        stats = {"errors": 0, "saved": 0, "skipped": 0}
        saved_results: list[PostScore] = []
        all_rows: list[dict[str, Any]] = []

        for result in results:
            if result.error:
                stats["skipped"] += 1
                continue

            all_rows.append(
                {
                    "categories": result.categories,
                    "final_score": result.final_score,
                    "model_version": CLAUDE_MODEL,
                    "post_id": result.post_id,
                    "prompt_version": PROMPT_VERSION,
                    "scores": result.scores,
                    "summary": result.summary,
                    "why_podcast_worthy": result.why_podcast_worthy,
                }
            )
            saved_results.append(result)

        if all_rows:
            try:
                self.supabase.table("llm_scores").upsert(
                    all_rows,
                    on_conflict="post_id",
                ).execute()
                stats["saved"] = len(all_rows)
            except Exception as e:
                log_supabase_error("Error batch saving llm_scores", e)
                stats["errors"] = len(all_rows)
                stats["saved"] = 0
                saved_results = []

        # Update topic frequencies before computing post_scores so novelty matches
        # Preview (which recomputes at query time with current frequencies).
        self._update_topic_frequencies(results)

        # Recompute final_scores with updated frequencies; write post_scores so
        # stored feed matches Preview exactly.
        self.calculate_final_scores(saved_results)

        active_config_id = self._get_active_weight_config_id()
        if active_config_id and saved_results:
            try:
                post_scores_data = [
                    {
                        "final_score": r.final_score,
                        "post_id": r.post_id,
                        "weight_config_id": active_config_id,
                    }
                    for r in saved_results
                ]
                self.supabase.table("post_scores").upsert(
                    post_scores_data,
                    on_conflict="post_id,weight_config_id",
                ).execute()
            except Exception as e:
                log_supabase_error("Failed to write post_scores (feed may be empty)", e)

        logger.info(
            "Saved %d scores, skipped %d, errors %d",
            stats["saved"],
            stats["skipped"],
            stats["errors"],
        )

        return stats

    def _update_topic_frequencies(self, results: list[PostScore]) -> None:
        """Update topic frequency counts.

        Args:
            results: List of scored posts.
        """
        # Count categories in this batch

        category_counts: dict[str, int] = {}

        for result in results:
            if result.error:
                continue

            for cat in result.categories:
                category_counts[cat] = category_counts.get(cat, 0) + 1

        if not category_counts:
            return

        # Batch update via RPC

        p_updates = [
            {"category": cat, "increment": count}
            for cat, count in sorted(category_counts.items())
        ]

        try:
            self.supabase.rpc(
                "increment_topic_frequencies_batch",
                {"p_updates": p_updates},
            ).execute()
        except Exception as e:
            logger.debug(
                "RPC increment_topic_frequencies_batch failed, falling back to per-category: %s",
                e,
            )

            for category, count in category_counts.items():
                try:
                    self.supabase.rpc(
                        "increment_topic_frequency",
                        {"p_category": category, "p_increment": count},
                    ).execute()
                except Exception as e2:
                    logger.debug(
                        "RPC increment_topic_frequency failed (category=%s): %s",
                        category,
                        e2,
                    )

                    try:
                        freq_result = (
                            self.supabase.table("topic_frequencies")
                            .select("count_30d")
                            .eq("category", category)
                            .single()
                            .execute()
                        )

                        freq_data = cast(dict[str, Any], freq_result.data)
                        current = int(freq_data.get("count_30d", 0)) if freq_data else 0

                        self.supabase.table("topic_frequencies").upsert(
                            {
                                "category": category,
                                "count_30d": current + count,
                                "last_updated": datetime.now(UTC).isoformat(),
                            },
                            on_conflict="category",
                        ).execute()
                    except Exception as e3:
                        logger.warning(
                            "Failed to update frequency for %s: %s",
                            category,
                            e3,
                        )

    def _get_weights(self) -> dict[str, float]:
        """Load ranking weights from settings.

        Returns:
            Dict of dimension -> weight.
        """
        if self._weights is not None:
            return self._weights

        try:
            result = (
                self.supabase.table("settings")
                .select("value")
                .eq("key", "ranking_weights")
                .limit(1)
                .execute()
            )
            rows = result.data if isinstance(result.data, list) else []
            if rows:
                row = rows[0]
                if isinstance(row, dict):
                    value = row.get("value", {})
                    if isinstance(value, dict):
                        self._weights = value
                        return self._weights

        except Exception as e:
            log_supabase_error("Failed to load ranking_weights from settings", e)

        # Default weights

        self._weights = {
            "absurdity": 2.0,
            "discussion_spark": 1.0,
            "drama": 1.5,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
            "podcast_worthy": 2.0,
            "readability": 1.2,
        }

        return self._weights

    def _get_active_weight_config_id(self) -> str | None:
        """Load active weight config id from settings (so post_scores feed the UI)."""
        try:
            result = (
                self.supabase.table("settings")
                .select("value")
                .eq("key", "active_weight_config_id")
                .limit(1)
                .execute()
            )
            rows = result.data if isinstance(result.data, list) else []
            if rows:
                row = rows[0]
                if isinstance(row, dict):
                    value = row.get("value")
                    if isinstance(value, str) and value:
                        return value
            # Fallback: first active config
            config_result = (
                self.supabase.table("weight_configs")
                .select("id")
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            config_rows = (
                config_result.data if isinstance(config_result.data, list) else []
            )
            if config_rows:
                cfg_row = config_rows[0]
                if isinstance(cfg_row, dict):
                    return cast("str | None", cfg_row.get("id"))
        except Exception as e:
            log_supabase_error("Failed to load active_weight_config_id", e)
        return None

    def _get_novelty_config(self) -> dict[str, Any]:
        """Load novelty configuration from settings.

        Returns:
            Novelty config dict.
        """
        if self._novelty_config is not None:
            return self._novelty_config

        try:
            result = (
                self.supabase.table("settings")
                .select("value")
                .eq("key", "novelty_config")
                .limit(1)
                .execute()
            )
            rows = result.data if isinstance(result.data, list) else []
            if rows:
                row = rows[0]
                if isinstance(row, dict):
                    value = row.get("value", {})
                    if isinstance(value, dict):
                        self._novelty_config = value
                        return self._novelty_config

        except Exception as e:
            log_supabase_error("Failed to load novelty_config from settings", e)

        # Default config

        self._novelty_config = {
            "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
            "max_multiplier": 1.5,
            "min_multiplier": 0.2,
            "window_days": 30,
        }

        return self._novelty_config

    def _get_topic_frequencies(self) -> dict[str, int]:
        """Load current topic frequencies from database.

        Returns:
            Dict of category -> count_30d.
        """
        try:
            result = (
                self.supabase.table("topic_frequencies")
                .select("category, count_30d")
                .execute()
            )

            if result.data:
                data = cast(list[dict[str, Any]], result.data)
                return {str(row["category"]): int(row["count_30d"]) for row in data}

        except Exception as e:
            # Intentionally broad: Supabase doesn't export specific exception types
            log_supabase_error("Failed to load topic_frequencies table", e)

        return {}

    def _get_scored_count(self) -> int | None:
        """Get count of existing scored posts for cold-start novelty check.

        Returns:
            Count of llm_scores rows, or None on error.
        """
        try:
            result = (
                self.supabase.table("llm_scores")
                .select("id", count=cast(Any, "exact"), head=True)
                .execute()
            )
            return result.count if result.count is not None else None
        except Exception as e:
            log_supabase_error("Failed to count llm_scores for cold-start check", e)
            return None

    def get_unscored_posts(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get posts that haven't been scored yet, oldest first.

        Uses an RPC function for efficiency. Falls back to a manual query
        if RPC is unavailable, but the fallback fetches all posts and filters
        in Python which can be slow with many posts.

        Args:
            limit: Maximum number of posts to return.

        Returns:
            List of post dicts with 'id' and 'text', ordered by created_at ASC.
        """
        try:
            # Get posts without llm_scores

            result = self.supabase.rpc(
                "get_unscored_posts",
                {"p_limit": limit},
            ).execute()

            if result.data:
                return list(result.data)  # type: ignore[arg-type]

        except Exception as e:
            # Intentionally broad: RPC may not exist or DB error; fall back
            logger.debug(
                "RPC get_unscored_posts failed (p_limit=%d), using fallback: %s",
                limit,
                e,
            )

        # Fallback: manual query (oldest first for chronological processing)

        try:
            posts_result = (
                self.supabase.table("posts")
                .select("id, text")
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )

            posts_data = cast(list[dict[str, Any]], posts_result.data)
            if not posts_data:
                return []

            # Filter out already scored posts

            post_ids = [p["id"] for p in posts_data]
            scored_result = (
                self.supabase.table("llm_scores")
                .select("post_id")
                .in_("post_id", post_ids)
                .execute()
            )

            scored_data = cast(list[dict[str, Any]], scored_result.data or [])
            scored_ids = {r["post_id"] for r in scored_data}

            return [dict(p) for p in posts_data if p["id"] not in scored_ids]

        except Exception as e:
            # Intentionally broad: DB/network error; return empty to avoid crash
            logger.error(
                "Failed to get unscored posts (fallback query, limit=%d): %s (%s)",
                limit,
                e,
                type(e).__name__,
            )
            return []
