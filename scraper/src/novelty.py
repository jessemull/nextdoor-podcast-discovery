"""Shared novelty calculation for ranking diversity.

Used by LLMScorer (scoring pipeline) and the background worker (recompute jobs)
so topic frequency logic lives in one place.
"""

__all__ = ["COLD_START_THRESHOLD", "calculate_novelty"]

from typing import Any

# When total scored posts is below this, use multiplier 1.0 to avoid boosting
# all early posts before topic frequencies are meaningful.
COLD_START_THRESHOLD = 30


def calculate_novelty(
    categories: list[str],
    frequencies: dict[str, int],
    config: dict[str, Any],
    total_scored_count: int | None = None,
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

    Cold start: When topic_frequencies is empty or total scored posts < N,
    return 1.0 (neutral) to avoid boosting all early posts.

    Args:
        categories: List of topic categories for this post.
        frequencies: Dict of category -> count_30d.
        config: Novelty configuration (min_multiplier, max_multiplier,
            frequency_thresholds with rare, common, very_common).
        total_scored_count: Total number of scored posts (llm_scores count).
            When provided and < COLD_START_THRESHOLD, returns 1.0.

    Returns:
        Novelty multiplier (0.2 to 1.5).
    """
    if not categories:
        return 1.0  # Default: no adjustment

    if not frequencies:
        return 1.0  # Cold start: no frequency data, use neutral multiplier

    if total_scored_count is not None and total_scored_count < COLD_START_THRESHOLD:
        return 1.0  # Cold start: too few scored posts, use neutral multiplier

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
        divisor = common_threshold - rare_threshold
        if divisor <= 0:
            return 1.0  # Invalid config, use neutral multiplier
        ratio = (avg_freq - rare_threshold) / divisor
        return float(max_mult - (ratio * (max_mult - 1.0)))
    elif avg_freq <= very_common_threshold:
        # Linear interpolation between 1.0 and min
        divisor = very_common_threshold - common_threshold
        if divisor <= 0:
            return float(min_mult)  # Invalid config, use min
        ratio = (avg_freq - common_threshold) / divisor
        return float(1.0 - (ratio * (1.0 - min_mult)))
    else:
        return float(min_mult)  # Very common: penalize
