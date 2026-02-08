"""Standalone script to generate embeddings for posts without them."""

__all__ = ["main"]

import argparse
import logging
import os
import sys

from dotenv import load_dotenv
from openai import OpenAI

from src.config import validate_env
from src.embedder import Embedder
from src.exceptions import ConfigurationError
from src.session_manager import SessionManager

# Load environment variables from .env file

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main(dry_run: bool = False) -> int:
    """Generate embeddings for posts without them.

    This script processes all posts in the database that don't have embeddings yet.
    It skips posts that already have embeddings, so it's safe to run multiple times.

    Args:
        dry_run: If True, don't actually store embeddings.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    logger.info("Starting embedding generation (dry_run=%s)", dry_run)

    try:
        # Validate environment variables
        validate_env()

        # Initialize session manager (for Supabase connection)
        session_manager = SessionManager()

        # Initialize OpenAI client
        openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

        # Initialize embedder
        embedder = Embedder(session_manager.supabase, openai_client)

        # Generate and store embeddings
        stats = embedder.generate_and_store_embeddings(dry_run=dry_run)

        logger.info(
            "Embedding generation complete: %d processed, %d stored, %d errors",
            stats["processed"],
            stats["stored"],
            stats["errors"],
        )

        return 0

    except ConfigurationError as e:
        logger.error("Configuration error: %s", e)
        return 1
    except Exception as e:
        # Last-resort catch so embed script exits cleanly with code 1
        logger.exception("Unexpected error (%s): %s", type(e).__name__, e)
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate embeddings for posts without them"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without making changes to the database",
    )
    args = parser.parse_args()

    sys.exit(main(dry_run=args.dry_run))
