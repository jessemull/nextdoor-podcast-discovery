"""Permalink fetch pipeline for the main scraper entrypoint."""

from __future__ import annotations

import logging
import os

from openai import OpenAI

from src.config import SCRAPER_CONFIG, validate_env
from src.embedder import Embedder
from src.main_scoring import _run_scoring_for_post
from src.post_extractor import PostExtractor
from src.post_storage import PostStorage
from src.scraper import NextdoorScraper
from src.session_manager import SessionManager

logger = logging.getLogger(__name__)


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

            # Navigate to raw permalink (post view with same DOM as feed card), not the
            # comments/details view, so extraction finds div.post / div.js-media-post.
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
                extract_comments=False,
            )
            if post and post.post_url:
                # Get comments the same way as feed: open post URL with view=detail in
                # a new tab, extract comments, close tab (current page stays on post view).
                post.comments = extractor._extract_comments_via_new_tab(post.post_url)

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
            result = storage.store_post_or_update(
                post, post_id=post_id, update_if_exists=True
            )

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
