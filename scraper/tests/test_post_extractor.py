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

    def test_normalize_post_url_returns_clean_url(
        self, extractor: PostExtractor
    ) -> None:
        """Should normalize post URL to canonical form."""
        assert extractor._normalize_post_url("https://nextdoor.com/p/ABC123") == "https://nextdoor.com/p/ABC123"
        assert extractor._normalize_post_url("https://nextdoor.com/p/ABC123?utm_x=1") == "https://nextdoor.com/p/ABC123"
        assert extractor._normalize_post_url("/p/XYZ") == "https://nextdoor.com/p/XYZ"

    def test_normalize_post_url_returns_none_for_invalid(
        self, extractor: PostExtractor
    ) -> None:
        """Should return None for non-post URLs or invalid input."""
        assert extractor._normalize_post_url(None) is None
        assert extractor._normalize_post_url("") is None
        assert extractor._normalize_post_url("  ") is None
        assert extractor._normalize_post_url("https://nextdoor.com/feed") is None
        assert extractor._normalize_post_url("https://nextdoor.com/profile/foo") is None

    def test_get_first_visible_post_returns_none_when_no_post_in_view(
        self, extractor: PostExtractor
    ) -> None:
        """Should return None when no post is in the viewport."""
        extractor.page.evaluate.return_value = None

        result = extractor._get_first_visible_post()

        assert result is None

    def test_get_first_visible_post_returns_index_and_raw_when_visible(
        self, extractor: PostExtractor
    ) -> None:
        """Should return (container_index, raw) when evaluate returns a post."""
        extractor.page.evaluate.return_value = {
            "containerIndex": 2,
            "raw": {
                "authorId": "a1",
                "authorName": "Author",
                "commentCount": 0,
                "content": "Enough content here",
                "imageUrls": [],
                "neighborhood": "Hood",
                "postUrl": "https://nextdoor.com/p/XYZ",
                "reactionCount": 1,
                "timestamp": "1h ago",
                "containerIndex": 2,
                "postIndex": 0,
            },
        }

        result = extractor._get_first_visible_post()

        assert result is not None
        idx, raw = result
        assert idx == 2
        assert raw["authorId"] == "a1"
        assert raw["content"] == "Enough content here"

    def test_scroll_next_post_into_view_returns_false_when_no_next(
        self, extractor: PostExtractor
    ) -> None:
        """Should return False when there is no next container."""
        extractor.page.locator.return_value.count.return_value = 5

        result = extractor._scroll_next_post_into_view(4)

        assert result is False

    def test_scroll_next_post_into_view_returns_true_when_next_exists(
        self, extractor: PostExtractor
    ) -> None:
        """Should return True and scroll next container to top of viewport."""
        mock_containers = mock.MagicMock()
        mock_containers.count.return_value = 10
        extractor.page.locator.return_value = mock_containers
        extractor.page.evaluate.return_value = True
        extractor.page.wait_for_timeout.return_value = None

        result = extractor._scroll_next_post_into_view(3)

        assert result is True
        extractor.page.evaluate.assert_called_once()
        call_args = extractor.page.evaluate.call_args
        assert call_args[0][1] == [4]

    def test_process_raw_post_opens_modal_even_when_comment_count_zero(
        self, extractor: PostExtractor
    ) -> None:
        """Should still open modal to read permalink when UI reports 0 comments."""
        raw = {
            "authorId": "author1",
            "authorName": "Test Author",
            "commentCount": 0,
            "containerIndex": 0,
            "content": "This is a test post with enough content to pass validation",
            "imageUrls": [],
            "neighborhood": "Test Neighborhood",
            "postUrl": "https://nextdoor.com/p/ABC123",
            "reactionCount": 0,
            "timestamp": "2 hours ago",
        }
        with mock.patch.object(
            extractor,
            "_extract_comments_via_desktop_modal",
            return_value=([], None),
        ) as mock_modal:
            result = extractor._process_raw_post(raw)

        assert result is not None
        assert result.comments == []
        assert result.comment_count == 0
        mock_modal.assert_called_once_with(0, comment_count_ui=0)

    def test_process_raw_post_uses_modal_permalink_when_feed_has_no_permalink(
        self, extractor: PostExtractor
    ) -> None:
        """Should set post_url from modal timestamp link when feed has no /p/ link."""
        raw = {
            "authorId": "author1",
            "authorName": "Test Author",
            "commentCount": 2,
            "containerIndex": 0,
            "content": "This is a test post with enough content to pass validation",
            "imageUrls": [],
            "neighborhood": "Test Neighborhood",
            "postUrl": None,
            "reactionCount": 0,
            "timestamp": "1 hr ago",
        }
        modal_permalink = "https://nextdoor.com/p/ABC123"
        with mock.patch.object(
            extractor,
            "_extract_comments_via_desktop_modal",
            return_value=([], modal_permalink),
        ):
            result = extractor._process_raw_post(raw)

        assert result is not None
        assert result.post_url == modal_permalink

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

    def test_scroll_down_scrolls_page(self, mock_page: mock.MagicMock) -> None:
        """Should scroll down and wait for network."""
        extractor = PostExtractor(mock_page, feed_type="trending", max_posts=10)
        extractor.page.evaluate.return_value = None
        extractor.page.wait_for_load_state.return_value = None
        extractor.page.wait_for_timeout.return_value = None

        extractor._scroll_down()

        extractor.page.evaluate.assert_called_once()
        extractor.page.wait_for_timeout.assert_called_once()

    def test_scroll_down_handles_network_timeout(
        self, mock_page: mock.MagicMock
    ) -> None:
        """Should continue even if network doesn't settle."""
        extractor = PostExtractor(mock_page, feed_type="trending", max_posts=10)
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
