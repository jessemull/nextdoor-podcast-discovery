"""Tests for configuration module."""

import os
from unittest import mock

import pytest

from src.config import (
    CLAUDE_MAX_TOKENS,
    CLAUDE_MODEL,
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    ENSEMBLE_RUNS,
    ENSEMBLE_TEMPERATURE,
    REQUIRED_ENV_VARS,
    SCRAPER_CONFIG,
    validate_env,
)


class TestConstants:
    """Test configuration constants."""

    def test_claude_model_is_haiku(self) -> None:
        """Should use Claude Haiku for cost optimization."""
        assert "haiku" in CLAUDE_MODEL.lower()

    def test_claude_max_tokens_is_reasonable(self) -> None:
        """Max tokens should be reasonable for scoring responses."""
        assert 100 <= CLAUDE_MAX_TOKENS <= 1000

    def test_ensemble_runs_is_three(self) -> None:
        """Ensemble scoring should run 3 times per batch."""
        assert ENSEMBLE_RUNS == 3

    def test_ensemble_temperature(self) -> None:
        """Ensemble temperature should be set for variance."""
        assert 0 < ENSEMBLE_TEMPERATURE <= 1.0

    def test_embedding_model_is_small(self) -> None:
        """Should use small embedding model for cost optimization."""
        assert "small" in EMBEDDING_MODEL

    def test_embedding_dimensions(self) -> None:
        """Embedding dimensions should match text-embedding-3-small."""
        assert EMBEDDING_DIMENSIONS == 1536

    def test_embedding_batch_size_limit(self) -> None:
        """Batch size should be under OpenAI limit."""
        assert EMBEDDING_BATCH_SIZE <= 100

    def test_scraper_headless_mode(self) -> None:
        """Scraper should be headless for CI."""
        assert SCRAPER_CONFIG["headless"] is True

    def test_required_env_vars_includes_supabase(self) -> None:
        """Should require Supabase credentials."""
        assert "SUPABASE_URL" in REQUIRED_ENV_VARS
        assert "SUPABASE_SERVICE_KEY" in REQUIRED_ENV_VARS


class TestValidateEnv:
    """Test environment variable validation."""

    def test_validate_env_with_all_vars_set(self) -> None:
        """Should not exit when all vars are set."""
        env_vars = {var: "test_value" for var in REQUIRED_ENV_VARS}

        with mock.patch.dict(os.environ, env_vars, clear=True):
            # Should not raise

            validate_env()

    def test_validate_env_with_missing_var(self) -> None:
        """Should raise ConfigurationError when a required var is missing."""

        # Set all but one

        from src.exceptions import ConfigurationError

        env_vars = {var: "test_value" for var in REQUIRED_ENV_VARS[:-1]}

        with mock.patch.dict(os.environ, env_vars, clear=True):
            with pytest.raises(ConfigurationError) as exc_info:
                validate_env()
            assert "Missing required environment variables" in str(exc_info.value)
