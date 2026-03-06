"""Post extraction from Nextdoor feed."""

__all__ = ["PostExtractor", "RawComment", "RawPost"]

import hashlib
import logging
import random
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from src.config import SCRAPER_CONFIG

logger = logging.getLogger(__name__)

# Minimum content length to consider a post valid (skip empty/stub posts)

MIN_CONTENT_LENGTH = 10

# Match "view more comments", "See more comments", "see 3 more replies", "View 5 more replies", etc.
VIEW_MORE_BUTTON_PATTERN = re.compile(
    r"(view|see)\s+(\d+\s+)?more\s+(repl(y|ies)|comment(s)?)",
    re.IGNORECASE,
)


@dataclass
class RawComment:
    """Single comment on a post."""

    author_name: str
    text: str
    timestamp_relative: str | None = None


@dataclass
class RawPost:
    """Raw post data extracted from Nextdoor feed.

    Required fields are listed first, optional fields are alphabetized after.
    """

    # Required fields

    author_id: str
    author_name: str
    content: str
    content_hash: str

    # Optional fields (alphabetized)

    comment_count: int | None = None
    comments: list["RawComment"] = field(default_factory=list)
    image_urls: list[str] = field(default_factory=list)
    neighborhood: str | None = None
    post_url: str | None = None
    reaction_count: int = 0
    timestamp_relative: str | None = None


def _get_extraction_script(min_content_length: int) -> str:
    """Generate JavaScript to extract post data from DOM.

    Args:
        min_content_length: Minimum content length to include a post.

    Returns:
        JavaScript code string.
    """
    # Selectors used in JavaScript extraction
    author_sel = 'a[href*="/profile/"][href*="is=feed_author"]'
    timestamp_sel = '[data-testid="post-timestamp"]'
    content_sel = '[data-testid="styled-text"]'
    image_sel = '[data-testid="resized-image"]'
    reaction_sel = '[data-testid="reaction-button-text"]'
    reply_sel = '[data-testid="post-reply-button"]'

    return f"""
(() => {{
    const posts = [];
    const MIN_LEN = {min_content_length};
    const AUTHOR_SEL = '{author_sel}';
    const TIMESTAMP_SEL = '{timestamp_sel}';
    const CONTENT_SEL = '{content_sel}';
    const IMAGE_SEL = '{image_sel}';
    const REACTION_SEL = '{reaction_sel}';
    const REPLY_SEL = '{reply_sel}';

    const containers = document.querySelectorAll('div.post, div.js-media-post');
    containers.forEach((el, containerIndex) => {{
        try {{
            if (el.textContent?.includes('Sponsored')) return;
            if (el.closest('[class*="gam-ad"], [class*="ad-placeholder"], [class*="feed-gam-ad"]')) return;

            const authorLink = el.querySelector(AUTHOR_SEL);
            if (!authorLink) return;

            const href = authorLink.getAttribute('href') || '';
            const match = href.match(/\\/profile\\/([^/?]+)/);
            const authorId = match?.[1];
            if (!authorId) return;

            let authorName = '';
            for (const link of el.querySelectorAll(AUTHOR_SEL)) {{
                const t = link.textContent?.trim() || '';
                if (t && !t.startsWith('Avatar for') && t.length > 1) {{
                    authorName = t;
                    break;
                }}
            }}

            const hoodLink = el.querySelector('a[href*="/neighborhood/"]');
            const neighborhood = hoodLink?.textContent?.trim() || null;

            const tsEl = el.querySelector(TIMESTAMP_SEL);
            const timestamp = tsEl?.textContent?.trim() || null;

            const contentEl = el.querySelector(CONTENT_SEL);
            const content = contentEl?.textContent?.trim() || '';
            if (!content || content.length < MIN_LEN) return;

            const imgs = el.querySelectorAll(IMAGE_SEL);
            const imageUrls = Array.from(imgs).map(i => i.src).filter(Boolean);

            const rxEl = el.querySelector(REACTION_SEL);
            const reactionCount = parseInt(rxEl?.textContent || '0', 10) || 0;

            const replyEl = el.querySelector(REPLY_SEL);
            const commentCount = replyEl ? (parseInt(replyEl.textContent?.trim() || '0', 10) || 0) : null;

            let postUrl = null;
            const postLink = el.querySelector('a[href*="/p/"]');
            if (postLink) {{
                const h = postLink.getAttribute('href');
                if (h) postUrl = h.startsWith('http') ? h : (window.location.origin + (h.startsWith('/') ? h : '/' + h));
            }}

            posts.push({{
                authorId, authorName, commentCount, content, imageUrls,
                neighborhood, postUrl, reactionCount, timestamp,
                containerIndex,
                postIndex: posts.length
            }});
        }} catch (e) {{
            console.error('Extract error:', e);
        }}
    }});

    return posts;
}})()
"""


def _get_first_visible_post_script(min_content_length: int) -> str:
    """Generate JavaScript to find the first post container in the viewport and return its index and raw data."""
    author_sel = 'a[href*="/profile/"][href*="is=feed_author"]'
    timestamp_sel = '[data-testid="post-timestamp"]'
    content_sel = '[data-testid="styled-text"]'
    image_sel = '[data-testid="resized-image"]'
    reaction_sel = '[data-testid="reaction-button-text"]'
    reply_sel = '[data-testid="post-reply-button"]'

    return f"""
(() => {{
    const MIN_LEN = {min_content_length};
    const AUTHOR_SEL = '{author_sel}';
    const TIMESTAMP_SEL = '{timestamp_sel}';
    const CONTENT_SEL = '{content_sel}';
    const IMAGE_SEL = '{image_sel}';
    const REACTION_SEL = '{reaction_sel}';
    const REPLY_SEL = '{reply_sel}';

    const containers = document.querySelectorAll('div.post, div.js-media-post');
    for (let containerIndex = 0; containerIndex < containers.length; containerIndex++) {{
        const el = containers[containerIndex];
        try {{
            if (el.textContent?.includes('Sponsored')) continue;
            if (el.closest('[class*="gam-ad"], [class*="ad-placeholder"], [class*="feed-gam-ad"]')) continue;

            const rect = el.getBoundingClientRect();
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

            const authorLink = el.querySelector(AUTHOR_SEL);
            if (!authorLink) continue;

            const href = authorLink.getAttribute('href') || '';
            const match = href.match(/\\/profile\\/([^/?]+)/);
            const authorId = match?.[1];
            if (!authorId) continue;

            let authorName = '';
            for (const link of el.querySelectorAll(AUTHOR_SEL)) {{
                const t = link.textContent?.trim() || '';
                if (t && !t.startsWith('Avatar for') && t.length > 1) {{ authorName = t; break; }}
            }}

            const hoodLink = el.querySelector('a[href*="/neighborhood/"]');
            const neighborhood = hoodLink?.textContent?.trim() || null;

            const tsEl = el.querySelector(TIMESTAMP_SEL);
            const timestamp = tsEl?.textContent?.trim() || null;

            const contentEl = el.querySelector(CONTENT_SEL);
            const content = contentEl?.textContent?.trim() || '';
            if (!content || content.length < MIN_LEN) continue;

            const imgs = el.querySelectorAll(IMAGE_SEL);
            const imageUrls = Array.from(imgs).map(i => i.src).filter(Boolean);

            const rxEl = el.querySelector(REACTION_SEL);
            const reactionCount = parseInt(rxEl?.textContent || '0', 10) || 0;

            const replyEl = el.querySelector(REPLY_SEL);
            const commentCount = replyEl ? (parseInt(replyEl.textContent?.trim() || '0', 10) || 0) : null;

            let postUrl = null;
            const postLink = el.querySelector('a[href*="/p/"]');
            if (postLink) {{
                const h = postLink.getAttribute('href');
                if (h) postUrl = h.startsWith('http') ? h : (window.location.origin + (h.startsWith('/') ? h : '/' + h));
            }}

            return {{
                containerIndex,
                raw: {{
                    authorId, authorName, commentCount, content, imageUrls,
                    neighborhood, postUrl, reactionCount, timestamp,
                    containerIndex,
                    postIndex: 0
                }}
            }};
        }} catch (e) {{ continue; }}
    }}
    return null;
}})()
"""


class PostExtractor:
    """Extracts posts from Nextdoor feed page."""

    # Stop scrolling if no new posts found after this many attempts

    MAX_EMPTY_SCROLLS = 5

    # Maximum scroll attempts before giving up (Recent feed)

    MAX_SCROLL_ATTEMPTS = 100

    # One-by-one flow: stop when same first-visible post seen this many times

    STUCK_THRESHOLD = 10

    def __init__(
        self,
        page: Page,
        feed_type: str = "recent",
        max_posts: int = 250,
        repeat_threshold: int = 10,
        run_stats: dict[str, int] | None = None,
    ) -> None:
        """Initialize the extractor.

        Args:
            page: Playwright page object.
            feed_type: "recent" or "trending"; affects stop logic and max scrolls.
            max_posts: Maximum number of posts to extract.
            repeat_threshold: For Recent feed only: stop when this many consecutive
                already-seen posts appear from the start of a batch.
            run_stats: Optional dict to accumulate warning/error counts for run summary.
                Keys: "comment_fallbacks", "comment_mismatches", "modal_failures".
        """
        self.feed_type = feed_type
        self.max_posts = max_posts
        self.page = page
        self.repeat_threshold = repeat_threshold
        self.run_stats = run_stats
        self.seen_hashes: set[str] = set()

    def extract_posts(self) -> list[RawPost]:
        """Scroll through feed and extract posts.

        Returns:
            List of extracted posts.
        """
        posts: list[RawPost] = []
        scroll_attempts = 0
        no_new_posts_count = 0
        timeout = SCRAPER_CONFIG["navigation_timeout_ms"]

        logger.debug("Starting post extraction (max_posts=%d)", self.max_posts)

        # Wait for feed to load

        try:
            self.page.wait_for_selector("div.post, div.js-media-post", timeout=timeout)
            logger.debug("Feed content detected, starting extraction")
        except PlaywrightTimeoutError:
            logger.warning("Timeout waiting for post containers")
            self._log_page_debug_info()

        # Generate extraction script with config value

        extraction_script = _get_extraction_script(MIN_CONTENT_LENGTH)

        max_scrolls = (
            SCRAPER_CONFIG["max_scroll_attempts_trending"]
            if self.feed_type == "trending"
            else self.MAX_SCROLL_ATTEMPTS
        )
        while len(posts) < self.max_posts and scroll_attempts < max_scrolls:
            # Extract visible posts using JavaScript

            raw_posts = self.page.evaluate(extraction_script)

            if scroll_attempts == 0:
                logger.debug("First scroll found %d raw posts", len(raw_posts))

            # Recent feed: stop before adding if repeat_threshold consecutive already-seen at start
            if self.feed_type == "recent" and self.repeat_threshold > 0:
                consecutive_seen = self._count_consecutive_already_seen(raw_posts)
                if consecutive_seen >= self.repeat_threshold:
                    logger.info(
                        "Repeat threshold reached (%d consecutive already-seen at start), stopping",
                        consecutive_seen,
                    )
                    break

            # Process extracted data

            new_count = self._process_batch(raw_posts, posts)

            logger.debug(
                "Scroll %d: Found %d new posts (total: %d/%d)",
                scroll_attempts + 1,
                new_count,
                len(posts),
                self.max_posts,
            )

            # Recent feed: stop only when many already-seen at top and no new posts this round
            if (
                self.feed_type == "recent"
                and self.repeat_threshold > 0
                and new_count == 0
            ):
                consecutive_seen = self._count_consecutive_already_seen(raw_posts)
                if consecutive_seen >= self.repeat_threshold:
                    logger.info(
                        "Repeat threshold reached (%d consecutive already-seen, 0 new), stopping",
                        consecutive_seen,
                    )
                    break

            # Check if we're getting new content

            if new_count == 0:
                no_new_posts_count += 1
                if no_new_posts_count >= self.MAX_EMPTY_SCROLLS:
                    logger.warning(
                        "No new posts after %d scrolls, stopping",
                        self.MAX_EMPTY_SCROLLS,
                    )
                    break
            else:
                no_new_posts_count = 0

            # Scroll down to load more

            self._scroll_down()
            scroll_attempts += 1

        logger.debug("Extraction complete: %d posts", len(posts))
        return posts

    def extract_post_batches(self, safety_cap: int = 500) -> Iterator[list[RawPost]]:
        """Yield batches of new posts after each scroll until caps are hit.

        Use this when the pipeline wants to store after each batch and stop
        when a target number of posts have been stored (not just extracted).
        Stops when: scroll cap, empty scrolls, repeat threshold (recent), or
        total posts yielded >= safety_cap.

        Args:
            safety_cap: Stop yielding after this many total posts (avoids
                runaway if the feed keeps returning new in-run duplicates only).

        Yields:
            List of new RawPost from the current scroll (may be empty).
        """
        total_yielded = 0
        scroll_attempts = 0
        timeout = SCRAPER_CONFIG["navigation_timeout_ms"]

        logger.debug(
            "Starting batch extraction (safety_cap=%d, feed_type=%s)",
            safety_cap,
            self.feed_type,
        )

        try:
            self.page.wait_for_selector("div.post, div.js-media-post", timeout=timeout)
            logger.debug(
                "Feed content detected, starting one-post-per-cycle extraction"
            )
        except PlaywrightTimeoutError:
            logger.warning("Timeout waiting for post containers")
            self._log_page_debug_info()
            return

        max_cycles = safety_cap * 3
        cycle = 0
        stuck_count = 0
        no_visible_count = 0
        last_known_scroll_y: float = 0.0

        while total_yielded < safety_cap and cycle < max_cycles:
            cycle += 1
            logger.debug(
                "Cycle %d: first visible (yielded so far: %d)",
                cycle,
                total_yielded,
            )

            result = self._get_first_visible_post()
            if result is None:
                no_visible_count += 1
                logger.debug(
                    "No post in view (attempt %d/%d), scrolling down",
                    no_visible_count,
                    self.MAX_EMPTY_SCROLLS,
                )
                if no_visible_count >= self.MAX_EMPTY_SCROLLS:
                    logger.warning(
                        "No post in view after %d attempts, stopping",
                        no_visible_count,
                    )
                    return
                self._scroll_down()
                scroll_attempts += 1
                continue
            no_visible_count = 0

            container_index, raw = result
            author_id = raw.get("authorId") or ""
            content = (raw.get("content") or "").strip()
            if not author_id or not content:
                self._scroll_next_post_into_view(container_index)
                continue
            content_hash = self._generate_hash(author_id, content)

            if content_hash in self.seen_hashes:
                stuck_count += 1
                logger.debug(
                    "Stuck: same first-visible post (index=%d, stuck_count=%d/%d)",
                    container_index,
                    stuck_count,
                    self.STUCK_THRESHOLD,
                )
                if stuck_count >= self.STUCK_THRESHOLD:
                    logger.info(
                        "Repeat threshold reached (same first-visible post %d times), stopping",
                        stuck_count,
                    )
                    return
                has_next = self._scroll_next_post_into_view(container_index)
                if not has_next:
                    self._scroll_down()
                    scroll_attempts += 1
                try:
                    scroll_y = self.page.evaluate("() => window.scrollY") or 0
                    if scroll_y < 100 and last_known_scroll_y > 200:
                        self.page.evaluate(
                            f"() => window.scrollTo(0, {last_known_scroll_y})"
                        )
                        self.page.wait_for_timeout(500)
                    else:
                        last_known_scroll_y = float(scroll_y)
                except Exception:
                    pass
                continue
            stuck_count = 0

            post = self._scrape_one_post(container_index, raw)
            if post is None:
                self._scroll_next_post_into_view(container_index)
                continue
            if post.content_hash in self.seen_hashes:
                self._scroll_next_post_into_view(container_index)
                continue

            self.seen_hashes.add(post.content_hash)
            total_yielded += 1
            yield [post]

            if total_yielded >= safety_cap:
                logger.debug("Safety cap reached (%d posts), stopping", safety_cap)
                return

            has_next = self._scroll_next_post_into_view(container_index)
            if not has_next:
                self._scroll_down()
                scroll_attempts += 1

            try:
                scroll_y = self.page.evaluate("() => window.scrollY") or 0
                if scroll_y < 100 and last_known_scroll_y > 200:
                    self.page.evaluate(
                        f"() => window.scrollTo(0, {last_known_scroll_y})"
                    )
                    self.page.wait_for_timeout(500)
                else:
                    last_known_scroll_y = float(scroll_y)
            except Exception:
                pass

        logger.debug("Batch extraction complete: %d posts yielded", total_yielded)

    def extract_single_post_from_current_page(
        self,
        page_url: str | None = None,
        extract_comments: bool = True,
    ) -> RawPost | None:
        """Extract a single post from the current page (e.g. permalink page).

        Does not scroll. Uses page URL as permalink when on a single-post page.
        When the URL is a permalink (/p/), the page is a feed with that post first;
        we open the desktop modal (same as feed) to extract comments.

        Args:
            page_url: Permalink URL (e.g. from page). If None, may be set from the comment modal when opened.
            extract_comments: If True, extract comments when on a permalink (via desktop modal).

        Returns:
            RawPost or None if no post found.
        """
        extraction_script = _get_extraction_script(MIN_CONTENT_LENGTH)
        raw_posts = self.page.evaluate(extraction_script)

        if not raw_posts or len(raw_posts) == 0:
            logger.warning("No posts found on current page")
            return None

        raw = raw_posts[0]
        container_index = raw.get("containerIndex", raw.get("postIndex", 0))

        post_url: str | None
        if page_url:
            post_url = page_url
        else:
            post_url = self._normalize_post_url(raw.get("postUrl"))

        comments: list[RawComment] = []
        if extract_comments:
            if page_url and "/p/" in page_url:
                # Permalink page is a feed with this post first; open modal on same page.
                comment_count_ui = raw.get("commentCount")
                comments, modal_permalink = self._extract_comments_via_desktop_modal(
                    container_index,
                    comment_count_ui=comment_count_ui,
                )
                if not post_url and modal_permalink:
                    post_url = modal_permalink
            else:
                # Comment extraction only supported for permalink (we open the modal there); no separate details page.
                pass

        author_id = raw.get("authorId", "")
        author_name = raw.get("authorName", "")
        content = raw.get("content", "")

        if not author_id or not content or len(content) < MIN_CONTENT_LENGTH:
            return None

        content_hash = self._generate_hash(author_id, content)

        post = RawPost(
            author_id=author_id,
            author_name=author_name,
            comment_count=raw.get("commentCount"),
            comments=comments,
            content=content,
            content_hash=content_hash,
            image_urls=raw.get("imageUrls", []),
            neighborhood=raw.get("neighborhood") or None,
            post_url=post_url,
            reaction_count=raw.get("reactionCount", 0),
            timestamp_relative=raw.get("timestamp") or None,
        )
        if post.comment_count is not None and post.comment_count != len(post.comments):
            if self.run_stats is not None:
                self.run_stats["comment_mismatches"] = (
                    self.run_stats.get("comment_mismatches", 0) + 1
                )
            logger.warning(
                "Comment count mismatch: UI=%d, scraped=%d (post_url=%s)",
                post.comment_count,
                len(post.comments),
                post.post_url or "?",
            )
        return post

    def _process_batch(
        self,
        raw_posts: list[dict[str, Any]],
        posts: list[RawPost],
        cap: int | None = None,
    ) -> int:
        """Process a batch of raw posts and add to posts list.

        Each post: get permalink (Share on feed), then open details in a new tab
        for comments and close it. Feed tab is never navigated away.

        Args:
            raw_posts: List of raw post dicts from JavaScript.
            posts: Accumulator list to add processed posts to.
            cap: Stop adding after this many new posts in this batch.
                If None, use self.max_posts (for extract_posts). Caller can pass
                a large value when building a single batch to yield.

        Returns:
            Number of new posts added.
        """
        limit = cap if cap is not None else self.max_posts
        new_count = 0

        for raw in raw_posts:
            if len(posts) >= limit:
                break

            post = self._process_raw_post(raw)
            if post and post.content_hash not in self.seen_hashes:
                self.seen_hashes.add(post.content_hash)
                posts.append(post)
                new_count += 1

        return new_count

    def _log_page_debug_info(self) -> None:
        """Log debug info about the current page state."""
        debug_info = self.page.evaluate("""
            () => ({
                url: window.location.href,
                bodyLen: document.body?.innerHTML?.length || 0,
                posts: document.querySelectorAll('div.post').length,
                links: document.querySelectorAll('a[href*="/profile/"]').length
            })
            """)
        logger.debug("Page debug info: %s", debug_info)

    def _get_first_visible_post_diagnostics(self) -> dict[str, Any]:
        """Return counts for debugging: total containers, in viewport, skipped ads, with author."""
        return (
            self.page.evaluate(
                """
            () => {
                const containers = document.querySelectorAll('div.post, div.js-media-post');
                let inView = 0, hasAuthor = 0, skippedAd = 0;
                for (let i = 0; i < containers.length; i++) {
                    const el = containers[i];
                    if (el.textContent?.includes('Sponsored') || el.closest('[class*="gam-ad"], [class*="ad-placeholder"], [class*="feed-gam-ad"]')) {
                        skippedAd++;
                        continue;
                    }
                    const rect = el.getBoundingClientRect();
                    if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
                    inView++;
                    const authorLink = el.querySelector('a[href*="/profile/"][href*="is=feed_author"]');
                    if (authorLink && authorLink.getAttribute('href')?.match(/\\/profile\\/([^/?]+)/)) hasAuthor++;
                }
                return { total: containers.length, inViewport: inView, skippedAds: skippedAd, inViewWithAuthor: hasAuthor, scrollY: window.scrollY };
            }
            """
            )
            or {}
        )

    def _get_first_visible_post(self) -> tuple[int, dict[str, Any]] | None:
        """Return the first post container in the viewport and its raw data.

        Returns:
            (container_index, raw_dict) or None if no post in view.
        """
        script = _get_first_visible_post_script(MIN_CONTENT_LENGTH)
        result = self.page.evaluate(script)
        if not result or not isinstance(result, dict):
            diag = self._get_first_visible_post_diagnostics()
            logger.debug(
                "First visible: none (total=%s, inViewport=%s, skippedAds=%s, inViewWithAuthor=%s, scrollY=%s)",
                diag.get("total"),
                diag.get("inViewport"),
                diag.get("skippedAds"),
                diag.get("inViewWithAuthor"),
                diag.get("scrollY"),
            )
            return None
        raw = result.get("raw")
        idx = result.get("containerIndex", 0)
        if raw is None:
            return None
        logger.debug("First visible: container_index=%d", idx)
        return (idx, raw)

    def _scroll_next_post_into_view(self, current_index: int) -> bool:
        """Scroll the next post container to the top of the viewport so it becomes first visible.

        Uses block: 'start' so the previous card moves above the viewport and we don't
        re-detect the same post as "first visible" on the next cycle.

        Returns:
            True if there was a next container and we scrolled to it, False otherwise.
        """
        containers = self.page.locator("div.post, div.js-media-post")
        count = containers.count()
        if count <= current_index + 1:
            logger.debug(
                "No next container (count=%d, current_index=%d)",
                count,
                current_index,
            )
            return False
        # Scroll next container to top of viewport so previous card is out of view
        scrolled = self.page.evaluate(
            """
            ([nextIdx]) => {
                const containers = document.querySelectorAll('div.post, div.js-media-post');
                if (containers.length <= nextIdx) return false;
                containers[nextIdx].scrollIntoView({ block: 'start', behavior: 'instant' });
                return true;
            }
            """,
            [current_index + 1],
        )
        self.page.wait_for_timeout(300)
        return bool(scrolled)

    def _scrape_one_post(
        self, container_index: int, raw: dict[str, Any]
    ) -> RawPost | None:
        """Scroll container into view, get permalink and comments, build RawPost.

        Returns:
            RawPost or None if invalid.
        """
        author_id = raw.get("authorId", "")
        author_name = raw.get("authorName", "")
        content = raw.get("content", "")

        if not author_id or not content or len(content) < MIN_CONTENT_LENGTH:
            return None

        content_hash = self._generate_hash(author_id, content)

        containers = self.page.locator("div.post, div.js-media-post")
        if containers.count() <= container_index:
            return None
        containers.nth(container_index).scroll_into_view_if_needed(timeout=3000)
        self.page.wait_for_timeout(200)

        post_url = self._normalize_post_url(raw.get("postUrl"))

        comment_count_ui = raw.get("commentCount")
        comments: list[RawComment]
        comments, modal_permalink = self._extract_comments_via_desktop_modal(
            container_index,
            comment_count_ui=comment_count_ui,
        )
        if not post_url and modal_permalink:
            post_url = modal_permalink
        if not comments and post_url and "/p/" in post_url:
            if comment_count_ui is None or comment_count_ui > 0:
                if self.run_stats is not None:
                    self.run_stats["comment_fallbacks"] = (
                        self.run_stats.get("comment_fallbacks", 0) + 1
                    )
                comments = self._extract_comments_via_details_page(post_url)

        post = RawPost(
            author_id=author_id,
            author_name=author_name,
            comment_count=raw.get("commentCount"),
            comments=comments,
            content=content,
            content_hash=content_hash,
            image_urls=raw.get("imageUrls", []),
            neighborhood=raw.get("neighborhood") or None,
            post_url=post_url,
            reaction_count=raw.get("reactionCount", 0),
            timestamp_relative=raw.get("timestamp") or None,
        )
        if post.comment_count is not None and post.comment_count != len(post.comments):
            if self.run_stats is not None:
                self.run_stats["comment_mismatches"] = (
                    self.run_stats.get("comment_mismatches", 0) + 1
                )
            logger.warning(
                "Comment count mismatch: UI=%d, scraped=%d (post_url=%s)",
                post.comment_count,
                len(post.comments),
                post.post_url or "?",
            )
        return post

    def _process_raw_post(self, raw: dict[str, Any]) -> RawPost | None:
        """Process raw post data from JavaScript.

        Args:
            raw: Raw post dictionary from JS evaluation.

        Returns:
            RawPost or None if invalid.
        """
        author_id = raw.get("authorId", "")
        author_name = raw.get("authorName", "")
        content = raw.get("content", "")

        if not author_id or not content:
            return None
        if len(content) < MIN_CONTENT_LENGTH:
            return None

        # Generate content hash for deduplication

        content_hash = self._generate_hash(author_id, content)

        container_index = raw.get("containerIndex", raw.get("postIndex", 0))
        post_url = self._normalize_post_url(raw.get("postUrl"))

        comment_count_ui = raw.get("commentCount")
        comments: list[RawComment]
        # Desktop: always open post modal so we can read permalink from the timestamp link,
        # but when UI reports 0 comments we skip the expensive comment-wait path inside.
        comments, modal_permalink = self._extract_comments_via_desktop_modal(
            container_index,
            comment_count_ui=comment_count_ui,
        )
        if not post_url and modal_permalink:
            post_url = modal_permalink
        # Fallback: when modal path returned no comments but we have a permalink (and
        # optionally UI said there are comments), open details page in a new tab.
        # Permalink flow succeeds where modal often fails after scrolling (stale refs, timing).
        if not comments and post_url and "/p/" in post_url:
            if comment_count_ui is None or comment_count_ui > 0:
                if self.run_stats is not None:
                    self.run_stats["comment_fallbacks"] = (
                        self.run_stats.get("comment_fallbacks", 0) + 1
                    )
                comments = self._extract_comments_via_details_page(post_url)

        post = RawPost(
            author_id=author_id,
            author_name=author_name,
            comment_count=raw.get("commentCount"),
            comments=comments,
            content=content,
            content_hash=content_hash,
            image_urls=raw.get("imageUrls", []),
            neighborhood=raw.get("neighborhood") or None,
            post_url=post_url,
            reaction_count=raw.get("reactionCount", 0),
            timestamp_relative=raw.get("timestamp") or None,
        )
        if post.comment_count is not None and post.comment_count != len(post.comments):
            if self.run_stats is not None:
                self.run_stats["comment_mismatches"] = (
                    self.run_stats.get("comment_mismatches", 0) + 1
                )
            logger.warning(
                "Comment count mismatch: UI=%d, scraped=%d (post_url=%s)",
                post.comment_count,
                len(post.comments),
                post.post_url or "?",
            )
        return post

    def _count_consecutive_already_seen(self, raw_posts: list[dict[str, Any]]) -> int:
        """Count how many posts from the start of the batch are already in seen_hashes.

        Used for Recent feed: when this reaches repeat_threshold we stop.

        Args:
            raw_posts: List of raw post dicts (authorId, content, etc.).

        Returns:
            Number of consecutive already-seen posts from the start.
        """
        count = 0
        for raw in raw_posts:
            author_id = raw.get("authorId") or ""
            content = (raw.get("content") or "").strip()
            if not author_id or not content:
                continue
            h = self._generate_hash(author_id, content)
            if h in self.seen_hashes:
                count += 1
            else:
                break
        return count

    def _generate_hash(self, author_id: str, content: str) -> str:
        """Generate SHA256 hash for deduplication.

        Args:
            author_id: Author's unique ID.
            content: Post content text.

        Returns:
            SHA256 hash string.
        """
        # Normalize content: lowercase, remove extra whitespace

        normalized = " ".join(content.lower().split())
        hash_input = f"{author_id}:{normalized}"
        return hashlib.sha256(hash_input.encode()).hexdigest()

    def _scroll_down(self) -> None:
        """Scroll down to load more posts.

        On recent feed, infinite scroll often only loads more when the user is near
        the bottom. We scroll to bottom so the 'load more' trigger fires, then wait
        for new content. On trending, one viewport step is enough.
        """
        min_delay, max_delay = SCRAPER_CONFIG["scroll_delay_ms"]

        logger.debug("_scroll_down: evaluate scroll")
        if self.feed_type == "recent":
            # Scroll to bottom so infinite-scroll triggers; otherwise no new posts load
            self.page.evaluate(
                "() => { window.scrollTo(0, document.documentElement.scrollHeight); }"
            )
        else:
            self.page.evaluate("window.scrollBy(0, window.innerHeight)")

        logger.debug("_scroll_down: wait_for_load_state networkidle")
        try:
            self.page.wait_for_load_state("networkidle", timeout=3000)
        except PlaywrightTimeoutError:
            logger.debug("Network didn't settle after scroll, continuing anyway")

        # Wait for DOM to grow (new posts) on recent feed, up to 4s
        if self.feed_type == "recent":
            prev_height = (
                self.page.evaluate("() => document.documentElement.scrollHeight") or 0
            )
            for _ in range(4):
                self.page.wait_for_timeout(1000)
                new_height = (
                    self.page.evaluate("() => document.documentElement.scrollHeight")
                    or 0
                )
                if new_height > prev_height:
                    logger.debug(
                        "Scroll: doc height grew %s -> %s after wait",
                        prev_height,
                        new_height,
                    )
                    break
                prev_height = new_height

        delay = random.randint(min_delay, max_delay)
        logger.debug("_scroll_down: wait_for_timeout %d ms", delay)
        self.page.wait_for_timeout(delay)

    def _extract_comments_via_details_page(self, post_url: str) -> list[RawComment]:
        """Open details page in a new tab, extract all comments, close tab.

        Leaves the feed tab untouched so permalink extraction and feed state
        are never broken.

        Args:
            post_url: Full URL to the post details page (e.g. https://nextdoor.com/p/XXX).

        Returns:
            List of RawComment from the details page.
        """
        if not post_url or "/p/" not in post_url:
            return []
        timeout = SCRAPER_CONFIG["navigation_timeout_ms"]
        new_page = self.page.context.new_page()
        try:
            new_page.goto(post_url, timeout=timeout)
            new_page.wait_for_url("**/p/**", timeout=timeout)
            comments = self._extract_comments_on_page(new_page)
            logger.debug(
                "Comments via details page (new tab): %d for %s",
                len(comments),
                post_url,
            )
            return comments
        except PlaywrightTimeoutError:
            logger.warning(
                "Details-page comment extraction failed: %s",
                post_url,
            )
            return []
        except Exception as e:
            logger.warning(
                "Details-page comment extraction error for %s: %s",
                post_url,
                e,
            )
            return []
        finally:
            new_page.close()

    def _extract_comments_via_desktop_modal(
        self,
        container_index: int,
        comment_count_ui: int | None = None,
    ) -> tuple[list[RawComment], str | None]:
        """Open the desktop post modal (click post body once or twice), load all comments, extract, close.

        Cards with "... see more" need two clicks (first expands body, second opens modal).
        Cards without it need one click to open the modal. Then we click "view more
        replies/comments" and "See X more replies" until none left, and extract from
        [data-testid="comment-thank-container"]. Also reads permalink from the modal's
        timestamp link [data-testid="post-timestamp"] a[href*="/p/"].

        Args:
            container_index: Index of the post card (div.post, div.js-media-post).
            comment_count_ui: Comment count reported by the feed UI, if available.

        Returns:
            Tuple of (list of RawComment from the modal, normalized permalink or None).
        """
        modal_wait_ms = 5000
        comments_load_wait_ms = 12000
        view_more_wait_ms = 800
        max_view_more_clicks = 50

        try:
            containers = self.page.locator("div.post, div.js-media-post")
            if containers.count() <= container_index:
                return ([], None)
            container = containers.nth(container_index)
            # Click only the post-text block (never the ad/smartlink). Use the
            # linktouchable that wraps the post text, or the first content block's
            # touchable. No fallback; if neither is found we return [] so state is clear.
            post_text_link = container.locator(
                '[data-testid="post-body"] [data-testid="linktouchable"]:has(.postTextBodySpan)'
            )
            if post_text_link.count() > 0:
                body = post_text_link.first
            else:
                first_block = container.locator(
                    '[data-testid="post-body"] .content > div'
                ).first
                touchable_in_block = first_block.locator(
                    '[data-testid="linktouchable"], [role="button"][data-touchable]'
                )
                if touchable_in_block.count() == 0:
                    logger.warning(
                        "No post-text click target found for container %d (no linktouchable/postTextBodySpan or content block touchable)",
                        container_index,
                    )
                    return ([], None)
                body = touchable_in_block.first
            body.scroll_into_view_if_needed(timeout=3000)
            self.page.wait_for_timeout(200)
            # Cards with "... see more" need two clicks: first expands body, second opens modal.
            # Cards without it need one click to open the modal (second click would close it).
            has_see_more = (
                container.locator("[data-testid='post-body']")
                .get_by_text("see more")
                .count()
                > 0
            )
            body.click(position={"x": 15, "y": 15}, timeout=3000)
            if has_see_more:
                self.page.wait_for_timeout(400)
                body.click(position={"x": 15, "y": 15}, timeout=3000)
            self.page.wait_for_timeout(500)
            # Wait for expanded post modal
            self.page.locator("#expanded-post-wrapper").wait_for(
                state="visible", timeout=modal_wait_ms
            )
            self.page.wait_for_timeout(300)
            # Read permalink from modal timestamp link (desktop has no /p/ link on feed cards).
            modal_permalink: str | None = None
            try:
                href = self.page.evaluate(
                    """() => {
                        const root = document.querySelector('#expanded-post-wrapper');
                        if (!root) return null;
                        const a = root.querySelector('[data-testid="post-timestamp"] a[href*="/p/"]');
                        return a ? a.getAttribute('href') : null;
                    }"""
                )
                if isinstance(href, str) and href.strip():
                    modal_permalink = self._normalize_post_url(href.strip())
            except Exception:
                pass
            has_comments = comment_count_ui is None or comment_count_ui > 0
            out: list[RawComment] = []
            if has_comments:
                # Wait for comments to load (not just skeletons); modal can show before content.
                modal = self.page.locator("#expanded-post-wrapper")
                try:
                    modal.locator(
                        "[data-testid='comment-thank-container']"
                    ).first.wait_for(state="visible", timeout=comments_load_wait_ms)
                except PlaywrightTimeoutError:
                    pass
                self.page.wait_for_timeout(200)
                # Click every "See X more replies" / "See more comments" until all expanded (scope to modal).
                # Use stable testid first; fallback to text pattern. Click all visible buttons each round.
                modal = self.page.locator("#expanded-post-wrapper")
                for _ in range(max_view_more_clicks):
                    view_more = modal.locator("[data-testid='seeMoreButton']")
                    if view_more.count() == 0:
                        view_more = modal.get_by_role(
                            "button",
                            name=VIEW_MORE_BUTTON_PATTERN,
                        )
                    n = view_more.count()
                    if n == 0:
                        break
                    clicked_any = False
                    for i in range(n):
                        btn = view_more.nth(i)
                        try:
                            if not btn.is_visible():
                                continue
                            btn.scroll_into_view_if_needed(timeout=2000)
                            self.page.wait_for_timeout(200)
                            btn.click(timeout=2000)
                            clicked_any = True
                            self.page.wait_for_timeout(300)
                        except Exception:
                            continue
                    if not clicked_any:
                        break
                    self.page.wait_for_timeout(view_more_wait_ms)
                # Extract comments from modal: [data-testid="comment-thank-container"] and surrounding block
                result = self.page.evaluate(
                    """
                    () => {
                        const root = document.querySelector('#expanded-post-wrapper');
                        if (!root) return { comments: [] };
                        const nodes = root.querySelectorAll('[data-testid="comment-thank-container"]');
                        const comments = Array.from(nodes).map(node => {
                            let block = node.parentElement;
                            for (let i = 0; i < 5 && block; i++) {
                                const text = block.innerText || '';
                                if (text.length > 2 && !text.startsWith('React')) break;
                                block = block.parentElement;
                            }
                            if (!block) return { author_name: '', text: '', timestamp_relative: null };
                            const authorLink = block.querySelector('a[href*=\"/profile/\"]');
                            const author = authorLink?.textContent?.trim() ?? '';
                            const styled = block.querySelector('[data-testid=\"styled-text\"]');
                            let text = (styled?.innerText || block.innerText || '').trim();
                            text = text.replace(/^React\\s*\\d*\\s*$/m, '').trim();
                            const ts = block.querySelector('[class*=\"timestamp\"], [class*=\"time\"]');
                            const timestamp = ts?.textContent?.trim() ?? null;
                            return { author_name: author, text: text.slice(0, 5000), timestamp_relative: timestamp };
                        });
                        return { comments };
                    }
                    """
                )
                comments_data = (
                    result.get("comments", []) if isinstance(result, dict) else []
                )
                out = [
                    RawComment(
                        author_name=item.get("author_name", ""),
                        text=item.get("text", ""),
                        timestamp_relative=item.get("timestamp_relative"),
                    )
                    for item in (comments_data or [])
                    if item.get("text") or item.get("author_name")
                ]
            return (out, modal_permalink)
        except PlaywrightTimeoutError:
            if self.run_stats is not None:
                self.run_stats["modal_failures"] = (
                    self.run_stats.get("modal_failures", 0) + 1
                )
            logger.warning(
                "Desktop modal comment extraction failed for container %d",
                container_index,
            )
            return ([], None)
        except Exception as e:
            if self.run_stats is not None:
                self.run_stats["modal_failures"] = (
                    self.run_stats.get("modal_failures", 0) + 1
                )
            logger.warning(
                "Desktop modal comment extraction error for container %d: %s",
                container_index,
                e,
            )
            return ([], None)
        finally:
            try:
                self.page.keyboard.press("Escape")
                self.page.wait_for_timeout(SCRAPER_CONFIG["modal_close_delay_ms"])
            except Exception:
                pass

    def extract_comments_on_details_page(self) -> list[RawComment]:
        """Extract all comments from the current page (details view).

        Use when the browser is on a post details page (URL contains /p/).
        Clicks "view more replies/comments" and extracts from comment-thank-container.

        Returns:
            List of RawComment (author_name, text, timestamp_relative).
        """
        return self._extract_comments_on_page(self.page)

    def _extract_comments_on_page(self, page: Page) -> list[RawComment]:
        """Extract comments when comment-thank-container is already on the page.

        Uses "view more replies/comments" buttons and [data-testid="comment-thank-container"].
        Used when the modal is already open or when comments are rendered inline on a
        true details view. The main permalink flow uses _extract_comments_via_desktop_modal
        instead (permalink page is a feed; we open the modal there).

        Args:
            page: Playwright Page that already has comment-thank-container in the DOM.

        Returns:
            List of RawComment.
        """
        view_more_wait_ms = 800
        max_view_more_clicks = 50

        # Click every "See X more replies" / "See more comments" until all expanded.
        # Use stable testid first; fallback to text pattern. Click all visible buttons each round.
        for _ in range(max_view_more_clicks):
            view_more = page.locator("[data-testid='seeMoreButton']")
            if view_more.count() == 0:
                view_more = page.get_by_role(
                    "button",
                    name=VIEW_MORE_BUTTON_PATTERN,
                )
            n = view_more.count()
            if n == 0:
                break
            clicked_any = False
            for i in range(n):
                btn = view_more.nth(i)
                try:
                    if not btn.is_visible():
                        continue
                    btn.scroll_into_view_if_needed(timeout=2000)
                    page.wait_for_timeout(200)
                    btn.click(timeout=2000)
                    clicked_any = True
                    page.wait_for_timeout(300)
                except Exception:
                    continue
            if not clicked_any:
                break
            page.wait_for_timeout(view_more_wait_ms)

        result = page.evaluate(
            """
            () => {
                const nodes = document.querySelectorAll('[data-testid="comment-thank-container"]');
                const comments = Array.from(nodes).map(node => {
                    let block = node.parentElement;
                    for (let i = 0; i < 5 && block; i++) {
                        const text = block.innerText || '';
                        if (text.length > 2 && !text.startsWith('React')) break;
                        block = block.parentElement;
                    }
                    if (!block) return { author_name: '', text: '', timestamp_relative: null };
                    const authorLink = block.querySelector('a[href*="/profile/"]');
                    const author = authorLink?.textContent?.trim() ?? '';
                    const styled = block.querySelector('[data-testid="styled-text"]');
                    let text = (styled?.innerText || block.innerText || '').trim();
                    text = text.replace(/^React\\s*\\d*\\s*$/m, '').trim();
                    const ts = block.querySelector('[class*="timestamp"], [class*="time"]');
                    const timestamp = ts?.textContent?.trim() ?? null;
                    return { author_name: author, text: text.slice(0, 5000), timestamp_relative: timestamp };
                });
                return { comments };
            }
            """
        )
        comments_data = result.get("comments", []) if isinstance(result, dict) else []
        return [
            RawComment(
                author_name=item.get("author_name", ""),
                text=item.get("text", ""),
                timestamp_relative=item.get("timestamp_relative"),
            )
            for item in (comments_data or [])
            if item.get("text") or item.get("author_name")
        ]

    def _normalize_post_url(self, url: str | None) -> str | None:
        """Normalize a post URL to canonical form https://nextdoor.com/p/XXX.

        Args:
            url: URL string from DOM or None.

        Returns:
            Clean URL or None if not a valid post permalink.
        """
        if not url or not isinstance(url, str) or not url.strip():
            return None
        try:
            parsed = urlparse(url.strip())
            if "/p/" not in (parsed.path or ""):
                return None
            return f"https://nextdoor.com{parsed.path}"
        except (ValueError, TypeError):
            return None
