"""Build LLM scoring few-shot block from settings.scoring_few_shot (Admin UI only).

No hardcoded threads. Missing or invalid config raises ConfigurationError.
"""

from __future__ import annotations

import json
from typing import Any, cast

from supabase import Client

from src.exceptions import ConfigurationError
from src.llm_prompts import (
    SCORING_DIMENSIONS,
    TOPIC_CATEGORIES,
    build_post_text_for_scoring,
)

SETTINGS_KEY = "scoring_few_shot"
MAX_EXAMPLES = 6

__all__ = [
    "MAX_EXAMPLES",
    "SETTINGS_KEY",
    "build_scoring_few_shot_block",
]

_DIM_KEYS = frozenset(SCORING_DIMENSIONS.keys())
_ALLOWED_CATS = frozenset(TOPIC_CATEGORIES)


def _validate_ideal(ideal: Any) -> dict[str, Any]:
    if not isinstance(ideal, dict):
        raise ConfigurationError(
            "scoring_few_shot: each example's ideal must be an object. "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    scores = ideal.get("scores")
    if not isinstance(scores, dict):
        raise ConfigurationError(
            "scoring_few_shot: ideal.scores must be an object. "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    for dim in _DIM_KEYS:
        if dim not in scores:
            raise ConfigurationError(
                f"scoring_few_shot: ideal.scores missing {dim!r}. "
                "Configure in Admin → Settings → Scoring few-shot."
            )
        v = scores[dim]
        if not isinstance(v, (int, float)) or not (1 <= float(v) <= 10):
            raise ConfigurationError(
                f"scoring_few_shot: ideal.scores.{dim} must be 1–10. "
                "Configure in Admin → Settings → Scoring few-shot."
            )
    cats = ideal.get("categories")
    if not isinstance(cats, list):
        raise ConfigurationError(
            "scoring_few_shot: ideal.categories must be an array. "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    for c in cats:
        if not isinstance(c, str) or c not in _ALLOWED_CATS:
            raise ConfigurationError(
                f"scoring_few_shot: invalid category {c!r}. "
                "Configure in Admin → Settings → Scoring few-shot."
            )
    if len(cats) < 1 or len(cats) > 3:
        raise ConfigurationError(
            "scoring_few_shot: ideal.categories must have 1–3 items. "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    summary = ideal.get("summary")
    if not isinstance(summary, str):
        raise ConfigurationError(
            "scoring_few_shot: ideal.summary must be a string. "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    why = ideal.get("why_podcast_worthy")
    if not isinstance(why, str):
        raise ConfigurationError(
            "scoring_few_shot: ideal.why_podcast_worthy must be a string. "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    return cast(dict[str, Any], ideal)


def _load_raw_config(supabase: Client) -> dict[str, Any]:
    result = (
        supabase.table("settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .limit(1)
        .execute()
    )
    rows = result.data if isinstance(result.data, list) else []
    if not rows:
        raise ConfigurationError(
            f"Missing settings.{SETTINGS_KEY}. "
            "Configure scoring few-shot in Admin → Settings (intro + examples)."
        )
    row = rows[0]
    if not isinstance(row, dict):
        raise ConfigurationError(
            f"Invalid settings.{SETTINGS_KEY} row. "
            "Configure scoring few-shot in Admin → Settings."
        )
    value = row.get("value")
    if not isinstance(value, dict):
        raise ConfigurationError(
            f"settings.{SETTINGS_KEY} must be a JSON object. "
            "Configure scoring few-shot in Admin → Settings."
        )
    return cast(dict[str, Any], value)


def build_scoring_few_shot_block(supabase: Client) -> str:
    """Load calibration from DB and format the prompt block. Raises ConfigurationError if invalid."""
    raw = _load_raw_config(supabase)
    intro = raw.get("intro")
    if not isinstance(intro, str) or not intro.strip():
        raise ConfigurationError(
            "scoring_few_shot.intro is required (non-empty string). "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    examples = raw.get("examples")
    if not isinstance(examples, list) or len(examples) == 0:
        raise ConfigurationError(
            "scoring_few_shot.examples must be a non-empty array. "
            "Configure in Admin → Settings → Scoring few-shot."
        )
    if len(examples) > MAX_EXAMPLES:
        raise ConfigurationError(
            f"scoring_few_shot: at most {MAX_EXAMPLES} examples allowed. "
            "Configure in Admin → Settings → Scoring few-shot."
        )

    chunks: list[str] = []
    for i, ex in enumerate(examples, 1):
        if not isinstance(ex, dict):
            raise ConfigurationError(
                "scoring_few_shot.examples[] entries must be objects. "
                "Configure in Admin → Settings → Scoring few-shot."
            )
        post_id = ex.get("post_id")
        if not isinstance(post_id, str) or not post_id.strip():
            raise ConfigurationError(
                "scoring_few_shot: each example needs post_id (string). "
                "Configure in Admin → Settings → Scoring few-shot."
            )
        ideal = _validate_ideal(ex.get("ideal"))

        post_result = (
            supabase.table("posts")
            .select("id, text, comments, url, post_id_ext")
            .eq("id", post_id.strip())
            .limit(1)
            .execute()
        )
        post_rows = cast(list[dict[str, Any]], post_result.data or [])
        if not post_rows:
            raise ConfigurationError(
                f"scoring_few_shot: post_id {post_id!r} not found. "
                "Configure in Admin → Settings → Scoring few-shot."
            )
        post = post_rows[0]
        thread = build_post_text_for_scoring(post)
        ideal_payload = {
            "categories": ideal["categories"],
            "scores": {k: ideal["scores"][k] for k in sorted(_DIM_KEYS)},
            "summary": ideal["summary"],
            "why_podcast_worthy": ideal["why_podcast_worthy"],
        }
        ideal_json = json.dumps(ideal_payload, ensure_ascii=True)
        chunks.append(
            f"=== Reference example {i} (calibration only—not a post to score) ===\n"
            f"Thread:\n---\n{thread}\n---\n"
            f"Illustrative model output for this thread (match relative levels):\n"
            f"{ideal_json}"
        )

    body = "\n\n".join(chunks)
    return intro.strip() + "\n\n" + body
