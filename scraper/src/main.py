"""Main entry point for the scraper pipeline."""

__all__ = ["main"]

import argparse
import logging
import os
import sys
from datetime import UTC, datetime

from anthropic import Anthropic
from dotenv import load_dotenv
from openai import OpenAI
from supabase import Client

from src.config import FEED_URLS, SCRAPER_CONFIG, validate_env
from src.embedder import Embedder
from src.exceptions import (
    CaptchaRequiredError,
    ConfigurationError,
    LoginFailedError,
    ScraperError,
)
from src.llm_scorer import LLMScorer
from src.post_storage import PostStorage
from src.scraper import NextdoorScraper
from src.session_manager import SessionManager

# Load environment variables from .env file

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def _run_scoring(supabase_client: Client) -> None:
    """Run LLM scoring on unscored posts.

    Args:
        supabase_client: Supabase client instance.
    """
    anthropic = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    scorer = LLMScorer(anthropic, supabase_client)

    # Get unscored posts

    unscored = scorer.get_unscored_posts(limit=50)
    if not unscored:
        logger.info("No unscored posts found")
        return

    logger.info("Scoring %d unscored posts", len(unscored))

    # Score posts

    results = scorer.score_posts(unscored)
    results = scorer.calculate_final_scores(results)

    # Save scores

    stats = scorer.save_scores(results)
    logger.info(
        "Scoring complete: %d saved, %d skipped, %d errors",
        stats["saved"],
        stats["skipped"],
        stats["errors"],
    )


def main(
    dry_run: bool = False,
    embed: bool = False,
    extract_permalinks: bool = False,
    feed_type: str = "recent",
    max_posts: int | None = None,
    score: bool = False,
    visible: bool = False,
) -> int:
    """Run the scraper pipeline.

    Args:
        dry_run: If True, don't make any changes to the database.
        embed: If True, run embedding generation after scrape/score (so new posts are searchable).
        extract_permalinks: If True, click Share on each post to get permalink.
        feed_type: Which feed to scrape ("recent" or "trending").
        max_posts: Maximum number of posts to scrape (default from config).
        score: If True, run LLM scoring on unscored posts after scraping.
        visible: If True, run browser in visible mode (not headless).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    # Validate feed type

    if feed_type not in FEED_URLS:
        logger.error(
            "Invalid feed type: %s (must be 'recent' or 'trending')", feed_type
        )
        return 1

    # Use default if not specified

    if max_posts is None:
        max_posts = SCRAPER_CONFIG["max_posts_per_run"]

    logger.info(
        "Starting scraper pipeline (feed=%s, max_posts=%d, dry_run=%s, "
        "visible=%s, extract_permalinks=%s, score=%s, embed=%s)",
        feed_type,
        max_posts,
        dry_run,
        visible,
        extract_permalinks,
        score,
        embed,
    )

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

            # Step 3: Navigate to the correct feed

            logger.info("Navigating to %s feed", feed_type)
            scraper.navigate_to_feed(feed_type)

            # Step 4: Extract posts

            logger.info("Extracting up to %d posts from %s feed", max_posts, feed_type)
            posts = scraper.extract_posts(
                max_posts=max_posts,
                extract_permalinks=extract_permalinks,
            )
            logger.info("Extracted %d posts", len(posts))

            # Step 5: Store posts in Supabase

            if dry_run:
                logger.info("Dry run mode - skipping storage")

                # Log sample of extracted posts

                for i, post in enumerate(posts[:5]):
                    logger.info(
                        "Sample post %d: [%s] %s... (%d chars)",
                        i + 1,
                        post.author_name,
                        post.content[:80],
                        len(post.content),
                    )
            else:
                logger.info("Storing %d posts in Supabase", len(posts))
                storage = PostStorage(session_manager.supabase)
                stats = storage.store_posts(posts)
                logger.info(
                    "Storage complete: %d inserted, %d duplicates skipped",
                    stats["inserted"],
                    stats["skipped"],
                )

            # Step 6: Run LLM scoring if enabled

            if score and not dry_run:
                logger.info("Running LLM scoring on unscored posts")
                _run_scoring(session_manager.supabase)

            if embed and not dry_run:
                logger.info("Running embedding generation for posts without embeddings")
                openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
                embedder = Embedder(session_manager.supabase, openai_client)
                embed_stats = embedder.generate_and_store_embeddings(dry_run=False)
                logger.info(
                    "Embedding complete: %d processed, %d stored, %d errors",
                    embed_stats["processed"],
                    embed_stats["stored"],
                    embed_stats["errors"],
                )

            logger.info("Pipeline complete (feed=%s, posts=%d)", feed_type, len(posts))

            if not dry_run:
                try:
                    session_manager.supabase.table("settings").upsert(
                        {
                            "key": "last_scrape_at",
                            "value": datetime.now(UTC).isoformat(),
                        },
                        on_conflict="key",
                    ).execute()
                except Exception as e:
                    logger.warning("Failed to update last_scrape_at: %s", e)

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
        # Last-resort catch so pipeline exits cleanly with code 1 (PR_REVIEW: intentional;
        # known exceptions handled above; broad catch avoids unhandled tracebacks in cron)
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
        "--embed",
        action="store_true",
        help="Run embedding generation after scrape/score so new posts are searchable",
    )
    parser.add_argument(
        "--extract-permalinks",
        action="store_true",
        help="Click Share on each post to extract permalink URL (slower)",
    )
    parser.add_argument(
        "--feed-type",
        choices=["recent", "trending"],
        default="recent",
        help="Which feed to scrape (default: recent)",
    )
    parser.add_argument(
        "--max-posts",
        type=int,
        default=None,
        help=f"Maximum posts to scrape (default: {SCRAPER_CONFIG['max_posts_per_run']})",  # noqa: E501
    )
    parser.add_argument(
        "--score",
        action="store_true",
        help="Run LLM scoring on unscored posts after scraping",
    )
    parser.add_argument(
        "--visible",
        action="store_true",
        help="Run browser in visible mode (not headless)",
    )
    args = parser.parse_args()

    sys.exit(
        main(
            dry_run=args.dry_run,
            embed=args.embed,
            extract_permalinks=args.extract_permalinks,
            feed_type=args.feed_type,
            max_posts=args.max_posts,
            score=args.score,
            visible=args.visible,
        )
    )
