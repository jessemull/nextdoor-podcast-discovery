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
    "drama": (
        "Level of conflict, tension, or heated exchanges "
        "(1=peaceful, 10=full-blown neighbor war)"
    ),
    "discussion_spark": (
        "Would listeners want to discuss this? "
        "(1=boring, 10=everyone has an opinion)"
    ),
    "emotional_intensity": (
        "Passion level - caps, exclamation marks, strong language "
        "(1=calm, 10=screaming)"
    ),
    "news_value": (
        "Did something actually happen worth reporting? "
        "(1=nothing, 10=major incident)"
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
        "drama": <1-10>,
        "discussion_spark": <1-10>,
        "emotional_intensity": <1-10>,
        "news_value": <1-10>
    }},
    "categories": ["category1", "category2"],
    "summary": "<one sentence summary of the post>"
}}"""


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
        """Score multiple posts.

        Args:
            posts: List of post dicts with 'id' and 'text' keys.

        Returns:
            List of PostScore results.
        """
        results = []

        for post in posts:
            try:
                score = self._score_single_post(post)
                results.append(score)

            except Exception as e:
                logger.error("Error scoring post %s: %s", post.get("id"), e)
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
            model=CLAUDE_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
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

            novelty = self._calculate_novelty(result.categories, frequencies)

            result.final_score = normalized * novelty

        return results

    def _calculate_novelty(
        self,
        categories: list[str],
        frequencies: dict[str, int],
    ) -> float:
        """Calculate novelty multiplier based on category frequency.

        Why: We want to boost rare/novel topics and penalize overused ones.
        This creates a dynamic ranking that adapts to what's been seen recently,
        preventing the feed from being dominated by the same topics (e.g., "lost pet"
        posts every day). The multiplier ranges from 0.2 (very common) to 1.5 (rare).

        Algorithm:
        - Rare topics (≤5 occurrences in 30 days): Boost by 1.5x
        - Common topics (5-30 occurrences): Linear interpolation from 1.5x to 1.0x
        - Very common topics (30-100 occurrences): Linear interpolation from 1.0x to 0.2x
        - Extremely common topics (>100 occurrences): Penalize by 0.2x

        Args:
            categories: List of topic categories for this post.
            frequencies: Dict of category -> count_30d.

        Returns:
            Novelty multiplier (0.2 to 1.5).
        """
        if not categories:
            return 1.0  # Default: no adjustment

        config = self._get_novelty_config()
        min_mult = float(config.get("min_multiplier", 0.2))
        max_mult = float(config.get("max_multiplier", 1.5))
        thresholds: dict[str, int] = config.get("frequency_thresholds", {})
        rare_threshold = int(thresholds.get("rare", 5))
        common_threshold = int(thresholds.get("common", 30))
        very_common_threshold = int(thresholds.get("very_common", 100))

        # Average frequency across categories
        # Why: A post can have multiple categories, so we average to get overall rarity

        total_freq = sum(frequencies.get(cat, 0) for cat in categories)
        avg_freq = float(total_freq) / len(categories) if categories else 0.0

        # Map frequency to multiplier (with division-by-zero guards)
        # Why: Linear interpolation provides smooth transitions between thresholds,
        # avoiding sudden jumps in score when a topic crosses a threshold

        if avg_freq <= rare_threshold:
            return float(max_mult)  # Rare topic: boost
        elif avg_freq <= common_threshold:
            # Linear interpolation between max and 1.0
            # Why: Smooth transition prevents score jumps when topic frequency changes slightly
            divisor = common_threshold - rare_threshold
            if divisor <= 0:
                return 1.0  # Invalid config, use neutral multiplier
            ratio = (avg_freq - rare_threshold) / divisor
            return float(max_mult - (ratio * (max_mult - 1.0)))
        elif avg_freq <= very_common_threshold:
            # Linear interpolation between 1.0 and min
            # Why: Same as above - smooth transition for common topics
            divisor = very_common_threshold - common_threshold
            if divisor <= 0:
                return float(min_mult)  # Invalid config, use min
            ratio = (avg_freq - common_threshold) / divisor
            return float(1.0 - (ratio * (1.0 - min_mult)))
        else:
            return float(min_mult)  # Very common: penalize

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
            logger.warning("Failed to load weights: %s", e)

        # Default weights

        self._weights = {
            "absurdity": 2.0,
            "discussion_spark": 1.0,
            "drama": 1.5,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
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
                return {
                    str(row["category"]): int(row["count_30d"])
                    for row in data
                }

        except Exception as e:
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

            result = (
                self.supabase.rpc(
                    "get_unscored_posts",
                    {"p_limit": limit},
                ).execute()
            )

            if result.data:
                return list(result.data)  # type: ignore[arg-type]

        except Exception as e:
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

            return [
                dict(p) for p in posts_data if p["id"] not in scored_ids
            ]

        except Exception as e:
            logger.error("Failed to get unscored posts: %s", e)
            return []
