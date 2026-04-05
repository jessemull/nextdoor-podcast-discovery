"""Tests for novelty multiplier calculation (edge cases)."""

from typing import Any

import pytest

from src.novelty import COLD_START_THRESHOLD, calculate_novelty


@pytest.fixture
def base_config() -> dict[str, Any]:
    """Standard novelty config matching production-shaped thresholds."""
    return {
        "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
        "max_multiplier": 1.5,
        "min_multiplier": 0.2,
    }


def test_interpolates_between_rare_and_common(base_config: dict[str, Any]) -> None:
    """Should linearly interpolate between max_multiplier and 1.0 in the mid band."""
    categories = ["a", "b"]
    frequencies = {"a": 0, "b": 35}
    # Average freq 17.5 is midpoint between rare=5 and common=30 -> multiplier midpoint 1.25

    result = calculate_novelty(
        categories,
        frequencies,
        base_config,
        total_scored_count=100,
    )

    assert abs(result - 1.25) < 0.001


def test_multi_category_averages_frequencies(base_config: dict[str, Any]) -> None:
    """Should average counts across categories before mapping to multiplier."""
    categories = ["a", "b"]
    frequencies = {"a": 0, "b": 10}

    result = calculate_novelty(
        categories,
        frequencies,
        base_config,
        total_scored_count=100,
    )

    assert result == base_config["max_multiplier"]


def test_total_scored_count_at_threshold_uses_frequencies(
    base_config: dict[str, Any],
) -> None:
    """Should apply frequency logic when total_scored_count equals threshold."""
    categories = ["pets"]
    frequencies = {"pets": 200}

    result = calculate_novelty(
        categories,
        frequencies,
        base_config,
        total_scored_count=COLD_START_THRESHOLD,
    )

    assert result == base_config["min_multiplier"]


def test_total_scored_count_below_threshold_returns_neutral(
    base_config: dict[str, Any],
) -> None:
    """Should return 1.0 when total_scored_count is below COLD_START_THRESHOLD."""
    categories = ["pets"]
    frequencies = {"pets": 200}

    result = calculate_novelty(
        categories,
        frequencies,
        base_config,
        total_scored_count=COLD_START_THRESHOLD - 1,
    )

    assert result == 1.0
