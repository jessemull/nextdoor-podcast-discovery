"""Post extraction from Nextdoor feed."""

__all__ = ["PostExtractor", "RawComment", "RawPost"]

import hashlib
import logging
import random
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from src.config import SCRAPER_CONFIG

logger = logging.getLogger(__name__)

# Minimum content length to consider a post valid (skip empty/stub posts)

MIN_CONTENT_LENGTH = 10


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

    return f"""
(() => {{
    const posts = [];
    const MIN_LEN = {min_content_length};
    const AUTHOR_SEL = '{author_sel}';
    const TIMESTAMP_SEL = '{timestamp_sel}';
    const CONTENT_SEL = '{content_sel}';
    const IMAGE_SEL = '{image_sel}';
    const REACTION_SEL = '{reaction_sel}';

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

            posts.push({{
                authorId, authorName, content, imageUrls,
                neighborhood, reactionCount, timestamp,
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


class PostExtractor:
    """Extracts posts from Nextdoor feed page."""

    # Stop scrolling if no new posts found after this many attempts

    MAX_EMPTY_SCROLLS = 5

    # Maximum scroll attempts before giving up (Recent feed)

    MAX_SCROLL_ATTEMPTS = 100

    def __init__(
        self,
        page: Page,
        feed_type: str = "recent",
        max_posts: int = 250,
        repeat_threshold: int = 10,
    ) -> None:
        """Initialize the extractor.

        Args:
            page: Playwright page object.
            feed_type: "recent" or "trending"; affects stop logic and max scrolls.
            max_posts: Maximum number of posts to extract.
            repeat_threshold: For Recent feed only: stop when this many consecutive
                already-seen posts appear from the start of a batch.
        """
        self.feed_type = feed_type
        self.max_posts = max_posts
        self.page = page
        self.repeat_threshold = repeat_threshold
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

        logger.info("Starting post extraction (max_posts=%d)", self.max_posts)

        # Wait for feed to load

        try:
            self.page.wait_for_selector("div.post, div.js-media-post", timeout=timeout)
            logger.info("Feed content detected, starting extraction")
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
                logger.info("First scroll found %d raw posts", len(raw_posts))

            # Recent feed: stop when we see repeat_threshold consecutive already-seen posts

            if self.feed_type == "recent" and self.repeat_threshold > 0:
                consecutive_seen = self._count_consecutive_already_seen(raw_posts)
                if consecutive_seen >= self.repeat_threshold:
                    logger.info(
                        "Repeat threshold reached (%d consecutive already-seen), stopping",
                        consecutive_seen,
                    )
                    break

            # Process extracted data

            new_count = self._process_batch(raw_posts, posts)

            logger.info(
                "Scroll %d: Found %d new posts (total: %d/%d)",
                scroll_attempts + 1,
                new_count,
                len(posts),
                self.max_posts,
            )

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

        logger.info("Extraction complete: %d posts", len(posts))
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
        no_new_posts_count = 0
        timeout = SCRAPER_CONFIG["navigation_timeout_ms"]

        logger.info(
            "Starting batch extraction (safety_cap=%d, feed_type=%s)",
            safety_cap,
            self.feed_type,
        )

        try:
            self.page.wait_for_selector("div.post, div.js-media-post", timeout=timeout)
            logger.info("Feed content detected, starting extraction")
        except PlaywrightTimeoutError:
            logger.warning("Timeout waiting for post containers")
            self._log_page_debug_info()
            return

        extraction_script = _get_extraction_script(MIN_CONTENT_LENGTH)
        max_scrolls = (
            SCRAPER_CONFIG["max_scroll_attempts_trending"]
            if self.feed_type == "trending"
            else self.MAX_SCROLL_ATTEMPTS
        )

        while total_yielded < safety_cap and scroll_attempts < max_scrolls:
            raw_posts = self.page.evaluate(extraction_script)

            if scroll_attempts == 0:
                logger.info("First scroll found %d raw posts", len(raw_posts))

            if self.feed_type == "recent" and self.repeat_threshold > 0:
                consecutive_seen = self._count_consecutive_already_seen(raw_posts)
                if consecutive_seen >= self.repeat_threshold:
                    logger.info(
                        "Repeat threshold reached (%d consecutive already-seen), stopping",
                        consecutive_seen,
                    )
                    return

            batch: list[RawPost] = []
            new_count = self._process_batch(raw_posts, batch, cap=safety_cap)
            total_yielded += len(batch)

            logger.info(
                "Scroll %d: %d new posts (total yielded: %d)",
                scroll_attempts + 1,
                new_count,
                total_yielded,
            )

            if new_count == 0:
                no_new_posts_count += 1
                if no_new_posts_count >= self.MAX_EMPTY_SCROLLS:
                    logger.warning(
                        "No new posts after %d scrolls, stopping",
                        self.MAX_EMPTY_SCROLLS,
                    )
                    return
            else:
                no_new_posts_count = 0

            if batch:
                yield batch

            if total_yielded >= safety_cap:
                logger.info("Safety cap reached (%d posts), stopping", safety_cap)
                return

            self._scroll_down()
            scroll_attempts += 1

        logger.info("Batch extraction complete: %d posts yielded", total_yielded)

    def _process_batch(
        self,
        raw_posts: list[dict[str, Any]],
        posts: list[RawPost],
        cap: int | None = None,
    ) -> int:
        """Process a batch of raw posts and add to posts list.

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

        # Always extract permalink (Share flow per post)

        container_index = raw.get("containerIndex", raw.get("postIndex", 0))
        post_url = self.extract_permalink(container_index)

        # Extract comments (open drawer, optionally "See previous", parse list)

        comments = self._extract_comments_for_post(container_index)

        return RawPost(
            author_id=author_id,
            author_name=author_name,
            comments=comments,
            content=content,
            content_hash=content_hash,
            image_urls=raw.get("imageUrls", []),
            neighborhood=raw.get("neighborhood") or None,
            post_url=post_url,
            reaction_count=raw.get("reactionCount", 0),
            timestamp_relative=raw.get("timestamp") or None,
        )

    def _scroll_feed_back_after_drawer_close(self, container_index: int) -> None:
        """Scroll the feed so we're not stuck at top after closing the comment drawer.

        Opening the drawer often scrolls the page to top; we scroll the next post
        into view so the next iteration targets the correct post and we don't
        reopen the same drawer.
        """
        try:
            containers = self.page.locator("div.post, div.js-media-post")
            next_index = container_index + 1
            if containers.count() > next_index:
                containers.nth(next_index).scroll_into_view_if_needed()
            else:
                self.page.evaluate("window.scrollBy(0, window.innerHeight)")
            self.page.wait_for_timeout(150)
        except Exception:
            pass

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
        """Scroll down to load more posts."""
        min_delay, max_delay = SCRAPER_CONFIG["scroll_delay_ms"]

        try:
            # Scroll by viewport height

            self.page.evaluate("window.scrollBy(0, window.innerHeight)")

            # Brief wait for new content; avoid long hang on infinite-scroll feeds
            self.page.wait_for_load_state("networkidle", timeout=3000)

        except PlaywrightTimeoutError:
            # Network didn't settle, that's okay - continue anyway
            # This is expected when page has continuous loading (infinite scroll)
            logger.debug("Network didn't settle after scroll, continuing anyway")

        # Random delay to seem human

        delay = random.randint(min_delay, max_delay)
        self.page.wait_for_timeout(delay)

    def extract_permalink(self, container_index: int) -> str | None:
        """Extract permalink for a specific post by clicking Share.

        Note: Uses DOM container index (among div.post, div.js-media-post) so
        we target the same card we extracted from, avoiding ad containers.

        Args:
            container_index: Index of the container in the DOM (0-based).

        Returns:
            Post URL like https://nextdoor.com/p/XXX or None if failed.
        """
        try:
            containers = self.page.locator("div.post, div.js-media-post")
            if containers.count() <= container_index:
                logger.warning("Container index %d out of range", container_index)
                return None

            container = containers.nth(container_index)

            # Find and click the Share button within this post

            share_btn = container.locator('[data-testid="share-button"]')
            if share_btn.count() == 0:
                logger.debug("No share button found for container %d", container_index)
                return None

            share_btn.click()

            # Wait for the share modal to appear

            fb_link = self.page.locator('[data-testid="share_app_button_FACEBOOK"]')
            fb_link.wait_for(timeout=SCRAPER_CONFIG["modal_timeout_ms"])

            # Extract the href and parse out the post URL

            href = fb_link.get_attribute("href")
            post_url = self._parse_post_url_from_share_link(href)

            # Close the modal (avoid clicking - top of viewport is Create Post prompt)
            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(SCRAPER_CONFIG["modal_close_delay_ms"])

            return post_url

        except PlaywrightTimeoutError:
            logger.debug(
                "Timeout extracting permalink for container %d", container_index
            )

            # Try to close any open modal
            try:
                self.page.keyboard.press("Escape")
            except Exception as e:
                # Intentionally swallow so modal close failure doesn't mask timeout
                logger.debug(
                    "Could not press Escape to close modal (container %d): %s",
                    container_index,
                    e,
                )

            return None
        except Exception as e:
            logger.debug(
                "Error extracting permalink for container %d: %s (%s)",
                container_index,
                e,
                type(e).__name__,
            )
            return None

    # Comment flow timeouts (drawer needs time to open after tap)

    COMMENT_DRAWER_TIMEOUT_MS = 3500
    COMMENT_SEE_MORE_WAIT_MS = 600
    COMMENT_CLOSE_WAIT_MS = 200

    def _extract_comments_for_post(self, container_index: int) -> list[RawComment]:
        """Open comment drawer for a post, optionally load all, and extract comments.

        Clicks the comment button inside the container at container_index so we
        target the same card we extracted from (avoiding ad containers).

        Args:
            container_index: Index of the post container in the DOM (0-based).

        Returns:
            List of RawComment (author_name, text, timestamp_relative).
        """
        try:
            containers = self.page.locator("div.post, div.js-media-post")
            total_containers = containers.count()
            if total_containers <= container_index:
                return []

            container = containers.nth(container_index)
            reply_in_container = container.get_by_test_id("post-reply-button")
            if reply_in_container.count() == 0:
                return []

            btn = reply_in_container.first
            btn.scroll_into_view_if_needed()
            self.page.wait_for_timeout(200)
            btn.click()

            # Give drawer time to start opening, then wait for content

            self.page.wait_for_timeout(400)
            comment_list = self.page.locator(
                ".comment-container, .comment-list-container, .js-media-comment"
            )
            try:
                comment_list.first.wait_for(
                    state="visible", timeout=self.COMMENT_DRAWER_TIMEOUT_MS
                )
            except PlaywrightTimeoutError:
                self.page.keyboard.press("Escape")
                self.page.wait_for_timeout(self.COMMENT_CLOSE_WAIT_MS)
                self._scroll_feed_back_after_drawer_close(container_index)
                return []

            # If "See previous comments" is visible, click to load all (scope to the
            # drawer we just opened so we match only one element)

            try:
                drawer = comment_list.first
                see_more = drawer.locator("[data-testid='seeMoreButton']").first
                if see_more.is_visible():
                    see_more.click()
                    self.page.wait_for_timeout(self.COMMENT_SEE_MORE_WAIT_MS)
            except Exception:
                pass

            # Extract from the LAST visible comment drawer (the one we just opened).
            # DOM order: old drawers stay in the DOM; the newly opened drawer is appended last.
            result = self.page.evaluate(
                """
                (targetContainerIndex) => {
                    const feed = document.querySelector('[data-testid="feed-container"]');
                    const containers = feed
                        ? feed.querySelectorAll('.comment-container')
                        : document.querySelectorAll('.comment-container');
                    let lastVisible = null;
                    for (let i = 0; i < containers.length; i++) {
                        const c = containers[i];
                        const nodes = c.querySelectorAll('.js-media-comment');
                        if (nodes.length === 0) continue;
                        const rect = c.getBoundingClientRect();
                        const isVisible = rect.height > 0 && rect.width > 0;
                        if (!isVisible) continue;
                        lastVisible = { nodes };
                    }
                    if (!lastVisible) return { comments: [] };
                    const comments = Array.from(lastVisible.nodes).map(el => {
                        const detail = el.querySelector('[data-testid="comment-detail"]');
                        const body = el.querySelector('[data-testid="comment-detail-body"]');
                        const authorLink = detail?.querySelector('.comment-detail-scopeline a');
                        const ts = el.querySelector('.comment-detail-scopeline-timestamp');
                        const author = authorLink?.textContent?.trim() ?? '';
                        const text = body?.innerText?.trim() ?? '';
                        const timestamp = ts?.textContent?.trim() ?? null;
                        return { author_name: author, text, timestamp_relative: timestamp };
                    });
                    return { comments };
                }
                """,
                container_index,
            )
            comments_data = result.get("comments") if isinstance(result, dict) else []

            # Close the drawer (avoid clicking - top of viewport is Create Post prompt)
            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(self.COMMENT_CLOSE_WAIT_MS)

            # Restore scroll position: opening the drawer often scrolls to top; scroll back
            # down so we don't stay at top and reopen the same post's drawer on next iteration.
            self._scroll_feed_back_after_drawer_close(container_index)

            out = [
                RawComment(
                    author_name=item["author_name"],
                    text=item["text"],
                    timestamp_relative=item.get("timestamp_relative"),
                )
                for item in (comments_data or [])
                if item.get("text") or item.get("author_name")
            ]
            return out

        except PlaywrightTimeoutError:
            try:
                self.page.keyboard.press("Escape")
                self.page.wait_for_timeout(self.COMMENT_CLOSE_WAIT_MS)
                self._scroll_feed_back_after_drawer_close(container_index)
            except Exception:
                pass
            return []
        except Exception:
            try:
                self.page.keyboard.press("Escape")
                self.page.wait_for_timeout(self.COMMENT_CLOSE_WAIT_MS)
                self._scroll_feed_back_after_drawer_close(container_index)
            except Exception:
                pass
            return []

    def _parse_post_url_from_share_link(self, href: str | None) -> str | None:
        """Parse the post URL from a share link href.

        Args:
            href: The href attribute from a share link (e.g., Facebook share).

        Returns:
            Clean post URL like https://nextdoor.com/p/XXX or None.
        """
        if not href:
            return None

        try:
            # Parse the Facebook share URL

            parsed = urlparse(href)
            params = parse_qs(parsed.query)

            # The 'href' param contains the encoded Nextdoor URL

            encoded_url = params.get("href", [None])[0]
            if not encoded_url:
                return None

            # Decode and extract just the base post URL

            decoded_url = unquote(encoded_url)

            # Parse again to get just the path (remove UTM params)

            post_parsed = urlparse(decoded_url)
            if "/p/" in post_parsed.path:
                # Return clean URL: https://nextdoor.com/p/XXX

                return f"https://nextdoor.com{post_parsed.path}"

            return None

        except (ValueError, TypeError) as e:
            logger.debug("Error parsing share URL: %s", e)
            return None
