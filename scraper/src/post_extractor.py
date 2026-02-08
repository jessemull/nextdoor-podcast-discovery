"""Post extraction from Nextdoor feed."""

__all__ = ["PostExtractor", "RawPost"]

import hashlib
import logging
import random
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

    document.querySelectorAll('div.post, div.js-media-post').forEach(el => {{
        try {{
            if (el.textContent?.includes('Sponsored')) return;

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
                postIndex: posts.length  // Track position for Share click
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

    # Maximum scroll attempts before giving up

    MAX_SCROLL_ATTEMPTS = 100

    def __init__(
        self,
        page: Page,
        max_posts: int = 250,
        extract_permalinks: bool = False,
    ) -> None:
        """Initialize the extractor.

        Args:
            page: Playwright page object.
            max_posts: Maximum number of posts to extract.
            extract_permalinks: If True, click Share on each post to get permalink.
                This is slower but provides direct links to posts.
        """
        self.extract_permalinks_flag = extract_permalinks
        self.max_posts = max_posts
        self.page = page
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

        max_scrolls = self.MAX_SCROLL_ATTEMPTS
        while len(posts) < self.max_posts and scroll_attempts < max_scrolls:
            # Extract visible posts using JavaScript

            raw_posts = self.page.evaluate(extraction_script)

            if scroll_attempts == 0:
                logger.info("First scroll found %d raw posts", len(raw_posts))

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

    def _process_batch(
        self, raw_posts: list[dict[str, Any]], posts: list[RawPost]
    ) -> int:
        """Process a batch of raw posts and add to posts list.

        Args:
            raw_posts: List of raw post dicts from JavaScript.
            posts: Accumulator list to add processed posts to.

        Returns:
            Number of new posts added.
        """
        new_count = 0

        for raw in raw_posts:
            if len(posts) >= self.max_posts:
                break

            post = self._process_raw_post(raw)
            if post and post.content_hash not in self.seen_hashes:
                self.seen_hashes.add(post.content_hash)
                posts.append(post)
                new_count += 1

        return new_count

    def _log_page_debug_info(self) -> None:
        """Log debug info about the current page state."""
        debug_info = self.page.evaluate(
            """
            () => ({
                url: window.location.href,
                bodyLen: document.body?.innerHTML?.length || 0,
                posts: document.querySelectorAll('div.post').length,
                links: document.querySelectorAll('a[href*="/profile/"]').length
            })
            """
        )
        logger.info("Page debug info: %s", debug_info)

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

        # Generate content hash for deduplication

        content_hash = self._generate_hash(author_id, content)

        # Extract permalink if flag is set

        post_url: str | None = None
        if self.extract_permalinks_flag:
            post_index = raw.get("postIndex", 0)
            post_url = self.extract_permalink(post_index)

        return RawPost(
            author_id=author_id,
            author_name=author_name,
            content=content,
            content_hash=content_hash,
            image_urls=raw.get("imageUrls", []),
            neighborhood=raw.get("neighborhood") or None,
            post_url=post_url,
            reaction_count=raw.get("reactionCount", 0),
            timestamp_relative=raw.get("timestamp") or None,
        )

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

            # Wait for network to settle

            self.page.wait_for_load_state("networkidle", timeout=5000)

        except PlaywrightTimeoutError:
            # Network didn't settle, that's okay - continue anyway
            # This is expected when page has continuous loading (infinite scroll)

            logger.debug("Network didn't settle after scroll, continuing anyway")

        # Random delay to seem human

        delay = random.randint(min_delay, max_delay)
        self.page.wait_for_timeout(delay)

    def extract_permalink(self, post_index: int) -> str | None:
        """Extract permalink for a specific post by clicking Share.

        Note: Uses DOM index which may become stale if posts shift during
        scrolling (e.g., new posts at top, ads inserted). This is a best-effort
        extraction - if the index is wrong, we get the wrong URL or fail gracefully.

        Args:
            post_index: Index of the post in the current view (0-based).

        Returns:
            Post URL like https://nextdoor.com/p/XXX or None if failed.
        """
        try:
            # Find all post containers and get the one at the specified index

            containers = self.page.locator("div.post, div.js-media-post")
            if containers.count() <= post_index:
                logger.warning("Post index %d out of range", post_index)
                return None

            container = containers.nth(post_index)

            # Find and click the Share button within this post

            share_btn = container.locator('[data-testid="share-button"]')
            if share_btn.count() == 0:
                logger.debug("No share button found for post %d", post_index)
                return None

            share_btn.click()

            # Wait for the share modal to appear

            fb_link = self.page.locator('[data-testid="share_app_button_FACEBOOK"]')
            fb_link.wait_for(timeout=SCRAPER_CONFIG["modal_timeout_ms"])

            # Extract the href and parse out the post URL

            href = fb_link.get_attribute("href")
            post_url = self._parse_post_url_from_share_link(href)

            # Close the modal and wait for close animation

            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(SCRAPER_CONFIG["modal_close_delay_ms"])

            return post_url

        except PlaywrightTimeoutError:
            logger.debug("Timeout extracting permalink for post %d", post_index)

            # Try to close any open modal

            try:
                self.page.keyboard.press("Escape")
            except Exception:
                pass

            return None
        except Exception as e:
            logger.debug("Error extracting permalink for post %d: %s", post_index, e)
            return None

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

        except Exception as e:
            logger.debug("Error parsing share URL: %s", e)
            return None
