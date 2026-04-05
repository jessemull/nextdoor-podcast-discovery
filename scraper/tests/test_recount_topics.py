"""Tests for recount_topics script."""

from unittest import mock

from src.exceptions import ConfigurationError
from src.recount_topics import main as recount_main


class TestRecountTopicsMain:
    """Tests for recount_topics.main."""

    def test_returns_one_on_configuration_error(self) -> None:
        """Should exit 1 when validate_env raises ConfigurationError."""
        with mock.patch(
            "src.recount_topics.validate_env",
            side_effect=ConfigurationError("missing env"),
        ):
            code = recount_main()

        assert code == 1

    def test_returns_zero_on_success(self) -> None:
        """Should exit 0 when RPC succeeds."""
        mock_client = mock.MagicMock()
        mock_create = mock.patch(
            "src.recount_topics.create_client",
            return_value=mock_client,
        )
        with mock.patch.dict(
            "os.environ",
            {"SUPABASE_SERVICE_KEY": "k", "SUPABASE_URL": "https://x.supabase.co"},
            clear=False,
        ):
            with mock.patch("src.recount_topics.validate_env"):
                with mock_create:
                    code = recount_main()

        assert code == 0
        mock_client.rpc.assert_called_once_with("recount_topic_frequencies")
        mock_client.rpc.return_value.execute.assert_called_once()

    def test_returns_one_on_rpc_failure(self) -> None:
        """Should exit 1 when RPC raises."""
        mock_client = mock.MagicMock()
        mock_client.rpc.return_value.execute.side_effect = RuntimeError("rpc failed")

        with mock.patch.dict(
            "os.environ",
            {"SUPABASE_SERVICE_KEY": "k", "SUPABASE_URL": "https://x.supabase.co"},
            clear=False,
        ):
            with mock.patch("src.recount_topics.validate_env"):
                with mock.patch(
                    "src.recount_topics.create_client",
                    return_value=mock_client,
                ):
                    code = recount_main()

        assert code == 1
