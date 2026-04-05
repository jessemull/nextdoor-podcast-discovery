"""Atomically claim the next pending background job (multi-worker safe)."""

from __future__ import annotations

import logging
from typing import Any, cast

from supabase import Client

logger = logging.getLogger(__name__)


def claim_next_background_job(
    supabase: Client, job_types: list[str]
) -> dict[str, Any] | None:
    """Claim one pending job: set status to running and return the full row.

    Uses DB function ``claim_next_background_job`` (migration 066) with
    ``FOR UPDATE SKIP LOCKED`` so concurrent workers cannot take the same job.

    Args:
        supabase: Supabase client (service role).
        job_types: Non-empty list of job ``type`` values to consider (same as
            worker ``--job-type`` comma-separated list).

    Returns:
        The job row after claim, or None if no matching pending job.
    """
    if not job_types:
        logger.warning("claim_next_background_job called with empty job_types")
        return None

    result = supabase.rpc(
        "claim_next_background_job",
        {"p_job_types": job_types},
    ).execute()

    data = result.data
    if not data:
        return None
    rows = data if isinstance(data, list) else [data]
    if len(rows) == 0:
        return None
    return cast(dict[str, Any], rows[0])
