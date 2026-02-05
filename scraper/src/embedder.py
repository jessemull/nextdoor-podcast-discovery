"""OpenAI embeddings for semantic search."""

__all__ = ["Embedder"]

import logging

from openai import APIError, OpenAI
from supabase import Client
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import EMBEDDING_BATCH_SIZE, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL

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
        except Exception as e:
            logger.error("Unexpected error generating embeddings: %s", e)
            raise

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

        existing_post_ids = {row["post_id"] for row in embeddings_result.data}

        # Filter out posts that already have embeddings or have no text
        posts_to_embed = [
            post
            for post in posts_result.data
            if post["id"] not in existing_post_ids
            and post.get("text")
            and len(post["text"].strip()) > 0
        ]

        if not posts_to_embed:
            logger.info("No posts need embeddings")
            return stats

        logger.info("Generating embeddings for %d posts", len(posts_to_embed))

        # Process in batches
        for i in range(0, len(posts_to_embed), EMBEDDING_BATCH_SIZE):
            batch = posts_to_embed[i : i + EMBEDDING_BATCH_SIZE]
            batch_texts = [post["text"] for post in batch]

            try:
                # Generate embeddings
                embeddings = self._generate_embeddings(batch_texts)

                if dry_run:
                    logger.info(
                        "DRY RUN: Would store %d embeddings", len(embeddings)
                    )
                    stats["processed"] += len(embeddings)
                    continue

                # Store embeddings
                embeddings_data = [
                    {
                        "embedding": embedding,
                        "model": EMBEDDING_MODEL,
                        "post_id": post["id"],
                    }
                    for post, embedding in zip(batch, embeddings)
                ]

                result = (
                    self.supabase.table("post_embeddings")
                    .upsert(embeddings_data, on_conflict="post_id")
                    .execute()
                )

                stored_count = len(result.data) if result.data else 0
                stats["stored"] += stored_count
                stats["processed"] += len(embeddings)

                logger.info(
                    "Stored %d embeddings (batch %d/%d)",
                    stored_count,
                    (i // EMBEDDING_BATCH_SIZE) + 1,
                    (len(posts_to_embed) + EMBEDDING_BATCH_SIZE - 1)
                    // EMBEDDING_BATCH_SIZE,
                )
            except Exception as e:
                logger.error(
                    "Error processing embedding batch (batch %d/%d): %s",
                    (i // EMBEDDING_BATCH_SIZE) + 1,
                    (len(posts_to_embed) + EMBEDDING_BATCH_SIZE - 1)
                    // EMBEDDING_BATCH_SIZE,
                    e,
                )
                stats["errors"] += len(batch)
                stats["processed"] += len(batch)
                # Continue processing remaining batches even if one fails
                # This catches both OpenAI API errors and Supabase database errors

        logger.info(
            "Embedding generation complete: %d processed, %d stored, %d errors",
            stats["processed"],
            stats["stored"],
            stats["errors"],
        )

        return stats
