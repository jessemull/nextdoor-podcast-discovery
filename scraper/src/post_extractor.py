"""Post extraction from Nextdoor feed."""

__all__ = ["PostExtractor", "RawPost"]

import hashlib
import logging
import random
from dataclasses import dataclass, field
from typing import Any

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError

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
    reaction_count: int = 0
    timestamp_relative: str | None = None


def _get_extraction_script(min_content_length: int) -> str:
    """Generate JavaScript to extract post data from DOM.

    Args:
        min_content_length: Minimum content length to include a post.

    Returns:
        JavaScript code string.
    """
    return f"""
() => {{
    const posts = [];
    const MIN_CONTENT_LENGTH = {min_content_length};

    // Find all post containers
    const postContainers = document.querySelectorAll('div.post, div.js-media-post');

    postContainers.forEach(container => {{
        try {{
            // Skip sponsored posts
            if (container.textContent?.includes('Sponsored')) {{
                return;
            }}

            // Get author info from profile link
            const authorLink = container.querySelector('a[href*="/profile/"][href*="is=feed_author"]');
            if (!authorLink) return;

            const authorHref = authorLink.getAttribute('href') || '';
            const authorMatch = authorHref.match(/\\/profile\\/([^/?]+)/);
            const authorId = authorMatch?.[1];
            if (!authorId) return;

            // Get author name (skip "Avatar for..." text)
            let authorName = '';
            const authorLinks = container.querySelectorAll('a[href*="/profile/"][href*="is=feed_author"]');
            for (const link of authorLinks) {{
                const text = link.textContent?.trim() || '';
                if (text && !text.startsWith('Avatar for') && text.length > 1) {{
                    authorName = text;
                    break;
                }}
            }}

            // Get neighborhood
            const hoodLink = container.querySelector('a[href*="/neighborhood/"]');
            const neighborhood = hoodLink?.textContent?.trim() || null;

            // Get timestamp
            const timestampEl = container.querySelector('[data-testid="post-timestamp"]');
            const timestamp = timestampEl?.textContent?.trim() || null;

            // Get post content
            const contentEl = container.querySelector('[data-testid="styled-text"]');
            const content = contentEl?.textContent?.trim() || '';

            if (!content || content.length < MIN_CONTENT_LENGTH) return;

            // Get images
            const imageEls = container.querySelectorAll('[data-testid="resized-image"]');
            const imageUrls = Array.from(imageEls).map(img => img.src).filter(Boolean);

            // Get reaction count
            const reactionEl = container.querySelector('[data-testid="reaction-button-text"]');
            const reactionCount = parseInt(reactionEl?.textContent || '0', 10) || 0;

            posts.push({{
                authorId,
                authorName,
                content,
                imageUrls,
                neighborhood,
                reactionCount,
                timestamp
            }});

        }} catch (e) {{
            console.error('Post extraction error:', e);
        }}
    }});

    return posts;
}}
"""


class PostExtractor:
    """Extracts posts from Nextdoor feed page."""

    # Stop scrolling if no new posts found after this many attempts

    MAX_EMPTY_SCROLLS = 5

    # Maximum scroll attempts before giving up

    MAX_SCROLL_ATTEMPTS = 100

    def __init__(self, page: Page, max_posts: int = 250) -> None:
        """Initialize the extractor.

        Args:
            page: Playwright page object.
            max_posts: Maximum number of posts to extract.
        """
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

        while len(posts) < self.max_posts and scroll_attempts < self.MAX_SCROLL_ATTEMPTS:
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
                        "No new posts after %d scrolls, stopping", self.MAX_EMPTY_SCROLLS
                    )
                    break
            else:
                no_new_posts_count = 0

            # Scroll down to load more

            self._scroll_down()
            scroll_attempts += 1

        logger.info("Extraction complete: %d posts", len(posts))
        return posts

    def _process_batch(self, raw_posts: list[dict[str, Any]], posts: list[RawPost]) -> int:
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
        debug_info = self.page.evaluate("""
            () => ({
                url: window.location.href,
                bodyLength: document.body?.innerHTML?.length || 0,
                postCount: document.querySelectorAll('div.post, div.js-media-post').length,
                linkCount: document.querySelectorAll('a[href*="/profile/"]').length
            })
        """)
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

        return RawPost(
            author_id=author_id,
            author_name=author_name,
            content=content,
            content_hash=content_hash,
            image_urls=raw.get("imageUrls", []),
            neighborhood=raw.get("neighborhood") or None,
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
            # Network didn't settle, that's okay

            pass

        # Random delay to seem human

        delay = random.randint(min_delay, max_delay)
        self.page.wait_for_timeout(delay)
