"""Resolve tuning example posts from a newline file (post UUIDs or Nextdoor /p/ URLs)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any, Literal, cast

from supabase import Client

__all__ = [
    "extract_nextdoor_slug",
    "load_tuning_lines",
    "parse_tuning_reference",
    "resolve_tuning_file_path",
    "resolve_tuning_posts",
]

_SLUG_RE = re.compile(r"/p/([A-Za-z0-9_-]+)")


def extract_nextdoor_slug(text: str) -> str | None:
    """Return Nextdoor post slug from a share URL or bare path, or None."""
    s = text.strip()
    if not s:
        return None
    m = _SLUG_RE.search(s)
    return m.group(1) if m else None


def load_tuning_lines(path: Path) -> list[str]:
    """Load non-empty, non-comment lines from a tuning input file."""
    if not path.is_file():
        raise FileNotFoundError(f"Tuning examples file not found: {path}")
    lines: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        lines.append(s)
    return lines


def resolve_tuning_file_path(raw: Path) -> Path:
    """Resolve a tuning input path when cwd may be scraper/ or repo root.

    Tries cwd first, then parent directory (monorepo root), matching make targets
    that run ``cd scraper``.
    """
    if raw.is_absolute():
        return raw.resolve()
    cwd = Path.cwd()
    for base in (cwd, cwd.parent):
        candidate = (base / raw).resolve()
        if candidate.is_file():
            return candidate
    return (cwd / raw).resolve()


def parse_tuning_reference(line: str) -> tuple[Literal["slug", "uuid"], str] | None:
    """Parse one line as a post UUID or a permalink containing /p/<slug>."""
    s = line.strip()
    if not s or s.startswith("#"):
        return None
    try:
        u = uuid.UUID(s)
        return ("uuid", str(u))
    except ValueError:
        pass
    slug = extract_nextdoor_slug(s)
    if slug:
        return ("slug", slug)
    return None


def _fetch_by_slug(supabase: Client, slug: str) -> list[dict[str, Any]]:
    """Return matching posts (0, 1, or more) for a permalink slug."""
    by_ext = (
        supabase.table("posts")
        .select("id, text, comments, url, post_id_ext")
        .eq("post_id_ext", slug)
        .execute()
    )
    rows = cast(list[dict[str, Any]], by_ext.data or [])
    if rows:
        return rows
    pattern = f"%/p/{slug}%"
    by_url = (
        supabase.table("posts")
        .select("id, text, comments, url, post_id_ext")
        .ilike("url", pattern)
        .execute()
    )
    return cast(list[dict[str, Any]], by_url.data or [])


def _fetch_by_uuid(supabase: Client, post_id: str) -> list[dict[str, Any]]:
    result = (
        supabase.table("posts")
        .select("id, text, comments, url, post_id_ext")
        .eq("id", post_id)
        .limit(1)
        .execute()
    )
    rows = cast(list[dict[str, Any]], result.data or [])
    return rows


def resolve_tuning_posts(
    supabase: Client, lines: list[str]
) -> tuple[list[dict[str, Any]], list[str]]:
    """Resolve tuning file lines to unique post dicts.

    Returns:
        (posts, issues) where issues collects human-readable problems.
    """
    posts: list[dict[str, Any]] = []
    issues: list[str] = []
    seen_ids: set[str] = set()
    ordered_refs: list[tuple[Literal["slug", "uuid"], str]] = []
    seen_ref: set[str] = set()

    for line in lines:
        ref = parse_tuning_reference(line)
        if not ref:
            issues.append(f"line not a UUID or Nextdoor /p/ URL: {line!r}")
            continue
        kind, val = ref
        key = f"{kind}:{val}"
        if key in seen_ref:
            continue
        seen_ref.add(key)
        ordered_refs.append(ref)

    for kind, val in ordered_refs:
        if kind == "uuid":
            rows = _fetch_by_uuid(supabase, val)
            label = f"uuid={val}"
        else:
            rows = _fetch_by_slug(supabase, val)
            label = f"slug={val}"

        if not rows:
            issues.append(f"{label}: no matching post")
            continue
        if len(rows) > 1:
            issues.append(
                f"{label}: multiple matches ({len(rows)}), using first id={rows[0].get('id')}"
            )
        row = dict(rows[0])
        pid = str(row.get("id", ""))
        if not pid:
            issues.append(f"{label}: row missing id")
            continue
        if pid in seen_ids:
            issues.append(f"{label}: duplicate post id {pid} (skipped)")
            continue
        seen_ids.add(pid)
        posts.append(row)

    return posts, issues
