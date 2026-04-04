"""Shared ranking math and Supabase loaders for weights, novelty, and frequencies.

Used by the background worker and tune_ranking_weights so final_score matches recompute.
"""

from __future__ import annotations

import logging
from typing import Any, cast

from supabase import Client

from src.config import log_supabase_error
from src.llm_prompts import SCORING_DIMENSIONS

__all__ = [
    "DEFAULT_RANKING_WEIGHTS",
    "calculate_final_score",
    "count_llm_scores",
    "get_active_weight_config_id",
    "load_novelty_config",
    "load_topic_frequencies",
    "load_weight_config",
]

logger = logging.getLogger(__name__)

DEFAULT_RANKING_WEIGHTS: dict[str, float] = {
    "absurdity": 2.5,
    "discussion_spark": 1.0,
    "drama": 1.5,
    "emotional_intensity": 1.2,
    "news_value": 1.0,
    "podcast_worthy": 2.5,
    "readability": 1.2,
}


def calculate_final_score(
    scores: dict[str, float],
    weights: dict[str, float],
    novelty: float,
) -> float:
    """Calculate final score using weights and novelty (same as worker recompute)."""
    weighted_sum = sum(scores.get(dim, 5.0) * w for dim, w in weights.items())
    max_possible = sum(10 * w for w in weights.values())
    if max_possible == 0:
        return 0.0

    normalized = (weighted_sum / max_possible) * 10

    raw_score = normalized * novelty
    return min(10.0, max(0.0, raw_score))


def load_weight_config(supabase: Client, weight_config_id: str) -> dict[str, float]:
    """Load ranking weights from a weight config row."""
    result = (
        supabase.table("weight_configs")
        .select("weights")
        .eq("id", weight_config_id)
        .single()
        .execute()
    )

    if not result.data:
        raise ValueError(f"Weight config {weight_config_id} not found")

    weights_data = result.data.get("weights", {})  # type: ignore[union-attr]
    if not isinstance(weights_data, dict):
        raise ValueError(f"Invalid weights format in config {weight_config_id}")

    weights: dict[str, float] = {
        k: float(v) for k, v in weights_data.items() if isinstance(v, (int, float))
    }

    if not weights:
        raise ValueError(f"No valid weights found in config {weight_config_id}")

    known = {k: v for k, v in weights.items() if k in SCORING_DIMENSIONS}
    if len(known) < len(weights):
        dropped = set(weights) - set(SCORING_DIMENSIONS)
        logger.warning("Dropping unknown weight dimensions: %s", dropped)
        weights = known

    return weights


def load_novelty_config(supabase: Client) -> dict[str, Any]:
    """Load novelty configuration from settings."""
    result = (
        supabase.table("settings")
        .select("value")
        .eq("key", "novelty_config")
        .limit(1)
        .execute()
    )

    novelty_config: dict[str, Any] = {}
    rows = result.data if isinstance(result.data, list) else []
    if rows:
        row = rows[0]
        value = row.get("value", {}) if isinstance(row, dict) else {}
        if isinstance(value, dict):
            novelty_config = value

    if not novelty_config:
        novelty_config = {
            "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
            "max_multiplier": 1.5,
            "min_multiplier": 0.2,
            "window_days": 30,
        }

    return novelty_config


def load_topic_frequencies(supabase: Client) -> dict[str, int]:
    """Load topic frequency counts from the database."""
    result = supabase.table("topic_frequencies").select("category, count_30d").execute()

    frequencies: dict[str, int] = {}
    rows = cast(list[dict[str, Any]], result.data or [])
    for row in rows:
        category = row.get("category")
        count = row.get("count_30d", 0)
        if isinstance(category, str) and isinstance(count, (int, float)):
            frequencies[category] = int(count)

    return frequencies


def get_active_weight_config_id(supabase: Client) -> str | None:
    """Resolve active weight config UUID (settings key or is_active fallback)."""
    try:
        result = (
            supabase.table("settings")
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
        config_result = (
            supabase.table("weight_configs")
            .select("id")
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        config_rows = config_result.data if isinstance(config_result.data, list) else []
        if config_rows:
            cfg_row = config_rows[0]
            if isinstance(cfg_row, dict):
                return cast("str | None", cfg_row.get("id"))
    except Exception as e:
        log_supabase_error("Failed to load active_weight_config_id", e)
    return None


def count_llm_scores(supabase: Client) -> int:
    """Exact count of llm_scores rows (for novelty cold-start)."""
    try:
        result = (
            supabase.table("llm_scores")
            .select("id", count=cast(Any, "exact"))
            .execute()
        )
        return int(result.count) if result.count is not None else 0
    except Exception as e:
        log_supabase_error("Failed to count llm_scores", e)
        return 0
