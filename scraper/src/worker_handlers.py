"""Job-type handlers for the background job worker.

Extracted from worker.py to keep the orchestrator small. Handles:
- fetch_permalink: Run scraper in permalink mode.
- run_scraper: Run scripts/run-scrape.sh.
"""

import logging
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from supabase import Client

logger = logging.getLogger(__name__)


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
