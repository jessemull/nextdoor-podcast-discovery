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
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from typing import Any, cast

from anthropic import Anthropic
from dotenv import load_dotenv
from supabase import Client

from src.config import ConfigurationError, validate_env
from src.logging_config import configure_logging

load_dotenv()  # noqa: E402
from src.llm_prompts import SCORING_DIMENSIONS  # noqa: E402
from src.llm_scorer import LLMScorer  # noqa: E402
from src.novelty import calculate_novelty  # noqa: E402
from src.ranking_common import (  # noqa: E402
    calculate_final_score,
    count_llm_scores,
    load_novelty_config,
    load_topic_frequencies,
    load_weight_config,
)
from src.session_manager import SessionManager  # noqa: E402
from src.worker_handlers import (  # noqa: E402
    process_fetch_permalink_job,
    process_run_scraper_job,
)

logger = logging.getLogger(__name__)

# Batch size for processing posts
BATCH_SIZE = 500

# Throttle DB round-trips: check cancellation and update progress every N batches
CANCEL_CHECK_INTERVAL = 5
PROGRESS_UPDATE_INTERVAL = 5

# Backfill dimension: batch size for get_posts_missing_dimension and LLM calls
BACKFILL_DIMENSION_BATCH_SIZE = 20


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

    logger.debug(
        "Loaded weights from config %s and novelty config for recompute job",
        weight_config_id,
    )

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

    logger.info(
        "[recompute] job=%s progress=%d/%d (%d%%)",
        job_id,
        processed,
        total,
        progress_pct,
    )


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


def _cutover_active_config(supabase: Client, weight_config_id: str) -> None:
    """Set the given weight config as active (settings + is_active flags).

    Called by the worker after a recompute job completes when
    activate_on_completion was true.
    """
    supabase.table("settings").upsert(
        {"key": "active_weight_config_id", "value": weight_config_id},
        on_conflict="key",
    ).execute()
    supabase.table("weight_configs").update({"is_active": False}).neq(
        "id", weight_config_id
    ).execute()
    supabase.table("weight_configs").update({"is_active": True}).eq(
        "id", weight_config_id
    ).execute()
    logger.info("Cut over active config to %s", weight_config_id)


def _maybe_invalidate_app_cache() -> None:
    """POST to app's cache-invalidate endpoint if APP_URL and INTERNAL_API_SECRET are set."""
    base_url = os.environ.get("APP_URL", "").rstrip("/")
    secret = os.environ.get("INTERNAL_API_SECRET")
    if not base_url or not secret:
        logger.debug(
            "Skipping app cache invalidation (APP_URL or INTERNAL_API_SECRET not set)"
        )
        return
    url = f"{base_url}/api/admin/invalidate-active-config"
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        logger.warning("APP_URL scheme not allowed: %s", parsed.scheme)
        return
    req = urllib.request.Request(
        url,
        data=None,
        headers={"x-internal-secret": secret},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310
            if 200 <= resp.getcode() < 300:
                logger.info("Invalidated app active-config cache")
            else:
                logger.warning("Cache invalidation returned %s", resp.getcode())
    except urllib.error.URLError as e:
        logger.warning("Cache invalidation request failed: %s", e)


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
        "[recompute] job=%s weight_config_id=%s starting recompute_final_scores",
        job_id,
        weight_config_id,
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
        total = count_llm_scores(supabase)

        logger.info(
            "[recompute] job=%s weight_config_id=%s found %d posts with scores",
            job_id,
            weight_config_id,
            total,
        )

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

        logger.info(
            "[recompute] job=%s weight_config_id=%s completed (processed=%d, total=%d)",
            job_id,
            weight_config_id,
            processed,
            total,
        )

        # Compute-then-cutover: become active only after scores are applied
        if params.get("activate_on_completion"):
            logger.info(
                "[recompute] job=%s weight_config_id=%s activating config and invalidating cache",
                job_id,
                weight_config_id,
            )
            _cutover_active_config(supabase, weight_config_id)
            _maybe_invalidate_app_cache()

    except ValueError as e:
        # Permanent failure: invalid config or params (don't retry)
        error_msg = str(e)
        logger.error(
            "[recompute] job=%s permanent error: %s",
            job_id,
            error_msg,
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
        logger.error(
            "[backfill_dimension] job=%s invalid params (expected dict)", job_id
        )
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
        logger.error(
            "[backfill_dimension] job=%s invalid dimension: %s", job_id, error_msg
        )
        return

    logger.info(
        "[backfill_dimension] job=%s dimension=%s starting backfill",
        job_id,
        dimension,
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
                    logger.info(
                        "[backfill_dimension] job=%s cancelled, stopping", job_id
                    )
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
                {
                    "id": str(row.get("id")),
                    "text": row.get("text") or "",
                    "comments": row.get("comments"),
                }
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
            "[backfill_dimension] job=%s dimension=%s completed (%d posts updated)",
            job_id,
            dimension,
            processed,
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
        logger.exception(
            "[backfill_dimension] job=%s dimension=%s failed: %s",
            job_id,
            dimension,
            e,
        )


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
                            "[permalink] previous job was cancelled, waiting %d seconds before next poll",
                            poll_interval,
                        )
                        time.sleep(poll_interval)
                elif actual_type == "run_scraper":
                    process_run_scraper_job(supabase, job)
                elif actual_type == "backfill_dimension":
                    process_backfill_dimension_job(supabase, job)
                else:
                    logger.warning("Unknown job type received: %s", actual_type)

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

    # Set up logging (shared configuration with color and quiet httpx).
    configure_logging("scraper-worker")

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
