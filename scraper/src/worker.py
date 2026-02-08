"""Background job worker for processing long-running tasks.

This script polls for pending background jobs and processes them.
Currently supports:
- recompute_final_scores: Recalculates final_score for all posts using current weights.
"""

__all__ = ["main"]

import argparse
import logging
import sys
import time
from datetime import UTC, datetime
from typing import Any, cast

from supabase import Client

from src.config import ConfigurationError, validate_env
from src.novelty import calculate_novelty
from src.session_manager import SessionManager

logger = logging.getLogger(__name__)

# Batch size for processing posts
BATCH_SIZE = 500


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
    # Calculate weighted sum
    weighted_sum = sum(
        scores.get(dim, 5.0) * weights.get(dim, 1.0)
        for dim in [
            "absurdity",
            "drama",
            "discussion_spark",
            "emotional_intensity",
            "news_value",
        ]
    )

    # Normalize to 0-10
    max_possible = sum(10 * weights.get(dim, 1.0) for dim in weights.keys())
    if max_possible == 0:
        return 0.0

    normalized = (weighted_sum / max_possible) * 10

    # Apply novelty multiplier
    return normalized * novelty


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
        .single()
        .execute()
    )

    novelty_config: dict[str, Any] = {}
    if result.data:
        value = result.data.get("value", {})  # type: ignore[union-attr]
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
    supabase: Client,
    batch_data: list[dict[str, Any]],
    weight_config_id: str,
    weights: dict[str, float],
    novelty_config: dict[str, Any],
    frequencies: dict[str, int],
) -> list[dict[str, Any]]:
    """Process a batch of LLM scores and calculate final scores.

    Args:
        supabase: Supabase client.
        batch_data: List of score rows from llm_scores table.
        weight_config_id: UUID of the weight config.
        weights: Weight multipliers for each dimension.
        novelty_config: Novelty configuration.
        frequencies: Topic frequency counts.

    Returns:
        List of post_scores records to upsert.
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
        novelty = calculate_novelty(categories, frequencies, novelty_config)

        # Calculate final score
        final_score = calculate_final_score(scores, weights, novelty)

        post_scores_to_upsert.append(
            {
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
        # Max retries exceeded: mark as error
        logger.error(
            "Job %s failed after %d retries, marking as error", job_id, max_retries
        )

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

        while offset < total:
            # Check if job was cancelled
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
                supabase.table("background_jobs").update(
                    {
                        "completed_at": datetime.now(UTC).isoformat(),
                        "progress": processed,
                    }
                ).eq("id", job_id).execute()
                return

            # Fetch batch of scores
            batch_result = (
                supabase.table("llm_scores")
                .select("id, post_id, scores, categories")
                .range(offset, offset + BATCH_SIZE - 1)
                .execute()
            )

            if not batch_result.data:
                break

            batch_data = cast(list[dict[str, Any]], batch_result.data)
            # Process batch
            post_scores_to_upsert = _process_batch(
                supabase,
                batch_data,
                weight_config_id,
                weights,
                novelty_config,
                frequencies,
            )

            # Bulk upsert to post_scores
            if post_scores_to_upsert:
                supabase.table("post_scores").upsert(
                    post_scores_to_upsert, on_conflict="post_id,weight_config_id"
                ).execute()

                processed += len(post_scores_to_upsert)
                _update_job_progress(supabase, job_id, processed, total)

            offset += BATCH_SIZE

        # Mark job as completed
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
        logger.error("Error processing job %s: %s", job_id, error_msg, exc_info=True)
        _handle_transient_error(supabase, job_id, error_msg)


def poll_and_process(supabase: Client, job_type: str, poll_interval: int = 30) -> None:
    """Poll for pending jobs and process them.

    Args:
        supabase: Supabase client.
        job_type: Type of job to process (e.g., 'recompute_final_scores').
        poll_interval: Seconds between polls when no jobs found.
    """
    logger.info("Starting worker for job type: %s", job_type)

    while True:
        try:
            # Look for pending job
            result = (
                supabase.table("background_jobs")
                .select("*")
                .eq("type", job_type)
                .eq("status", "pending")
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )

            if result.data and len(result.data) > 0:
                job = cast(dict[str, Any], result.data[0])
                if job_type == "recompute_final_scores":
                    process_recompute_job(supabase, job)
                else:
                    logger.warning("Unknown job type: %s", job_type)

            else:
                # No jobs, wait before polling again
                logger.debug("No pending jobs, waiting %d seconds", poll_interval)
                time.sleep(poll_interval)

        except KeyboardInterrupt:
            logger.info("Worker interrupted, shutting down")
            break
        except Exception as e:
            # Catch any error to keep poll loop running; log and continue
            logger.error("Error in worker loop: %s", e, exc_info=True)
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
            result = (
                supabase.table("background_jobs")
                .select("*")
                .eq("type", args.job_type)
                .eq("status", "pending")
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )

            if result.data and len(result.data) > 0:
                job = cast(dict[str, Any], result.data[0])
                if args.job_type == "recompute_final_scores":
                    process_recompute_job(supabase, job)
                else:
                    logger.warning("Unknown job type: %s", args.job_type)
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
        logger.error("Fatal unexpected error: %s", e, exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
