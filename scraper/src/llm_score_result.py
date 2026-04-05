"""Post scoring result model and ensemble aggregation helpers."""

from __future__ import annotations

__all__ = ["PostScore", "aggregate_ensemble_results", "strip_json_from_markdown"]

import statistics
from dataclasses import dataclass, field

from src.llm_prompts import MAX_SUMMARY_LENGTH, SCORING_DIMENSIONS, TOPIC_CATEGORIES


def strip_json_from_markdown(text: str) -> str:
    """Try to extract JSON from markdown code blocks (e.g. ```json ... ```)."""
    if not text:
        return ""
    text = text.strip()
    for start in ("```json", "```"):
        if text.startswith(start):
            text = text[len(start) :].strip()
            if text.endswith("```"):
                text = text[:-3].strip()
            return text
    return text


def aggregate_ensemble_results(
    run_results: list[list[PostScore]],
) -> list[PostScore]:
    """Aggregate multiple scoring runs into one result per post.

    Uses median per dimension, majority vote for categories, and picks
    summary/why from the run whose podcast_worthy is closest to median.
    """
    if not run_results:
        return []

    num_posts = len(run_results[0])
    aggregated: list[PostScore] = []

    for post_idx in range(num_posts):
        post_id = run_results[0][post_idx].post_id
        runs_for_post = [run[post_idx] for run in run_results]

        # Skip runs with errors
        valid_runs = [r for r in runs_for_post if not r.error and r.scores]

        if not valid_runs:
            err_run = runs_for_post[0]
            aggregated.append(
                PostScore(
                    post_id=post_id,
                    scores={},
                    categories=[],
                    summary="",
                    error=err_run.error or "No valid runs",
                )
            )
            continue

        # Median per dimension
        aggregated_scores: dict[str, float] = {}
        for dim in SCORING_DIMENSIONS:
            # Missing dimension defaults to 5.0; see docs on new dimension backfill
            values = [
                r.scores.get(dim, 5.0)
                for r in valid_runs
                if isinstance(r.scores.get(dim), (int, float))
            ]
            if values:
                med = statistics.median(values)
                aggregated_scores[dim] = min(10.0, max(1.0, float(med)))
            else:
                aggregated_scores[dim] = 5.0

        # Majority vote for categories
        cat_counts: dict[str, int] = {}
        for r in valid_runs:
            for c in r.categories:
                if c in TOPIC_CATEGORIES:
                    cat_counts[c] = cat_counts.get(c, 0) + 1
        sorted_cats = sorted(
            cat_counts.items(),
            key=lambda x: (-x[1], x[0]),
        )
        categories = [c for c, _ in sorted_cats[:3]]

        # Summary and why_podcast_worthy from run closest to median podcast_worthy
        # Missing podcast_worthy defaults to 5.0; see docs on new dimension backfill
        median_pw = statistics.median(
            r.scores.get("podcast_worthy", 5.0) for r in valid_runs
        )
        best_run = min(
            valid_runs,
            key=lambda r: abs(r.scores.get("podcast_worthy", 5.0) - median_pw),
        )
        summary = (best_run.summary or "")[:MAX_SUMMARY_LENGTH]
        why_podcast_worthy = (best_run.why_podcast_worthy or "")[
            :MAX_SUMMARY_LENGTH
        ].strip() or None

        aggregated.append(
            PostScore(
                post_id=post_id,
                scores=aggregated_scores,
                categories=categories,
                summary=summary,
                why_podcast_worthy=why_podcast_worthy,
            )
        )

    return aggregated


@dataclass
class PostScore:
    """Scoring result for a single post."""

    post_id: str
    scores: dict[str, float]
    categories: list[str]
    summary: str

    # Computed after applying weights and novelty

    final_score: float | None = None

    # Podcast-worthiness (LLM-generated)

    why_podcast_worthy: str | None = None

    # Metadata

    error: str | None = None
    raw_response: str | None = field(default=None, repr=False)
