"""OpenAI embeddings for semantic search."""

__all__ = ["Embedder"]

import logging
from typing import Any, cast

from openai import APIError, OpenAI
from supabase import Client
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import (
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_CHUNK_SIZE,
    EMBEDDING_MODEL,
)

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

        Fetches posts in chunks via RPC (bounded memory); processes each chunk
        in API-sized batches.

        Args:
            dry_run: If True, don't actually store embeddings.

        Returns:
            Dict with counts: {"processed": N, "stored": N, "errors": N}
        """
        stats = {"errors": 0, "processed": 0, "stored": 0}
        chunk_num = 0

        while True:
            chunk_num += 1
            result = (
                self.supabase.rpc(
                    "get_posts_without_embeddings",
                    {"lim": EMBEDDING_CHUNK_SIZE},
                )
                .execute()
            )
            chunk = cast(list[dict[str, Any]], result.data or [])
            if not chunk:
                if chunk_num == 1:
                    logger.info("No posts need embeddings")
                break

            logger.info(
                "Processing chunk %d: %d posts without embeddings",
                chunk_num,
                len(chunk),
            )

            # Process chunk in API-sized batches
            for i in range(0, len(chunk), EMBEDDING_BATCH_SIZE):
                batch = chunk[i : i + EMBEDDING_BATCH_SIZE]
                batch_texts = [str(post.get("text", "")).strip() for post in batch]

                try:
                    embeddings = self._generate_embeddings(batch_texts)

                    if dry_run:
                        logger.info(
                            "DRY RUN: Would store %d embeddings", len(embeddings)
                        )
                        stats["processed"] += len(embeddings)
                        continue

                    to_store = [
                        {
                            "embedding": embedding,
                            "model": EMBEDDING_MODEL,
                            "post_id": post["id"],
                        }
                        for post, embedding in zip(batch, embeddings)
                    ]

                    upsert_result = (
                        self.supabase.table("post_embeddings")
                        .upsert(to_store, on_conflict="post_id")
                        .execute()
                    )
                    stored_count = (
                        len(cast(list[Any], upsert_result.data))
                        if upsert_result.data
                        else 0
                    )
                    stats["stored"] += stored_count
                    stats["processed"] += len(embeddings)

                    logger.info(
                        "Stored %d embeddings (chunk %d, batch %d)",
                        stored_count,
                        chunk_num,
                        (i // EMBEDDING_BATCH_SIZE) + 1,
                    )
                except (APIError, ValueError) as e:
                    logger.error(
                        "Error processing batch (chunk %d): %s (%s)",
                        chunk_num,
                        e,
                        type(e).__name__,
                    )
                    stats["errors"] += len(batch)
                    stats["processed"] += len(batch)
                except (OSError, ConnectionError) as e:
                    logger.error(
                        "Connection error processing batch (chunk %d): %s (%s)",
                        chunk_num,
                        e,
                        type(e).__name__,
                    )
                    stats["errors"] += len(batch)
                    stats["processed"] += len(batch)
                except Exception as e:
                    logger.error(
                        "Unexpected error processing batch (chunk %d): %s (%s)",
                        chunk_num,
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
