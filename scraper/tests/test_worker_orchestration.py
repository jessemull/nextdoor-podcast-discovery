"""Tests for worker backfill job, poll loop dispatch, and worker CLI main."""

from typing import Any
from unittest import mock

from src.worker import (
    main as worker_main,
)
from src.worker import (
    poll_and_process,
    process_backfill_dimension_job,
)


class TestProcessBackfillDimensionJob:
    """Tests for process_backfill_dimension_job."""

    def test_invalid_params_type_marks_error(self) -> None:
        """Should mark error when params is not a dict."""
        supabase = mock.MagicMock()
        bg = mock.MagicMock()
        bg.update.return_value.eq.return_value.execute.return_value = mock.MagicMock()
        supabase.table.return_value = bg

        bad_job: dict[str, Any] = {"id": "j1", "params": "bad"}
        process_backfill_dimension_job(supabase, bad_job)

        payload = bg.update.call_args[0][0]
        assert payload["status"] == "error"
        assert payload["error_message"] == "Invalid params"

    def test_missing_dimension_marks_error(self) -> None:
        """Should mark error when dimension is missing or not in SCORING_DIMENSIONS."""
        supabase = mock.MagicMock()
        bg = mock.MagicMock()
        bg.update.return_value.eq.return_value.execute.return_value = mock.MagicMock()
        supabase.table.return_value = bg

        process_backfill_dimension_job(
            supabase,
            {"id": "j2", "params": {}},
        )

        payload = bg.update.call_args[0][0]
        assert payload["status"] == "error"
        assert "dimension" in payload["error_message"].lower()

    def test_completes_with_zero_when_no_rows(self) -> None:
        """Should complete when RPC returns no posts."""
        supabase = mock.MagicMock()
        bg = mock.MagicMock()
        bg.update.return_value.eq.return_value.execute.return_value = mock.MagicMock()

        rpc_mock = mock.MagicMock()
        rpc_mock.execute.return_value = mock.MagicMock(data=[])

        def table_side_effect(name: str) -> mock.MagicMock:
            if name == "background_jobs":
                return bg
            return mock.MagicMock()

        supabase.table.side_effect = table_side_effect
        supabase.rpc.return_value = rpc_mock

        with mock.patch("src.worker.Anthropic"):
            with mock.patch("src.worker.LLMScorer") as mock_scorer_cls:
                mock_scorer_cls.return_value.score_single_dimension.return_value = []
                process_backfill_dimension_job(
                    supabase,
                    {"id": "j3", "params": {"dimension": "drama"}},
                )

        completed = [
            c[0][0]
            for c in bg.update.call_args_list
            if c[0][0].get("status") == "completed"
        ]
        assert len(completed) == 1
        assert completed[0]["progress"] == 0
        supabase.rpc.assert_called()
        get_calls = [
            mock.call(*c.args, **c.kwargs)
            for c in supabase.rpc.call_args_list
            if c.args and c.args[0] == "get_posts_missing_dimension"
        ]
        assert len(get_calls) >= 1

    def test_marks_error_on_exception(self) -> None:
        """Should mark error when scorer or RPC raises."""
        supabase = mock.MagicMock()
        bg = mock.MagicMock()
        bg.update.return_value.eq.return_value.execute.return_value = mock.MagicMock()

        def table_side_effect(name: str) -> mock.MagicMock:
            if name == "background_jobs":
                return bg
            return mock.MagicMock()

        supabase.table.side_effect = table_side_effect
        supabase.rpc.side_effect = RuntimeError("db down")

        with mock.patch("src.worker.Anthropic"):
            with mock.patch("src.worker.LLMScorer"):
                process_backfill_dimension_job(
                    supabase,
                    {"id": "j4", "params": {"dimension": "drama"}},
                )

        errors = [
            c[0][0]
            for c in bg.update.call_args_list
            if c[0][0].get("status") == "error"
        ]
        assert len(errors) == 1
        assert "db down" in errors[0]["error_message"]

    def test_stops_when_job_cancelled(self) -> None:
        """Should exit early when job status is cancelled."""
        supabase = mock.MagicMock()
        bg = mock.MagicMock()
        bg.update.return_value.eq.return_value.execute.return_value = mock.MagicMock()

        status_exec = mock.MagicMock()
        status_exec.execute.return_value = mock.MagicMock(data={"status": "cancelled"})
        bg.select.return_value.eq.return_value.single.return_value = status_exec

        rpc_mock = mock.MagicMock()
        rpc_mock.execute.return_value = mock.MagicMock(
            data=[{"id": "p1", "text": "hi", "comments": None}]
        )

        def table_side_effect(name: str) -> mock.MagicMock:
            if name == "background_jobs":
                return bg
            return mock.MagicMock()

        supabase.table.side_effect = table_side_effect
        supabase.rpc.return_value = rpc_mock

        with mock.patch("src.worker.Anthropic"):
            with mock.patch("src.worker.LLMScorer") as mock_scorer_cls:
                mock_scorer_cls.return_value.score_single_dimension.return_value = [
                    ("p1", 5.0)
                ]
                process_backfill_dimension_job(
                    supabase,
                    {"id": "j5", "params": {"dimension": "news_value"}},
                )

        merge_calls = [
            c
            for c in supabase.rpc.call_args_list
            if c.args and c.args[0] == "merge_dimension_into_llm_scores"
        ]
        assert len(merge_calls) == 0


class TestPollAndProcess:
    """Tests for poll_and_process."""

    def test_dispatches_recompute_job(self) -> None:
        """Should call process_recompute_job for recompute_final_scores."""
        supabase = mock.MagicMock()
        job = {"id": "r1", "type": "recompute_final_scores", "params": {}}

        with mock.patch(
            "src.worker.claim_next_background_job",
            side_effect=[job, KeyboardInterrupt()],
        ):
            with mock.patch("src.worker.process_recompute_job") as mock_recompute:
                with mock.patch("src.worker.time.sleep"):
                    poll_and_process(
                        supabase, "recompute_final_scores", poll_interval=1
                    )

        mock_recompute.assert_called_once_with(supabase, job)

    def test_fetch_permalink_cancelled_sleeps(self) -> None:
        """Should sleep when permalink job reports cancelled."""
        supabase = mock.MagicMock()
        job = {"id": "f1", "type": "fetch_permalink", "params": {"url": "http://x"}}

        with mock.patch(
            "src.worker.claim_next_background_job",
            side_effect=[job, KeyboardInterrupt()],
        ):
            with mock.patch(
                "src.worker.process_fetch_permalink_job", return_value=True
            ):
                with mock.patch("src.worker.time.sleep") as mock_sleep:
                    poll_and_process(supabase, "fetch_permalink", poll_interval=42)

        mock_sleep.assert_called_once_with(42)

    def test_dispatches_run_scraper(self) -> None:
        """Should call process_run_scraper_job."""
        supabase = mock.MagicMock()
        job = {"id": "s1", "type": "run_scraper", "params": {}}

        with mock.patch(
            "src.worker.claim_next_background_job",
            side_effect=[job, KeyboardInterrupt()],
        ):
            with mock.patch("src.worker.process_run_scraper_job") as mock_run:
                with mock.patch("src.worker.time.sleep"):
                    poll_and_process(supabase, "run_scraper", poll_interval=1)

        mock_run.assert_called_once_with(supabase, job)

    def test_dispatches_backfill_dimension(self) -> None:
        """Should call process_backfill_dimension_job."""
        supabase = mock.MagicMock()
        job = {
            "id": "b1",
            "type": "backfill_dimension",
            "params": {"dimension": "drama"},
        }

        with mock.patch(
            "src.worker.claim_next_background_job",
            side_effect=[job, KeyboardInterrupt()],
        ):
            with mock.patch("src.worker.process_backfill_dimension_job") as mock_bf:
                with mock.patch("src.worker.time.sleep"):
                    poll_and_process(supabase, "backfill_dimension", poll_interval=1)

        mock_bf.assert_called_once_with(supabase, job)

    def test_unknown_job_type_logs_only(self) -> None:
        """Should not call known handlers for unknown type."""
        supabase = mock.MagicMock()
        job = {"id": "u1", "type": "unknown_xyz", "params": {}}

        with mock.patch(
            "src.worker.claim_next_background_job",
            side_effect=[job, KeyboardInterrupt()],
        ):
            with mock.patch("src.worker.process_recompute_job") as mock_recompute:
                with mock.patch("src.worker.process_fetch_permalink_job") as mock_pl:
                    with mock.patch("src.worker.process_run_scraper_job") as mock_rs:
                        with mock.patch(
                            "src.worker.process_backfill_dimension_job"
                        ) as mock_bf:
                            with mock.patch("src.worker.time.sleep"):
                                poll_and_process(
                                    supabase, "unknown_xyz", poll_interval=1
                                )

        mock_recompute.assert_not_called()
        mock_pl.assert_not_called()
        mock_rs.assert_not_called()
        mock_bf.assert_not_called()

    def test_no_job_sleeps_until_interrupt(self) -> None:
        """Should sleep when no pending job."""
        supabase = mock.MagicMock()

        with mock.patch(
            "src.worker.claim_next_background_job",
            side_effect=[None, KeyboardInterrupt()],
        ):
            with mock.patch("src.worker.time.sleep") as mock_sleep:
                poll_and_process(supabase, "recompute_final_scores", poll_interval=7)

        mock_sleep.assert_called_once_with(7)


class TestWorkerMain:
    """Tests for worker main() CLI entry."""

    def test_returns_one_on_configuration_error(self) -> None:
        """Should exit 1 when validate_env raises ConfigurationError."""
        from src.config import ConfigurationError

        with mock.patch(
            "src.worker.validate_env",
            side_effect=ConfigurationError("missing"),
        ):
            with mock.patch("sys.argv", ["worker", "--once"]):
                code = worker_main()

        assert code == 1

    def test_once_no_jobs_returns_zero(self) -> None:
        """Should exit 0 when --once and queue empty."""
        mock_session = mock.MagicMock()
        mock_session.supabase = mock.MagicMock()

        with mock.patch("src.worker.validate_env"):
            with mock.patch("src.worker.SessionManager", return_value=mock_session):
                with mock.patch(
                    "src.worker.claim_next_background_job", return_value=None
                ):
                    with mock.patch("sys.argv", ["worker", "--once"]):
                        code = worker_main()

        assert code == 0

    def test_once_unknown_job_type_returns_one(self) -> None:
        """Should exit 1 for unknown job type in --once mode."""
        mock_session = mock.MagicMock()
        mock_session.supabase = mock.MagicMock()

        with mock.patch("src.worker.validate_env"):
            with mock.patch("src.worker.SessionManager", return_value=mock_session):
                with mock.patch(
                    "src.worker.claim_next_background_job",
                    return_value={"id": "x", "type": "alien_job", "params": {}},
                ):
                    with mock.patch("sys.argv", ["worker", "--once"]):
                        code = worker_main()

        assert code == 1
