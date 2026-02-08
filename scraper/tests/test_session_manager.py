"""Tests for session_manager module."""

import json
import os
from datetime import UTC, datetime, timedelta
from unittest import mock

import pytest
from cryptography.fernet import Fernet
from supabase import Client

from src.session_manager import DEFAULT_SESSION_ID, SessionManager


class TestSessionManager:
    """Test SessionManager class."""

    @pytest.fixture
    def encryption_key(self) -> bytes:
        """Generate a test encryption key."""
        return Fernet.generate_key()

    @pytest.fixture
    def mock_supabase(self) -> mock.MagicMock:
        """Provide a mocked Supabase client."""
        return mock.MagicMock(spec=Client)

    @pytest.fixture
    def session_manager(
        self, encryption_key: bytes, mock_supabase: mock.MagicMock
    ) -> SessionManager:
        """Create a SessionManager instance with mocked dependencies."""
        with mock.patch(
            "src.session_manager.create_client", return_value=mock_supabase
        ):
            with mock.patch.dict(
                os.environ,
                {
                    "SESSION_ENCRYPTION_KEY": encryption_key.decode(),
                    "SUPABASE_URL": "https://test.supabase.co",
                    "SUPABASE_SERVICE_KEY": "test_key",
                },
            ):
                return SessionManager()

    def test_get_cookies_returns_none_when_no_session(
        self, session_manager: SessionManager
    ) -> None:
        """Should return None when no session exists."""
        result_mock = mock.MagicMock()
        result_mock.data = []
        session_manager.supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = (
            result_mock
        )

        result = session_manager.get_cookies()

        assert result is None

    def test_get_cookies_returns_cookies_when_valid(
        self, session_manager: SessionManager, encryption_key: bytes
    ) -> None:
        """Should return decrypted cookies when session is valid."""
        cookies = [{"name": "test", "value": "cookie"}]
        encrypted = Fernet(encryption_key).encrypt(json.dumps(cookies).encode())
        expires_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()

        result_mock = mock.MagicMock()
        result_mock.data = [
            {
                "cookies_encrypted": encrypted.decode(),
                "expires_at": expires_at,
            }
        ]
        session_manager.supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = (
            result_mock
        )

        result = session_manager.get_cookies()

        assert result == cookies

    def test_get_cookies_returns_none_when_expired(
        self, session_manager: SessionManager, encryption_key: bytes
    ) -> None:
        """Should return None when session is expired."""
        cookies = [{"name": "test", "value": "cookie"}]
        encrypted = Fernet(encryption_key).encrypt(json.dumps(cookies).encode())
        expires_at = (datetime.now(UTC) - timedelta(days=1)).isoformat()  # Expired

        result_mock = mock.MagicMock()
        result_mock.data = [
            {
                "cookies_encrypted": encrypted.decode(),
                "expires_at": expires_at,
            }
        ]
        session_manager.supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = (
            result_mock
        )

        result = session_manager.get_cookies()

        assert result is None

    def test_get_cookies_handles_invalid_token(
        self, session_manager: SessionManager
    ) -> None:
        """Should return None when encryption key is invalid."""
        # Use wrong key to encrypt
        wrong_key = Fernet.generate_key()
        encrypted = Fernet(wrong_key).encrypt(
            json.dumps([{"name": "test", "value": "cookie"}]).encode()
        )
        expires_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()

        result_mock = mock.MagicMock()
        result_mock.data = [
            {
                "cookies_encrypted": encrypted.decode(),
                "expires_at": expires_at,
            }
        ]
        session_manager.supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = (
            result_mock
        )

        result = session_manager.get_cookies()

        assert result is None

    def test_save_cookies_encrypts_and_saves(
        self, session_manager: SessionManager
    ) -> None:
        """Should encrypt and save cookies to database."""
        cookies = [{"name": "test", "value": "cookie"}]
        result_mock = mock.MagicMock()
        session_manager.supabase.table.return_value.upsert.return_value.execute.return_value = (
            result_mock
        )

        session_manager.save_cookies(cookies)

        session_manager.supabase.table.return_value.upsert.assert_called_once()
        # Verify encryption happened (check that encrypted data was passed)
        call_args = session_manager.supabase.table.return_value.upsert.call_args
        assert "cookies_encrypted" in call_args[0][0]
        assert "expires_at" in call_args[0][0]

    def test_save_cookies_uses_default_session_id(
        self, session_manager: SessionManager
    ) -> None:
        """Should use default session ID when neighborhood_id is None."""
        cookies = [{"name": "test", "value": "cookie"}]
        session_manager.save_cookies(cookies, neighborhood_id=None)

        call_args = session_manager.supabase.table.return_value.upsert.call_args
        assert call_args[0][0]["neighborhood_id"] == DEFAULT_SESSION_ID

    def test_save_cookies_uses_provided_neighborhood_id(
        self, session_manager: SessionManager
    ) -> None:
        """Should use provided neighborhood_id."""
        cookies = [{"name": "test", "value": "cookie"}]
        neighborhood_id = "test-neighborhood-uuid"
        session_manager.save_cookies(cookies, neighborhood_id=neighborhood_id)

        call_args = session_manager.supabase.table.return_value.upsert.call_args
        assert call_args[0][0]["neighborhood_id"] == neighborhood_id

    def test_delete_session(self, session_manager: SessionManager) -> None:
        """Should delete session from database."""
        neighborhood_id = "test-neighborhood-uuid"
        session_manager.delete_session(neighborhood_id)

        session_manager.supabase.table.return_value.delete.return_value.eq.return_value.execute.assert_called_once()
