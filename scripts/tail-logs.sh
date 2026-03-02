#!/usr/bin/env bash
# Tail scraper logs on the server (run from your local machine).
# Set DEPLOY_HOST (e.g. nextdoor@scraper-server) and optionally LOG_PATH.
#
# Usage: ./scripts/tail-logs.sh [ -n N ]
#   Default: tail -f ~/nextdoor-logs/scraper.log on the server.
#   With -n N: show last N lines and exit (e.g. tail-logs.sh -n 500).

set -e

DEPLOY_HOST="${DEPLOY_HOST:-}"
LOG_PATH="${LOG_PATH:-~/nextdoor-logs/scraper.log}"

if [ -z "$DEPLOY_HOST" ]; then
  echo "Error: DEPLOY_HOST not set. Example: DEPLOY_HOST=nextdoor@scraper-server ./scripts/tail-logs.sh"
  exit 1
fi

if [ "${1:-}" = "-n" ] && [ -n "${2:-}" ]; then
  ssh "$DEPLOY_HOST" "tail -n $2 $LOG_PATH"
else
  ssh -t "$DEPLOY_HOST" "tail -f $LOG_PATH"
fi
