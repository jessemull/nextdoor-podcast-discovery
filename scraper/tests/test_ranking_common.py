"""Tests for ranking_common (final score + loaders wiring)."""

from src.ranking_common import DEFAULT_RANKING_WEIGHTS, calculate_final_score


def test_calculate_final_score_matches_weighted_normalized_times_novelty() -> None:
    """Should match weighted sum / max_possible * 10 * novelty, clamped."""
    weights = {k: 1.0 for k in DEFAULT_RANKING_WEIGHTS}
    scores = {k: 5.0 for k in DEFAULT_RANKING_WEIGHTS}
    assert calculate_final_score(scores, weights, 1.0) == 5.0

    scores_hi = dict(scores)
    scores_hi["podcast_worthy"] = 10.0
    out = calculate_final_score(scores_hi, weights, 1.0)
    assert 5.0 < out <= 10.0

    assert calculate_final_score(scores, weights, 1.5) == 7.5
    assert calculate_final_score(scores, weights, 0.0) == 0.0


def test_calculate_final_score_zero_max_possible() -> None:
    """Should return 0 when all weights are zero."""
    assert calculate_final_score({"a": 5.0}, {}, 1.0) == 0.0
