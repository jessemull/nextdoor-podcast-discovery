"""Tests for main pipeline module."""

import os
from unittest import mock

import pytest

from src.config import REQUIRED_ENV_VARS
from src.exceptions import ScraperError
from src.main import main


class TestMain:
    """Test main pipeline function."""

    @pytest.fixture
    def mock_env(self) -> dict[str, str]:
        """Provide valid environment variables for testing."""
        return {var: "test_value" for var in REQUIRED_ENV_VARS}

    def test_main_dry_run_returns_zero(self, mock_env: dict[str, str]) -> None:
        """Should return 0 in dry-run mode with valid env."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.main.SessionManager") as _mock_session:
                with mock.patch("src.main.NextdoorScraper") as mock_scraper:
                    # Mock the scraper context manager
                    mock_scraper_instance = mock.MagicMock()
                    mock_scraper_instance.extract_post_batches.return_value = iter([])
                    mock_scraper.return_value.__enter__.return_value = (
                        mock_scraper_instance
                    )
                    mock_scraper.return_value.__exit__.return_value = None

                    result = main(dry_run=True)

        assert result == 0

    def test_main_normal_run_returns_zero(self, mock_env: dict[str, str]) -> None:
        """Should return 0 in normal mode with valid env."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.main.SessionManager") as _mock_session:
                with mock.patch("src.main.NextdoorScraper") as mock_scraper:
                    # Mock the scraper context manager
                    mock_scraper_instance = mock.MagicMock()
                    mock_scraper_instance.extract_post_batches.return_value = iter([])
                    mock_scraper.return_value.__enter__.return_value = (
                        mock_scraper_instance
                    )
                    mock_scraper.return_value.__exit__.return_value = None

                    result = main(dry_run=False)

        assert result == 0

    def test_main_returns_one_on_scraper_error(self, mock_env: dict[str, str]) -> None:
        """Should return 1 when ScraperError is raised."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.main.validate_env"):
                # Mock something in the pipeline to raise ScraperError

                with mock.patch(
                    "src.main.logger.info",
                    side_effect=[None, ScraperError("Test error")],
                ):
                    result = main(dry_run=True)

        assert result == 1

    def test_main_returns_one_on_unexpected_error(
        self, mock_env: dict[str, str]
    ) -> None:
        """Should return 1 when unexpected exception is raised."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.main.validate_env"):
                # Mock something to raise an unexpected error

                with mock.patch(
                    "src.main.logger.info",
                    side_effect=[None, RuntimeError("Unexpected")],
                ):
                    result = main(dry_run=True)

        assert result == 1

    def test_main_validates_env_before_running(self, mock_env: dict[str, str]) -> None:
        """Should call validate_env before running pipeline."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.main.validate_env") as mock_validate:
                main(dry_run=True)

        mock_validate.assert_called_once()

    def test_main_exits_if_env_invalid(self) -> None:
        """Should return 1 if env vars are missing."""

        # Clear all env vars

        with mock.patch.dict(os.environ, {}, clear=True):
            result = main(dry_run=True)

        assert result == 1

    def test_main_stops_when_stored_count_reaches_max_posts(
        self, mock_env: dict[str, str]
    ) -> None:
        """Should stop extracting once we have stored max_posts new rows (not just extracted)."""
        fake_batch1 = [mock.MagicMock()] * 3
        fake_batch2 = [mock.MagicMock()] * 2
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.main.SessionManager") as mock_session:
                mock_session.return_value.supabase = mock.MagicMock()
                with mock.patch("src.main.NextdoorScraper") as mock_scraper:
                    mock_scraper_instance = mock.MagicMock()
                    mock_scraper_instance.extract_post_batches.return_value = iter(
                        [fake_batch1, fake_batch2]
                    )
                    mock_scraper.return_value.__enter__.return_value = (
                        mock_scraper_instance
                    )
                    mock_scraper.return_value.__exit__.return_value = None
                    with mock.patch("src.main.PostStorage") as mock_storage_cls:
                        mock_storage = mock.MagicMock()
                        mock_storage.store_posts.side_effect = [
                            {"errors": 0, "inserted": 3, "skipped": 0},
                            {"errors": 0, "inserted": 2, "skipped": 0},
                        ]
                        mock_storage_cls.return_value = mock_storage

                        result = main(dry_run=False, max_posts=5)

        assert result == 0
        assert mock_storage.store_posts.call_count == 2
        mock_storage.store_posts.assert_any_call(fake_batch1)
        mock_storage.store_posts.assert_any_call(fake_batch2)
