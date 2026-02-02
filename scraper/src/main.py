"""Main entry point for the scraper pipeline."""

import argparse
import logging
import sys

from src.config import validate_env
from src.exceptions import ScraperError

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main(dry_run: bool = False) -> int:
    """Run the full scraper pipeline.

    Args:
        dry_run: If True, don't make any changes to the database.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    logger.info("Starting scraper pipeline (dry_run=%s)", dry_run)

    # Always validate environment variables

    validate_env()

    try:
        # TODO: Implement scraper pipeline
        # 1. Load session cookies or login
        # 2. Scrape posts from each neighborhood
        # 3. Deduplicate and store new posts
        # 4. Run LLM scoring
        # 5. Generate embeddings
        # 6. Update rankings

        if dry_run:
            logger.info("Dry run mode - no changes made")
        else:
            logger.info("Pipeline complete")

        return 0

    except ScraperError as e:
        logger.error("Scraper error: %s", e)
        return 1
    except Exception as e:
        logger.exception("Unexpected error (%s): %s", type(e).__name__, e)
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Nextdoor scraper pipeline")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without making changes to the database",
    )
    args = parser.parse_args()

    sys.exit(main(dry_run=args.dry_run))
