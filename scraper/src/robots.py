"""Optional robots.txt fetch and check for scraper startup."""

__all__ = ["check_robots_allowed"]

import logging
import urllib.parse
import urllib.request
from typing import cast
from urllib.error import URLError

logger = logging.getLogger(__name__)

# Default User-agent used when fetching robots.txt (generic)
ROBOTS_USER_AGENT = "NextdoorScraper/1.0 (compliance check)"


def _fetch_robots_txt(base_url: str, timeout_seconds: int = 10) -> str | None:
    """Fetch robots.txt for the given base URL.

    Args:
        base_url: Scheme and host, e.g. "https://nextdoor.com".
        timeout_seconds: Request timeout.

    Returns:
        Raw robots.txt content or None on failure.
    """
    parsed = urllib.parse.urlparse(base_url)
    if not parsed.scheme or not parsed.netloc:
        return None
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    request = urllib.request.Request(
        robots_url, headers={"User-Agent": ROBOTS_USER_AGENT}
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as resp:
            return cast(str, resp.read().decode("utf-8", errors="replace"))
    except (URLError, OSError) as e:
        logger.debug("Could not fetch robots.txt from %s: %s", robots_url, e)
        return None


def _parse_disallow_paths(robots_txt: str, user_agent: str = "*") -> list[str]:
    """Parse Disallow lines for the given User-agent.

    Only considers the last "User-agent: *" or matching agent block.
    Simple parser: no wildcards in paths.

    Args:
        robots_txt: Raw robots.txt content.
        user_agent: User-agent to match (default "*").

    Returns:
        List of path prefixes that are disallowed (e.g. ["/api/", "/login"]).
    """
    disallowed: list[str] = []
    current_agent: str | None = None
    in_matching_block = False

    for line in robots_txt.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()

        if key == "user-agent":
            current_agent = value.lower()
            in_matching_block = (
                current_agent == "*" or user_agent.lower() in current_agent
            )
            if in_matching_block:
                disallowed = []
        elif key == "disallow" and in_matching_block and value:
            path = value.split("#")[0].strip()
            if path:
                disallowed.append(path)

    return disallowed


def _path_disallowed(path: str, disallow_prefixes: list[str]) -> bool:
    """Return True if path is disallowed by any of the prefixes."""
    for prefix in disallow_prefixes:
        if not prefix:
            continue
        if path == prefix:
            return True
        if prefix.endswith("/"):
            if path.startswith(prefix):
                return True
        else:
            if path.startswith(prefix + "/") or path == prefix:
                return True
    return False


def check_robots_allowed(
    base_url: str,
    paths_to_check: list[str],
    user_agent: str | None = None,
) -> tuple[bool, str]:
    """Check whether the given paths are allowed by robots.txt.

    Args:
        base_url: Scheme and host, e.g. "https://nextdoor.com".
        paths_to_check: Paths we intend to request, e.g. ["/login/", "/news_feed/"].
        user_agent: User-agent to match; if None, uses SCRAPER_CONFIG-style default "*".

    Returns:
        (allowed, message). allowed is False if any path is disallowed.
    """
    if user_agent is None:
        user_agent = "*"
    robots_txt = _fetch_robots_txt(base_url)
    if not robots_txt:
        return True, "Could not fetch robots.txt; proceeding without check"
    disallow_prefixes = _parse_disallow_paths(robots_txt, user_agent)
    if not disallow_prefixes:
        return True, "robots.txt allows all paths"
    disallowed_used = [
        p for p in paths_to_check if _path_disallowed(p, disallow_prefixes)
    ]
    if disallowed_used:
        return False, (
            f"robots.txt disallows paths we use: {disallowed_used}. "
            "Consider respecting the site's crawler policy."
        )
    return True, "robots.txt allows the paths we use"
