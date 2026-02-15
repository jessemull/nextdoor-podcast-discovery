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

from src.config import FEED_URLS, LOGIN_URL, SCRAPER_CONFIG, validate_env
from src.embedder import Embedder
from src.exceptions import (
    CaptchaRequiredError,
    ConfigurationError,
    LoginFailedError,
    ScraperError,
)
from src.llm_scorer import LLMScorer
from src.post_storage import PostStorage
from src.robots import check_robots_allowed
from src.scraper import NextdoorScraper
from src.session_manager import SessionManager

# Load environment variables from .env file

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def _run_scoring(
    supabase_client: Client,
    unscored_batch_limit: int = 50,
) -> None:
    """Run LLM scoring on unscored posts.

    Args:
        supabase_client: Supabase client instance.
        unscored_batch_limit: Max number of unscored posts to fetch and score (default 50).
    """
    anthropic = Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        timeout=120.0,
    )
    scorer = LLMScorer(anthropic, supabase_client)

    # Get unscored posts

    unscored = scorer.get_unscored_posts(limit=unscored_batch_limit)
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
    check_robots: bool = False,
    dry_run: bool = False,
    embed: bool = False,
    feed_type: str = "recent",
    inspect: bool = False,
    max_posts: int | None = None,
    repeat_threshold: int | None = None,
    score: bool = False,
    score_only: bool = False,
    unscored_batch_limit: int = 50,
    visible: bool = False,
) -> int:
    """Run the scraper pipeline.

    Args:
        check_robots: If True, fetch robots.txt and exit with 1 if our paths are disallowed.
        dry_run: If True, don't make any changes to the database.
        embed: If True, run embedding generation after scrape/score (so new posts are searchable).
        feed_type: Which feed to scrape ("recent" or "trending").
        inspect: If True, open browser (iPhone mobile), go to feed, then pause so you can inspect DOM (e.g. Filter by menu).
        max_posts: Maximum number of posts to scrape (default from config).
        repeat_threshold: For Recent feed, stop after this many consecutive already-seen posts (default from config).
        score: If True, run LLM scoring on unscored posts after scraping.
        score_only: If True, skip scraping and only run score/embed (use to re-run scoring without re-scraping).
        unscored_batch_limit: Max unscored posts to score per run (default 50; use env UNSCORED_BATCH_LIMIT or --unscored-limit for backfills).
        visible: If True, run browser in visible mode (not headless).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    # Optional robots.txt check before scraping
    if check_robots:
        base_url = LOGIN_URL.rstrip("/").rsplit("/", 1)[0] or "https://nextdoor.com"
        paths = ["/login/", "/news_feed/"]
        allowed, message = check_robots_allowed(base_url, paths)
        if allowed:
            logger.info("Robots check: %s", message)
        else:
            logger.error("Robots check failed: %s", message)
            return 1

    # Validate feed type

    if feed_type not in FEED_URLS:
        logger.error(
            "Invalid feed type: %s (must be 'recent' or 'trending')", feed_type
        )
        return 1

    # Use default if not specified

    if max_posts is None:
        max_posts = SCRAPER_CONFIG["max_posts_per_run"]

    if score_only and not score and not embed:
        logger.error("--score-only requires at least one of --score or --embed")
        return 1

    logger.info(
        "Starting scraper pipeline (feed=%s, max_posts=%d, dry_run=%s, "
        "visible=%s, score=%s, embed=%s, score_only=%s)",
        feed_type,
        max_posts,
        dry_run,
        visible,
        score,
        embed,
        score_only,
    )

    try:
        # Validate environment variables
        validate_env()

        # Initialize session manager (for Supabase client)
        session_manager = SessionManager()

        if score_only:
            # Skip scraping; run only score and/or embed
            if score and not dry_run:
                logger.info(
                    "Running LLM scoring on unscored posts (limit=%d)",
                    unscored_batch_limit,
                )
                _run_scoring(
                    session_manager.supabase,
                    unscored_batch_limit=unscored_batch_limit,
                )
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
            logger.info("Score-only pipeline complete")
            return 0

        # Start browser (visible flag overrides config)
        headless = False if visible else SCRAPER_CONFIG["headless"]

        with NextdoorScraper(headless=False if inspect else headless) as scraper:
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

            # Inspect mode: pause so user can open DevTools and inspect DOM (e.g. Filter by menu)

            if inspect:
                print()
                print("Browser is open with iPhone mobile view on the news feed.")
                print(
                    "Open DevTools (F12 or right-click → Inspect), click the 'Filter by' menu to open it,"
                )
                print(
                    "then inspect the DOM for menu selectors. Press Enter here when done to close the browser."
                )
                input()
                return 0

            # Step 4 & 5: Extract and store until we have max_posts new rows in DB

            safety_cap = max(250, max_posts * 10)
            logger.info(
                "Extracting from %s feed until %d new posts are stored (safety cap: %d)",
                feed_type,
                max_posts,
                safety_cap,
            )
            stored = 0
            total_extracted = 0
            storage_stats: dict[str, int] | None = None
            if not dry_run:
                storage = PostStorage(session_manager.supabase)

            for batch in scraper.extract_post_batches(
                feed_type=feed_type,
                repeat_threshold=repeat_threshold,
                safety_cap=safety_cap,
            ):
                total_extracted += len(batch)
                if dry_run:
                    stored += len(batch)
                    if total_extracted == len(batch):
                        for i, post in enumerate(batch[:5]):
                            logger.info(
                                "Sample post %d: [%s] %s... (%d chars)",
                                i + 1,
                                post.author_name,
                                post.content[:80],
                                len(post.content),
                            )
                else:
                    remaining = max_posts - stored
                    to_store = batch[:remaining] if remaining < len(batch) else batch
                    stats = storage.store_posts(to_store)
                    stored += stats["inserted"]
                    logger.info(
                        "Batch: %d in batch, %d inserted, %d skipped (new posts stored: %d, target: %d)",
                        len(batch),
                        stats["inserted"],
                        stats["skipped"],
                        stored,
                        max_posts,
                    )
                if stored >= max_posts:
                    logger.info("Target reached: %d new posts stored", stored)
                    break

            if dry_run:
                logger.info(
                    "Dry run: would store %d posts (extracted %d)",
                    stored,
                    total_extracted,
                )
            else:
                storage_stats = {"inserted": stored, "skipped": 0, "errors": 0}

            # Step 6: Run LLM scoring if enabled

            if score and not dry_run:
                logger.info(
                    "Running LLM scoring on unscored posts (limit=%d)",
                    unscored_batch_limit,
                )
                _run_scoring(
                    session_manager.supabase,
                    unscored_batch_limit=unscored_batch_limit,
                )

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

            if storage_stats is not None:
                logger.info(
                    "Pipeline complete (feed=%s, extracted=%d, stored=%d)",
                    feed_type,
                    total_extracted,
                    storage_stats["inserted"],
                )
            else:
                logger.info(
                    "Pipeline complete (feed=%s, extracted=%d, dry_run)",
                    feed_type,
                    total_extracted,
                )

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
                    # Non-fatal: Supabase doesn't export specific exception types;
                    # continue pipeline even if timestamp update fails
                    logger.warning(
                        "Failed to update settings.last_scrape_at: %s (%s)",
                        e,
                        type(e).__name__,
                    )

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
        "--check-robots",
        action="store_true",
        help="Fetch robots.txt and exit with error if our paths are disallowed",
    )
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
        "--feed-type",
        choices=["recent", "trending"],
        default="recent",
        help="Which feed to scrape (default: recent)",
    )
    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Open browser (iPhone mobile), go to feed, then pause for DOM inspection (e.g. Filter by menu)",
    )
    parser.add_argument(
        "--max-posts",
        type=int,
        default=None,
        help=f"Maximum posts to scrape (default: {SCRAPER_CONFIG['max_posts_per_run']})",  # noqa: E501
    )
    parser.add_argument(
        "--repeat-threshold",
        dest="repeat_threshold",
        type=int,
        default=None,
        help="For Recent feed: stop after this many consecutive already-seen posts (default from config)",
    )
    parser.add_argument(
        "--score",
        action="store_true",
        help="Run LLM scoring on unscored posts after scraping",
    )
    parser.add_argument(
        "--score-only",
        action="store_true",
        dest="score_only",
        help="Skip scraping; only run score and/or embed (re-run scoring without re-scraping)",
    )
    parser.add_argument(
        "--unscored-limit",
        dest="unscored_batch_limit",
        type=int,
        default=None,
        help="Max unscored posts to score per run (default: 50 or UNSCORED_BATCH_LIMIT env)",
    )
    parser.add_argument(
        "--visible",
        action="store_true",
        help="Run browser in visible mode (not headless)",
    )
    args = parser.parse_args()

    unscored_limit = args.unscored_batch_limit
    if unscored_limit is None:
        env_limit = os.environ.get("UNSCORED_BATCH_LIMIT")
        unscored_limit = int(env_limit) if env_limit else 50
    unscored_limit = max(1, min(1000, unscored_limit))

    sys.exit(
        main(
            check_robots=args.check_robots,
            dry_run=args.dry_run,
            embed=args.embed,
            feed_type=args.feed_type,
            inspect=args.inspect,
            max_posts=args.max_posts,
            repeat_threshold=args.repeat_threshold,
            score=args.score,
            score_only=args.score_only,
            unscored_batch_limit=unscored_limit,
            visible=args.visible,
        )
    )
