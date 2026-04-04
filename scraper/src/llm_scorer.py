"""LLM scoring for Nextdoor posts using Claude Haiku."""

__all__ = [
    "LLMScorer",
    "PostScore",
    "SCORING_DIMENSIONS",
    "_aggregate_ensemble_results",
]

import logging
from typing import Any

from anthropic import Anthropic
from supabase import Client
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import (
    CLAUDE_MODEL,
    ENSEMBLE_RUNS,
    ENSEMBLE_TEMPERATURE,
    log_supabase_error,
)
from src.llm_prompts import (
    BATCH_SIZE,
    PROMPT_VERSION,
    SCORING_DIMENSIONS,
)
from src.llm_score_result import PostScore, aggregate_ensemble_results
from src.llm_scorer_claude import LLMScorerClaudeCalls
from src.llm_scorer_data import LLMScorerDataHelper
from src.novelty import calculate_novelty
from src.scoring_few_shot import build_scoring_few_shot_block

logger = logging.getLogger(__name__)

_aggregate_ensemble_results = aggregate_ensemble_results


class LLMScorer:
    """Scores posts using Claude Haiku."""

    def __init__(self, anthropic_client: Anthropic, supabase: Client) -> None:
        self.anthropic = anthropic_client
        self.supabase = supabase
        self._data = LLMScorerDataHelper(supabase)
        self._claude = LLMScorerClaudeCalls(
            anthropic_client,
            self._scoring_few_shot_block,
        )

    def calculate_final_scores(self, results: list[PostScore]) -> list[PostScore]:
        """Calculate final scores with weights and novelty adjustment."""
        weights = self._data.get_weights()
        frequencies = self._data.get_topic_frequencies()
        total_scored_count = self._get_scored_count()

        for result in results:
            if result.error or not result.scores:
                continue

            weighted_sum = sum(
                result.scores.get(dim, 5.0) * weights.get(dim, 1.0)
                for dim in SCORING_DIMENSIONS
            )
            max_possible = sum(10 * weights.get(dim, 1.0) for dim in SCORING_DIMENSIONS)
            normalized = (weighted_sum / max_possible) * 10

            config = self._data.get_novelty_config()
            novelty = calculate_novelty(
                result.categories,
                frequencies,
                config,
                total_scored_count=total_scored_count,
            )

            raw_score = normalized * novelty
            result.final_score = min(10.0, max(0.0, raw_score))

        return results

    def get_unscored_posts(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get posts that haven't been scored yet, oldest first."""
        return self._data.get_unscored_posts(limit)

    def save_scores(self, results: list[PostScore]) -> dict[str, int]:
        """Save scores to Supabase (llm_scores and post_scores for active config)."""
        stats = {"errors": 0, "saved": 0, "skipped": 0}
        saved_results: list[PostScore] = []
        all_rows: list[dict[str, Any]] = []

        for result in results:
            if result.error:
                stats["skipped"] += 1
                continue

            all_rows.append(
                {
                    "categories": result.categories,
                    "final_score": result.final_score,
                    "model_version": CLAUDE_MODEL,
                    "post_id": result.post_id,
                    "prompt_version": PROMPT_VERSION,
                    "scores": result.scores,
                    "summary": result.summary,
                    "why_podcast_worthy": result.why_podcast_worthy,
                }
            )
            saved_results.append(result)

        if all_rows:
            try:
                self.supabase.table("llm_scores").upsert(
                    all_rows,
                    on_conflict="post_id",
                ).execute()
                stats["saved"] = len(all_rows)
            except Exception as e:
                log_supabase_error("Error batch saving llm_scores", e)
                stats["errors"] = len(all_rows)
                stats["saved"] = 0
                saved_results = []

        self._data.update_topic_frequencies(results)

        self.calculate_final_scores(saved_results)

        active_config_id = self._data.get_active_weight_config_id()
        if active_config_id and saved_results:
            try:
                post_scores_data = [
                    {
                        "final_score": r.final_score,
                        "post_id": r.post_id,
                        "weight_config_id": active_config_id,
                    }
                    for r in saved_results
                ]
                self.supabase.table("post_scores").upsert(
                    post_scores_data,
                    on_conflict="post_id,weight_config_id",
                ).execute()
            except Exception as e:
                log_supabase_error("Failed to write post_scores (feed may be empty)", e)

        logger.info(
            "Saved %d scores, skipped %d, errors %d",
            stats["saved"],
            stats["skipped"],
            stats["errors"],
        )

        return stats

    def score_posts(self, posts: list[dict[str, Any]]) -> list[PostScore]:
        """Score multiple posts in batches for efficiency."""
        results: list[PostScore] = []
        total_batches = (len(posts) + BATCH_SIZE - 1) // BATCH_SIZE

        for i in range(0, len(posts), BATCH_SIZE):
            batch = posts[i : i + BATCH_SIZE]
            batch_index = (i // BATCH_SIZE) + 1
            post_ids = [p.get("id", "?") for p in batch]
            logger.debug(
                "Scoring batch %d/%d (post_ids=%s)",
                batch_index,
                total_batches,
                post_ids,
            )
            try:
                batch_results = self._score_batch(batch)
                results.extend(batch_results)
            except Exception as e:
                logger.error(
                    "Error scoring batch %d (post_ids=%s): %s",
                    batch_index,
                    post_ids,
                    e,
                )
                for post in batch:
                    results.append(
                        PostScore(
                            post_id=post.get("id", "unknown"),
                            scores={},
                            categories=[],
                            summary="",
                            error=str(e),
                        )
                    )

        return results

    def score_single_dimension(
        self,
        posts: list[dict[str, Any]],
        dimension: str,
    ) -> list[tuple[str, float]]:
        """Score only one dimension for each post (for backfill). Does not write to DB."""
        if dimension not in SCORING_DIMENSIONS:
            raise ValueError(
                f"Unknown dimension: {dimension}. Must be one of {list(SCORING_DIMENSIONS)}"
            )
        results: list[tuple[str, float]] = []
        for i in range(0, len(posts), BATCH_SIZE):
            batch = posts[i : i + BATCH_SIZE]
            batch_results = self._score_single_dimension_batch(batch, dimension)
            results.extend(batch_results)
        return results

    def _get_scored_count(self) -> int | None:
        """Total llm_scores rows for cold-start novelty (tests may replace on instance)."""
        return self._data.get_scored_count()

    @property
    def _novelty_config(self) -> dict[str, Any] | None:
        return self._data._novelty_config

    @_novelty_config.setter
    def _novelty_config(self, value: dict[str, Any] | None) -> None:
        self._data._novelty_config = value

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _score_batch(self, posts: list[dict[str, Any]]) -> list[PostScore]:
        """Score a batch of posts using ensemble (3 runs, median aggregation)."""
        if len(posts) == 1:
            pt = posts[0].get("text", "")
            if not pt or not pt.strip():
                return [
                    PostScore(
                        post_id=posts[0].get("id", "unknown"),
                        scores={},
                        categories=[],
                        summary="",
                        error="Empty post text",
                    )
                ]

        successful_runs: list[list[PostScore]] = []
        last_error: Exception | None = None

        for _ in range(ENSEMBLE_RUNS):
            try:
                run_result = self._claude.score_batch_single_run(
                    posts, ENSEMBLE_TEMPERATURE
                )
                successful_runs.append(run_result)
            except Exception as e:
                logger.warning("Ensemble run failed: %s", e)
                last_error = e

        if not successful_runs:
            return [
                PostScore(
                    post_id=p.get("id", "unknown"),
                    scores={},
                    categories=[],
                    summary="",
                    error=str(last_error) if last_error else "All ensemble runs failed",
                )
                for p in posts
            ]

        return aggregate_ensemble_results(successful_runs)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _score_single_dimension_batch(
        self,
        posts: list[dict[str, Any]],
        dimension: str,
    ) -> list[tuple[str, float]]:
        """Score one dimension for a batch of posts."""
        return self._claude.score_single_dimension_batch(posts, dimension)

    def _scoring_few_shot_block(self) -> str:
        """Few-shot calibration from settings (Admin UI); raises if unconfigured."""
        return build_scoring_few_shot_block(self.supabase)

    @property
    def _weights(self) -> dict[str, float] | None:
        return self._data._weights

    @_weights.setter
    def _weights(self, value: dict[str, float] | None) -> None:
        self._data._weights = value
