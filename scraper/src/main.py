"""Main entry point for the scraper pipeline."""

__all__ = ["main"]

import argparse
import logging
import os
import sys
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import httpx
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
from src.post_extractor import PostExtractor
from src.post_storage import PostStorage
from src.robots import check_robots_allowed
from src.scraper import NextdoorScraper
from src.session_manager import SessionManager

# Max length for error_message stored in scraper_runs
SCRAPER_RUN_ERROR_MESSAGE_MAX_LEN = 500


def _record_scraper_run(
    supabase: Client,
    feed_type: str,
    status: str,
    error_message: str | None = None,
) -> None:
    """Insert one row into scraper_runs for Jobs page (self-reported outcome)."""
    try:
        row: dict[str, Any] = {
            "feed_type": feed_type,
            "run_at": datetime.now(UTC).isoformat(),
            "status": status,
        }
        if error_message:
            row["error_message"] = error_message[:SCRAPER_RUN_ERROR_MESSAGE_MAX_LEN]
        supabase.table("scraper_runs").insert(row).execute()
    except Exception as e:
        logger.warning(
            "Failed to record scraper run: %s (%s)",
            e,
            type(e).__name__,
        )


# Load environment variables from scraper/.env (works whether run from repo root or scraper/)
_scraper_dir = Path(__file__).resolve().parent.parent
load_dotenv(_scraper_dir / ".env")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_SEC = 60


def _heartbeat_loop(start_monotonic: float) -> None:
    """Log every HEARTBEAT_INTERVAL_SEC so you can tell if the process is alive or stuck."""
    while True:
        time.sleep(HEARTBEAT_INTERVAL_SEC)
        elapsed = time.monotonic() - start_monotonic
        logger.info(
            "Heartbeat: pipeline still running (elapsed %.0fs)",
            elapsed,
        )


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


def _run_scoring_for_post(supabase_client: Client, post_id: str) -> bool:
    """Score a single post by ID.

    Args:
        supabase_client: Supabase client.
        post_id: UUID of the post to score.

    Returns:
        True if scoring succeeded, False otherwise.
    """
    result = (
        supabase_client.table("posts")
        .select("id, text")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    if not result.data or len(result.data) == 0:
        logger.warning("Post %s not found for scoring", post_id)
        return False

    anthropic = Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        timeout=120.0,
    )
    scorer = LLMScorer(anthropic, supabase_client)
    row = cast(dict[str, Any], result.data[0])
    posts_data = [row]
    results = scorer.score_posts(posts_data)
    results = scorer.calculate_final_scores(results)
    stats = scorer.save_scores(results)
    logger.info(
        "Scored post %s: saved=%d, skipped=%d, errors=%d",
        post_id,
        stats["saved"],
        stats["skipped"],
        stats["errors"],
    )
    return stats["saved"] > 0 or stats["skipped"] > 0


def _run_permalink_fetch(
    permalink: str,
    post_id: str | None,
    dry_run: bool,
    visible: bool,
) -> int:
    """Fetch a single post by permalink URL; insert or update.

    Args:
        permalink: Nextdoor permalink URL (e.g. https://nextdoor.com/p/ABC123).
        post_id: If set, update existing post; otherwise insert new.
        dry_run: If True, don't write to DB.
        visible: If True, run browser visible.

    Returns:
        Exit code (0 success, 1 failure).
    """
    try:
        validate_env()
        session_manager = SessionManager()
        headless = not visible

        with NextdoorScraper(headless=headless) as scraper:
            cookies = session_manager.get_cookies()
            if cookies:
                scraper.load_cookies(cookies)
                if not scraper.is_logged_in():
                    cookies = None
            if not cookies:
                scraper.login()
                if not dry_run:
                    new_cookies = scraper.get_cookies()
                    session_manager.save_cookies(new_cookies)

            if not scraper.page:
                logger.error("Browser page not available")
                return 1

            # Navigate to permalink URL
            timeout = SCRAPER_CONFIG["navigation_timeout_ms"]
            logger.info("Navigating to permalink: %s", permalink)
            scraper.page.goto(permalink, timeout=timeout)

            # Wait for post content
            scraper.page.wait_for_selector(
                "div.post, div.js-media-post",
                timeout=timeout,
            )

            extractor = PostExtractor(scraper.page, feed_type="recent", max_posts=1)
            post = extractor.extract_single_post_from_current_page(
                page_url=permalink,
                extract_comments=True,
            )

            if not post:
                logger.error("No post found at permalink: %s", permalink)
                return 1

            if dry_run:
                logger.info(
                    "Dry run: would store post [%s] %s... (reactions=%d)",
                    post.author_name,
                    post.content[:80],
                    post.reaction_count,
                )
                return 0

            storage = PostStorage(session_manager.supabase)
            result = storage.store_post_or_update(post, post_id=post_id)

            if result["errors"]:
                logger.error("Failed to store/update post")
                return 1

            stored_post_id = result.get("post_id")
            if stored_post_id:
                # Always score and embed (insert or update) so post is discoverable
                _run_scoring_for_post(session_manager.supabase, stored_post_id)
                openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
                embedder = Embedder(session_manager.supabase, openai_client)
                embedder.embed_post(stored_post_id, dry_run=False)

            logger.info(
                "Permalink fetch complete: %s (post_id=%s)",
                result["action"],
                stored_post_id,
            )
            return 0

    except Exception as e:
        logger.exception("Permalink fetch failed: %s", e)
        return 1


def main(
    check_robots: bool = False,
    dry_run: bool = False,
    embed: bool = True,
    feed_type: str = "recent",
    inspect: bool = False,
    max_posts: int | None = None,
    no_embed: bool = False,
    no_score: bool = False,
    permalink: str | None = None,
    post_id: str | None = None,
    repeat_threshold: int | None = None,
    score: bool = True,
    score_only: bool = False,
    unscored_batch_limit: int = 50,
    visible: bool = False,
) -> int:
    """Run the scraper pipeline.

    Default: scrape, score, and embed so posts are discoverable. Use --no-score
    or --no-embed to skip those steps.

    Args:
        check_robots: If True, fetch robots.txt and exit with 1 if our paths are disallowed.
        dry_run: If True, don't make any changes to the database.
        embed: If True, run embedding after scrape/score (default True; use --no-embed to skip).
        feed_type: Which feed to scrape ("recent" or "trending").
        inspect: If True, open browser (iPhone mobile), go to feed, then pause for DOM inspection.
        max_posts: Maximum number of posts to scrape (default from config).
        no_embed: If True, skip embedding (overrides default).
        no_score: If True, skip LLM scoring (overrides default).
        permalink: If set, fetch single post by URL instead of scraping feed.
        post_id: With --permalink, update existing post by UUID.
        repeat_threshold: For Recent feed, stop after this many consecutive already-seen posts.
        score: If True, run LLM scoring on unscored posts (default True; use --no-score to skip).
        score_only: If True, skip scraping and only run score/embed.
        unscored_batch_limit: Max unscored posts to score per run (default 50).
        visible: If True, run browser in visible mode (not headless).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if no_score:
        score = False
    if no_embed:
        embed = False
    # Permalink mode: fetch single post by URL (insert or update)
    if permalink:
        return _run_permalink_fetch(
            permalink=permalink,
            post_id=post_id,
            dry_run=dry_run,
            visible=visible,
        )

    # Optional robots.txt check before scraping
    if check_robots:
        base_url = LOGIN_URL.rstrip("/").rsplit("/", 1)[0] or "https://nextdoor.com"
        paths = ["/login/", "/news_feed/"]
        allowed, message = check_robots_allowed(base_url, paths)
        if allowed:
            logger.info("Robots check: %s", message)
        else:
            logger.error("Robots check failed: %s", message)
            logger.info("Exiting with code 1")
            return 1

    # Validate feed type

    if feed_type not in FEED_URLS:
        logger.error(
            "Invalid feed type: %s (must be 'recent' or 'trending')", feed_type
        )
        logger.info("Exiting with code 1")
        return 1

    # Use default if not specified

    if max_posts is None:
        max_posts = SCRAPER_CONFIG["max_posts_per_run"]

    if score_only and not score and not embed:
        logger.error(
            "--score-only requires at least one of score or embed (don't use both --no-score and --no-embed with --score-only)"
        )
        logger.info("Exiting with code 1")
        return 1

    run_start = time.monotonic()
    run_start_iso = datetime.now(UTC).isoformat()
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
        logger.info(
            "Run PID=%s started at %s — if this hangs, check heartbeats below; "
            "run with PYTHONUNBUFFERED=1 and 2>&1 | tee scrape.log to capture logs",
            os.getpid(),
            run_start_iso,
        )
        heartbeat = threading.Thread(
            target=_heartbeat_loop,
            args=(run_start,),
            daemon=True,
        )
        heartbeat.start()

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
            logger.info("Exiting with code 0")
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
                logger.info("Exiting with code 0")
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
            # After a scrape, score at least all newly stored posts so the feed shows them
            if score and not dry_run:
                scoring_limit = unscored_batch_limit
                if storage_stats is not None:
                    newly_stored = storage_stats.get("inserted", 0)
                    scoring_limit = max(scoring_limit, newly_stored)
                logger.info(
                    "Running LLM scoring on unscored posts (limit=%d)",
                    scoring_limit,
                )
                _run_scoring(
                    session_manager.supabase,
                    unscored_batch_limit=scoring_limit,
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
                _record_scraper_run(session_manager.supabase, feed_type, "completed")

        logger.info("Exiting with code 0")
        return 0

    except ConfigurationError as e:
        logger.error("Configuration error: %s", e)
        logger.info("Exiting with code 1")
        return 1
    except CaptchaRequiredError as e:
        logger.error("CAPTCHA required: %s", e)
        logger.error("Manual intervention needed - run with --visible to solve CAPTCHA")
        try:
            _record_scraper_run(session_manager.supabase, feed_type, "error", str(e))
        except NameError:
            pass
        logger.info("Exiting with code 1")
        return 1
    except LoginFailedError as e:
        logger.error("Login failed: %s", e)
        try:
            _record_scraper_run(session_manager.supabase, feed_type, "error", str(e))
        except NameError:
            pass
        logger.info("Exiting with code 1")
        return 1
    except ScraperError as e:
        logger.error("Scraper error: %s", e)
        try:
            _record_scraper_run(session_manager.supabase, feed_type, "error", str(e))
        except NameError:
            pass
        logger.info("Exiting with code 1")
        return 1
    except httpx.ConnectError as e:
        logger.exception("Cannot reach Supabase (%s): %s", type(e).__name__, e)
        logger.error(
            "Check scraper/.env: SUPABASE_URL and SUPABASE_SERVICE_KEY must point to a valid project."
        )
        logger.info("Exiting with code 1")
        return 1
    except Exception as e:
        # Last-resort catch so pipeline exits cleanly with code 1 (PR_REVIEW: intentional;
        # known exceptions handled above; broad catch avoids unhandled tracebacks in cron)
        logger.exception("Unexpected error (%s): %s", type(e).__name__, e)
        try:
            _record_scraper_run(session_manager.supabase, feed_type, "error", str(e))
        except NameError:
            pass
        logger.info("Exiting with code 1")
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
        "--no-embed",
        action="store_true",
        dest="no_embed",
        help="Skip embedding (default is to embed so new posts are searchable)",
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
        "--permalink",
        dest="permalink",
        type=str,
        default=None,
        help="Fetch a single post by Nextdoor permalink URL (e.g. https://nextdoor.com/p/ABC123)",
    )
    parser.add_argument(
        "--post-id",
        dest="post_id",
        type=str,
        default=None,
        help="When used with --permalink: update existing post by UUID instead of inserting new",
    )
    parser.add_argument(
        "--repeat-threshold",
        dest="repeat_threshold",
        type=int,
        default=None,
        help="For Recent feed: stop after this many consecutive already-seen posts (default from config)",
    )
    parser.add_argument(
        "--no-score",
        action="store_true",
        dest="no_score",
        help="Skip LLM scoring (default is to score unscored posts after scraping)",
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
            feed_type=args.feed_type,
            inspect=args.inspect,
            max_posts=args.max_posts,
            no_embed=getattr(args, "no_embed", False),
            no_score=getattr(args, "no_score", False),
            permalink=args.permalink,
            post_id=args.post_id,
            repeat_threshold=args.repeat_threshold,
            score_only=args.score_only,
            unscored_batch_limit=unscored_limit,
            visible=args.visible,
        )
    )
