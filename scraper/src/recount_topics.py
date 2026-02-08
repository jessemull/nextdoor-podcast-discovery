"""Recount topic frequencies for the 30-day novelty window.

Call this daily (e.g. after scraping/scoring) so novelty reflects a true
rolling 30-day window. Uses the recount_topic_frequencies() RPC in the database.
"""

__all__ = ["main"]

import logging
import os
import sys

from supabase import create_client

logger = logging.getLogger(__name__)


def main() -> int:
    """Call recount_topic_frequencies RPC and exit.

    Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY.

    Returns:
        Exit code (0 success, 1 error).
    """
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.INFO,
    )

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
        return 1

    try:
        client = create_client(url, key)
        client.rpc("recount_topic_frequencies").execute()
        logger.info("Topic frequencies recounted successfully")
        return 0
    except Exception as e:
        # Broad catch: RPC or Supabase errors; script exits with code 1 for cron
        logger.exception(
            "Failed to run RPC recount_topic_frequencies: %s (%s)",
            e,
            type(e).__name__,
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
