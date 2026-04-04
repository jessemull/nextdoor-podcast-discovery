"""Supabase reads/writes for LLMScorer (weights, frequencies, persistence)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, cast

from supabase import Client

from src.config import log_supabase_error
from src.llm_score_result import PostScore

logger = logging.getLogger(__name__)


class LLMScorerDataHelper:
    """Caches settings-backed config and performs topic / score persistence."""

    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self._weights: dict[str, float] | None = None
        self._novelty_config: dict[str, Any] | None = None

    def get_active_weight_config_id(self) -> str | None:
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

    def get_novelty_config(self) -> dict[str, Any]:
        """Load novelty configuration from settings."""
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

    def get_scored_count(self) -> int | None:
        """Get count of existing scored posts for cold-start novelty check."""
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

    def get_topic_frequencies(self) -> dict[str, int]:
        """Load current topic frequencies from database."""
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
        """Get posts that haven't been scored yet, oldest first."""
        try:
            result = self.supabase.rpc(
                "get_unscored_posts",
                {"p_limit": limit},
            ).execute()

            if result.data:
                return list(result.data)  # type: ignore[arg-type]

        except Exception as e:
            logger.debug(
                "RPC get_unscored_posts failed (p_limit=%d), using fallback: %s",
                limit,
                e,
            )

        try:
            posts_result = (
                self.supabase.table("posts")
                .select("id, text, comments")
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )

            posts_data = cast(list[dict[str, Any]], posts_result.data)
            if not posts_data:
                return []

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
            logger.error(
                "Failed to get unscored posts (fallback query, limit=%d): %s (%s)",
                limit,
                e,
                type(e).__name__,
            )
            return []

    def get_weights(self) -> dict[str, float]:
        """Load ranking weights from settings."""
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

        # Default weights (must match DB/bootstrap and web DEFAULT_PREVIEW_WEIGHTS)

        self._weights = {
            "absurdity": 2.5,
            "discussion_spark": 1.0,
            "drama": 1.5,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
            "podcast_worthy": 2.5,
            "readability": 1.2,
        }

        return self._weights

    def update_topic_frequencies(self, results: list[PostScore]) -> None:
        """Update topic frequency counts."""
        category_counts: dict[str, int] = {}

        for result in results:
            if result.error:
                continue

            for cat in result.categories:
                category_counts[cat] = category_counts.get(cat, 0) + 1

        if not category_counts:
            return

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
