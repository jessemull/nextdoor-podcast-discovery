"""Optimize weight_configs.weights to lift example posts' final_score.

Uses the same final_score formula as the recompute worker (ranking_common + novelty).

Use --no-novelty to optimize with novelty multiplier fixed at 1.0 (matches production
when novelty min/max are both 1; ignores topic_frequencies for the objective).

Environment: SUPABASE_URL, SUPABASE_SERVICE_KEY only.

Pass --examples-file with newline-separated post UUIDs and/or Nextdoor /p/ URLs.

After --apply, enqueue recompute_final_scores (admin API or worker) so post_scores refresh.
LLM calibration is configured only in Admin → Settings → Scoring few-shot.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import random
import sys
from pathlib import Path
from typing import Any, cast

from dotenv import load_dotenv
from supabase import Client, create_client

from src.exceptions import ConfigurationError
from src.llm_prompts import SCORING_DIMENSIONS
from src.novelty import calculate_novelty
from src.ranking_common import (
    DEFAULT_RANKING_WEIGHTS,
    calculate_final_score,
    count_llm_scores,
    get_active_weight_config_id,
    load_novelty_config,
    load_topic_frequencies,
    load_weight_config,
)
from src.tuning_posts_lib import (
    load_tuning_lines,
    resolve_tuning_file_path,
    resolve_tuning_posts,
)

logger = logging.getLogger(__name__)

_DIM_KEYS = tuple(sorted(SCORING_DIMENSIONS.keys()))


def _validate_env() -> None:
    missing = [
        k for k in ("SUPABASE_SERVICE_KEY", "SUPABASE_URL") if not os.environ.get(k)
    ]
    if missing:
        raise ConfigurationError(
            f"Missing environment variables: {', '.join(sorted(missing))}"
        )


def _coerce_scores(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, float] = {}
    for k, v in raw.items():
        if isinstance(k, str) and isinstance(v, (int, float)):
            out[k] = float(v)
    return out


def _final_for_row(
    row: dict[str, Any],
    weights: dict[str, float],
    frequencies: dict[str, int],
    novelty_config: dict[str, Any],
    total_scored_count: int,
    *,
    novelty_neutral: bool = False,
) -> float | None:
    scores = _coerce_scores(row.get("scores"))
    cats = row.get("categories")
    if not isinstance(cats, list):
        return None
    categories = [c for c in cats if isinstance(c, str)]
    if novelty_neutral:
        novelty = 1.0
    else:
        novelty = calculate_novelty(
            categories,
            frequencies,
            novelty_config,
            total_scored_count=total_scored_count,
        )
    return calculate_final_score(scores, weights, novelty)


def _initial_full_weights(loaded: dict[str, float]) -> dict[str, float]:
    return {k: float(loaded.get(k, DEFAULT_RANKING_WEIGHTS[k])) for k in _DIM_KEYS}


def _effective_min_weight_per_dim(
    w0: dict[str, float], requested: float, target_sum: float
) -> float:
    """Clamp requested floor so weights stay feasible and initial w0 stays representable."""
    n = len(_DIM_KEYS)
    if requested <= 0:
        return 0.0
    cap = target_sum / n - 1e-6
    m = min(w0[k] for k in _DIM_KEYS)
    return max(0.0, min(requested, cap, m * 0.999))


def _logits_to_weights(
    logits: list[float],
    target_sum: float,
    min_weight_per_dim: float,
) -> dict[str, float]:
    """Map logits to positive weights summing to target_sum.

    If min_weight_per_dim > 0, each dimension gets at least that floor and the
    remainder is split by softmax(logits). This prevents degenerate solutions
    that put all weight on one axis (e.g. only drama) to game the margin.
    """
    n = len(_DIM_KEYS)
    exps = [math.exp(min(20.0, max(-20.0, x))) for x in logits]
    s_exp = sum(exps)

    if min_weight_per_dim <= 0:
        if s_exp <= 0:
            return {k: DEFAULT_RANKING_WEIGHTS[k] for k in _DIM_KEYS}
        return {k: exps[i] / s_exp * target_sum for i, k in enumerate(_DIM_KEYS)}

    remaining = target_sum - min_weight_per_dim * n
    if remaining <= 0:
        return {k: target_sum / n for k in _DIM_KEYS}

    if s_exp <= 0:
        shares = [1.0 / n] * n
    else:
        shares = [e / s_exp for e in exps]
    return {
        k: min_weight_per_dim + remaining * shares[i] for i, k in enumerate(_DIM_KEYS)
    }


def _logits_initial_from_w0(
    w0: dict[str, float], target_sum: float, min_weight_per_dim: float
) -> list[float]:
    """Logits so the first _logits_to_weights matches w0 (when feasible)."""
    if min_weight_per_dim <= 0:
        return [math.log(max(w0[k], 1e-6)) for k in _DIM_KEYS]

    n = len(_DIM_KEYS)
    remaining = target_sum - min_weight_per_dim * n
    raw_shares = [
        max((w0[k] - min_weight_per_dim) / remaining, 1e-9) for k in _DIM_KEYS
    ]
    s0 = sum(raw_shares)
    shares = [x / s0 for x in raw_shares]
    return [math.log(x) for x in shares]


def _reservoir_sample_llm_scores(
    supabase: Client,
    exclude: set[str],
    n: int,
    rng: random.Random,
) -> list[dict[str, Any]]:
    reservoir: list[dict[str, Any]] = []
    seen_eligible = 0
    page = 0
    page_size = 400
    while True:
        batch_result = (
            supabase.table("llm_scores")
            .select("post_id, scores, categories")
            .order("id")
            .range(page * page_size, page * page_size + page_size - 1)
            .execute()
        )
        rows = cast(list[dict[str, Any]], batch_result.data or [])
        if not rows:
            break
        for row in rows:
            pid = str(row.get("post_id", ""))
            if not pid or pid in exclude:
                continue
            seen_eligible += 1
            if len(reservoir) < n:
                reservoir.append(row)
            else:
                j = rng.randint(1, seen_eligible)
                if j <= n:
                    reservoir[j - 1] = row
        page += 1
        if len(rows) < page_size:
            break
    return reservoir


def _fetch_example_rows(supabase: Client, post_ids: list[str]) -> list[dict[str, Any]]:
    if not post_ids:
        return []
    r = (
        supabase.table("llm_scores")
        .select("post_id, scores, categories")
        .in_("post_id", post_ids)
        .execute()
    )
    return cast(list[dict[str, Any]], r.data or [])


def _evaluate_weights(
    weights: dict[str, float],
    example_rows: list[dict[str, Any]],
    sample_rows: list[dict[str, Any]],
    frequencies: dict[str, int],
    novelty_config: dict[str, Any],
    total_scored_count: int,
    *,
    examples_only: bool,
    min_example_floor: float | None,
    novelty_neutral: bool = False,
) -> tuple[float, float, float, float]:
    """Return (objective, mean_ex, mean_sample, min_ex)."""
    ex_vals: list[float] = []
    for row in example_rows:
        f = _final_for_row(
            row,
            weights,
            frequencies,
            novelty_config,
            total_scored_count,
            novelty_neutral=novelty_neutral,
        )
        if f is not None:
            ex_vals.append(f)
    if not ex_vals:
        return -1e9, 0.0, 0.0, 0.0

    mean_ex = sum(ex_vals) / len(ex_vals)
    min_ex = min(ex_vals)

    sm_vals: list[float] = []
    for row in sample_rows:
        f = _final_for_row(
            row,
            weights,
            frequencies,
            novelty_config,
            total_scored_count,
            novelty_neutral=novelty_neutral,
        )
        if f is not None:
            sm_vals.append(f)
    mean_sm = sum(sm_vals) / len(sm_vals) if sm_vals else 0.0

    if examples_only or not sm_vals:
        obj = mean_ex
    else:
        obj = mean_ex - mean_sm

    if min_example_floor is not None and min_ex < min_example_floor:
        obj -= 100.0 * (min_example_floor - min_ex)

    return obj, mean_ex, mean_sm, min_ex


def _optimize(
    w0: dict[str, float],
    example_rows: list[dict[str, Any]],
    sample_rows: list[dict[str, Any]],
    frequencies: dict[str, int],
    novelty_config: dict[str, Any],
    total_scored_count: int,
    *,
    rng: random.Random,
    n_random: int,
    examples_only: bool,
    min_example_floor: float | None,
    min_weight_per_dim: float,
    novelty_neutral: bool = False,
) -> tuple[dict[str, float], float, float, float, float]:
    target_sum = sum(w0[k] for k in _DIM_KEYS)
    floor = _effective_min_weight_per_dim(w0, min_weight_per_dim, target_sum)
    logits = _logits_initial_from_w0(w0, target_sum, floor)

    def eval_logits(logit_vec: list[float]) -> tuple[float, float, float, float]:
        w = _logits_to_weights(logit_vec, target_sum, floor)
        return _evaluate_weights(
            w,
            example_rows,
            sample_rows,
            frequencies,
            novelty_config,
            total_scored_count,
            examples_only=examples_only,
            min_example_floor=min_example_floor,
            novelty_neutral=novelty_neutral,
        )

    best_logits = logits[:]
    best_obj, mean_ex, mean_sm, min_ex = eval_logits(best_logits)

    for _ in range(n_random):
        trial = [x + rng.gauss(0, 0.2) for x in logits]
        obj, mex, msm, mne = eval_logits(trial)
        if obj > best_obj:
            best_obj = obj
            best_logits = trial
            mean_ex, mean_sm, min_ex = mex, msm, mne
            logits = trial

    step = 0.15
    for _ in range(80):
        improved = False
        for i in range(len(_DIM_KEYS)):
            for delta in (-step, step):
                trial = best_logits[:]
                trial[i] += delta
                obj, mex, msm, mne = eval_logits(trial)
                if obj > best_obj:
                    best_obj = obj
                    best_logits = trial
                    mean_ex, mean_sm, min_ex = mex, msm, mne
                    improved = True
        if not improved:
            step *= 0.5
            if step < 1e-3:
                break

    best_w = _logits_to_weights(best_logits, target_sum, floor)
    return best_w, best_obj, mean_ex, mean_sm, min_ex


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Optimize ranking weights for example posts (weight_configs)",
    )
    parser.add_argument(
        "--examples-file",
        type=Path,
        required=True,
        metavar="PATH",
        help="Newline file: post UUIDs and/or Nextdoor permalink URLs (lines starting with # ignored)",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=500,
        help="Reservoir sample size of other scored posts (default 500)",
    )
    parser.add_argument(
        "--examples-only",
        action="store_true",
        help="Maximize mean(example final) only (ignore comparison sample)",
    )
    parser.add_argument(
        "--min-example-floor",
        type=float,
        default=None,
        metavar="F",
        help="Penalty if min(example final) is below F",
    )
    parser.add_argument(
        "--trials",
        type=int,
        default=4000,
        help="Random search iterations before coordinate refinement",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="RNG seed for reproducibility",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write optimized weights to active weight_configs row",
    )
    parser.add_argument(
        "--min-weight-per-dim",
        type=float,
        default=0.15,
        metavar="W",
        help=(
            "Minimum weight on each dimension (default 0.15) so the optimizer "
            "cannot collapse to a single axis. Use 0 to allow the old unconstrained "
            "behavior (may yield zeros on podcast_worthy etc.)."
        ),
    )
    parser.add_argument(
        "--no-novelty",
        action="store_true",
        help=(
            "Use novelty multiplier 1.0 for every row (ignore topic_frequencies). "
            "Aligns tuning with production when novelty min/max are both 1."
        ),
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    scraper_dir = Path(__file__).resolve().parent.parent
    load_dotenv(scraper_dir / ".env")

    try:
        _validate_env()
    except ConfigurationError as e:
        print(e, file=sys.stderr)
        return 1

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    supabase = create_client(url, key)

    examples_path = resolve_tuning_file_path(args.examples_file)

    try:
        lines = load_tuning_lines(examples_path)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1

    if not lines:
        print("No non-empty lines in examples file.", file=sys.stderr)
        return 1

    example_posts, issues = resolve_tuning_posts(supabase, lines)
    for msg in issues:
        logger.warning("%s", msg)

    if not example_posts:
        print("Could not resolve any example posts in the database.", file=sys.stderr)
        return 1

    example_ids = [str(p["id"]) for p in example_posts]
    exclude = set(example_ids)

    config_id = get_active_weight_config_id(supabase)
    if not config_id:
        print(
            "No active weight config (settings.active_weight_config_id or "
            "weight_configs.is_active).",
            file=sys.stderr,
        )
        return 1

    try:
        loaded_weights = load_weight_config(supabase, config_id)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1

    w_initial = _initial_full_weights(loaded_weights)
    target_sum_pre = sum(w_initial[k] for k in _DIM_KEYS)
    eff_floor = _effective_min_weight_per_dim(
        w_initial, args.min_weight_per_dim, target_sum_pre
    )
    if args.min_weight_per_dim > 0 and eff_floor > 0:
        logger.info(
            "Using min weight per dimension=%.4f (requested=%.4f) to avoid one-axis collapse",
            eff_floor,
            args.min_weight_per_dim,
        )

    example_rows = _fetch_example_rows(supabase, example_ids)
    found_ids = {str(r["post_id"]) for r in example_rows}
    missing = set(example_ids) - found_ids
    if missing:
        logger.warning(
            "No llm_scores for %d example post(s): %s", len(missing), missing
        )

    if not example_rows:
        print(
            "No llm_scores rows for resolved examples; score posts first.",
            file=sys.stderr,
        )
        return 1

    rng = random.Random(args.seed)
    sample_rows = _reservoir_sample_llm_scores(
        supabase, exclude, max(1, args.sample_size), rng
    )
    if len(sample_rows) < 10 and not args.examples_only:
        logger.warning(
            "Small comparison sample (%d rows); margin objective may be noisy",
            len(sample_rows),
        )

    novelty_neutral = args.no_novelty
    if novelty_neutral:
        logger.info(
            "Objective uses novelty=1.0 for all rows (--no-novelty); "
            "skipping topic_frequencies / novelty_config / llm_scores count load"
        )
        frequencies: dict[str, int] = {}
        novelty_config: dict[str, Any] = {}
        total_scored = 0
    else:
        frequencies = load_topic_frequencies(supabase)
        novelty_config = load_novelty_config(supabase)
        total_scored = count_llm_scores(supabase)

    base_obj, b_mex, b_msm, b_mne = _evaluate_weights(
        w_initial,
        example_rows,
        sample_rows,
        frequencies,
        novelty_config,
        total_scored,
        examples_only=args.examples_only,
        min_example_floor=args.min_example_floor,
        novelty_neutral=novelty_neutral,
    )

    best_w, best_obj, a_mex, a_msm, a_mne = _optimize(
        w_initial,
        example_rows,
        sample_rows,
        frequencies,
        novelty_config,
        total_scored,
        rng=rng,
        n_random=max(1, args.trials),
        examples_only=args.examples_only,
        min_example_floor=args.min_example_floor,
        min_weight_per_dim=args.min_weight_per_dim,
        novelty_neutral=novelty_neutral,
    )

    print("=== Before (active weight_configs) ===")
    print(
        f"objective={base_obj:.4f} mean_example={b_mex:.4f} mean_sample={b_msm:.4f} min_example={b_mne:.4f}"
    )
    print(
        json.dumps(
            {k: round(w_initial[k], 4) for k in _DIM_KEYS}, sort_keys=True, indent=2
        )
    )

    print("=== After (optimized) ===")
    print(
        f"objective={best_obj:.4f} mean_example={a_mex:.4f} mean_sample={a_msm:.4f} min_example={a_mne:.4f}"
    )
    print(
        json.dumps(
            {k: round(best_w[k], 4) for k in _DIM_KEYS}, sort_keys=True, indent=2
        )
    )
    if args.min_weight_per_dim <= 0 and min(best_w.values()) < 1e-6:
        print(
            "\n(Note: some weights are ~0 — the margin objective can collapse to one dimension. "
            "Re-run with default --min-weight-per-dim 0.15 to keep all dimensions in the mix.)"
        )

    print(
        "\nNext: enqueue recompute_final_scores for this config (e.g. POST /api/admin/recompute-scores "
        "with use_active_config: true, or make recompute-scores-once). "
        "Until recompute completes, post_scores.final_score will not match."
    )
    print(
        "LLM calibration is only in Admin → Settings → Scoring few-shot (settings.scoring_few_shot). "
        "Note: scraper may still read settings.ranking_weights for some paths; align that row if you rely on previews."
    )

    if args.apply:
        rounded = {k: float(f"{best_w[k]:.6f}") for k in _DIM_KEYS}
        supabase.table("weight_configs").update({"weights": rounded}).eq(
            "id", config_id
        ).execute()
        print(f"\nApplied weights to weight_configs id={config_id}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
