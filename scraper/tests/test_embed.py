"""Tests for embed.py standalone script."""

import os
from unittest import mock

import pytest

from src.config import REQUIRED_ENV_VARS
from src.embed import main


class TestEmbed:
    """Test embed.py main function."""

    @pytest.fixture
    def mock_env(self) -> dict[str, str]:
        """Provide valid environment variables for testing."""
        return {var: "test_value" for var in REQUIRED_ENV_VARS}

    def test_main_dry_run_returns_zero(self, mock_env: dict[str, str]) -> None:
        """Should return 0 in dry-run mode with valid env."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.embed.SessionManager") as _mock_session:
                with mock.patch("src.embed.Embedder") as mock_embedder:
                    mock_embedder_instance = mock.MagicMock()
                    mock_embedder_instance.generate_and_store_embeddings.return_value = {
                        "errors": 0,
                        "processed": 10,
                        "stored": 10,
                    }
                    mock_embedder.return_value = mock_embedder_instance

                    result = main(dry_run=True)

        assert result == 0

    def test_main_normal_run_returns_zero(self, mock_env: dict[str, str]) -> None:
        """Should return 0 in normal mode with valid env."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.embed.SessionManager") as _mock_session:
                with mock.patch("src.embed.Embedder") as mock_embedder:
                    mock_embedder_instance = mock.MagicMock()
                    mock_embedder_instance.generate_and_store_embeddings.return_value = {
                        "errors": 0,
                        "processed": 10,
                        "stored": 10,
                    }
                    mock_embedder.return_value = mock_embedder_instance

                    result = main(dry_run=False)

        assert result == 0

    def test_main_returns_one_on_config_error(self) -> None:
        """Should return 1 when ConfigurationError is raised."""
        with mock.patch.dict(os.environ, {}, clear=True):
            result = main(dry_run=True)

        assert result == 1

    def test_main_validates_env_before_running(self, mock_env: dict[str, str]) -> None:
        """Should call validate_env before running."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.embed.validate_env") as mock_validate:
                with mock.patch("src.embed.SessionManager"):
                    with mock.patch("src.embed.Embedder"):
                        main(dry_run=True)

        mock_validate.assert_called_once()

    def test_main_returns_one_on_unexpected_error(
        self, mock_env: dict[str, str]
    ) -> None:
        """Should return 1 when unexpected exception is raised."""
        with mock.patch.dict(os.environ, mock_env, clear=True):
            with mock.patch("src.embed.validate_env"):
                with mock.patch(
                    "src.embed.SessionManager", side_effect=RuntimeError("Unexpected")
                ):
                    result = main(dry_run=True)

        assert result == 1
