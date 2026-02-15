"""Session management for Nextdoor cookies."""

__all__ = ["SessionManager"]

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from supabase import Client, create_client

logger = logging.getLogger(__name__)

# UUID of the reserved "Default" neighborhood used for session storage when
# no specific neighborhood is selected. Must match the row inserted in
# database/migrations/024_default_session_neighborhood.sql.
DEFAULT_SESSION_ID = "00000000-0000-0000-0000-000000000001"


class SessionManager:
    """Manages Nextdoor login sessions stored in Supabase."""

    def __init__(self) -> None:
        """Initialize the session manager."""
        self.supabase: Client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
        self.cipher = Fernet(os.environ["SESSION_ENCRYPTION_KEY"].encode())

    def get_cookies(
        self, neighborhood_id: str | None = None
    ) -> list[dict[str, Any]] | None:
        """Load and decrypt session cookies from Supabase.

        Args:
            neighborhood_id: Optional neighborhood ID to filter by.

        Returns:
            List of cookie dicts, or None if no valid session.
        """
        query = self.supabase.table("sessions").select("cookies_encrypted, expires_at")

        # When no neighborhood specified, load the default session (reserved UUID)
        session_key = (
            neighborhood_id if neighborhood_id is not None else DEFAULT_SESSION_ID
        )
        query = query.eq("neighborhood_id", session_key)

        result = query.order("updated_at", desc=True).limit(1).execute()

        if not result.data:
            logger.info("No session found")
            return None

        # Cast to expected type (Supabase returns complex JSON union)
        session: dict[str, Any] = result.data[0]  # type: ignore[assignment]

        # Check expiration

        expires_at_str = session.get("expires_at")
        if not expires_at_str or not isinstance(expires_at_str, str):
            logger.warning("Session has no expiration date, treating as expired")
            return None

        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        except ValueError as e:
            logger.error("Failed to parse expires_at '%s': %s", expires_at_str, e)
            return None

        if expires_at < datetime.now(UTC):
            logger.info("Session expired at %s", expires_at)
            return None

        # Decrypt cookies

        try:
            encrypted_str = session.get("cookies_encrypted", "")
            if not isinstance(encrypted_str, str):
                logger.error("Invalid cookies_encrypted type")
                return None
            encrypted = encrypted_str.encode()
            decrypted = self.cipher.decrypt(encrypted)
            cookies: list[dict[str, Any]] = json.loads(decrypted)
            logger.info("Loaded %d cookies from session", len(cookies))
            return cookies
        except InvalidToken:
            logger.error("Failed to decrypt cookies: invalid encryption key")
            return None
        except json.JSONDecodeError as e:
            logger.error("Failed to parse cookies JSON: %s", e)
            return None

    def save_cookies(
        self,
        cookies: list[dict[str, Any]],
        neighborhood_id: str | None = None,
        expires_days: int = 7,
    ) -> None:
        """Encrypt and save session cookies to Supabase.

        Args:
            cookies: List of cookie dictionaries.
            neighborhood_id: Optional neighborhood ID.
            expires_days: Days until session expires.
        """
        # Encrypt cookies

        encrypted = self.cipher.encrypt(json.dumps(cookies).encode())
        now = datetime.now(UTC)
        expires_at = now + timedelta(days=expires_days)

        # Use provided neighborhood_id or default to avoid duplicate inserts
        session_id = neighborhood_id or DEFAULT_SESSION_ID

        data: dict[str, Any] = {
            "cookies_encrypted": encrypted.decode(),
            "expires_at": expires_at.isoformat(),
            "neighborhood_id": session_id,
            "updated_at": now.isoformat(),
        }

        # Always upsert to prevent duplicate sessions
        self.supabase.table("sessions").upsert(
            data,
            on_conflict="neighborhood_id",
        ).execute()

        logger.info(
            "Saved %d cookies, expires %s",
            len(cookies),
            expires_at.isoformat(),
        )

    def delete_session(self, neighborhood_id: str) -> None:
        """Delete a session from Supabase.

        Args:
            neighborhood_id: Neighborhood ID to delete session for (required).
        """
        self.supabase.table("sessions").delete().eq(
            "neighborhood_id", neighborhood_id
        ).execute()

        logger.info("Deleted session for neighborhood %s", neighborhood_id)
