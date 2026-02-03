"""Session management for Nextdoor cookies."""

__all__ = ["SessionManager"]

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from supabase import Client, create_client

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages Nextdoor login sessions stored in Supabase."""

    def __init__(self) -> None:
        """Initialize the session manager."""
        self.supabase: Client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
        self.cipher = Fernet(os.environ["SESSION_ENCRYPTION_KEY"].encode())

    def get_cookies(self, neighborhood_id: str | None = None) -> list[dict[str, Any]] | None:
        """Load and decrypt session cookies from Supabase.

        Args:
            neighborhood_id: Optional neighborhood ID to filter by.

        Returns:
            List of cookie dicts, or None if no valid session.
        """
        query = self.supabase.table("sessions").select(
            "cookies_encrypted, expires_at"
        )

        if neighborhood_id:
            query = query.eq("neighborhood_id", neighborhood_id)

        result = query.order("updated_at", desc=True).limit(1).execute()

        if not result.data:
            logger.info("No session found")
            return None

        session = result.data[0]

        # Check expiration

        expires_at_str = session.get("expires_at")
        if not expires_at_str:
            logger.warning("Session has no expiration date, treating as expired")
            return None

        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        except ValueError as e:
            logger.error("Failed to parse expires_at '%s': %s", expires_at_str, e)
            return None

        if expires_at < datetime.now(timezone.utc):
            logger.info("Session expired at %s", expires_at)
            return None

        # Decrypt cookies

        try:
            encrypted = session["cookies_encrypted"].encode()
            decrypted = self.cipher.decrypt(encrypted)
            cookies = json.loads(decrypted)
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
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=expires_days)

        data: dict[str, Any] = {
            "cookies_encrypted": encrypted.decode(),
            "expires_at": expires_at.isoformat(),
            "updated_at": now.isoformat(),
        }

        if neighborhood_id:
            data["neighborhood_id"] = neighborhood_id

            # Upsert with conflict on neighborhood_id

            self.supabase.table("sessions").upsert(
                data,
                on_conflict="neighborhood_id",
            ).execute()
        else:
            # Insert new session without neighborhood_id

            self.supabase.table("sessions").insert(data).execute()

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
