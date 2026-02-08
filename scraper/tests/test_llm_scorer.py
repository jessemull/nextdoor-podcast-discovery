"""Tests for llm_scorer module."""

import json
from unittest import mock

import pytest
from anthropic import Anthropic
from supabase import Client

from src.llm_scorer import SCORING_DIMENSIONS, LLMScorer, PostScore
from src.novelty import calculate_novelty


class TestLLMScorer:
    """Test LLMScorer class."""

    @pytest.fixture
    def mock_anthropic(self) -> mock.MagicMock:
        """Provide a mocked Anthropic client."""
        return mock.MagicMock(spec=Anthropic)

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    @pytest.fixture
    def scorer(
        self, mock_anthropic: mock.MagicMock, mock_supabase: mock.MagicMock
    ) -> LLMScorer:
        """Create an LLMScorer instance."""
        return LLMScorer(mock_anthropic, mock_supabase)

    def test_score_posts_returns_empty_list_for_empty_input(
        self, scorer: LLMScorer
    ) -> None:
        """Should return empty list for empty posts."""
        result = scorer.score_posts([])

        assert result == []

    def test_score_posts_scores_single_post(self, scorer: LLMScorer) -> None:
        """Should score a post using Claude (batch path with 2 posts)."""
        posts = [
            {"id": "post1", "text": "This is a test post about a lost dog"},
            {"id": "post2", "text": "Another test"},
        ]
        mock_response = mock.MagicMock()
        mock_content = mock.MagicMock()
        batch_response = [
            {
                "categories": ["lost_pet"],
                "post_index": 0,
                "scores": {
                    "absurdity": 5.0,
                    "discussion_spark": 7.0,
                    "drama": 3.0,
                    "emotional_intensity": 4.0,
                    "news_value": 6.0,
                    "podcast_worthy": 6.0,
                    "readability": 8.0,
                },
                "summary": "A post about a lost dog",
                "why_podcast_worthy": "Classic lost pet appeal.",
            },
            {
                "categories": ["humor"],
                "post_index": 1,
                "scores": {
                    "absurdity": 8.0,
                    "discussion_spark": 5.0,
                    "drama": 2.0,
                    "emotional_intensity": 6.0,
                    "news_value": 3.0,
                    "podcast_worthy": 7.0,
                    "readability": 9.0,
                },
                "summary": "Another post",
                "why_podcast_worthy": "Funny.",
            },
        ]
        mock_content.text = json.dumps(batch_response)
        mock_response.content = [mock_content]
        scorer.anthropic.messages.create.return_value = mock_response

        # Mock weights and novelty config
        scorer._weights = {dim: 1.0 for dim in SCORING_DIMENSIONS}
        scorer._novelty_config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
        }

        # Mock topic frequencies
        freq_result = mock.MagicMock()
        freq_result.data = [
            {"category": "lost_pet", "count_30d": 10},
            {"category": "humor", "count_30d": 20},
        ]
        scorer.supabase.table.return_value.select.return_value.execute.return_value = (
            freq_result
        )

        results = scorer.score_posts(posts)

        assert len(results) == 2
        assert results[0].post_id == "post1"
        assert results[0].scores["absurdity"] == 5.0
        assert "lost_pet" in results[0].categories

    def test_score_posts_handles_empty_post_text(self, scorer: LLMScorer) -> None:
        """Should return error PostScore for empty post text."""
        post = {"id": "post1", "text": ""}

        results = scorer.score_posts([post])

        assert len(results) == 1
        assert results[0].error == "Empty post text"
        assert results[0].scores == {}

    def test_score_posts_handles_json_parse_error(self, scorer: LLMScorer) -> None:
        """Should return error PostScore when JSON parsing fails."""
        post = {"id": "post1", "text": "Test post"}
        mock_response = mock.MagicMock()
        mock_content = mock.MagicMock()
        mock_content.text = "Invalid JSON response"
        mock_response.content = [mock_content]
        scorer.anthropic.messages.create.return_value = mock_response

        results = scorer.score_posts([post])

        assert len(results) == 1
        assert results[0].error is not None
        assert "JSON parse error" in results[0].error

    def test_score_posts_handles_exception(self, scorer: LLMScorer) -> None:
        """Should return error PostScore when exception occurs."""
        post = {"id": "post1", "text": "Test post"}
        scorer.anthropic.messages.create.side_effect = Exception("API error")

        results = scorer.score_posts([post])

        assert len(results) == 1
        assert results[0].error is not None

    def test_calculate_final_scores_applies_weights(self, scorer: LLMScorer) -> None:
        """Should apply weights when calculating final scores."""
        results = [
            PostScore(
                post_id="post1",
                scores={dim: 5.0 for dim in SCORING_DIMENSIONS},
                categories=["drama"],
                summary="Test",
            )
        ]

        # Mock weights
        scorer._weights = {
            "absurdity": 2.0,
            "drama": 1.5,
            "discussion_spark": 1.0,
            "emotional_intensity": 1.2,
            "news_value": 1.0,
        }

        # Mock novelty config and frequencies
        scorer._novelty_config = {
            "min_multiplier": 0.2,
            "max_multiplier": 1.5,
            "frequency_thresholds": {"rare": 5, "common": 30, "very_common": 100},
        }
        freq_result = mock.MagicMock()
        freq_result.data = [{"category": "drama", "count_30d": 10}]
        scorer.supabase.table.return_value.select.return_value.execute.return_value = (
            freq_result
        )

        scorer.calculate_final_scores(results)

        assert results[0].final_score is not None
        assert 0 <= results[0].final_score <= 10

    def test_calculate_novelty_boosts_rare_topics(self, scorer: LLMScorer) -> None:
        """Should boost score for rare topics."""
        frequencies = {"rare_topic": 2}  # Below rare threshold
        config = {
            "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
            "max_multiplier": 1.5,
            "min_multiplier": 0.2,
        }

        novelty = calculate_novelty(["rare_topic"], frequencies, config)

        assert novelty == 1.5  # max_multiplier

    def test_calculate_novelty_penalizes_common_topics(self, scorer: LLMScorer) -> None:
        """Should penalize score for very common topics."""
        frequencies = {"common_topic": 150}  # Above very_common threshold
        config = {
            "frequency_thresholds": {"common": 30, "rare": 5, "very_common": 100},
            "max_multiplier": 1.5,
            "min_multiplier": 0.2,
        }

        novelty = calculate_novelty(["common_topic"], frequencies, config)

        assert novelty == 0.2  # min_multiplier

    def test_save_scores_saves_to_database(self, scorer: LLMScorer) -> None:
        """Should save scores to Supabase."""
        results = [
            PostScore(
                post_id="post1",
                scores={dim: 5.0 for dim in SCORING_DIMENSIONS},
                categories=["drama"],
                final_score=7.5,
                summary="Test summary",
            )
        ]

        upsert_result = mock.MagicMock()
        scorer.supabase.table.return_value.upsert.return_value.execute.return_value = (
            upsert_result
        )

        # Mock topic frequency update
        scorer.supabase.rpc.return_value.execute.return_value = None

        stats = scorer.save_scores(results)

        assert stats["saved"] == 1
        assert stats["skipped"] == 0
        scorer.supabase.table.return_value.upsert.assert_called_once()

    def test_save_scores_skips_posts_with_errors(self, scorer: LLMScorer) -> None:
        """Should skip posts with errors."""
        results = [
            PostScore(
                post_id="post1",
                scores={},
                categories=[],
                summary="",
                error="Test error",
            )
        ]

        stats = scorer.save_scores(results)

        assert stats["saved"] == 0
        assert stats["skipped"] == 1

    def test_get_unscored_posts_returns_posts(self, scorer: LLMScorer) -> None:
        """Should return unscored posts."""
        rpc_result = mock.MagicMock()
        rpc_result.data = [
            {"id": "post1", "text": "Post 1"},
            {"id": "post2", "text": "Post 2"},
        ]
        scorer.supabase.rpc.return_value.execute.return_value = rpc_result

        posts = scorer.get_unscored_posts(limit=10)

        assert len(posts) == 2
        assert posts[0]["id"] == "post1"

    def test_get_unscored_posts_falls_back_to_manual_query(
        self, scorer: LLMScorer
    ) -> None:
        """Should fall back to manual query when RPC fails."""
        # RPC fails
        scorer.supabase.rpc.return_value.execute.side_effect = Exception(
            "RPC not found"
        )

        # Mock manual query
        posts_result = mock.MagicMock()
        posts_result.data = [{"id": "post1", "text": "Post 1"}]
        scored_result = mock.MagicMock()
        scored_result.data = []  # No scored posts

        def table_side_effect(table_name: str) -> mock.MagicMock:
            table_mock = mock.MagicMock()
            if table_name == "posts":
                table_mock.select.return_value.order.return_value.limit.return_value.execute.return_value = (
                    posts_result
                )
            elif table_name == "llm_scores":
                table_mock.select.return_value.in_.return_value.execute.return_value = (
                    scored_result
                )
            return table_mock

        scorer.supabase.table.side_effect = table_side_effect

        posts = scorer.get_unscored_posts(limit=10)

        assert len(posts) == 1
        assert posts[0]["id"] == "post1"
