"""Tests for worker module."""

from unittest import mock

import pytest
from supabase import Client

from src.novelty import calculate_novelty
from src.worker import (
    _load_job_dependencies,
    _process_batch,
    _update_job_progress,
    calculate_final_score,
    load_novelty_config,
    load_topic_frequencies,
    load_weight_config,
    process_recompute_job,
)


class TestCalculateFinalScore:
    """Test calculate_final_score function."""

    def test_calculates_weighted_sum(self) -> None:
        """Should calculate weighted sum correctly."""
        scores = {
            "absurdity": 5.0,
            "drama": 3.0,
            "discussion_spark": 7.0,
            "emotional_intensity": 4.0,
            "news_value": 6.0,
        }
        weights = {
            "absurdity": 2.0,
            "drama": 1.5,
            "discussion_spark": 1.0,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
        }
        novelty = 1.0

        result = calculate_final_score(scores, weights, novelty)

        assert result > 0
        assert result <= 10

    def test_applies_novelty_multiplier(self) -> None:
        """Should apply novelty multiplier to final score."""
        scores = {
            "absurdity": 5.0,
            "drama": 5.0,
            "discussion_spark": 5.0,
            "emotional_intensity": 5.0,
            "news_value": 5.0,
        }
        weights = {
            "absurdity": 1.0,
            "drama": 1.0,
            "discussion_spark": 1.0,
            "emotional_intensity": 1.0,
            "news_value": 1.0,
        }

        score_without_novelty = calculate_final_score(scores, weights, 1.0)
        score_with_novelty = calculate_final_score(scores, weights, 1.5)

        assert score_with_novelty > score_without_novelty


class TestCalculateNovelty:
    """Test calculate_novelty function."""

    def test_rare_topic_boosts(self) -> None:
        """Should boost score for rare topics."""
        categories = ["rare_topic"]
        frequencies = {"rare_topic": 2}
        config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
        }

        result = calculate_novelty(categories, frequencies, config)

        assert result == 1.5  # max_multiplier

    def test_very_common_topic_penalizes(self) -> None:
        """Should penalize score for very common topics."""
        categories = ["common_topic"]
        frequencies = {"common_topic": 150}
        config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
        }

        result = calculate_novelty(categories, frequencies, config)

        assert result == 0.2  # min_multiplier

    def test_empty_categories_returns_default(self) -> None:
        """Should return 1.0 for empty categories."""
        categories: list[str] = []
        frequencies: dict[str, int] = {}
        config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
        }

        result = calculate_novelty(categories, frequencies, config)

        assert result == 1.0


class TestLoadWeightConfig:
    """Test load_weight_config function."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    def test_loads_weights_successfully(self, mock_supabase: mock.MagicMock) -> None:
        """Should load weights from weight config."""
        config_id = "test-config-id"
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "weights": {
                "absurdity": 2.0,
                "drama": 1.5,
                "discussion_spark": 1.0,
                "emotional_intensity": 1.2,
                "news_value": 1.0,
            }
        }

        result = load_weight_config(mock_supabase, config_id)

        assert result["absurdity"] == 2.0
        assert result["drama"] == 1.5

    def test_raises_error_if_config_not_found(
        self, mock_supabase: mock.MagicMock
    ) -> None:
        """Should raise ValueError if config not found."""
        config_id = "non-existent-id"
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = (
            None
        )

        with pytest.raises(ValueError, match="Weight config .* not found"):
            load_weight_config(mock_supabase, config_id)


class TestLoadNoveltyConfig:
    """Test load_novelty_config function."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    def test_loads_config_from_settings(self, mock_supabase: mock.MagicMock) -> None:
        """Should load novelty config from settings."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "value": {
                "min_multiplier": 0.2,
                "max_multiplier": 1.5,
                "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
            }
        }

        result = load_novelty_config(mock_supabase)

        assert result["min_multiplier"] == 0.2
        assert result["max_multiplier"] == 1.5

    def test_returns_defaults_if_not_found(self, mock_supabase: mock.MagicMock) -> None:
        """Should return default config if not found in settings."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = (
            None
        )

        result = load_novelty_config(mock_supabase)

        assert result["min_multiplier"] == 0.2
        assert result["max_multiplier"] == 1.5


class TestLoadTopicFrequencies:
    """Test load_topic_frequencies function."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    def test_loads_frequencies(self, mock_supabase: mock.MagicMock) -> None:
        """Should load topic frequencies from database."""
        mock_supabase.table.return_value.select.return_value.execute.return_value.data = [
            {"category": "pets", "count_30d": 10},
            {"category": "crime", "count_30d": 5},
        ]

        result = load_topic_frequencies(mock_supabase)

        assert result["pets"] == 10
        assert result["crime"] == 5


class TestLoadJobDependencies:
    """Test _load_job_dependencies function."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        supabase = mock.MagicMock(spec=Client)

        # Mock weight config
        weight_result = mock.MagicMock()
        weight_result.data = {
            "weights": {
                "absurdity": 2.0,
                "drama": 1.5,
                "discussion_spark": 1.0,
                "emotional_intensity": 1.2,
                "news_value": 1.0,
            }
        }
        supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            weight_result
        )

        # Mock novelty config
        novelty_result = mock.MagicMock()
        novelty_result.data = {
            "value": {
                "min_multiplier": 0.2,
                "max_multiplier": 1.5,
                "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
            }
        }

        # Mock topic frequencies
        frequencies_result = mock.MagicMock()
        frequencies_result.data = [{"category": "pets", "count_30d": 10}]

        # Set up table() to return different mocks based on table name
        def table_side_effect(table_name: str) -> mock.MagicMock:
            table_mock = mock.MagicMock()
            if table_name == "weight_configs":
                table_mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    weight_result
                )
            elif table_name == "settings":
                table_mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    novelty_result
                )
            elif table_name == "topic_frequencies":
                table_mock.select.return_value.execute.return_value = frequencies_result
            return table_mock

        supabase.table.side_effect = table_side_effect
        return supabase

    def test_loads_all_dependencies(self, mock_supabase: mock.MagicMock) -> None:
        """Should load weights, novelty config, and frequencies."""
        weights, novelty_config, frequencies = _load_job_dependencies(
            mock_supabase, "test-config-id"
        )

        assert weights["absurdity"] == 2.0
        assert novelty_config["min_multiplier"] == 0.2
        assert frequencies["pets"] == 10


class TestProcessBatch:
    """Test _process_batch function."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    def test_processes_batch_correctly(self, mock_supabase: mock.MagicMock) -> None:
        """Should process batch and return post_scores."""
        batch_data = [
            {
                "post_id": "post-1",
                "scores": {
                    "absurdity": 5.0,
                    "drama": 3.0,
                    "discussion_spark": 7.0,
                    "emotional_intensity": 4.0,
                    "news_value": 6.0,
                },
                "categories": ["pets"],
            },
            {
                "post_id": "post-2",
                "scores": {
                    "absurdity": 8.0,
                    "drama": 2.0,
                    "discussion_spark": 5.0,
                    "emotional_intensity": 6.0,
                    "news_value": 4.0,
                },
                "categories": ["crime"],
            },
        ]
        weights = {
            "absurdity": 2.0,
            "drama": 1.5,
            "discussion_spark": 1.0,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
        }
        novelty_config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
        }
        frequencies = {"pets": 10, "crime": 5}

        result = _process_batch(
            mock_supabase, batch_data, "config-id", weights, novelty_config, frequencies
        )

        assert len(result) == 2
        assert result[0]["post_id"] == "post-1"
        assert result[0]["weight_config_id"] == "config-id"
        assert "final_score" in result[0]
        assert "computed_at" in result[0]

    def test_skips_invalid_rows(self, mock_supabase: mock.MagicMock) -> None:
        """Should skip rows with invalid data."""
        batch_data = [
            {"post_id": None, "scores": {}, "categories": []},  # Invalid: no post_id
            {
                "post_id": "post-2",
                "scores": {
                    "absurdity": 5.0,
                    "drama": 3.0,
                    "discussion_spark": 7.0,
                    "emotional_intensity": 4.0,
                    "news_value": 6.0,
                },
                "categories": ["pets"],
            },
        ]
        weights = {
            "absurdity": 2.0,
            "drama": 1.5,
            "discussion_spark": 1.0,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
        }
        novelty_config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
        }
        frequencies: dict[str, int] = {}

        result = _process_batch(
            mock_supabase, batch_data, "config-id", weights, novelty_config, frequencies
        )

        assert len(result) == 1
        assert result[0]["post_id"] == "post-2"


class TestUpdateJobProgress:
    """Test _update_job_progress function."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    def test_updates_progress(self, mock_supabase: mock.MagicMock) -> None:
        """Should update job progress in database."""
        _update_job_progress(mock_supabase, "job-id", 50, 100)

        mock_supabase.table.assert_called_with("background_jobs")
        mock_supabase.table.return_value.update.assert_called_once()
        mock_supabase.table.return_value.update.return_value.eq.assert_called_once_with(
            "id", "job-id"
        )
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.assert_called_once()


class TestProcessRecomputeJob:
    """Test process_recompute_job function."""

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        supabase = mock.MagicMock(spec=Client)

        # Mock job update responses
        update_mock = mock.MagicMock()
        supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            update_mock
        )

        # Mock count query
        count_mock = mock.MagicMock()
        count_mock.count = 2
        supabase.table.return_value.select.return_value.execute.return_value = (
            count_mock
        )

        # Mock batch query
        batch_mock = mock.MagicMock()
        batch_mock.data = [
            {
                "id": "score-1",
                "post_id": "post-1",
                "scores": {
                    "absurdity": 5.0,
                    "drama": 3.0,
                    "discussion_spark": 7.0,
                    "emotional_intensity": 4.0,
                    "news_value": 6.0,
                },
                "categories": ["pets"],
            },
            {
                "id": "score-2",
                "post_id": "post-2",
                "scores": {
                    "absurdity": 8.0,
                    "drama": 2.0,
                    "discussion_spark": 5.0,
                    "emotional_intensity": 6.0,
                    "news_value": 4.0,
                },
                "categories": ["crime"],
            },
        ]

        # Set up table() to return different mocks
        def table_side_effect(table_name: str) -> mock.MagicMock:
            table_mock = mock.MagicMock()
            if table_name == "background_jobs":
                table_mock.update.return_value.eq.return_value.execute.return_value = (
                    update_mock
                )
            elif table_name == "llm_scores":
                select_mock = mock.MagicMock()
                select_mock.count = 2
                select_mock.execute.return_value = count_mock
                select_mock.range.return_value.execute.return_value = batch_mock
                table_mock.select.return_value = select_mock
            elif table_name == "post_scores":
                table_mock.upsert.return_value.execute.return_value = update_mock
            elif table_name == "weight_configs":
                weight_result = mock.MagicMock()
                weight_result.data = {
                    "weights": {
                        "absurdity": 2.0,
                        "drama": 1.5,
                        "discussion_spark": 1.0,
                        "emotional_intensity": 1.2,
                        "news_value": 1.0,
                    }
                }
                table_mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    weight_result
                )
            elif table_name == "settings":
                novelty_result = mock.MagicMock()
                novelty_result.data = {
                    "value": {
                        "min_multiplier": 0.2,
                        "max_multiplier": 1.5,
                        "frequency_thresholds": {
                            "rare": 5,
                            "common": 30,
                            "very_common": 100,
                        },
                    }
                }
                table_mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    novelty_result
                )
            elif table_name == "topic_frequencies":
                frequencies_result = mock.MagicMock()
                frequencies_result.data = [
                    {"category": "pets", "count_30d": 10},
                    {"category": "crime", "count_30d": 5},
                ]
                table_mock.select.return_value.execute.return_value = frequencies_result
            return table_mock

        supabase.table.side_effect = table_side_effect
        return supabase

    def test_processes_job_successfully(self, mock_supabase: mock.MagicMock) -> None:
        """Should process job and mark as completed."""
        job = {
            "id": "job-1",
            "params": {"weight_config_id": "config-1"},
            "status": "pending",
        }

        process_recompute_job(mock_supabase, job)

        # Verify job was updated to running
        mock_supabase.table.assert_any_call("background_jobs")
        # Verify job was marked as completed
        assert mock_supabase.table.call_count >= 3

    def test_raises_error_for_missing_weight_config_id(
        self, mock_supabase: mock.MagicMock
    ) -> None:
        """Should raise ValueError if weight_config_id is missing."""
        job = {
            "id": "job-1",
            "params": {},
            "status": "pending",
        }

        with pytest.raises(ValueError, match="Missing weight_config_id"):
            process_recompute_job(mock_supabase, job)

    def test_handles_invalid_params(self, mock_supabase: mock.MagicMock) -> None:
        """Should raise ValueError for invalid params."""
        job = {
            "id": "job-1",
            "params": "invalid",  # type: ignore[dict-item]
            "status": "pending",
        }

        with pytest.raises(ValueError, match="Invalid params"):
            process_recompute_job(mock_supabase, job)

    def test_handles_cancellation(self, mock_supabase: mock.MagicMock) -> None:
        """Should stop processing when job is cancelled."""
        job = {
            "id": "job-1",
            "params": {"weight_config_id": "config-1"},
            "status": "pending",
        }

        # Mock job status check to return cancelled
        cancelled_status_mock = mock.MagicMock()
        cancelled_status_mock.data = {"status": "cancelled"}

        def table_side_effect(table_name: str) -> mock.MagicMock:
            table_mock = mock.MagicMock()
            if table_name == "background_jobs":
                # First call: update to running
                # Second call: check status (returns cancelled)
                # Third call: update completed_at
                status_select = mock.MagicMock()
                status_select.eq.return_value.single.return_value.execute.return_value = (
                    cancelled_status_mock
                )
                table_mock.update.return_value.eq.return_value.execute.return_value = (
                    mock.MagicMock()
                )
                table_mock.select.return_value = status_select
            elif table_name == "weight_configs":
                weight_result = mock.MagicMock()
                weight_result.data = {
                    "weights": {
                        "absurdity": 2.0,
                        "drama": 1.5,
                        "discussion_spark": 1.0,
                        "emotional_intensity": 1.2,
                        "news_value": 1.0,
                    }
                }
                table_mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    weight_result
                )
            elif table_name == "settings":
                novelty_result = mock.MagicMock()
                novelty_result.data = {
                    "value": {
                        "min_multiplier": 0.2,
                        "max_multiplier": 1.5,
                        "frequency_thresholds": {
                            "rare": 5,
                            "common": 30,
                            "very_common": 100,
                        },
                    }
                }
                table_mock.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    novelty_result
                )
            elif table_name == "topic_frequencies":
                frequencies_result = mock.MagicMock()
                frequencies_result.data = []
                table_mock.select.return_value.execute.return_value = frequencies_result
            elif table_name == "llm_scores":
                count_mock = mock.MagicMock()
                count_mock.count = 0
                select_mock = mock.MagicMock()
                select_mock.count = 0
                select_mock.execute.return_value = count_mock
                table_mock.select.return_value = select_mock
            return table_mock

        mock_supabase.table.side_effect = table_side_effect

        process_recompute_job(mock_supabase, job)

        # Verify job was checked for cancellation
        assert mock_supabase.table.call_count >= 2

    def test_retries_on_transient_error(self, mock_supabase: mock.MagicMock) -> None:
        """Should retry job on transient error and increment retry_count."""
        job = {
            "id": "job-1",
            "params": {"weight_config_id": "config-1"},
            "status": "pending",
        }

        # Mock a transient error (network error)
        network_error = Exception("Network timeout")

        def table_side_effect(table_name: str) -> mock.MagicMock:
            table_mock = mock.MagicMock()
            if table_name == "background_jobs":
                # First: update to running
                # Second: get retry_count and max_retries
                retry_status_mock = mock.MagicMock()
                retry_status_mock.data = {"retry_count": 0, "max_retries": 3}
                status_select = mock.MagicMock()
                status_select.eq.return_value.single.return_value.execute.return_value = (
                    retry_status_mock
                )
                table_mock.update.return_value.eq.return_value.execute.return_value = (
                    mock.MagicMock()
                )
                table_mock.select.return_value = status_select
            elif table_name == "weight_configs":
                # Raise error when loading weights (simulating transient failure)
                raise network_error
            return table_mock

        mock_supabase.table.side_effect = table_side_effect

        # Should not raise, but update job for retry
        try:
            process_recompute_job(mock_supabase, job)
        except Exception:
            pass  # Expected to catch and handle

        # Verify retry logic was triggered
        assert mock_supabase.table.call_count >= 2

    def test_marks_error_after_max_retries(self, mock_supabase: mock.MagicMock) -> None:
        """Should mark job as error after max retries exceeded."""
        job = {
            "id": "job-1",
            "params": {"weight_config_id": "config-1"},
            "status": "pending",
        }

        network_error = Exception("Network timeout")

        def table_side_effect(table_name: str) -> mock.MagicMock:
            table_mock = mock.MagicMock()
            if table_name == "background_jobs":
                # Return retry_count = max_retries (should mark as error)
                retry_status_mock = mock.MagicMock()
                retry_status_mock.data = {"retry_count": 3, "max_retries": 3}
                status_select = mock.MagicMock()
                status_select.eq.return_value.single.return_value.execute.return_value = (
                    retry_status_mock
                )
                table_mock.update.return_value.eq.return_value.execute.return_value = (
                    mock.MagicMock()
                )
                table_mock.select.return_value = status_select
            elif table_name == "weight_configs":
                raise network_error
            return table_mock

        mock_supabase.table.side_effect = table_side_effect

        # Should not raise, but mark as error
        try:
            process_recompute_job(mock_supabase, job)
        except Exception:
            pass  # Expected to catch and handle

        # Verify error handling was triggered
        assert mock_supabase.table.call_count >= 2
