"""Post storage in Supabase with deduplication."""

__all__ = ["PostStorage", "parse_relative_timestamp"]

import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from supabase import Client

from src.post_extractor import RawPost

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
    now = datetime.now(UTC)
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

        # Resolve all unique neighborhood names in one batch
        unique_names = sorted(
            {post.neighborhood or "Unknown" for post in posts},
            key=str,
        )
        name_to_id = self._resolve_neighborhoods_batch(unique_names)

        # Prepare all post data for batch insert

        posts_data = []

        for post in posts:
            name = post.neighborhood or "Unknown"
            neighborhood_id = name_to_id.get(name)
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

    def store_post_or_update(
        self, post: RawPost, post_id: str | None = None
    ) -> dict[str, Any]:
        """Store a single post: insert if new, update if existing.

        Args:
            post: RawPost to store.
            post_id: If provided, update existing post; otherwise insert new.

        Returns:
            Dict with keys: action ("inserted" | "updated"), post_id, errors (bool).
        """
        result: dict[str, Any] = {
            "action": "inserted",
            "errors": False,
            "post_id": None,
        }

        if post_id:
            success = self.update_post(post_id, post)
            if success:
                result["action"] = "updated"
                result["post_id"] = post_id
            else:
                result["errors"] = True
            return result

        # Insert new post
        neighborhood_id = self._get_or_create_neighborhood(post.neighborhood)
        if not neighborhood_id:
            logger.warning("Could not get neighborhood ID for: %s", post.neighborhood)
            result["errors"] = True
            return result

        posted_at = parse_relative_timestamp(post.timestamp_relative)
        comments_payload = [
            {
                "author_name": c.author_name,
                "text": c.text,
                "timestamp_relative": c.timestamp_relative,
            }
            for c in post.comments
        ]
        post_data: dict[str, Any] = {
            "author_name": post.author_name or None,
            "comments": comments_payload,
            "hash": post.content_hash,
            "image_urls": post.image_urls,
            "neighborhood_id": neighborhood_id,
            "post_id_ext": self._extract_post_id(post.post_url, post.content_hash),
            "posted_at": posted_at.isoformat() if posted_at else None,
            "reaction_count": post.reaction_count,
            "text": post.content,
            "url": post.post_url,
            "user_id_hash": post.author_id,
        }

        try:
            insert_result = (
                self.supabase.table("posts").insert(cast(Any, post_data)).execute()
            )
            if insert_result.data and len(insert_result.data) > 0:
                row = cast(dict[str, Any], insert_result.data[0])
                result["post_id"] = row.get("id")
            else:
                result["errors"] = True
        except Exception as e:
            error_msg = str(e).lower()
            if "duplicate" in error_msg or "unique" in error_msg:
                # Already exists - fetch by url
                existing = self._get_post_by_url_or_hash(
                    post.post_url, post.content_hash
                )
                if existing:
                    result["action"] = "skipped"
                    result["post_id"] = existing.get("id")
            else:
                logger.error(
                    "Failed to insert post: %s (%s)",
                    e,
                    type(e).__name__,
                )
                result["errors"] = True
        return result

    def update_post(self, post_id: str, post: RawPost) -> bool:
        """Update an existing post with fresh data (reaction_count, comments, etc.).

        Args:
            post_id: UUID of the post to update.
            post: RawPost with fresh extracted data.

        Returns:
            True if update succeeded, False otherwise.
        """
        comments_payload = [
            {
                "author_name": c.author_name,
                "text": c.text,
                "timestamp_relative": c.timestamp_relative,
            }
            for c in post.comments
        ]

        update_data: dict[str, Any] = {
            "comments": comments_payload,
            "image_urls": post.image_urls,
            "reaction_count": post.reaction_count,
            "text": post.content,
        }

        # Only update author/url if we have them (preserve existing if extraction failed)
        if post.author_name is not None:
            update_data["author_name"] = post.author_name
        if post.post_url:
            update_data["url"] = post.post_url

        try:
            result = (
                self.supabase.table("posts")
                .update(cast(Any, update_data))
                .eq("id", post_id)
                .execute()
            )
            if result.data and len(result.data) > 0:
                logger.info(
                    "Updated post %s (reactions=%d, comments=%d)",
                    post_id,
                    post.reaction_count,
                    len(post.comments),
                )
                return True
            return False
        except Exception as e:
            logger.error(
                "Failed to update post %s: %s (%s)",
                post_id,
                e,
                type(e).__name__,
            )
            return False

    def _get_post_by_url_or_hash(
        self, post_url: str | None, content_hash: str
    ) -> dict[str, Any] | None:
        """Get post by url or hash.

        Args:
            post_url: Post URL (may be None).
            content_hash: Content hash.

        Returns:
            Post row dict or None.
        """
        if post_url:
            post_id_ext = self._extract_post_id(post_url, content_hash)
            result = (
                self.supabase.table("posts")
                .select("id")
                .eq("post_id_ext", post_id_ext)
                .limit(1)
                .execute()
            )
            if result.data and len(result.data) > 0:
                return cast(dict[str, Any], result.data[0])
        return None

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

    def _resolve_neighborhoods_batch(
        self, names: list[str]
    ) -> dict[str, str]:
        """Resolve neighborhood names to IDs in one batch.

        Batch-selects existing neighborhoods by slug, inserts missing ones,
        and updates the cache.

        Args:
            names: Unique neighborhood names (use "Unknown" for None).

        Returns:
            Dict mapping name -> neighborhood_id.
        """
        if not names:
            return {}

        # Build name -> slug and slug -> name (for reverse lookup)
        name_to_slug: dict[str, str] = {}
        for name in names:
            if name not in name_to_slug:
                name_to_slug[name] = self._name_to_slug(name)
        slugs = list(name_to_slug.values())
        slug_to_name = {v: k for k, v in name_to_slug.items()}

        # Batch select existing neighborhoods
        result = (
            self.supabase.table("neighborhoods")
            .select("id, slug")
            .in_("slug", slugs)
            .execute()
        )
        found_slugs: set[str] = set()
        name_to_id: dict[str, str] = {}
        for row in result.data or []:
            row_dict = cast(dict[str, str], row)
            slug = row_dict.get("slug")
            neighborhood_id = row_dict.get("id")
            if slug and neighborhood_id:
                found_slugs.add(slug)
                name = slug_to_name.get(slug, slug)
                name_to_id[name] = neighborhood_id
                self._neighborhood_cache[name] = neighborhood_id

        # Insert missing neighborhoods one-by-one (with race-condition retry)
        for name, slug in name_to_slug.items():
            if slug in found_slugs:
                continue
            neighborhood_id = self._get_or_create_neighborhood(name)
            if neighborhood_id:
                name_to_id[name] = neighborhood_id
                found_slugs.add(slug)

        return name_to_id

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
