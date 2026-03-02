"""Shared logging configuration for scraper components.

Provides a single place to enable colored console output (via colorlog when
available), optional file logging, and consistent HTTP client log levels.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
from pathlib import Path
from typing import Any

_CONFIGURED = False


def configure_logging(app_name: str = "scraper") -> None:
    """Configure root logger with optional color and file handlers.

    Args:
        app_name: Logical name for the app using the logger. Currently unused,
            but reserved for future tagging or structured logging.
    """
    global _CONFIGURED

    # Always ensure noisy libraries are dialed down, even if we've already
    # configured handlers.
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if _CONFIGURED:
        return

    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    disable_color = bool(os.environ.get("NO_COLOR")) or os.environ.get("LOG_COLOR") in (
        "0",
        "false",
        "False",
    )

    handler: logging.Handler
    use_colorlog = False
    colorlog: Any = None

    if not disable_color:
        try:
            import colorlog as _colorlog  # type: ignore[import]

            colorlog = _colorlog
            use_colorlog = True
        except Exception:  # pragma: no cover - colorlog is optional
            use_colorlog = False

    if use_colorlog and colorlog is not None:
        handler = colorlog.StreamHandler()
        handler.setFormatter(
            colorlog.ColoredFormatter(
                "%(log_color)s" + log_format + "%(reset)s",
                log_colors={
                    "DEBUG": "cyan",
                    "ERROR": "red",
                    "INFO": "green",
                    "WARNING": "yellow",
                },
            )
        )
        logging.basicConfig(handlers=[handler], level=log_level)
    else:
        logging.basicConfig(format=log_format, level=log_level)

    # Optional file logging shared across components.
    log_file = os.environ.get("SCRAPER_LOG_FILE")
    log_dir = os.environ.get("SCRAPER_LOG_DIR")
    if log_file or log_dir:
        if log_file:
            file_path = Path(log_file).expanduser()
        else:
            assert log_dir is not None
            file_path = Path(log_dir).expanduser() / "scraper.log"

        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.handlers.RotatingFileHandler(
                file_path,
                maxBytes=5 * 1024 * 1024,
                backupCount=3,
                encoding="utf-8",
            )
        except PermissionError:
            logging.getLogger(__name__).warning(
                "Could not create or open log file %s; continuing without file logging",
                file_path,
            )
        else:
            file_handler.setFormatter(logging.Formatter(log_format))
            file_handler.setLevel(log_level)
            logging.getLogger().addHandler(file_handler)

    _CONFIGURED = True

