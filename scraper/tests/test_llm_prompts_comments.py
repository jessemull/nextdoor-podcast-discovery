"""Tests for comment formatting in LLM scoring prompts."""

import json
from unittest import mock

import src.llm_prompts as llm_prompts
from src.llm_prompts import (
    build_post_text_for_scoring,
    format_comments_for_scoring_prompt,
)


class TestFormatCommentsForScoringPrompt:
    """Tests for format_comments_for_scoring_prompt."""

    def test_returns_empty_for_none(self) -> None:
        """Should return empty string when comments is None."""
        assert format_comments_for_scoring_prompt(None) == ""

    def test_returns_empty_for_empty_list(self) -> None:
        """Should return empty string for empty list."""
        assert format_comments_for_scoring_prompt([]) == ""

    def test_returns_empty_for_invalid_json_string(self) -> None:
        """Should return empty string when JSON string is invalid."""
        assert format_comments_for_scoring_prompt("not-json") == ""

    def test_parses_json_string(self) -> None:
        """Should parse comments from JSON string."""
        raw = json.dumps([{"author_name": "A", "text": "Hello"}])
        out = format_comments_for_scoring_prompt(raw)
        assert "1. A: Hello" in out

    def test_skips_empty_comment_bodies(self) -> None:
        """Should skip comments with no text."""
        comments = [
            {"author_name": "A", "text": ""},
            {"author_name": "B", "text": "Real"},
        ]
        out = format_comments_for_scoring_prompt(comments)
        assert "1. B: Real" in out
        assert "1. A:" not in out

    def test_truncates_long_comment_text(self) -> None:
        """Should truncate single comment body past MAX_COMMENT_TEXT_LENGTH."""
        long_text = "x" * 500
        out = format_comments_for_scoring_prompt(
            [{"author_name": "U", "text": long_text}]
        )
        assert "[Comment text truncated at" in out
        assert len(out) < len(long_text) + 50

    def test_respects_max_comments_per_post(self) -> None:
        """Should omit comments beyond MAX_COMMENTS_PER_POST with notice."""
        with mock.patch.object(llm_prompts, "MAX_COMMENTS_PER_POST", 2):
            comments = [{"author_name": "N", "text": f"c{i}"} for i in range(5)]
            out = llm_prompts.format_comments_for_scoring_prompt(comments)
        assert "more comments omitted" in out
        assert out.count("N:") == 2


class TestBuildPostTextForScoring:
    """Tests for build_post_text_for_scoring."""

    def test_body_only_when_no_comments(self) -> None:
        """Should return truncated body only when no comments."""
        post = {"text": "Hello world"}
        assert build_post_text_for_scoring(post) == "Hello world"

    def test_appends_comments_section(self) -> None:
        """Should append Comments block when comments present."""
        post = {
            "text": "OP text",
            "comments": [{"author_name": "Sam", "text": "Reply"}],
        }
        out = build_post_text_for_scoring(post)
        assert out.startswith("OP text")
        assert "\n\nComments:\n" in out
        assert "Sam: Reply" in out

    def test_truncates_post_body(self) -> None:
        """Should truncate long post body with marker."""
        long = "y" * 2500
        post = {"text": long}
        out = build_post_text_for_scoring(post)
        assert "[Text truncated at" in out
        assert len(out) < len(long)
