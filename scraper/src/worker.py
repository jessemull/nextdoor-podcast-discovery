"""Background job worker for processing long-running tasks.

This script polls for pending background jobs and processes them.
Currently supports:
- backfill_dimension: Backfill a single scoring dimension into existing llm_scores.
- fetch_permalink: Fetches a single post by Nextdoor permalink URL.
- recompute_final_scores: Recalculates final_score for all posts using current weights.
- run_scraper: Runs the scraper pipeline for a feed type.
"""

__all__ = ["main"]

import argparse
import logging
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import Client

from src.config import ConfigurationError, validate_env

load_dotenv()  # noqa: E402
from src.llm_prompts import SCORING_DIMENSIONS  # noqa: E402
from src.llm_scorer import LLMScorer  # noqa: E402
from src.novelty import calculate_novelty  # noqa: E402
from src.session_manager import SessionManager  # noqa: E402

logger = logging.getLogger(__name__)

# Batch size for processing posts
BATCH_SIZE = 500

# Throttle DB round-trips: check cancellation and update progress every N batches
CANCEL_CHECK_INTERVAL = 5
PROGRESS_UPDATE_INTERVAL = 5

# Backfill dimension: batch size for get_posts_missing_dimension and LLM calls
BACKFILL_DIMENSION_BATCH_SIZE = 20


def calculate_final_score(
    scores: dict[str, float],
    weights: dict[str, float],
    novelty: float,
) -> float:
    """Calculate final score using weights and novelty.

    Args:
        scores: Dimension scores from LLM.
        weights: Weight multipliers for each dimension.
        novelty: Novelty multiplier (0.2 to 1.5).

    Returns:
        Final score (0-10).
    """
    # Missing dimension (e.g. newly added) defaults to 5.0; see docs on new dimension backfill
    weighted_sum = sum(scores.get(dim, 5.0) * w for dim, w in weights.items())
    max_possible = sum(10 * w for w in weights.values())
    if max_possible == 0:
        return 0.0

    normalized = (weighted_sum / max_possible) * 10

    # Apply novelty multiplier and clamp to [0, 10]
    raw_score = normalized * novelty
    return min(10.0, max(0.0, raw_score))


def load_weight_config(supabase: Client, weight_config_id: str) -> dict[str, float]:
    """Load ranking weights from a weight config.

    Args:
        supabase: Supabase client.
        weight_config_id: UUID of the weight config.

    Returns:
        Dict of dimension -> weight.

    Raises:
        ValueError: If weight config not found.
    """
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
    """Load novelty configuration from settings.

    Args:
        supabase: Supabase client.

    Returns:
        Novelty config dict.
    """
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

    # Default config if not found
    if not novelty_config:
        novelty_config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {
                "rare": 5,
                "common": 30,
                "very_common": 100,
            },
        }

    return novelty_config


def load_topic_frequencies(supabase: Client) -> dict[str, int]:
    """Load topic frequencies from database.

    Args:
        supabase: Supabase client.

    Returns:
        Dict of category -> count_30d.
    """
    result = supabase.table("topic_frequencies").select("category, count_30d").execute()

    frequencies: dict[str, int] = {}
    rows = cast(list[dict[str, Any]], result.data or [])
    for row in rows:
        category = row.get("category")
        count = row.get("count_30d", 0)
        if isinstance(category, str) and isinstance(count, (int, float)):
            frequencies[category] = int(count)

    return frequencies


def _load_job_dependencies(
    supabase: Client, weight_config_id: str
) -> tuple[dict[str, float], dict[str, Any], dict[str, int]]:
    """Load dependencies needed for processing a recompute job.

    Args:
        supabase: Supabase client.
        weight_config_id: UUID of the weight config.

    Returns:
        Tuple of (weights, novelty_config, frequencies).

    Raises:
        ValueError: If weight config not found or invalid.
    """
    weights = load_weight_config(supabase, weight_config_id)
    novelty_config = load_novelty_config(supabase)
    frequencies = load_topic_frequencies(supabase)

    logger.info("Loaded weights from config %s: %s", weight_config_id, weights)
    logger.info("Loaded novelty config: %s", novelty_config)

    return weights, novelty_config, frequencies


def _process_batch(
    batch_data: list[dict[str, Any]],
    job_id: str,
    weight_config_id: str,
    weights: dict[str, float],
    novelty_config: dict[str, Any],
    frequencies: dict[str, int],
    total_scored_count: int,
) -> list[dict[str, Any]]:
    """Process a batch of LLM scores and calculate final scores.

    Args:
        batch_data: List of score rows from llm_scores table.
        job_id: UUID of the job (for staging table).
        weight_config_id: UUID of the weight config.
        weights: Weight multipliers for each dimension.
        novelty_config: Novelty configuration.
        frequencies: Topic frequency counts.
        total_scored_count: Total number of scored posts (for cold-start novelty).

    Returns:
        List of post_scores_staging records to insert.
    """
    post_scores_to_upsert: list[dict[str, Any]] = []

    for score_row in batch_data:
        post_id = score_row.get("post_id")
        scores = score_row.get("scores", {})
        categories = score_row.get("categories", [])

        if (
            not post_id
            or not isinstance(scores, dict)
            or not isinstance(categories, list)
        ):
            logger.warning("Skipping invalid score row: post_id=%s", post_id)
            continue

        # Calculate novelty
        novelty = calculate_novelty(
            categories,
            frequencies,
            novelty_config,
            total_scored_count=total_scored_count,
        )

        # Calculate final score
        final_score = calculate_final_score(scores, weights, novelty)

        post_scores_to_upsert.append(
            {
                "job_id": job_id,
                "post_id": post_id,
                "weight_config_id": weight_config_id,
                "final_score": final_score,
                "computed_at": datetime.now(UTC).isoformat(),
            }
        )

    return post_scores_to_upsert


def _update_job_progress(
    supabase: Client, job_id: str, processed: int, total: int
) -> None:
    """Update job progress in the database.

    Args:
        supabase: Supabase client.
        job_id: UUID of the job.
        processed: Number of posts processed so far.
        total: Total number of posts to process.
    """
    progress_pct = int((processed / total) * 100) if total > 0 else 0
    supabase.table("background_jobs").update(
        {
            "progress": processed,
        }
    ).eq("id", job_id).execute()

    logger.info("Processed %d / %d posts (%d%%)", processed, total, progress_pct)


def _cleanup_staging(supabase: Client, job_id: str) -> None:
    """Delete staging rows for a job (on error or cancel).

    Args:
        supabase: Supabase client.
        job_id: UUID of the job.
    """
    try:
        supabase.table("post_scores_staging").delete().eq("job_id", job_id).execute()
        logger.debug("Cleaned up staging for job %s", job_id)
    except Exception as e:
        logger.warning("Failed to cleanup staging for job %s: %s", job_id, e)


def _handle_transient_error(supabase: Client, job_id: str, error_msg: str) -> None:
    """Handle a transient error by retrying the job if retries are available.

    Args:
        supabase: Supabase client.
        job_id: UUID of the job.
        error_msg: Error message to log.
    """
    # Get current retry count and max_retries
    job_status_result = (
        supabase.table("background_jobs")
        .select("retry_count, max_retries")
        .eq("id", job_id)
        .single()
        .execute()
    )

    current_retry_count = 0
    max_retries = 3  # Default

    if job_status_result.data:
        job_data = cast(dict[str, Any], job_status_result.data)
        current_retry_count = job_data.get("retry_count", 0) or 0
        max_retries = job_data.get("max_retries", 3) or 3

    if current_retry_count < max_retries:
        # Retry: reset to pending and increment retry count
        new_retry_count = current_retry_count + 1
        logger.info(
            "Retrying job %s (attempt %d/%d)", job_id, new_retry_count, max_retries
        )

        supabase.table("background_jobs").update(
            {
                "error_message": error_msg,
                "last_retry_at": datetime.now(UTC).isoformat(),
                "retry_count": new_retry_count,
                "status": "pending",  # Reset to pending for retry
            }
        ).eq("id", job_id).execute()
    else:
        # Max retries exceeded: cleanup staging and mark as error
        logger.error(
            "Job %s failed after %d retries, marking as error", job_id, max_retries
        )

        _cleanup_staging(supabase, job_id)

        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": f"{error_msg} (Failed after {max_retries} retries)",
                "status": "error",
            }
        ).eq("id", job_id).execute()


def process_recompute_job(supabase: Client, job: dict[str, Any]) -> None:
    """Process a recompute_final_scores job.

    Args:
        supabase: Supabase client.
        job: Job record from database.

    Raises:
        ValueError: If job params are invalid or weight_config_id is missing.
    """
    job_id = job["id"]
    params = job.get("params", {})

    if not isinstance(params, dict):
        raise ValueError(f"Invalid params in job {job_id}")

    weight_config_id = params.get("weight_config_id")
    if not weight_config_id or not isinstance(weight_config_id, str):
        raise ValueError(
            f"Missing weight_config_id in job {job_id} params. "
            "This job was created before versioning. Please delete it and create a new one."
        )

    logger.info(
        "Processing recompute job %s for weight config %s", job_id, weight_config_id
    )

    # Update job status to running
    supabase.table("background_jobs").update(
        {
            "started_at": datetime.now(UTC).isoformat(),
            "status": "running",
        }
    ).eq("id", job_id).execute()

    try:
        # Load dependencies
        weights, novelty_config, frequencies = _load_job_dependencies(
            supabase, weight_config_id
        )

        # Get total count of posts with scores
        count_result = (
            supabase.table("llm_scores")
            .select("id", count=cast(Any, "exact"))
            .execute()
        )
        total = count_result.count or 0

        logger.info("Found %d posts to process", total)

        # Update job with total
        supabase.table("background_jobs").update(
            {
                "total": total,
            }
        ).eq("id", job_id).execute()

        # Process in batches
        offset = 0
        processed = 0
        batch_index = 0

        while offset < total:
            # Check cancellation every N batches to reduce DB round-trips
            if batch_index % CANCEL_CHECK_INTERVAL == 0:
                job_status_result = (
                    supabase.table("background_jobs")
                    .select("status")
                    .eq("id", job_id)
                    .single()
                    .execute()
                )

                job_data = (
                    cast(dict[str, Any], job_status_result.data)
                    if job_status_result.data
                    else None
                )
                if job_data and job_data.get("status") == "cancelled":
                    logger.info("Job %s was cancelled, stopping processing", job_id)
                    _cleanup_staging(supabase, job_id)
                    supabase.table("background_jobs").update(
                        {
                            "completed_at": datetime.now(UTC).isoformat(),
                            "progress": processed,
                        }
                    ).eq("id", job_id).execute()
                    return

            # Fetch batch of scores with deterministic order for pagination
            batch_result = (
                supabase.table("llm_scores")
                .select("id, post_id, scores, categories")
                .order("id")
                .range(offset, offset + BATCH_SIZE - 1)
                .execute()
            )

            if not batch_result.data:
                break

            batch_data = cast(list[dict[str, Any]], batch_result.data)
            # Process batch
            post_scores_to_insert = _process_batch(
                batch_data,
                job_id,
                weight_config_id,
                weights,
                novelty_config,
                frequencies,
                total_scored_count=total,
            )

            # Bulk insert to post_scores_staging
            if post_scores_to_insert:
                supabase.table("post_scores_staging").upsert(
                    post_scores_to_insert, on_conflict="job_id,post_id"
                ).execute()

                processed += len(post_scores_to_insert)
                is_last_batch = offset + BATCH_SIZE >= total
                if batch_index % PROGRESS_UPDATE_INTERVAL == 0 or is_last_batch:
                    _update_job_progress(supabase, job_id, processed, total)

            offset += BATCH_SIZE
            batch_index += 1

        # Apply staging to post_scores in one transaction, then mark job completed
        supabase.rpc(
            "apply_post_scores_from_staging",
            {"p_job_id": job_id, "p_weight_config_id": weight_config_id},
        ).execute()

        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "progress": processed,
                "status": "completed",
            }
        ).eq("id", job_id).execute()

        logger.info("Job %s completed successfully", job_id)

    except ValueError as e:
        # Permanent failure: invalid config or params (don't retry)
        error_msg = str(e)
        logger.error(
            "Permanent error processing job %s: %s", job_id, error_msg, exc_info=True
        )

        _cleanup_staging(supabase, job_id)

        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": error_msg,
                "status": "error",
            }
        ).eq("id", job_id).execute()

        raise  # Re-raise to signal permanent failure

    except (ConnectionError, TimeoutError, OSError) as e:
        # Network/system errors: likely transient (retry)
        error_msg = f"Network/system error: {str(e)}"
        logger.error(
            "Transient error processing job %s: %s", job_id, error_msg, exc_info=True
        )
        _handle_transient_error(supabase, job_id, error_msg)

    except Exception as e:
        # Other exceptions: database errors, unexpected issues (may retry)
        # Note: Supabase client doesn't export specific exception types,
        # so we catch generic Exception for database/API errors
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(
            "Error processing job %s (type=%s): %s (%s)",
            job_id,
            job.get("type", "?"),
            e,
            type(e).__name__,
            exc_info=True,
        )
        _handle_transient_error(supabase, job_id, error_msg)


def _fetch_permalink_job_was_cancelled(supabase: Client, job_id: str) -> bool:
    """Return True if the job was cancelled (e.g. by user removing from queue)."""
    result = (
        supabase.table("background_jobs")
        .select("status")
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    if not result.data or len(result.data) == 0:
        return False
    row = cast(dict[str, Any], result.data[0])
    return (row.get("status") or "") == "cancelled"


def process_fetch_permalink_job(supabase: Client, job: dict[str, Any]) -> bool:
    """Process a fetch_permalink job by running the scraper in permalink mode.

    Returns True if the job was cancelled (do not start the next job this cycle).
    """
    job_id = job["id"]
    params = job.get("params", {})

    if not isinstance(params, dict):
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": "Invalid params",
                "status": "error",
            }
        ).eq("id", job_id).execute()
        return False

    url = params.get("url")
    if not url or not isinstance(url, str):
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": "Missing or invalid params.url",
                "status": "error",
            }
        ).eq("id", job_id).execute()
        return False

    post_id = params.get("post_id")
    if post_id is not None and not isinstance(post_id, str):
        post_id = None

    supabase.table("background_jobs").update(
        {
            "started_at": datetime.now(UTC).isoformat(),
            "status": "running",
        }
    ).eq("id", job_id).execute()

    if _fetch_permalink_job_was_cancelled(supabase, job_id):
        logger.info("Permalink job %s was cancelled before run, skipping", job_id)
        return True

    scraper_dir = Path(__file__).resolve().parent.parent
    cmd = [sys.executable, "-m", "src.main", "--permalink", url]
    if post_id:
        cmd.extend(["--post-id", post_id])

    try:
        result = subprocess.run(
            cmd,
            cwd=str(scraper_dir),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if _fetch_permalink_job_was_cancelled(supabase, job_id):
            logger.info(
                "Permalink job %s was cancelled during run, not updating", job_id
            )
            return True
        if result.returncode == 0:
            supabase.table("background_jobs").update(
                {
                    "completed_at": datetime.now(UTC).isoformat(),
                    "status": "completed",
                }
            ).eq("id", job_id).execute()
            logger.info("Permalink job %s completed successfully", job_id)
        else:
            error_msg = (
                result.stderr
                or result.stdout
                or f"Scraper exited with {result.returncode}"
            )
            supabase.table("background_jobs").update(
                {
                    "completed_at": datetime.now(UTC).isoformat(),
                    "error_message": error_msg[:1000],
                    "status": "error",
                }
            ).eq("id", job_id).execute()
            logger.error("Permalink job %s failed: %s", job_id, error_msg[:200])
        return False
    except subprocess.TimeoutExpired:
        if _fetch_permalink_job_was_cancelled(supabase, job_id):
            logger.info(
                "Permalink job %s was cancelled (timed out), not updating", job_id
            )
            return True
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": "Scraper timed out after 300s",
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.error("Permalink job %s timed out", job_id)
        return False
    except Exception as e:
        if _fetch_permalink_job_was_cancelled(supabase, job_id):
            logger.info("Permalink job %s was cancelled, not updating", job_id)
            return True
        error_msg = str(e)
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": error_msg[:1000],
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.exception("Permalink job %s failed: %s", job_id, e)
        return False


def process_run_scraper_job(supabase: Client, job: dict[str, Any]) -> None:
    """Process a run_scraper job by running scripts/run-scrape.sh.

    Args:
        supabase: Supabase client.
        job: Job record from database.
    """
    job_id = job["id"]
    params = job.get("params", {}) or {}
    feed_type = params.get("feed_type") or "recent"
    if feed_type not in ("recent", "trending"):
        feed_type = "recent"

    logger.info("Processing run_scraper job %s (feed_type=%s)", job_id, feed_type)

    supabase.table("background_jobs").update(
        {
            "started_at": datetime.now(UTC).isoformat(),
            "status": "running",
        }
    ).eq("id", job_id).execute()

    repo_root = Path(__file__).resolve().parent.parent
    script = repo_root / "scripts" / "run-scrape.sh"
    if not script.is_file():
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": "scripts/run-scrape.sh not found",
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.error("run_scraper job %s: script not found at %s", job_id, script)
        return

    try:
        result = subprocess.run(
            [str(script), feed_type],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            timeout=7200,
        )
        if result.returncode == 0:
            supabase.table("background_jobs").update(
                {
                    "completed_at": datetime.now(UTC).isoformat(),
                    "status": "completed",
                }
            ).eq("id", job_id).execute()
            logger.info("run_scraper job %s completed successfully", job_id)
        else:
            error_msg = (
                result.stderr
                or result.stdout
                or f"run-scrape.sh exited with {result.returncode}"
            )
            supabase.table("background_jobs").update(
                {
                    "completed_at": datetime.now(UTC).isoformat(),
                    "error_message": error_msg[:1000],
                    "status": "error",
                }
            ).eq("id", job_id).execute()
            logger.error("run_scraper job %s failed: %s", job_id, error_msg[:200])
    except subprocess.TimeoutExpired:
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": "Scraper timed out after 7200s",
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.error("run_scraper job %s timed out", job_id)
    except Exception as e:
        error_msg = str(e)
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": error_msg[:1000],
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.exception("run_scraper job %s failed: %s", job_id, e)


def process_backfill_dimension_job(supabase: Client, job: dict[str, Any]) -> None:
    """Process a backfill_dimension job: score one dimension for posts missing it and merge.

    Args:
        supabase: Supabase client.
        job: Job record from database (params.dimension required).
    """
    job_id = job["id"]
    params = job.get("params") or {}
    if not isinstance(params, dict):
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": "Invalid params",
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.error("backfill_dimension job %s: params must be a dict", job_id)
        return

    dimension = (
        params.get("dimension") if isinstance(params.get("dimension"), str) else None
    )
    if not dimension or dimension not in SCORING_DIMENSIONS:
        error_msg = (
            f"Invalid or missing dimension. Must be one of: {list(SCORING_DIMENSIONS)}"
        )
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": error_msg[:1000],
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.error("backfill_dimension job %s: %s", job_id, error_msg)
        return

    logger.info(
        "Processing backfill_dimension job %s for dimension %s", job_id, dimension
    )

    supabase.table("background_jobs").update(
        {
            "started_at": datetime.now(UTC).isoformat(),
            "status": "running",
        }
    ).eq("id", job_id).execute()

    try:
        anthropic = Anthropic()
        scorer = LLMScorer(anthropic, supabase)
        processed = 0
        batch_index = 0

        while True:
            if batch_index % CANCEL_CHECK_INTERVAL == 0:
                job_status_result = (
                    supabase.table("background_jobs")
                    .select("status")
                    .eq("id", job_id)
                    .single()
                    .execute()
                )
                job_data = (
                    cast(dict[str, Any], job_status_result.data)
                    if job_status_result.data
                    else None
                )
                if job_data and job_data.get("status") == "cancelled":
                    logger.info("Job %s was cancelled", job_id)
                    supabase.table("background_jobs").update(
                        {
                            "completed_at": datetime.now(UTC).isoformat(),
                            "progress": processed,
                        }
                    ).eq("id", job_id).execute()
                    return

            result = supabase.rpc(
                "get_posts_missing_dimension",
                {
                    "p_dimension": dimension,
                    "p_limit": BACKFILL_DIMENSION_BATCH_SIZE,
                },
            ).execute()

            rows: list[dict[str, Any]] = cast(list[Any], result.data or [])
            if not rows:
                break

            posts = [
                {"id": str(row.get("id")), "text": row.get("text") or ""}
                for row in rows
            ]
            updates = scorer.score_single_dimension(posts, dimension)
            if not updates:
                break

            p_updates = [
                {"post_id": post_id, "value": value} for post_id, value in updates
            ]
            supabase.rpc(
                "merge_dimension_into_llm_scores",
                {"p_dimension": dimension, "p_updates": p_updates},
            ).execute()

            processed += len(updates)
            supabase.table("background_jobs").update({"progress": processed}).eq(
                "id", job_id
            ).execute()
            batch_index += 1

        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "progress": processed,
                "status": "completed",
            }
        ).eq("id", job_id).execute()
        logger.info(
            "backfill_dimension job %s completed: %d posts updated", job_id, processed
        )

    except Exception as e:
        error_msg = str(e)
        supabase.table("background_jobs").update(
            {
                "completed_at": datetime.now(UTC).isoformat(),
                "error_message": error_msg[:1000],
                "status": "error",
            }
        ).eq("id", job_id).execute()
        logger.exception("backfill_dimension job %s failed: %s", job_id, e)


def poll_and_process(supabase: Client, job_type: str, poll_interval: int = 30) -> None:
    """Poll for pending jobs and process them.

    Args:
        supabase: Supabase client.
        job_type: Type(s) of job to process (e.g. 'recompute_final_scores' or
            'recompute_final_scores,run_scraper' for multiple).
        poll_interval: Seconds between polls when no jobs found.
    """
    job_types = [t.strip() for t in job_type.split(",") if t.strip()]
    if not job_types:
        job_types = ["recompute_final_scores"]
    logger.info("Starting worker for job type(s): %s", job_types)

    while True:
        try:
            query = (
                supabase.table("background_jobs")
                .select("*")
                .eq("status", "pending")
                .order("created_at", desc=False)
                .limit(1)
            )
            if len(job_types) == 1:
                query = query.eq("type", job_types[0])
            else:
                query = query.in_("type", job_types)

            result = query.execute()

            if result.data and len(result.data) > 0:
                job = cast(dict[str, Any], result.data[0])
                actual_type = job.get("type") or ""
                if actual_type == "recompute_final_scores":
                    process_recompute_job(supabase, job)
                elif actual_type == "fetch_permalink":
                    was_cancelled = process_fetch_permalink_job(supabase, job)
                    if was_cancelled:
                        logger.debug(
                            "Previous permalink job was cancelled, waiting %d seconds before next poll",
                            poll_interval,
                        )
                        time.sleep(poll_interval)
                elif actual_type == "run_scraper":
                    process_run_scraper_job(supabase, job)
                elif actual_type == "backfill_dimension":
                    process_backfill_dimension_job(supabase, job)
                else:
                    logger.warning("Unknown job type: %s", actual_type)

            else:
                # No jobs, wait before polling again
                logger.debug("No pending jobs, waiting %d seconds", poll_interval)
                time.sleep(poll_interval)

        except KeyboardInterrupt:
            logger.info("Worker interrupted, shutting down")
            break
        except Exception as e:
            # Catch any error to keep poll loop running; log and continue
            logger.error(
                "Error in worker loop (job_types=%s): %s (%s)",
                job_types,
                e,
                type(e).__name__,
                exc_info=True,
            )
            time.sleep(poll_interval)


def main() -> int:
    """Main entry point for the worker.

    Returns:
        Exit code (0 for success, 1 for error).
    """
    parser = argparse.ArgumentParser(description="Background job worker")
    parser.add_argument(
        "--job-type",
        default="recompute_final_scores",
        help="Type of job to process (default: recompute_final_scores)",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=30,
        help="Seconds between polls when no jobs found (default: 30)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process one job and exit (for cron jobs)",
    )

    args = parser.parse_args()

    # Set up logging
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        level=logging.INFO,
    )

    try:
        validate_env()
    except ConfigurationError as e:
        logger.error("Configuration error: %s", e)
        return 1

    try:
        # Initialize Supabase client
        session_manager = SessionManager()
        supabase = session_manager.supabase

        if args.once:
            # Process one job and exit
            job_types = [t.strip() for t in args.job_type.split(",") if t.strip()] or [
                "recompute_final_scores"
            ]
            query = (
                supabase.table("background_jobs")
                .select("*")
                .eq("status", "pending")
                .order("created_at", desc=False)
                .limit(1)
            )
            if len(job_types) == 1:
                query = query.eq("type", job_types[0])
            else:
                query = query.in_("type", job_types)
            result = query.execute()

            if result.data and len(result.data) > 0:
                job = cast(dict[str, Any], result.data[0])
                actual_type = job.get("type") or ""
                if actual_type == "recompute_final_scores":
                    process_recompute_job(supabase, job)
                elif actual_type == "fetch_permalink":
                    process_fetch_permalink_job(supabase, job)
                elif actual_type == "run_scraper":
                    process_run_scraper_job(supabase, job)
                elif actual_type == "backfill_dimension":
                    process_backfill_dimension_job(supabase, job)
                else:
                    logger.warning("Unknown job type: %s", actual_type)
                    return 1
            else:
                logger.info("No pending jobs found")
        else:
            # Continuous polling
            poll_and_process(supabase, args.job_type, args.poll_interval)

        return 0

    except (ConfigurationError, ValueError) as e:
        # Configuration or validation errors: don't retry
        logger.error("Fatal configuration/validation error: %s", e, exc_info=True)
        return 1
    except (ConnectionError, TimeoutError, OSError) as e:
        # Network/system errors: fatal for main function
        logger.error("Fatal network/system error: %s", e, exc_info=True)
        return 1
    except Exception as e:
        # Other unexpected errors: fatal
        logger.error(
            "Fatal unexpected error (job_type=%s): %s (%s)",
            args.job_type,
            e,
            type(e).__name__,
            exc_info=True,
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
