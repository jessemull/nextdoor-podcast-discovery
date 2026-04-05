"""Tests for atomic background job claim."""

from unittest import mock

import pytest
from supabase import Client

from src.worker_job_claim import claim_next_background_job


class TestClaimNextBackgroundJob:
    """Test claim_next_background_job."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    def test_returns_none_when_no_row(self, mock_supabase: mock.MagicMock) -> None:
        """Should return None when RPC returns empty."""
        rpc_mock = mock.MagicMock()
        mock_supabase.rpc.return_value = rpc_mock
        rpc_mock.execute.return_value = mock.MagicMock(data=[])

        result = claim_next_background_job(mock_supabase, ["recompute_final_scores"])

        assert result is None
        mock_supabase.rpc.assert_called_once_with(
            "claim_next_background_job",
            {"p_job_types": ["recompute_final_scores"]},
        )

    def test_returns_first_row_when_claimed(self, mock_supabase: mock.MagicMock) -> None:
        """Should return the claimed job row."""
        row = {
            "id": "job-uuid",
            "status": "running",
            "type": "recompute_final_scores",
        }
        rpc_mock = mock.MagicMock()
        mock_supabase.rpc.return_value = rpc_mock
        rpc_mock.execute.return_value = mock.MagicMock(data=[row])

        result = claim_next_background_job(
            mock_supabase, ["recompute_final_scores", "run_scraper"]
        )

        assert result == row
        mock_supabase.rpc.assert_called_once_with(
            "claim_next_background_job",
            {"p_job_types": ["recompute_final_scores", "run_scraper"]},
        )

    def test_returns_none_for_empty_job_types(self, mock_supabase: mock.MagicMock) -> None:
        """Should not call RPC when job_types is empty."""
        result = claim_next_background_job(mock_supabase, [])

        assert result is None
        mock_supabase.rpc.assert_not_called()
