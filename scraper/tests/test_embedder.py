"""Tests for embedder module."""

from unittest import mock

import pytest
from openai import OpenAI
from supabase import Client

from src.config import EMBEDDING_BATCH_SIZE, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL
from src.embedder import Embedder


class TestEmbedder:
    """Test Embedder class."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    @pytest.fixture
    def mock_openai(self) -> mock.MagicMock:
        """Provide a mocked OpenAI client."""
        return mock.MagicMock(spec=OpenAI)

    @pytest.fixture
    def embedder(
        self, mock_supabase: mock.MagicMock, mock_openai: mock.MagicMock
    ) -> Embedder:
        """Create an Embedder instance with mocked dependencies."""
        return Embedder(mock_supabase, mock_openai)

    def test_generate_embeddings_empty_list(self, embedder: Embedder) -> None:
        """Should return empty list for empty input."""
        result = embedder._generate_embeddings([])

        assert result == []
        embedder.openai.embeddings.create.assert_not_called()

    def test_generate_embeddings_success(self, embedder: Embedder) -> None:
        """Should generate embeddings for texts."""
        mock_response = mock.MagicMock()
        mock_response.data = [
            mock.MagicMock(embedding=[0.1] * EMBEDDING_DIMENSIONS),
            mock.MagicMock(embedding=[0.2] * EMBEDDING_DIMENSIONS),
        ]
        embedder.openai.embeddings.create.return_value = mock_response

        texts = ["First post", "Second post"]
        result = embedder._generate_embeddings(texts)

        assert len(result) == 2
        assert len(result[0]) == EMBEDDING_DIMENSIONS
        assert len(result[1]) == EMBEDDING_DIMENSIONS
        embedder.openai.embeddings.create.assert_called_once_with(
            input=texts, model=EMBEDDING_MODEL
        )

    def test_generate_embeddings_mismatch_raises_error(
        self, embedder: Embedder
    ) -> None:
        """Should raise RetryError after retries if embedding count doesn't match."""
        from tenacity import RetryError

        mock_response = mock.MagicMock()
        mock_response.data = [mock.MagicMock(embedding=[0.1] * EMBEDDING_DIMENSIONS)]
        embedder.openai.embeddings.create.return_value = mock_response

        texts = ["First post", "Second post"]

        with pytest.raises(RetryError):
            embedder._generate_embeddings(texts)

        # Verify it was called multiple times (retries)
        assert embedder.openai.embeddings.create.call_count == 3

    def test_generate_and_store_embeddings_no_posts(self, embedder: Embedder) -> None:
        """Should return zero stats when no posts need embeddings."""
        embedder.supabase.table.return_value.select.return_value.not_.is_.return_value.execute.return_value.data = (
            []
        )
        embedder.supabase.table.return_value.select.return_value.execute.return_value.data = (
            []
        )

        stats = embedder.generate_and_store_embeddings()

        assert stats == {"errors": 0, "processed": 0, "stored": 0}

    def test_generate_and_store_embeddings_skips_existing(
        self, embedder: Embedder
    ) -> None:
        """Should skip posts that already have embeddings."""
        # Mock posts
        posts_data = [
            {"id": "post-1", "text": "First post"},
            {"id": "post-2", "text": "Second post"},
        ]
        embedder.supabase.table.return_value.select.return_value.not_.is_.return_value.execute.return_value.data = (
            posts_data
        )

        # Mock existing embeddings
        embedder.supabase.table.return_value.select.return_value.execute.return_value.data = [
            {"post_id": "post-1"}
        ]

        # Mock OpenAI response for post-2
        mock_response = mock.MagicMock()
        mock_response.data = [mock.MagicMock(embedding=[0.1] * EMBEDDING_DIMENSIONS)]
        embedder.openai.embeddings.create.return_value = mock_response

        # Mock upsert response
        mock_upsert_response = mock.MagicMock()
        mock_upsert_response.data = [{"id": "test"}]
        embedder.supabase.table.return_value.upsert.return_value.execute.return_value = (
            mock_upsert_response
        )

        stats = embedder.generate_and_store_embeddings()

        # Should only process post-2
        assert stats["processed"] == 1
        assert stats["stored"] == 1
        embedder.openai.embeddings.create.assert_called_once_with(
            input=["Second post"], model=EMBEDDING_MODEL
        )

    def test_generate_and_store_embeddings_dry_run(self, embedder: Embedder) -> None:
        """Should not store embeddings in dry run mode."""
        posts_data = [{"id": "post-1", "text": "Test post"}]
        embedder.supabase.table.return_value.select.return_value.not_.is_.return_value.execute.return_value.data = (
            posts_data
        )
        embedder.supabase.table.return_value.select.return_value.execute.return_value.data = (
            []
        )

        mock_response = mock.MagicMock()
        mock_response.data = [mock.MagicMock(embedding=[0.1] * EMBEDDING_DIMENSIONS)]
        embedder.openai.embeddings.create.return_value = mock_response

        stats = embedder.generate_and_store_embeddings(dry_run=True)

        assert stats["processed"] == 1
        assert stats["stored"] == 0
        embedder.supabase.table.return_value.upsert.assert_not_called()

    def test_generate_and_store_embeddings_batches(self, embedder: Embedder) -> None:
        """Should process posts in batches."""
        # Create more posts than batch size
        posts_data = [
            {"id": f"post-{i}", "text": f"Post {i}"}
            for i in range(EMBEDDING_BATCH_SIZE + 10)
        ]
        embedder.supabase.table.return_value.select.return_value.not_.is_.return_value.execute.return_value.data = (
            posts_data
        )
        embedder.supabase.table.return_value.select.return_value.execute.return_value.data = (
            []
        )

        # Mock embeddings response
        mock_response = mock.MagicMock()
        mock_response.data = [
            mock.MagicMock(embedding=[0.1] * EMBEDDING_DIMENSIONS)
            for _ in range(EMBEDDING_BATCH_SIZE)
        ]
        embedder.openai.embeddings.create.return_value = mock_response

        # Mock upsert response
        mock_upsert_response = mock.MagicMock()
        mock_upsert_response.data = [{"id": "test"}]
        embedder.supabase.table.return_value.upsert.return_value.execute.return_value = (
            mock_upsert_response
        )

        _stats = embedder.generate_and_store_embeddings()

        # Should have called OpenAI at least twice (batch + remainder)
        assert embedder.openai.embeddings.create.call_count >= 2
