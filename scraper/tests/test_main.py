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
            result = main(dry_run=True)

        assert result == 0

    def test_main_normal_run_returns_zero(self, mock_env: dict[str, str]) -> None:
        """Should return 0 in normal mode with valid env."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
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
        """Should exit with code 1 if env vars are missing."""

        # Clear all env vars

        with mock.patch.dict(os.environ, {}, clear=True):
            with pytest.raises(SystemExit) as exc_info:
                main(dry_run=True)

        assert exc_info.value.code == 1
