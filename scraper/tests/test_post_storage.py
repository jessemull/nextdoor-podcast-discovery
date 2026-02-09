"""Tests for post_storage module."""

from datetime import datetime, timezone
from unittest import mock

import pytest
from supabase import Client

from src.post_extractor import RawPost
from src.post_storage import PostStorage, parse_relative_timestamp


class TestParseRelativeTimestamp:
    """Test parse_relative_timestamp helper."""

    def test_returns_none_for_empty_or_none(self) -> None:
        """Should return None for None or empty string."""
        assert parse_relative_timestamp(None) is None
        assert parse_relative_timestamp("") is None
        assert parse_relative_timestamp("   ") is None

    def test_parses_minutes(self) -> None:
        """Should parse N minutes."""
        result = parse_relative_timestamp("5m")
        assert result is not None
        assert (datetime.now(timezone.utc) - result).total_seconds() >= 4 * 60

    def test_parses_hours(self) -> None:
        """Should parse N hours and 'N hours ago'."""
        result = parse_relative_timestamp("2h")
        assert result is not None
        result_ago = parse_relative_timestamp("2 hours ago")
        assert result_ago is not None

    def test_parses_yesterday(self) -> None:
        """Should parse Yesterday."""
        result = parse_relative_timestamp("Yesterday")
        assert result is not None
        assert result.date() != datetime.now(timezone.utc).date()

    def test_returns_none_for_unknown_format(self) -> None:
        """Should return None for unparseable strings."""
        assert parse_relative_timestamp("Last week") is None
        assert parse_relative_timestamp("Jan 15") is None


class TestPostStorage:
    """Test PostStorage class."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    @pytest.fixture
    def storage(self, mock_supabase: mock.MagicMock) -> PostStorage:
        """Create a PostStorage instance."""
        return PostStorage(mock_supabase)

    @pytest.fixture
    def sample_post(self) -> RawPost:
        """Provide a sample RawPost for testing."""
        return RawPost(
            author_id="author1",
            author_name="Test Author",
            content="This is a test post with enough content",
            content_hash="test_hash_123",
            image_urls=["https://example.com/image.jpg"],
            neighborhood="Test Neighborhood",
            post_url="https://nextdoor.com/p/ABC123",
            reaction_count=5,
            timestamp_relative="2 hours ago",
        )

    def test_store_posts_returns_empty_stats_for_empty_list(
        self, storage: PostStorage
    ) -> None:
        """Should return zero stats for empty post list."""
        result = storage.store_posts([])

        assert result == {"errors": 0, "inserted": 0, "skipped": 0}

    def test_store_posts_inserts_posts_successfully(
        self, storage: PostStorage, sample_post: RawPost
    ) -> None:
        """Should insert posts successfully."""
        # Mock neighborhood lookup
        neighborhood_result = mock.MagicMock()
        neighborhood_result.data = [{"id": "neighborhood-uuid"}]
        storage.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            neighborhood_result
        )

        # Mock successful batch insert
        insert_result = mock.MagicMock()
        insert_result.data = [{"id": "post-uuid"}]
        storage.supabase.table.return_value.upsert.return_value.execute.return_value = (
            insert_result
        )

        result = storage.store_posts([sample_post])

        assert result["inserted"] == 1
        assert result["errors"] == 0
        storage.supabase.table.return_value.upsert.assert_called_once()

    def test_store_posts_handles_batch_insert_failure(
        self, storage: PostStorage, sample_post: RawPost
    ) -> None:
        """Should fall back to individual inserts when batch fails."""
        # Mock neighborhood lookup
        neighborhood_result = mock.MagicMock()
        neighborhood_result.data = [{"id": "neighborhood-uuid"}]
        storage.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            neighborhood_result
        )

        # Mock batch insert failure
        storage.supabase.table.return_value.upsert.return_value.execute.side_effect = [
            Exception("Batch insert failed"),
        ]

        # Mock successful individual insert
        individual_result = mock.MagicMock()
        individual_result.data = [{"id": "post-uuid"}]
        storage.supabase.table.return_value.insert.return_value.execute.return_value = (
            individual_result
        )

        result = storage.store_posts([sample_post])

        assert result["inserted"] == 1
        storage.supabase.table.return_value.insert.assert_called_once()

    def test_store_posts_skips_duplicates(
        self, storage: PostStorage, sample_post: RawPost
    ) -> None:
        """Should skip duplicate posts."""
        # Mock neighborhood lookup
        neighborhood_result = mock.MagicMock()
        neighborhood_result.data = [{"id": "neighborhood-uuid"}]
        storage.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            neighborhood_result
        )

        # Mock batch insert with no data returned (duplicates skipped)
        insert_result = mock.MagicMock()
        insert_result.data = []  # No rows inserted (duplicates)
        storage.supabase.table.return_value.upsert.return_value.execute.return_value = (
            insert_result
        )

        result = storage.store_posts([sample_post])

        assert result["inserted"] == 0
        assert result["skipped"] == 1

    def test_store_posts_handles_individual_insert_duplicate(
        self, storage: PostStorage, sample_post: RawPost
    ) -> None:
        """Should handle duplicate errors in individual inserts."""
        # Mock neighborhood lookup
        neighborhood_result = mock.MagicMock()
        neighborhood_result.data = [{"id": "neighborhood-uuid"}]
        storage.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            neighborhood_result
        )

        # Mock batch insert failure
        storage.supabase.table.return_value.upsert.return_value.execute.side_effect = [
            Exception("Batch insert failed"),
        ]

        # Mock individual insert with duplicate error
        storage.supabase.table.return_value.insert.return_value.execute.side_effect = [
            Exception("duplicate key value"),
        ]

        result = storage.store_posts([sample_post])

        assert result["skipped"] == 1
        assert result["errors"] == 0

    def test_get_or_create_neighborhood_returns_existing(
        self, storage: PostStorage
    ) -> None:
        """Should return existing neighborhood ID."""
        result_mock = mock.MagicMock()
        result_mock.data = [{"id": "existing-uuid"}]
        storage.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            result_mock
        )

        neighborhood_id = storage._get_or_create_neighborhood("Existing Neighborhood")

        assert neighborhood_id == "existing-uuid"
        # Should not try to insert
        storage.supabase.table.return_value.insert.assert_not_called()

    def test_get_or_create_neighborhood_creates_new(self, storage: PostStorage) -> None:
        """Should create new neighborhood if not found."""
        # First call: no existing neighborhood
        no_result = mock.MagicMock()
        no_result.data = []
        # Second call: created neighborhood
        created_result = mock.MagicMock()
        created_result.data = [{"id": "new-uuid"}]

        storage.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            no_result,
            created_result,
        ]
        storage.supabase.table.return_value.insert.return_value.execute.return_value = (
            created_result
        )

        neighborhood_id = storage._get_or_create_neighborhood("New Neighborhood")

        assert neighborhood_id == "new-uuid"
        storage.supabase.table.return_value.insert.assert_called_once()

    def test_get_or_create_neighborhood_handles_race_condition(
        self, storage: PostStorage
    ) -> None:
        """Should handle race condition when creating neighborhood."""
        # First call: no existing neighborhood
        no_result = mock.MagicMock()
        no_result.data = []
        # Insert fails (race condition - another process created it)
        storage.supabase.table.return_value.insert.return_value.execute.side_effect = (
            Exception("duplicate")
        )
        # Second call: neighborhood now exists
        existing_result = mock.MagicMock()
        existing_result.data = [{"id": "existing-uuid"}]

        storage.supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            no_result,
            existing_result,
        ]

        neighborhood_id = storage._get_or_create_neighborhood(
            "Race Condition Neighborhood"
        )

        assert neighborhood_id == "existing-uuid"

    def test_name_to_slug_converts_correctly(self, storage: PostStorage) -> None:
        """Should convert neighborhood name to slug."""
        assert storage._name_to_slug("Arbor Lodge") == "arbor-lodge"
        assert storage._name_to_slug("St. Johns") == "st-johns"
        assert storage._name_to_slug("Test   Neighborhood") == "test-neighborhood"

    def test_extract_post_id_from_url(self, storage: PostStorage) -> None:
        """Should extract post ID from URL."""
        post_id = storage._extract_post_id(
            "https://nextdoor.com/p/ABC123", "fallback_hash"
        )
        assert post_id == "ABC123"

    def test_extract_post_id_uses_fallback(self, storage: PostStorage) -> None:
        """Should use hash fallback when no URL provided."""
        post_id = storage._extract_post_id(None, "fallback_hash_12345678901234567890")
        assert post_id == "fallback_hash_123456789012345678"  # First 32 chars
