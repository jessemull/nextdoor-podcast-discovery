"""Tests for tune_ranking_weights optimizer (no Supabase)."""

import random

from src.llm_prompts import SCORING_DIMENSIONS
from src.tune_ranking_weights import (
    _evaluate_weights,
    _initial_full_weights,
    _optimize,
)

_DIMS = sorted(SCORING_DIMENSIONS.keys())


def _flat_scores(v: float) -> dict[str, float]:
    return {k: v for k in _DIMS}


def test_optimize_raises_margin_for_podcast_heavy_examples() -> None:
    """Optimized weights should increase example mean vs flat sample (margin)."""
    example_rows = [
        {
            "categories": [],
            "post_id": "e1",
            "scores": {**_flat_scores(5.0), "podcast_worthy": 9.0},
        },
        {
            "categories": [],
            "post_id": "e2",
            "scores": {**_flat_scores(5.0), "podcast_worthy": 10.0},
        },
    ]
    sample_rows = [
        {"categories": [], "post_id": "s1", "scores": _flat_scores(5.0)},
        {"categories": [], "post_id": "s2", "scores": _flat_scores(5.0)},
    ]
    frequencies: dict[str, int] = {}
    novelty_config = {
        "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
        "max_multiplier": 1.5,
        "min_multiplier": 0.2,
        "window_days": 30,
    }
    total = 100

    w0 = _initial_full_weights({k: 1.0 for k in _DIMS})
    base_obj, b_mex, b_msm, _ = _evaluate_weights(
        w0,
        example_rows,
        sample_rows,
        frequencies,
        novelty_config,
        total,
        examples_only=False,
        min_example_floor=None,
    )

    rng = random.Random(42)
    best_w, opt_obj, a_mex, a_msm, _ = _optimize(
        w0,
        example_rows,
        sample_rows,
        frequencies,
        novelty_config,
        total,
        rng=rng,
        n_random=2000,
        examples_only=False,
        min_example_floor=None,
        min_weight_per_dim=0.0,
    )

    assert opt_obj >= base_obj
    assert a_mex - a_msm >= b_mex - b_msm - 1e-6
    assert best_w["podcast_worthy"] >= w0["podcast_worthy"]


def test_min_example_floor_penalizes_low_tail() -> None:
    """Floor should reduce objective when an example scores very low."""
    rows = [
        {"categories": [], "post_id": "e1", "scores": _flat_scores(2.0)},
    ]
    frequencies: dict[str, int] = {}
    novelty_config = {
        "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
        "max_multiplier": 1.5,
        "min_multiplier": 0.2,
        "window_days": 30,
    }
    w = _initial_full_weights({k: 1.0 for k in _DIMS})
    obj_no_floor, _, _, _ = _evaluate_weights(
        w,
        rows,
        [],
        frequencies,
        novelty_config,
        100,
        examples_only=True,
        min_example_floor=None,
    )
    obj_floor, _, _, _ = _evaluate_weights(
        w,
        rows,
        [],
        frequencies,
        novelty_config,
        100,
        examples_only=True,
        min_example_floor=8.0,
    )
    assert obj_floor < obj_no_floor


def test_optimize_respects_min_weight_per_dimension() -> None:
    """With min_weight_per_dim > 0, no dimension should collapse to zero."""
    example_rows = [
        {
            "categories": [],
            "post_id": "e1",
            "scores": {**_flat_scores(5.0), "drama": 9.0},
        },
    ]
    sample_rows = [
        {"categories": [], "post_id": "s1", "scores": _flat_scores(5.0)},
    ]
    frequencies: dict[str, int] = {}
    novelty_config = {
        "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
        "max_multiplier": 1.5,
        "min_multiplier": 0.2,
        "window_days": 30,
    }
    w0 = _initial_full_weights({k: 1.0 for k in _DIMS})
    rng = random.Random(0)
    best_w, _, _, _, _ = _optimize(
        w0,
        example_rows,
        sample_rows,
        frequencies,
        novelty_config,
        100,
        rng=rng,
        n_random=500,
        examples_only=False,
        min_example_floor=None,
        min_weight_per_dim=0.2,
    )
    for k in _DIMS:
        assert best_w[k] >= 0.199, k


def test_novelty_neutral_ignores_frequency_penalty() -> None:
    """--no-novelty path should use multiplier 1.0 even when topic is very common."""
    row = {
        "categories": ["crime"],
        "post_id": "e1",
        "scores": {**_flat_scores(5.0), "drama": 10.0},
    }
    w = {k: 0.0 for k in _DIMS}
    w["drama"] = 1.0
    frequencies = {"crime": 200}
    novelty_config = {
        "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
        "max_multiplier": 1.5,
        "min_multiplier": 0.2,
        "window_days": 30,
    }
    total = 100
    _, mean_neutral, _, _ = _evaluate_weights(
        w,
        [row],
        [],
        frequencies,
        novelty_config,
        total,
        examples_only=True,
        min_example_floor=None,
        novelty_neutral=True,
    )
    _, mean_penalized, _, _ = _evaluate_weights(
        w,
        [row],
        [],
        frequencies,
        novelty_config,
        total,
        examples_only=True,
        min_example_floor=None,
        novelty_neutral=False,
    )
    assert mean_neutral > mean_penalized
    assert abs(mean_neutral - 10.0) < 1e-6
    assert abs(mean_penalized - 2.0) < 1e-6
