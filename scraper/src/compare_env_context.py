"""Collect per-environment scoring context for prod vs dev comparison (read-only)."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Literal

from supabase import Client

from src.llm_prompts import SCORING_DIMENSIONS
from src.llm_scorer import PostScore
from src.novelty import COLD_START_THRESHOLD, calculate_novelty
from src.ranking_common import (
    DEFAULT_RANKING_WEIGHTS,
    calculate_final_score,
    count_llm_scores,
    get_active_weight_config_id,
    load_novelty_config,
    load_topic_frequencies,
    load_weight_config,
)
from src.tuning_posts_lib import _fetch_by_slug, _fetch_by_uuid

__all__ = [
    "body_content_fingerprint",
    "collect_env_snapshot",
    "explain_final_score",
    "few_shot_fingerprint",
    "resolve_post_row",
]

_FALLBACK_NOVELTY: dict[str, Any] = {
    "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
    "max_multiplier": 1.5,
    "min_multiplier": 0.2,
    "window_days": 30,
}


def body_content_fingerprint(text: Any, comments: Any) -> str:
    """SHA-256 of canonical JSON for post body fields (for cross-env parity)."""
    payload = {
        "comments": comments if comments is not None else None,
        "text": text if isinstance(text, str) else (text or ""),
    }
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def few_shot_fingerprint(raw: Any) -> dict[str, Any]:
    """Hash and example count for settings.scoring_few_shot (no full dump)."""
    if raw is None:
        return {"example_count": 0, "present": False, "sha256": None}
    if isinstance(raw, dict):
        examples = raw.get("examples")
        count = len(examples) if isinstance(examples, list) else 0
        canonical = json.dumps(raw, sort_keys=True, default=str)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return {"example_count": count, "present": True, "sha256": digest}
    canonical = json.dumps(raw, sort_keys=True, default=str)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {"example_count": 0, "present": True, "sha256": digest}


def _load_scoring_few_shot_raw(supabase: Client) -> Any:
    result = (
        supabase.table("settings")
        .select("value")
        .eq("key", "scoring_few_shot")
        .limit(1)
        .execute()
    )
    rows = result.data if isinstance(result.data, list) else []
    if not rows:
        return None
    row = rows[0]
    if isinstance(row, dict):
        return row.get("value")
    return None


def collect_env_snapshot(
    supabase: Client,
    *,
    label: str,
    claude_model: str,
    prompt_version: str,
    ensemble_runs: int,
) -> dict[str, Any]:
    """Load weights, novelty, counts, and few-shot fingerprint for one Supabase project."""
    active_id = get_active_weight_config_id(supabase)
    weights: dict[str, float]
    weights_error: str | None = None

    if active_id:
        try:
            weights = load_weight_config(supabase, active_id)
        except ValueError as e:
            weights_error = str(e)
            weights = dict(DEFAULT_RANKING_WEIGHTS)
    else:
        weights = dict(DEFAULT_RANKING_WEIGHTS)

    novelty_config = load_novelty_config(supabase)
    if not novelty_config:
        novelty_config = dict(_FALLBACK_NOVELTY)

    scored_count = count_llm_scores(supabase)
    few_raw = _load_scoring_few_shot_raw(supabase)
    few_fp = few_shot_fingerprint(few_raw)

    return {
        "active_weight_config_id": active_id,
        "ensemble_runs": ensemble_runs,
        "few_shot": few_fp,
        "few_shot_raw": few_raw,
        "label": label,
        "llm_scores_count": scored_count,
        "llm_scores_cold_start": scored_count < COLD_START_THRESHOLD,
        "model": {"claude": claude_model, "prompt_version": prompt_version},
        "novelty_config": novelty_config,
        "weights": dict(sorted(weights.items(), key=lambda kv: kv[0])),
        "weights_error": weights_error,
    }


def resolve_post_row(
    supabase: Client, ref: tuple[Literal["slug", "uuid"], str]
) -> dict[str, Any] | None:
    """Return first matching post row for slug or UUID, or None."""
    kind, val = ref
    if kind == "uuid":
        rows = _fetch_by_uuid(supabase, val)
    else:
        rows = _fetch_by_slug(supabase, val)
    if not rows:
        return None
    return dict(rows[0])


def explain_final_score(
    supabase: Client,
    post_score: PostScore,
) -> dict[str, Any]:
    """Recompute novelty and final_score for sanity check vs PostScore.final_score."""
    if post_score.error or not post_score.scores:
        return {
            "final_score_check": None,
            "matches_post_score": None,
            "novelty": None,
        }

    active_id = get_active_weight_config_id(supabase)
    if not active_id:
        weights = dict(DEFAULT_RANKING_WEIGHTS)
    else:
        try:
            weights = load_weight_config(supabase, active_id)
        except ValueError:
            weights = dict(DEFAULT_RANKING_WEIGHTS)

    novelty_config = load_novelty_config(supabase)
    frequencies = load_topic_frequencies(supabase)
    total = count_llm_scores(supabase)

    novelty = calculate_novelty(
        post_score.categories,
        frequencies,
        novelty_config,
        total_scored_count=total,
    )
    check = calculate_final_score(post_score.scores, weights, novelty)
    final_stored = post_score.final_score
    matches = (
        final_stored is not None and abs(float(check) - float(final_stored)) < 1e-6
    )

    return {
        "final_score_check": round(check, 4),
        "matches_post_score": matches,
        "novelty": round(novelty, 4),
    }


def dimension_keys() -> list[str]:
    """Stable dimension order for reporting."""
    return list(SCORING_DIMENSIONS.keys())
