"""Tests for worker_handlers (permalink and run_scraper jobs)."""

import subprocess
from pathlib import Path
from typing import Any
from unittest import mock

import pytest

from src.worker_handlers import (
    process_fetch_permalink_job,
    process_run_scraper_job,
)


def _supabase_with_bg_table(
    status_rows: list[dict[str, str]] | None = None,
) -> tuple[mock.MagicMock, mock.MagicMock]:
    """Supabase mock with background_jobs select/update chains."""
    supabase = mock.MagicMock()
    bg_mock = mock.MagicMock()

    if status_rows is None:
        status_rows = [{"status": "pending"}]

    status_exec = mock.MagicMock()
    status_exec.execute.side_effect = [
        mock.MagicMock(data=[row]) for row in status_rows
    ]
    bg_mock.select.return_value.eq.return_value.limit.return_value = status_exec

    bg_mock.update.return_value.eq.return_value.execute.return_value = mock.MagicMock()

    def table_side_effect(name: str) -> mock.MagicMock:
        if name == "background_jobs":
            return bg_mock
        return mock.MagicMock()

    supabase.table.side_effect = table_side_effect
    return supabase, bg_mock


class TestProcessFetchPermalinkJob:
    """Tests for process_fetch_permalink_job."""

    def test_invalid_params_marks_error(self) -> None:
        """Should set error status when params is not a dict."""
        supabase, bg_mock = _supabase_with_bg_table()
        job: dict[str, Any] = {"id": "job-1", "params": "not-a-dict"}

        result = process_fetch_permalink_job(supabase, job)

        assert result is False
        supabase.table.assert_called_with("background_jobs")
        bg_mock.update.assert_called_once()
        payload = bg_mock.update.call_args[0][0]
        assert payload["status"] == "error"
        assert payload["error_message"] == "Invalid params"

    def test_missing_url_marks_error(self) -> None:
        """Should set error when url is missing or not a string."""
        supabase, bg_mock = _supabase_with_bg_table()
        job = {"id": "job-1", "params": {}}

        result = process_fetch_permalink_job(supabase, job)

        assert result is False
        bg_mock.update.assert_called_once()
        payload = bg_mock.update.call_args[0][0]
        assert payload["status"] == "error"
        assert "params.url" in payload["error_message"]

    def test_cancelled_before_run_skips_subprocess(self) -> None:
        """Should return True and not run subprocess when job already cancelled."""
        supabase, _ = _supabase_with_bg_table(status_rows=[{"status": "cancelled"}])
        job = {"id": "job-1", "params": {"url": "https://nextdoor.com/p/abc"}}

        with mock.patch("src.worker_handlers.subprocess.run") as mock_run:
            result = process_fetch_permalink_job(supabase, job)

        assert result is True
        mock_run.assert_not_called()

    def test_success_marks_completed(self) -> None:
        """Should mark completed when subprocess exits 0."""
        supabase, bg_mock = _supabase_with_bg_table(
            status_rows=[{"status": "pending"}, {"status": "pending"}]
        )
        job = {
            "id": "job-1",
            "params": {"url": "https://nextdoor.com/p/xyz", "post_id": "uuid-1"},
        }

        proc_result = mock.MagicMock()
        proc_result.returncode = 0
        proc_result.stderr = ""
        proc_result.stdout = ""

        with mock.patch(
            "src.worker_handlers.subprocess.run", return_value=proc_result
        ) as mock_run:
            result = process_fetch_permalink_job(supabase, job)

        assert result is False
        mock_run.assert_called_once()
        cmd = mock_run.call_args[0][0]
        assert "--permalink" in cmd
        assert "https://nextdoor.com/p/xyz" in cmd
        assert "--post-id" in cmd
        assert "uuid-1" in cmd

        update_calls = bg_mock.update.call_args_list
        completed = [
            c[0][0] for c in update_calls if c[0][0].get("status") == "completed"
        ]
        assert len(completed) == 1

    def test_non_string_post_id_omitted_from_cmd(self) -> None:
        """Should ignore non-string post_id and still run permalink fetch."""
        supabase, _ = _supabase_with_bg_table(
            status_rows=[{"status": "pending"}, {"status": "pending"}]
        )
        job: dict[str, Any] = {
            "id": "job-1",
            "params": {"url": "https://nextdoor.com/p/x", "post_id": 123},
        }
        with mock.patch("src.worker_handlers.subprocess.run") as mock_run:
            mock_run.return_value = mock.MagicMock(returncode=0, stderr="", stdout="")
            process_fetch_permalink_job(supabase, job)
            inner_cmd = mock_run.call_args[0][0]
        assert "--post-id" not in inner_cmd

    def test_subprocess_failure_marks_error(self) -> None:
        """Should store stderr/stdout and set error on non-zero exit."""
        supabase, bg_mock = _supabase_with_bg_table(
            status_rows=[{"status": "pending"}, {"status": "pending"}]
        )
        job = {"id": "job-1", "params": {"url": "https://nextdoor.com/p/fail"}}
        proc_result = mock.MagicMock()
        proc_result.returncode = 1
        proc_result.stderr = "boom\nmore"
        proc_result.stdout = ""

        with mock.patch("src.worker_handlers.subprocess.run", return_value=proc_result):
            result = process_fetch_permalink_job(supabase, job)

        assert result is False
        error_updates = [
            c[0][0]
            for c in bg_mock.update.call_args_list
            if c[0][0].get("status") == "error"
        ]
        assert len(error_updates) == 1
        assert error_updates[0]["error_message"].startswith("boom")

    def test_timeout_marks_error(self) -> None:
        """Should set error when subprocess times out."""
        supabase, bg_mock = _supabase_with_bg_table(
            status_rows=[{"status": "pending"}, {"status": "pending"}]
        )
        job = {"id": "job-1", "params": {"url": "https://nextdoor.com/p/slow"}}

        with mock.patch(
            "src.worker_handlers.subprocess.run",
            side_effect=subprocess.TimeoutExpired(cmd="x", timeout=300),
        ):
            result = process_fetch_permalink_job(supabase, job)

        assert result is False
        error_updates = [
            c[0][0]
            for c in bg_mock.update.call_args_list
            if c[0][0].get("status") == "error"
        ]
        assert any("timed out" in u["error_message"] for u in error_updates)

    def test_cancelled_after_run_does_not_update_status(self) -> None:
        """Should return True without completed/error update if cancelled after subprocess."""
        supabase = mock.MagicMock()
        bg_mock = mock.MagicMock()
        status_exec = mock.MagicMock()
        status_exec.execute.side_effect = [
            mock.MagicMock(data=[{"status": "pending"}]),
            mock.MagicMock(data=[{"status": "cancelled"}]),
        ]
        bg_mock.select.return_value.eq.return_value.limit.return_value = status_exec
        bg_mock.update.return_value.eq.return_value.execute.return_value = (
            mock.MagicMock()
        )
        supabase.table.return_value = bg_mock

        job = {"id": "job-1", "params": {"url": "https://nextdoor.com/p/x"}}
        proc_result = mock.MagicMock(returncode=0, stderr="", stdout="")
        with mock.patch("src.worker_handlers.subprocess.run", return_value=proc_result):
            result = process_fetch_permalink_job(supabase, job)

        assert result is True
        error_or_done = [
            c[0][0]
            for c in bg_mock.update.call_args_list
            if c[0][0].get("status") in ("completed", "error")
        ]
        assert len(error_or_done) == 0


class TestProcessRunScraperJob:
    """Tests for process_run_scraper_job."""

    @pytest.fixture
    def repo_layout(self, tmp_path: Path) -> tuple[Path, Path]:
        """Minimal monorepo layout: scraper/src/worker_handlers.py + scripts/."""
        wh_path = tmp_path / "scraper" / "src"
        wh_path.mkdir(parents=True)
        (wh_path / "worker_handlers.py").write_text("")
        return tmp_path, wh_path / "worker_handlers.py"

    def test_script_missing_marks_error(
        self,
        repo_layout: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Should error when scripts/run-scrape.sh is missing."""
        repo_root, wh_file = repo_layout
        monkeypatch.setattr("src.worker_handlers.__file__", str(wh_file))
        (repo_root / "scripts").mkdir(exist_ok=True)

        supabase, bg_mock = _supabase_with_bg_table()
        job = {"id": "job-2", "params": {"feed_type": "recent"}}

        process_run_scraper_job(supabase, job)

        payloads = [c[0][0] for c in bg_mock.update.call_args_list]
        err = next(p for p in payloads if p.get("status") == "error")
        assert "not found" in err["error_message"]

    def test_success_marks_completed(
        self,
        repo_layout: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Should run script and mark job completed on exit 0."""
        repo_root, wh_file = repo_layout
        monkeypatch.setattr("src.worker_handlers.__file__", str(wh_file))
        scripts = repo_root / "scripts"
        scripts.mkdir(exist_ok=True)
        sh = scripts / "run-scrape.sh"
        sh.write_text("#!/bin/sh\nexit 0\n")
        sh.chmod(0o755)

        supabase, bg_mock = _supabase_with_bg_table()
        job = {"id": "job-3", "params": {"feed_type": "trending"}}

        process_run_scraper_job(supabase, job)

        completed = [
            c[0][0]
            for c in bg_mock.update.call_args_list
            if c[0][0].get("status") == "completed"
        ]
        assert len(completed) == 1

    def test_invalid_feed_type_defaults_to_recent(
        self,
        repo_layout: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Should pass recent when feed_type is invalid."""
        repo_root, wh_file = repo_layout
        monkeypatch.setattr("src.worker_handlers.__file__", str(wh_file))
        scripts = repo_root / "scripts"
        scripts.mkdir(exist_ok=True)
        sh = scripts / "run-scrape.sh"
        sh.write_text("#!/bin/sh\nexit 0\n")
        sh.chmod(0o755)

        supabase, _ = _supabase_with_bg_table()

        with mock.patch("src.worker_handlers.subprocess.run") as mock_run:
            mock_run.return_value = mock.MagicMock(returncode=0, stderr="", stdout="")
            process_run_scraper_job(
                supabase,
                {"id": "j", "params": {"feed_type": "not_a_feed"}},
            )
            args = mock_run.call_args[0][0]
            assert args[1] == "recent"

    def test_nonzero_exit_marks_error(
        self,
        repo_layout: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Should record error message when script exits non-zero."""
        repo_root, wh_file = repo_layout
        monkeypatch.setattr("src.worker_handlers.__file__", str(wh_file))
        scripts = repo_root / "scripts"
        scripts.mkdir(exist_ok=True)
        sh = scripts / "run-scrape.sh"
        sh.write_text("#!/bin/sh\nexit 2\n")
        sh.chmod(0o755)

        supabase, bg_mock = _supabase_with_bg_table()
        process_run_scraper_job(supabase, {"id": "j4", "params": {}})

        errors = [
            c[0][0]
            for c in bg_mock.update.call_args_list
            if c[0][0].get("status") == "error"
        ]
        assert len(errors) == 1

    def test_timeout_marks_error(
        self,
        repo_layout: tuple[Path, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Should set error on TimeoutExpired."""
        repo_root, wh_file = repo_layout
        monkeypatch.setattr("src.worker_handlers.__file__", str(wh_file))
        scripts = repo_root / "scripts"
        scripts.mkdir(exist_ok=True)
        sh = scripts / "run-scrape.sh"
        sh.write_text("#!/bin/sh\nsleep 9\n")
        sh.chmod(0o755)

        supabase, bg_mock = _supabase_with_bg_table()
        with mock.patch(
            "src.worker_handlers.subprocess.run",
            side_effect=subprocess.TimeoutExpired(cmd=str(sh), timeout=7200),
        ):
            process_run_scraper_job(supabase, {"id": "j5", "params": {}})

        errors = [
            c[0][0]
            for c in bg_mock.update.call_args_list
            if c[0][0].get("status") == "error"
        ]
        assert any("7200" in e["error_message"] for e in errors)
