"""LLM scoring for Nextdoor posts using Claude Haiku."""

__all__ = ["LLMScorer", "PostScore", "SCORING_DIMENSIONS"]

import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

from anthropic import Anthropic
from supabase import Client
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import CLAUDE_MODEL, log_supabase_error
from src.llm_prompts import (
    BATCH_SCORING_PROMPT,
    BATCH_SCORING_RETRY_PROMPT,
    BATCH_SIZE,
    MAX_POST_LENGTH,
    MAX_SUMMARY_LENGTH,
    SCORING_DIMENSIONS,
    SCORING_PROMPT,
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
        """Score a batch of posts in one API call.

        Args:
            posts: List of post dicts with 'id' and 'text' keys.

        Returns:
            List of PostScore results.
        """
        if len(posts) == 1:
            return [self._score_single_post(posts[0])]

        dimension_desc = "\n".join(
            f"- {dim}: {desc}" for dim, desc in SCORING_DIMENSIONS.items()
        )
        posts_text = "\n\n".join(
            f"[Post {i}] (id={p.get('id')})\n{p.get('text', '')[:MAX_POST_LENGTH]}"
            for i, p in enumerate(posts)
        )
        prompt = BATCH_SCORING_PROMPT.format(
            dimension_descriptions=dimension_desc,
            categories=", ".join(TOPIC_CATEGORIES),
            posts_text=posts_text,
        )

        max_attempts = 3
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        parsed: Any = None
        raw_response = ""

        for attempt in range(max_attempts):
            response = self.anthropic.messages.create(
                max_tokens=500 * len(posts),
                model=CLAUDE_MODEL,
                messages=messages,
                temperature=0.3,
            )

            content_block = response.content[0]
            raw_response = getattr(content_block, "text", "")

            parse_error: json.JSONDecodeError | None = None
            for text_to_parse in (raw_response, _strip_json_from_markdown(raw_response)):
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
                e = parse_error or json.JSONDecodeError("Invalid JSON", raw_response, 0)
                if attempt < max_attempts - 1:
                    logger.warning(
                        "Batch JSON parse error (attempt %d/%d, retrying with feedback): %s",
                        attempt + 1,
                        max_attempts,
                        e,
                    )
                    messages.append({"role": "assistant", "content": raw_response})
                    messages.append({
                        "role": "user",
                        "content": BATCH_SCORING_RETRY_PROMPT.format(error=str(e)),
                    })
                else:
                    logger.warning("Batch JSON parse error after %d attempts: %s", max_attempts, e)
                    return [
                        PostScore(
                            post_id=p.get("id", "unknown"),
                            scores={},
                            categories=[],
                            summary="",
                            error=f"JSON parse error: {e}",
                            raw_response=raw_response,
                        )
                        for p in posts
                    ]
                continue

            break

        if not isinstance(parsed, list):
            logger.warning("Batch response not a list: %s", type(parsed))
            return [
                PostScore(
                    post_id=p.get("id", "unknown"),
                    scores={},
                    categories=[],
                    summary="",
                    error="Invalid batch response format",
                    raw_response=raw_response,
                )
                for p in posts
            ]

        results = []
        parsed_by_index: dict[int, dict[str, Any]] = {
            int(item.get("post_index", idx)): item
            for idx, item in enumerate(parsed)
            if isinstance(item, dict)
        }

        for i, post in enumerate(posts):
            item = parsed_by_index.get(i)
            if not item:
                results.append(
                    PostScore(
                        post_id=post.get("id", "unknown"),
                        scores={},
                        categories=[],
                        summary="",
                        error="Missing result in batch response",
                    )
                )
                continue

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

        # Build the prompt

        dimension_desc = "\n".join(
            f"- {dim}: {desc}" for dim, desc in SCORING_DIMENSIONS.items()
        )
        prompt = SCORING_PROMPT.format(
            dimension_descriptions=dimension_desc,
            categories=", ".join(TOPIC_CATEGORIES),
            post_text=post_text[:MAX_POST_LENGTH],
        )

        # Call Claude

        response = self.anthropic.messages.create(
            max_tokens=500,
            model=CLAUDE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,  # Explicit for reproducible scoring (PR_REVIEW)
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

        for result in results:
            if result.error or not result.scores:
                continue

            # Calculate weighted score

            weighted_sum = sum(
                result.scores.get(dim, 5.0) * weights.get(dim, 1.0)
                for dim in SCORING_DIMENSIONS
            )
            max_possible = sum(10 * weights.get(dim, 1.0) for dim in SCORING_DIMENSIONS)
            normalized = (weighted_sum / max_possible) * 10

            # Calculate novelty multiplier based on categories

            config = self._get_novelty_config()
            novelty = calculate_novelty(result.categories, frequencies, config)

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

        for result in results:
            if result.error:
                stats["skipped"] += 1
                continue

            try:
                data = {
                    "categories": result.categories,
                    "final_score": result.final_score,
                    "model_version": CLAUDE_MODEL,
                    "post_id": result.post_id,
                    "scores": result.scores,
                    "summary": result.summary,
                    "why_podcast_worthy": result.why_podcast_worthy,
                }

                self.supabase.table("llm_scores").upsert(
                    data,
                    on_conflict="post_id",
                ).execute()

                stats["saved"] += 1
                saved_results.append(result)

            except Exception as e:
                # Intentionally broad: Supabase doesn't export specific exception types
                log_supabase_error(f"Error saving score for post {result.post_id}", e)
                stats["errors"] += 1

        # Write post_scores for active weight config so the feed shows posts
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

        # Update topic frequencies

        self._update_topic_frequencies(results)

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

        # Update database

        for category, count in category_counts.items():
            try:
                # Increment count_30d for this category

                self.supabase.rpc(
                    "increment_topic_frequency",
                    {"p_category": category, "p_increment": count},
                ).execute()

            except Exception as e:
                # Intentionally broad: RPC may not exist or DB error; fall back
                logger.debug(
                    "RPC increment_topic_frequency failed (category=%s): %s",
                    category,
                    e,
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

                except Exception as e2:
                    # Intentionally broad: fallback update failed; log and continue
                    logger.warning(
                        "Failed to update frequency for %s: %s", category, e2
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
                value = rows[0].get("value", {})
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
                value = rows[0].get("value")
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
            config_rows = config_result.data if isinstance(config_result.data, list) else []
            if config_rows:
                return config_rows[0].get("id")
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
                value = rows[0].get("value", {})
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
