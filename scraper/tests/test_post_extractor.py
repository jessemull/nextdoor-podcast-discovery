"""Tests for post_extractor module."""

from unittest import mock

import pytest
from playwright.sync_api import Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from src.post_extractor import PostExtractor


class TestPostExtractor:
    """Test PostExtractor class."""

    @pytest.fixture
    def mock_page(self) -> mock.MagicMock:
        """Provide a mocked Playwright page."""
        return mock.MagicMock(spec=Page)

    @pytest.fixture
    def extractor(self, mock_page: mock.MagicMock) -> PostExtractor:
        """Create a PostExtractor instance."""
        return PostExtractor(mock_page, max_posts=10)

    def test_extract_posts_returns_empty_list_when_no_posts(
        self, extractor: PostExtractor
    ) -> None:
        """Should return empty list when no posts found."""
        extractor.page.wait_for_selector.side_effect = PlaywrightTimeoutError("Timeout")
        extractor.page.evaluate.return_value = []

        result = extractor.extract_posts()

        assert result == []

    def test_extract_posts_extracts_posts_from_page(
        self, extractor: PostExtractor
    ) -> None:
        """Should extract posts from page using JavaScript."""
        mock_posts = [
            {
                "authorId": "author1",
                "authorName": "Test Author",
                "content": "This is a test post with enough content",
                "imageUrls": [],
                "neighborhood": "Test Neighborhood",
                "reactionCount": 5,
                "timestamp": "2 hours ago",
            }
        ]

        extractor.page.wait_for_selector.return_value = None
        extractor.page.evaluate.return_value = mock_posts
        extractor.page.wait_for_load_state.return_value = None
        extractor.page.wait_for_timeout.return_value = None

        result = extractor.extract_posts()

        assert len(result) == 1
        assert result[0].author_id == "author1"
        assert result[0].author_name == "Test Author"
        assert result[0].content == "This is a test post with enough content"

    def test_extract_posts_skips_posts_below_min_length(
        self, extractor: PostExtractor
    ) -> None:
        """Should skip posts with content below minimum length."""
        mock_posts = [
            {
                "authorId": "author1",
                "authorName": "Test",
                "content": "Short",  # Below MIN_CONTENT_LENGTH
                "imageUrls": [],
                "neighborhood": None,
                "reactionCount": 0,
                "timestamp": None,
            }
        ]

        extractor.page.wait_for_selector.return_value = None
        extractor.page.evaluate.return_value = mock_posts
        extractor.page.wait_for_load_state.return_value = None
        extractor.page.wait_for_timeout.return_value = None

        result = extractor.extract_posts()

        assert len(result) == 0

    def test_extract_posts_stops_after_max_posts(
        self, extractor: PostExtractor
    ) -> None:
        """Should stop extracting after reaching max_posts."""
        mock_posts = [
            {
                "authorId": f"author{i}",
                "authorName": f"Author {i}",
                "content": f"This is post {i} with enough content to pass validation",
                "imageUrls": [],
                "neighborhood": None,
                "reactionCount": 0,
                "timestamp": None,
            }
            for i in range(15)  # More than max_posts (10)
        ]

        extractor.page.wait_for_selector.return_value = None
        extractor.page.evaluate.return_value = mock_posts
        extractor.page.wait_for_load_state.return_value = None
        extractor.page.wait_for_timeout.return_value = None

        result = extractor.extract_posts()

        assert len(result) <= extractor.max_posts

    def test_extract_posts_stops_after_empty_scrolls(
        self, extractor: PostExtractor
    ) -> None:
        """Should stop extracting after MAX_EMPTY_SCROLLS with no new posts."""
        extractor.page.wait_for_selector.return_value = None
        extractor.page.evaluate.return_value = []  # No posts found
        extractor.page.wait_for_load_state.return_value = None
        extractor.page.wait_for_timeout.return_value = None

        result = extractor.extract_posts()

        assert result == []
        # Should have called evaluate multiple times (once per scroll attempt)
        assert extractor.page.evaluate.call_count > 1

    def test_extract_permalink_success(self, extractor: PostExtractor) -> None:
        """Should extract permalink by clicking Share button."""
        container = mock.MagicMock()
        share_btn = mock.MagicMock()
        share_btn.count.return_value = 1
        share_btn.click.return_value = None
        container.locator.return_value = share_btn

        # Single return value for both page.locator(...) calls: post containers and FB share link
        locator_mock = mock.MagicMock()
        locator_mock.count.return_value = 5
        locator_mock.nth.return_value = container
        locator_mock.wait_for.return_value = None
        locator_mock.get_attribute.return_value = "https://www.facebook.com/sharer/sharer.php?href=https%3A%2F%2Fnextdoor.com%2Fp%2FABC123"
        extractor.page.locator.return_value = locator_mock
        extractor.page.keyboard.press.return_value = None
        extractor.page.wait_for_timeout.return_value = None

        result = extractor.extract_permalink(0)

        assert result == "https://nextdoor.com/p/ABC123"
        share_btn.click.assert_called_once()

    def test_extract_permalink_returns_none_when_no_share_button(
        self, extractor: PostExtractor
    ) -> None:
        """Should return None when Share button not found."""
        extractor.page.locator.return_value.count.return_value = 5
        container = mock.MagicMock()
        share_btn = mock.MagicMock()
        share_btn.count.return_value = 0  # No share button
        container.locator.return_value = share_btn
        extractor.page.locator.return_value.nth.return_value = container

        result = extractor.extract_permalink(0)

        assert result is None

    def test_extract_permalink_handles_timeout(self, extractor: PostExtractor) -> None:
        """Should return None when modal timeout occurs."""
        container = mock.MagicMock()
        share_btn = mock.MagicMock()
        share_btn.count.return_value = 1
        container.locator.return_value = share_btn

        locator_mock = mock.MagicMock()
        locator_mock.count.return_value = 5
        locator_mock.nth.return_value = container
        locator_mock.wait_for.side_effect = PlaywrightTimeoutError("Timeout")
        extractor.page.locator.return_value = locator_mock
        extractor.page.keyboard.press.return_value = None

        result = extractor.extract_permalink(0)

        assert result is None

    def test_extract_permalink_handles_timeout_then_escape_failure(
        self, extractor: PostExtractor
    ) -> None:
        """Should return None when modal timeout occurs and closing modal raises.

        Regression test: the inner except must use container_index (not post_index)
        so that no NameError is raised when Escape fails.
        """
        container = mock.MagicMock()
        share_btn = mock.MagicMock()
        share_btn.count.return_value = 1
        container.locator.return_value = share_btn

        locator_mock = mock.MagicMock()
        locator_mock.count.return_value = 5
        locator_mock.nth.return_value = container
        locator_mock.wait_for.side_effect = PlaywrightTimeoutError("Timeout")
        extractor.page.locator.return_value = locator_mock
        extractor.page.keyboard.press.side_effect = RuntimeError("Escape failed")

        result = extractor.extract_permalink(0)

        assert result is None

    def test_generate_hash_creates_consistent_hash(
        self, extractor: PostExtractor
    ) -> None:
        """Should generate consistent hash for same author and content."""
        hash1 = extractor._generate_hash("author1", "Test content")
        hash2 = extractor._generate_hash("author1", "Test content")

        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex length

    def test_generate_hash_creates_different_hash_for_different_content(
        self, extractor: PostExtractor
    ) -> None:
        """Should generate different hash for different content."""
        hash1 = extractor._generate_hash("author1", "Test content")
        hash2 = extractor._generate_hash("author1", "Different content")

        assert hash1 != hash2

    def test_scroll_down_scrolls_page(self, extractor: PostExtractor) -> None:
        """Should scroll down and wait for network."""
        extractor.page.evaluate.return_value = None
        extractor.page.wait_for_load_state.return_value = None
        extractor.page.wait_for_timeout.return_value = None

        extractor._scroll_down()

        extractor.page.evaluate.assert_called_once()
        extractor.page.wait_for_timeout.assert_called_once()

    def test_scroll_down_handles_network_timeout(
        self, extractor: PostExtractor
    ) -> None:
        """Should continue even if network doesn't settle."""
        extractor.page.evaluate.return_value = None
        extractor.page.wait_for_load_state.side_effect = PlaywrightTimeoutError(
            "Timeout"
        )
        extractor.page.wait_for_timeout.return_value = None

        # Should not raise
        extractor._scroll_down()

        extractor.page.wait_for_timeout.assert_called_once()

    def test_recent_stops_when_repeat_threshold_consecutive_already_seen(
        self, mock_page: mock.MagicMock
    ) -> None:
        """Should stop extraction when repeat_threshold consecutive already-seen posts at start of batch (Recent only)."""
        repeat_threshold = 10
        extractor = PostExtractor(
            mock_page,
            feed_type="recent",
            max_posts=50,
            repeat_threshold=repeat_threshold,
        )
        # Pre-seed seen_hashes so the first 10 posts in the batch count as already seen
        for i in range(repeat_threshold):
            h = extractor._generate_hash(
                f"author{i}",
                f"Post {i} with enough content to pass minimum length",
            )
            extractor.seen_hashes.add(h)
        batch = [
            {
                "authorId": f"author{i}",
                "authorName": f"Author {i}",
                "content": f"Post {i} with enough content to pass minimum length",
                "imageUrls": [],
                "neighborhood": None,
                "reactionCount": 0,
                "timestamp": None,
            }
            for i in range(15)
        ]
        mock_page.wait_for_selector.return_value = None
        mock_page.evaluate.return_value = batch
        mock_page.wait_for_load_state.return_value = None
        mock_page.wait_for_timeout.return_value = None

        result = extractor.extract_posts()

        # Stopped on repeat threshold before adding any from this batch; no prior batch
        assert result == []
        assert mock_page.evaluate.call_count == 1

    def test_trending_does_not_stop_on_consecutive_duplicates(
        self, mock_page: mock.MagicMock
    ) -> None:
        """Should not stop on consecutive already-seen posts when feed_type is trending."""
        repeat_threshold = 10
        extractor = PostExtractor(
            mock_page,
            feed_type="trending",
            max_posts=50,
            repeat_threshold=repeat_threshold,
        )
        for i in range(repeat_threshold):
            h = extractor._generate_hash(
                f"author{i}",
                f"Post {i} with enough content to pass minimum length",
            )
            extractor.seen_hashes.add(h)
        # First 10 already seen, next 5 new
        batch = [
            {
                "authorId": f"author{i}",
                "authorName": f"Author {i}",
                "content": f"Post {i} with enough content to pass minimum length",
                "imageUrls": [],
                "neighborhood": None,
                "reactionCount": 0,
                "timestamp": None,
            }
            for i in range(15)
        ]
        mock_page.wait_for_selector.return_value = None
        mock_page.evaluate.return_value = batch
        mock_page.wait_for_load_state.return_value = None
        mock_page.wait_for_timeout.return_value = None

        result = extractor.extract_posts()

        # Trending does not use repeat-threshold stop; the 5 new posts are added
        assert len(result) == 5
        assert mock_page.evaluate.call_count >= 1
