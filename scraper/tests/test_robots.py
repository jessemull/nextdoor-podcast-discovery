"""Tests for robots.txt check module."""

from unittest import mock

import pytest

from src.robots import (
    _parse_disallow_paths,
    _path_disallowed,
    check_robots_allowed,
)


class TestParseDisallowPaths:
    """Tests for _parse_disallow_paths."""

    def test_returns_empty_for_empty_content(self) -> None:
        """Should return empty list for empty robots.txt."""
        assert _parse_disallow_paths("") == []
        assert _parse_disallow_paths("   \n\n  ") == []

    def test_parses_simple_disallow(self) -> None:
        """Should parse Disallow lines for User-agent *."""
        robots = """
User-agent: *
Disallow: /api/
Disallow: /login
"""
        assert _parse_disallow_paths(robots) == ["/api/", "/login"]

    def test_ignores_comments_and_blank_lines(self) -> None:
        """Should skip comments and blank lines."""
        robots = """
# comment
User-agent: *

Disallow: /admin/
# Disallow: /secret
Disallow: /private/
"""
        assert _parse_disallow_paths(robots) == ["/admin/", "/private/"]

    def test_uses_last_matching_agent_block(self) -> None:
        """Should use the last User-agent * block."""
        robots = """
User-agent: *
Disallow: /old/

User-agent: *
Disallow: /new/
"""
        assert _parse_disallow_paths(robots) == ["/new/"]

    def test_strips_inline_comments(self) -> None:
        """Should strip inline comments from paths."""
        robots = """
User-agent: *
Disallow: /api/  # no api
"""
        assert _parse_disallow_paths(robots) == ["/api/"]


class TestPathDisallowed:
    """Tests for _path_disallowed."""

    def test_exact_match(self) -> None:
        """Should disallow exact path match."""
        assert _path_disallowed("/login", ["/login"]) is True
        assert _path_disallowed("/api/", ["/api/"]) is True

    def test_prefix_with_trailing_slash(self) -> None:
        """Should disallow path starting with prefix that ends in /."""
        assert _path_disallowed("/api/v1/foo", ["/api/"]) is True
        assert _path_disallowed("/api/", ["/api/"]) is True

    def test_prefix_without_trailing_slash(self) -> None:
        """Should disallow path starting with prefix or exact match."""
        assert _path_disallowed("/login/", ["/login"]) is True
        assert _path_disallowed("/login", ["/login"]) is True
        assert _path_disallowed("/login/extra", ["/login"]) is True

    def test_allowed_path(self) -> None:
        """Should allow paths not matching any prefix."""
        assert _path_disallowed("/public/", ["/api/", "/login"]) is False
        assert _path_disallowed("/news_feed/", ["/api/"]) is False

    def test_ignores_empty_prefix(self) -> None:
        """Should ignore empty prefix."""
        assert _path_disallowed("/anything", [""]) is False


class TestCheckRobotsAllowed:
    """Tests for check_robots_allowed."""

    @mock.patch("src.robots._fetch_robots_txt")
    def test_returns_true_when_fetch_fails(
        self, mock_fetch: mock.MagicMock
    ) -> None:
        """Should allow and proceed when robots.txt cannot be fetched."""
        mock_fetch.return_value = None

        allowed, msg = check_robots_allowed(
            "https://example.com", ["/login/", "/news_feed/"]
        )

        assert allowed is True
        assert "Could not fetch" in msg

    @mock.patch("src.robots._fetch_robots_txt")
    def test_returns_true_when_no_disallow(
        self, mock_fetch: mock.MagicMock
    ) -> None:
        """Should allow when robots.txt has no Disallow."""
        mock_fetch.return_value = "User-agent: *\nAllow: /"

        allowed, msg = check_robots_allowed(
            "https://example.com", ["/login/", "/news_feed/"]
        )

        assert allowed is True
        assert "allows all paths" in msg or "allows the paths" in msg

    @mock.patch("src.robots._fetch_robots_txt")
    def test_returns_true_when_paths_allowed(
        self, mock_fetch: mock.MagicMock
    ) -> None:
        """Should allow when our paths are not disallowed."""
        mock_fetch.return_value = """
User-agent: *
Disallow: /api/
Disallow: /admin/
"""

        allowed, msg = check_robots_allowed(
            "https://example.com", ["/login/", "/news_feed/"]
        )

        assert allowed is True
        assert "allows the paths" in msg

    @mock.patch("src.robots._fetch_robots_txt")
    def test_returns_false_when_path_disallowed(
        self, mock_fetch: mock.MagicMock
    ) -> None:
        """Should disallow when one of our paths is disallowed."""
        mock_fetch.return_value = """
User-agent: *
Disallow: /login/
Disallow: /api/
"""

        allowed, msg = check_robots_allowed(
            "https://example.com", ["/login/", "/news_feed/"]
        )

        assert allowed is False
        assert "disallows paths" in msg
        assert "/login/" in msg
