"""Tests for tuning_posts_lib (newline file: UUIDs and permalink URLs)."""

import uuid
from pathlib import Path
from unittest.mock import MagicMock, Mock

from src.tuning_posts_lib import (
    extract_nextdoor_slug,
    load_tuning_lines,
    parse_tuning_reference,
    resolve_tuning_file_path,
    resolve_tuning_posts,
)


def test_extract_nextdoor_slug_from_url() -> None:
    url = "https://nextdoor.com/p/GfdpMS2B-Z_b?utm_source=share"
    assert extract_nextdoor_slug(url) == "GfdpMS2B-Z_b"


def test_parse_tuning_reference_uuid() -> None:
    u = str(uuid.uuid4())
    assert parse_tuning_reference(u) == ("uuid", u)


def test_parse_tuning_reference_slug_line() -> None:
    assert parse_tuning_reference("https://nextdoor.com/p/abc_X-1") == (
        "slug",
        "abc_X-1",
    )


def test_parse_tuning_reference_invalid() -> None:
    assert parse_tuning_reference("not-a-uuid-or-url") is None


def test_resolve_tuning_file_path_parent_dir(tmp_path: Path, monkeypatch) -> None:
    """Should find urls.txt in repo root when cwd is scraper/ (make targets)."""
    repo = tmp_path / "nextdoor"
    scraper = repo / "scraper"
    scraper.mkdir(parents=True)
    urls = repo / "urls.txt"
    urls.write_text("x\n", encoding="utf-8")
    monkeypatch.chdir(scraper)
    resolved = resolve_tuning_file_path(Path("./urls.txt"))
    assert resolved == urls.resolve()


def test_load_tuning_lines_skips_comments_and_blank(tmp_path: Path) -> None:
    f = tmp_path / "t.txt"
    f.write_text(
        "\n# skip\n\n"
        "550e8400-e29b-41d4-a716-446655440000\n"
        "  https://nextdoor.com/p/sluggy  \n",
        encoding="utf-8",
    )
    lines = load_tuning_lines(f)
    assert lines == [
        "550e8400-e29b-41d4-a716-446655440000",
        "https://nextdoor.com/p/sluggy",
    ]


def test_resolve_tuning_posts_dedupes_uuid() -> None:
    pid = str(uuid.uuid4())
    supabase = MagicMock()
    row = {
        "comments": [],
        "id": pid,
        "post_id_ext": "x",
        "text": "t",
        "url": "",
    }
    chain = MagicMock()
    chain.execute.return_value = Mock(data=[row])
    supabase.table.return_value.select.return_value.eq.return_value.limit.return_value = chain

    posts, issues = resolve_tuning_posts(supabase, [pid, pid])
    assert len(posts) == 1
    assert posts[0]["id"] == pid
    assert not issues


def test_resolve_tuning_posts_missing_slug_reports_issue() -> None:
    supabase = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "posts":
            m = MagicMock()
            sel = MagicMock()
            sel.eq.return_value.execute.return_value = Mock(data=[])
            sel.ilike.return_value.execute.return_value = Mock(data=[])
            m.select.return_value = sel
            return m
        return MagicMock()

    supabase.table.side_effect = table_side_effect

    posts, issues = resolve_tuning_posts(supabase, ["https://nextdoor.com/p/nope_nope"])
    assert posts == []
    assert len(issues) == 1
