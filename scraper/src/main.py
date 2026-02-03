"""Main entry point for the scraper pipeline."""

__all__ = ["main"]

import argparse
import logging
import sys

from dotenv import load_dotenv

from src.config import SCRAPER_CONFIG, validate_env
from src.exceptions import (
    CaptchaRequiredError,
    ConfigurationError,
    LoginFailedError,
    ScraperError,
)
from src.scraper import NextdoorScraper
from src.session_manager import SessionManager

# Load environment variables from .env file

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main(dry_run: bool = False, visible: bool = False) -> int:
    """Run the full scraper pipeline.

    Args:
        dry_run: If True, don't make any changes to the database.
        visible: If True, run browser in visible mode (not headless).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    logger.info("Starting scraper pipeline (dry_run=%s, visible=%s)", dry_run, visible)

    try:
        # Validate environment variables

        validate_env()

        # Initialize session manager

        session_manager = SessionManager()

        # Start browser (visible flag overrides config)

        headless = False if visible else SCRAPER_CONFIG["headless"]

        with NextdoorScraper(headless=headless) as scraper:
            # Step 1: Try to load existing session

            cookies = session_manager.get_cookies()

            if cookies:
                logger.info("Found existing session, loading cookies")
                scraper.load_cookies(cookies)

                # Verify session is still valid

                if scraper.is_logged_in():
                    logger.info("Session is valid")
                else:
                    logger.info("Session expired, need fresh login")
                    cookies = None

            # Step 2: Login if no valid session

            if not cookies:
                logger.info("Logging in to Nextdoor")
                scraper.login()

                # Save new session

                if not dry_run:
                    new_cookies = scraper.get_cookies()
                    session_manager.save_cookies(new_cookies)
                    logger.info("Saved new session")

            # TODO: Implement remaining pipeline steps
            # - Scrape posts from each neighborhood
            # - Deduplicate and store new posts
            # - Run LLM scoring
            # - Generate embeddings
            # - Update rankings

            if dry_run:
                logger.info("Dry run mode - no changes made")
            else:
                logger.info("Pipeline complete")

        return 0

    except ConfigurationError as e:
        logger.error("Configuration error: %s", e)
        return 1
    except CaptchaRequiredError as e:
        logger.error("CAPTCHA required: %s", e)
        logger.error("Manual intervention needed - run with --visible to solve CAPTCHA")
        return 1
    except LoginFailedError as e:
        logger.error("Login failed: %s", e)
        return 1
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
    parser.add_argument(
        "--visible",
        action="store_true",
        help="Run browser in visible mode (not headless)",
    )
    args = parser.parse_args()

    sys.exit(main(dry_run=args.dry_run, visible=args.visible))
