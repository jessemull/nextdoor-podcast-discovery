"""Post storage in Supabase with deduplication."""

__all__ = ["PostStorage"]

import logging
import re

from supabase import Client

from src.post_extractor import RawPost

logger = logging.getLogger(__name__)


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
        """Store posts in Supabase.

        Uses ON CONFLICT DO NOTHING to skip duplicates based on hash.

        Args:
            posts: List of RawPost objects to store.

        Returns:
            Dict with counts: {"inserted": N, "skipped": N, "errors": N}
        """
        stats = {"errors": 0, "inserted": 0, "skipped": 0}

        for post in posts:
            try:
                result = self._store_single_post(post)

                if result == "inserted":
                    stats["inserted"] += 1
                elif result == "skipped":
                    stats["skipped"] += 1
                else:
                    stats["errors"] += 1

            except Exception as e:
                logger.error("Error storing post: %s", e)
                stats["errors"] += 1

        logger.info(
            "Storage complete: %d inserted, %d skipped, %d errors",
            stats["inserted"],
            stats["skipped"],
            stats["errors"],
        )

        return stats

    def _store_single_post(self, post: RawPost) -> str:
        """Store a single post.

        Args:
            post: RawPost to store.

        Returns:
            Status string: "inserted", "skipped", or "error"
        """
        # Get or create neighborhood

        neighborhood_id = self._get_or_create_neighborhood(post.neighborhood)
        if not neighborhood_id:
            logger.warning("Could not get neighborhood ID for: %s", post.neighborhood)
            return "error"

        # Prepare post data
        # NOTE: Using content_hash as post_id_ext until we implement Share modal extraction
        # NOTE: url is None until we implement Share modal extraction

        post_data = {
            "hash": post.content_hash,
            "image_urls": post.image_urls,
            "neighborhood_id": neighborhood_id,
            "post_id_ext": post.content_hash[:32],  # Temporary: use hash prefix
            "text": post.content,
            "url": None,
            "user_id_hash": post.author_id,
        }

        try:
            result = (
                self.supabase.table("posts")
                .insert(post_data)
                .execute()
            )

            if result.data:
                logger.debug("Inserted post: %s", post.content_hash[:16])
                return "inserted"

            return "skipped"

        except Exception as e:
            error_msg = str(e)

            # Check if it's a duplicate key error

            if "duplicate key" in error_msg.lower() or "unique" in error_msg.lower():
                logger.debug("Skipped duplicate post: %s", post.content_hash[:16])
                return "skipped"

            logger.error("Insert error: %s", error_msg)
            return "error"

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

            logger.warning("Error creating neighborhood %s: %s", name, e)

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
