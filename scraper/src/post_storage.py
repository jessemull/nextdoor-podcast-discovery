"""Post storage in Supabase with deduplication."""

__all__ = ["PostStorage", "parse_relative_timestamp"]

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, cast

from supabase import Client

from src.post_extractor import RawComment, RawPost

logger = logging.getLogger(__name__)


def parse_relative_timestamp(relative: str | None) -> datetime | None:
    """Parse a relative timestamp string into an absolute UTC datetime.

    Handles patterns like "5m", "2h", "1d", "Yesterday", "Just now".
    Uses current UTC time as reference; result is approximate.

    Args:
        relative: Raw string from DOM (e.g. "2h", "Yesterday").

    Returns:
        UTC datetime or None if unparseable.
    """
    if not relative or not relative.strip():
        return None
    text = relative.strip().lower()
    if text.endswith(" ago"):
        text = text[:-4].strip()
    now = datetime.now(timezone.utc)
    # Just now / Now
    if text in ("just now", "now"):
        return now
    # N minutes
    m = re.match(r"^(\d+)\s*m(?:in(?:ute)?s?)?$", text)
    if m:
        return now - timedelta(minutes=int(m.group(1)))
    # N hours
    m = re.match(r"^(\d+)\s*h(?:our)?s?$", text)
    if m:
        return now - timedelta(hours=int(m.group(1)))
    # N days
    m = re.match(r"^(\d+)\s*d(?:ay)?s?$", text)
    if m:
        return now - timedelta(days=int(m.group(1)))
    # N weeks
    m = re.match(r"^(\d+)\s*w(?:eek)?s?$", text)
    if m:
        return now - timedelta(weeks=int(m.group(1)))
    # Yesterday: use previous day at noon UTC (approximate)
    if text == "yesterday":
        return (now - timedelta(days=1)).replace(
            hour=12, minute=0, second=0, microsecond=0
        )
    return None


class PostStorage:
    """Stores posts in Supabase with deduplication."""

    def __init__(self, supabase: Client) -> None:
        """Initialize the storage.

        Args:
            supabase: Supabase client instance.
        """
        self.supabase = supabase
        self._neighborhood_cache: dict[str, str] = {}

    def store_posts(self, posts: list[RawPost]) -> dict[str, int]:
        """Store posts in Supabase using batch insert.

        Uses upsert with ON CONFLICT DO NOTHING to skip duplicates based on hash.

        Args:
            posts: List of RawPost objects to store.

        Returns:
            Dict with counts: {"inserted": N, "skipped": N, "errors": N}
        """
        stats = {"errors": 0, "inserted": 0, "skipped": 0}

        if not posts:
            return stats

        # Prepare all post data for batch insert

        posts_data = []

        for post in posts:
            neighborhood_id = self._get_or_create_neighborhood(post.neighborhood)
            if not neighborhood_id:
                logger.warning(
                    "Could not get neighborhood ID for: %s", post.neighborhood
                )
                stats["errors"] += 1
                continue

            posted_at = parse_relative_timestamp(post.timestamp_relative)
            comments_payload = [
                {
                    "author_name": c.author_name,
                    "text": c.text,
                    "timestamp_relative": c.timestamp_relative,
                }
                for c in post.comments
            ]
            posts_data.append(
                {
                    "author_name": post.author_name or None,
                    "comments": comments_payload,
                    "hash": post.content_hash,
                    "image_urls": post.image_urls,
                    "neighborhood_id": neighborhood_id,
                    "post_id_ext": self._extract_post_id(
                        post.post_url, post.content_hash
                    ),
                    "posted_at": posted_at.isoformat() if posted_at else None,
                    "reaction_count": post.reaction_count,
                    "text": post.content,
                    "url": post.post_url,
                    "user_id_hash": post.author_id,
                }
            )

        if not posts_data:
            return stats

        # Batch insert with conflict handling

        try:
            result = (
                self.supabase.table("posts")
                .upsert(
                    cast(Any, posts_data),
                    on_conflict="neighborhood_id,hash",
                    ignore_duplicates=True,
                )
                .execute()
            )

            # Count inserted (returned rows) vs skipped (total - returned)

            inserted_count = len(result.data) if result.data else 0
            stats["inserted"] = inserted_count
            stats["skipped"] = len(posts_data) - inserted_count

        except Exception as e:
            # Intentionally broad: batch insert can fail for network, constraints, etc.
            # Fall back to individual inserts so we don't lose all posts.
            logger.warning(
                "Batch insert failed (%s), falling back to individual inserts: %s",
                type(e).__name__,
                e,
            )

            # Fall back to individual inserts on batch failure

            for post_data in posts_data:
                try:
                    result = (
                        self.supabase.table("posts")
                        .insert(cast(Any, post_data))
                        .execute()
                    )
                    if result.data:
                        stats["inserted"] += 1
                    else:
                        stats["skipped"] += 1
                except Exception as inner_e:
                    # Supabase doesn't export specific exception types; inspect message
                    error_msg = str(inner_e).lower()
                    # Handle duplicate/unique constraint violations gracefully
                    if "duplicate" in error_msg or "unique" in error_msg:
                        stats["skipped"] += 1
                    else:
                        # Other errors (network, validation, etc.) are logged with context
                        post_hash = (
                            post_data.get("hash", "?")
                            if isinstance(post_data, dict)
                            else "?"
                        )
                        logger.error(
                            "Individual insert error (hash=%s) (%s): %s",
                            post_hash,
                            type(inner_e).__name__,
                            error_msg,
                        )
                        stats["errors"] += 1

        logger.info(
            "Storage complete: %d inserted, %d skipped, %d errors",
            stats["inserted"],
            stats["skipped"],
            stats["errors"],
        )

        return stats

    def _get_or_create_neighborhood(self, name: str | None) -> str | None:
        """Get neighborhood ID by name, creating if needed.

        Args:
            name: Neighborhood name.

        Returns:
            Neighborhood UUID or None.
        """
        if not name:
            name = "Unknown"

        # Check cache first

        if name in self._neighborhood_cache:
            return self._neighborhood_cache[name]

        # Generate a slug from the name

        slug = self._name_to_slug(name)

        # Try to find existing

        result = (
            self.supabase.table("neighborhoods")
            .select("id")
            .eq("slug", slug)
            .limit(1)
            .execute()
        )

        if result.data:
            # Cast to expected type (Supabase returns complex JSON union)
            row: dict[str, str] = result.data[0]  # type: ignore[assignment]
            neighborhood_id = row["id"]
            self._neighborhood_cache[name] = neighborhood_id
            return neighborhood_id

        # Create new neighborhood

        try:
            result = (
                self.supabase.table("neighborhoods")
                .insert({"name": name, "slug": slug})
                .execute()
            )

            if result.data:
                row = result.data[0]  # type: ignore[assignment]
                neighborhood_id = row["id"]
                self._neighborhood_cache[name] = neighborhood_id
                logger.info("Created neighborhood: %s (%s)", name, slug)
                return neighborhood_id

        except Exception as e:
            # Might be a race condition - try to fetch again
            logger.warning(
                "Error creating neighborhood %s (slug=%s): %s (%s)",
                name,
                slug,
                e,
                type(e).__name__,
            )

            result = (
                self.supabase.table("neighborhoods")
                .select("id")
                .eq("slug", slug)
                .limit(1)
                .execute()
            )

            if result.data:
                row = result.data[0]  # type: ignore[assignment]
                neighborhood_id = row["id"]
                self._neighborhood_cache[name] = neighborhood_id
                return neighborhood_id

        return None

    def _name_to_slug(self, name: str) -> str:
        """Convert neighborhood name to slug.

        Args:
            name: Neighborhood name like "Arbor Lodge".

        Returns:
            Slug like "arbor-lodge".
        """
        # Lowercase, replace spaces with dashes, remove special chars

        slug = name.lower().strip()
        slug = re.sub(r"[^a-z0-9\s-]", "", slug)
        slug = re.sub(r"\s+", "-", slug)
        slug = re.sub(r"-+", "-", slug)
        return slug.strip("-")

    def _extract_post_id(self, post_url: str | None, fallback_hash: str) -> str:
        """Extract post ID from URL or use fallback.

        Args:
            post_url: URL like https://nextdoor.com/p/NCcN87kHgBCc
            fallback_hash: Hash to use if no URL available.

        Returns:
            Post ID string.
        """
        if post_url:
            # Extract ID from URL like /p/NCcN87kHgBCc

            match = re.search(r"/p/([A-Za-z0-9]+)", post_url)
            if match:
                return match.group(1)

        # Fallback to hash prefix

        return fallback_hash[:32]
