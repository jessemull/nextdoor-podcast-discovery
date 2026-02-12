"""Recount topic frequencies for the 30-day novelty window.

Call this daily (e.g. after scraping/scoring) so novelty reflects a true
rolling 30-day window. Uses the recount_topic_frequencies() RPC in the database.
"""

__all__ = ["main"]

import logging
import os
import sys

from supabase import create_client

from src.config import validate_env
from src.exceptions import ConfigurationError

logger = logging.getLogger(__name__)


def main() -> int:
    """Call recount_topic_frequencies RPC and exit.

    Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY (via validate_env).

    Returns:
        Exit code (0 success, 1 error).
    """
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.INFO,
    )

    try:
        validate_env()
    except ConfigurationError as e:
        logger.error("Configuration error: %s", e)
        return 1

    try:
        client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
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
