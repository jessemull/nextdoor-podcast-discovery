"""LLM scoring for Nextdoor posts using Claude Haiku."""

__all__ = ["LLMScorer", "PostScore"]

import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

from anthropic import Anthropic
from supabase import Client
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import CLAUDE_MODEL
from src.novelty import calculate_novelty

logger = logging.getLogger(__name__)

# Maximum characters to send to Claude (longer posts are truncated)

MAX_POST_LENGTH = 2000

# Maximum characters for post summary

MAX_SUMMARY_LENGTH = 500

# Scoring dimensions with descriptions for the prompt
# Order matches the JSON example in the prompt for consistency

SCORING_DIMENSIONS = {
    "absurdity": (
        "How ridiculous, unhinged, or 'peak Nextdoor' is this post? "
        "(1=mundane, 10=absolutely unhinged)"
    ),
    "discussion_spark": (
        "Would listeners want to discuss this? (1=boring, 10=everyone has an opinion)"
    ),
    "drama": (
        "Level of conflict, tension, or heated exchanges "
        "(1=peaceful, 10=full-blown neighbor war)"
    ),
    "emotional_intensity": (
        "Passion level - caps, exclamation marks, strong language "
        "(1=calm, 10=screaming)"
    ),
    "news_value": (
        "Did something actually happen worth reporting? (1=nothing, 10=major incident)"
    ),
    "readability": (
        "How easy and punchy is this to read aloud? Short, clear posts score higher; "
        "walls of text score lower. (1=rambling/long, 10=concise and punchy)"
    ),
}

# Topic categories for frequency tracking

TOPIC_CATEGORIES = [
    "crime",
    "drama",
    "humor",
    "local_news",
    "lost_pet",
    "noise",
    "suspicious",
    "wildlife",
]

# The scoring prompt template

SCORING_PROMPT = """You are analyzing Nextdoor posts for a comedy podcast.

Score this post on each dimension from 1-10:

{dimension_descriptions}

Also assign 1-3 topic categories from this list: {categories}

Post to analyze:
---
{post_text}
---

Respond with ONLY valid JSON in this exact format:
{{
    "scores": {{
        "absurdity": <1-10>,
        "discussion_spark": <1-10>,
        "drama": <1-10>,
        "emotional_intensity": <1-10>,
        "news_value": <1-10>,
        "readability": <1-10>
    }},
    "categories": ["category1", "category2"],
    "summary": "<one sentence summary of the post>"
}}"""

# Batch scoring: multiple posts per API call
BATCH_SIZE = 5

BATCH_SCORING_PROMPT = """You are analyzing Nextdoor posts for a comedy podcast.

Score each post on these dimensions (1-10):
{dimension_descriptions}

Also assign 1-3 topic categories from this list to each post: {categories}

Posts to analyze (each numbered):
{posts_text}

Respond with ONLY a valid JSON array. One object per post, in order. Format:
[
  {{"post_index": 0, "scores": {{"absurdity": N, "discussion_spark": N, "drama": N, "emotional_intensity": N, "news_value": N, "readability": N}}, "categories": ["cat1"], "summary": "..."}},
  {{"post_index": 1, ...}}
]"""


@dataclass
class PostScore:
    """Scoring result for a single post."""

    post_id: str
    scores: dict[str, float]
    categories: list[str]
    summary: str

    # Computed after applying weights and novelty

    final_score: float | None = None

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

        for i in range(0, len(posts), BATCH_SIZE):
            batch = posts[i : i + BATCH_SIZE]
            try:
                batch_results = self._score_batch(batch)
                results.extend(batch_results)
            except Exception as e:
                logger.error("Error scoring batch: %s", e)
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

        response = self.anthropic.messages.create(
            max_tokens=500 * len(posts),
            model=CLAUDE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )

        content_block = response.content[0]
        raw_response = getattr(content_block, "text", "")

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.warning("Batch JSON parse error: %s", e)
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

            raw_cats = item.get("categories", [])
            categories = [c for c in raw_cats if c in TOPIC_CATEGORIES]
            summary = (item.get("summary") or "")[:MAX_SUMMARY_LENGTH]

            results.append(
                PostScore(
                    post_id=post.get("id", "unknown"),
                    scores=validated_scores,
                    categories=categories,
                    summary=summary,
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

        # Extract categories

        raw_categories = data.get("categories", [])
        categories = [c for c in raw_categories if c in TOPIC_CATEGORIES]

        # Extract summary

        summary = data.get("summary", "")[:MAX_SUMMARY_LENGTH]

        return PostScore(
            post_id=post_id,
            scores=validated_scores,
            categories=categories,
            summary=summary,
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

            result.final_score = normalized * novelty

        return results

    def save_scores(self, results: list[PostScore]) -> dict[str, int]:
        """Save scores to Supabase.

        Args:
            results: List of PostScore objects to save.

        Returns:
            Dict with counts: {"saved": N, "skipped": N, "errors": N}
        """
        stats = {"errors": 0, "saved": 0, "skipped": 0}

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
                }

                self.supabase.table("llm_scores").upsert(
                    data,
                    on_conflict="post_id",
                ).execute()

                stats["saved"] += 1

            except Exception as e:
                # Supabase/DB errors; continue with remaining scores
                logger.error("Error saving score for post %s: %s", result.post_id, e)
                stats["errors"] += 1

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
                # If RPC doesn't exist, fall back to manual update

                logger.debug("RPC failed, using manual update: %s", e)

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
                    # Fallback update failed; log and continue
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
                .single()
                .execute()
            )

            if result.data:
                value = result.data.get("value", {})  # type: ignore[union-attr]
                if isinstance(value, dict):
                    self._weights = value
                    return self._weights

        except Exception as e:
            # Supabase/DB error; use default weights
            logger.warning("Failed to load weights: %s", e)

        # Default weights

        self._weights = {
            "absurdity": 2.0,
            "discussion_spark": 1.0,
            "drama": 1.5,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
            "readability": 1.2,
        }

        return self._weights

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
                .single()
                .execute()
            )

            if result.data:
                value = result.data.get("value", {})  # type: ignore[union-attr]
                if isinstance(value, dict):
                    self._novelty_config = value
                    return self._novelty_config

        except Exception as e:
            # Supabase/DB error; use default config
            logger.warning("Failed to load novelty config: %s", e)

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
            # Supabase/DB error; return empty dict
            logger.warning("Failed to load topic frequencies: %s", e)

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
            # RPC may not exist; fall back to manual query
            logger.debug("RPC failed, using manual query: %s", e)

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
            # Manual query failed; return empty
            logger.error("Failed to get unscored posts: %s", e)
            return []
