"""OpenAI embeddings for semantic search."""

__all__ = ["Embedder"]

import logging
from typing import Any, cast

from openai import APIError, OpenAI
from supabase import Client
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import EMBEDDING_BATCH_SIZE, EMBEDDING_MODEL

logger = logging.getLogger(__name__)


class Embedder:
    """Generates and stores embeddings for posts."""

    def __init__(self, supabase: Client, openai_client: OpenAI) -> None:
        """Initialize the embedder.

        Args:
            supabase: Supabase client instance.
            openai_client: OpenAI client instance.
        """
        self.supabase = supabase
        self.openai = openai_client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts.

        Args:
            texts: List of post texts to embed.

        Returns:
            List of embedding vectors (each is a list of floats).

        Raises:
            APIError: If OpenAI API call fails after retries.
            ValueError: If the number of embeddings doesn't match the number of texts.
        """
        if not texts:
            return []

        try:
            response = self.openai.embeddings.create(
                input=texts,
                model=EMBEDDING_MODEL,
            )

            embeddings = [item.embedding for item in response.data]

            if len(embeddings) != len(texts):
                raise ValueError(
                    f"Expected {len(texts)} embeddings, got {len(embeddings)}"
                )

            return embeddings
        except (APIError, ValueError) as e:
            logger.error("Failed to generate embeddings: %s", e)
            raise

    def embed_post(self, post_id: str, dry_run: bool = False) -> bool:
        """Generate and store embedding for a single post. Overwrites if exists.

        Args:
            post_id: UUID of the post to embed.
            dry_run: If True, don't store.

        Returns:
            True if embedding stored successfully, False otherwise.
        """
        result = (
            self.supabase.table("posts")
            .select("id, text")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        if not result.data or len(result.data) == 0:
            logger.warning("Post %s not found for embedding", post_id)
            return False
        row = cast(dict[str, Any], result.data[0])
        text = str(row.get("text", "")).strip()
        if not text:
            logger.warning("Post %s has no text to embed", post_id)
            return False
        try:
            embeddings = self._generate_embeddings([text])
            if not embeddings:
                return False
            if dry_run:
                logger.info("DRY RUN: Would store embedding for post %s", post_id)
                return True
            to_store = [
                {
                    "embedding": embeddings[0],
                    "model": EMBEDDING_MODEL,
                    "post_id": post_id,
                }
            ]
            self.supabase.table("post_embeddings").upsert(
                to_store, on_conflict="post_id"
            ).execute()
            logger.info("Stored embedding for post %s", post_id)
            return True
        except Exception as e:
            logger.error("Failed to embed post %s: %s", post_id, e)
            return False

    def generate_and_store_embeddings(self, dry_run: bool = False) -> dict[str, int]:
        """Generate embeddings for posts without them and store in database.

        Processes posts in batches to minimize API calls.

        Args:
            dry_run: If True, don't actually store embeddings.

        Returns:
            Dict with counts: {"processed": N, "stored": N, "errors": N}
        """
        stats = {"errors": 0, "processed": 0, "stored": 0}

        # Get all posts with text
        posts_result = (
            self.supabase.table("posts")
            .select("id, text")
            .not_.is_("text", "null")
            .execute()
        )

        # Get existing embeddings to skip
        embeddings_result = (
            self.supabase.table("post_embeddings").select("post_id").execute()
        )
        embeddings_data = cast(list[dict[str, Any]], embeddings_result.data or [])
        existing_post_ids = {row["post_id"] for row in embeddings_data}

        # Filter out posts that already have embeddings or have no text
        posts_data = cast(list[dict[str, Any]], posts_result.data or [])
        posts_to_embed = [
            post
            for post in posts_data
            if post["id"] not in existing_post_ids
            and post.get("text")
            and len(str(post.get("text", "")).strip()) > 0
        ]

        if not posts_to_embed:
            logger.info("No posts need embeddings")
            return stats

        logger.info("Generating embeddings for %d posts", len(posts_to_embed))

        # Process in batches
        for i in range(0, len(posts_to_embed), EMBEDDING_BATCH_SIZE):
            batch = posts_to_embed[i : i + EMBEDDING_BATCH_SIZE]
            batch_texts = [str(post["text"]) for post in batch]

            try:
                # Generate embeddings
                embeddings = self._generate_embeddings(batch_texts)

                if dry_run:
                    logger.info("DRY RUN: Would store %d embeddings", len(embeddings))
                    stats["processed"] += len(embeddings)
                    continue

                # Store embeddings
                to_store = [
                    {
                        "embedding": embedding,
                        "model": EMBEDDING_MODEL,
                        "post_id": post["id"],
                    }
                    for post, embedding in zip(batch, embeddings)
                ]

                result = (
                    self.supabase.table("post_embeddings")
                    .upsert(to_store, on_conflict="post_id")
                    .execute()
                )

                stored_count = len(cast(list[Any], result.data)) if result.data else 0
                stats["stored"] += stored_count
                stats["processed"] += len(embeddings)

                logger.info(
                    "Stored %d embeddings (batch %d/%d)",
                    stored_count,
                    (i // EMBEDDING_BATCH_SIZE) + 1,
                    (len(posts_to_embed) + EMBEDDING_BATCH_SIZE - 1)
                    // EMBEDDING_BATCH_SIZE,
                )
            except (APIError, ValueError) as e:
                # OpenAI API errors or validation errors - log and continue
                logger.error(
                    "Error processing embedding batch (batch %d/%d): %s (type: %s)",
                    (i // EMBEDDING_BATCH_SIZE) + 1,
                    (len(posts_to_embed) + EMBEDDING_BATCH_SIZE - 1)
                    // EMBEDDING_BATCH_SIZE,
                    e,
                    type(e).__name__,
                )
                stats["errors"] += len(batch)
                stats["processed"] += len(batch)
            except (OSError, ConnectionError) as e:
                # Network/Supabase connection errors - continue with remaining batches
                logger.error(
                    "Connection error processing batch (batch %d/%d): %s (type: %s)",
                    (i // EMBEDDING_BATCH_SIZE) + 1,
                    (len(posts_to_embed) + EMBEDDING_BATCH_SIZE - 1)
                    // EMBEDDING_BATCH_SIZE,
                    e,
                    type(e).__name__,
                )
                stats["errors"] += len(batch)
                stats["processed"] += len(batch)
            except Exception as e:
                # Intentional broad catch: Supabase/DB or other unexpected errors;
                # log and continue with remaining batches (tenacity on API call only).
                logger.error(
                    "Unexpected error processing batch (batch %d/%d): %s (type: %s)",
                    (i // EMBEDDING_BATCH_SIZE) + 1,
                    (len(posts_to_embed) + EMBEDDING_BATCH_SIZE - 1)
                    // EMBEDDING_BATCH_SIZE,
                    e,
                    type(e).__name__,
                )
                stats["errors"] += len(batch)
                stats["processed"] += len(batch)

        logger.info(
            "Embedding generation complete: %d processed, %d stored, %d errors",
            stats["processed"],
            stats["stored"],
            stats["errors"],
        )

        return stats
