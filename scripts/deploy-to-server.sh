#!/usr/bin/env bash
# Deploy scraper changes to the server: SSH in and run git pull.
# Optional: run a scrape after pulling.
#
# Set DEPLOY_HOST (e.g. nextdoor@scraper-server) in the environment.
# Usage: ./scripts/deploy-to-server.sh [recent|trending]
#   With no arg: only git pull. With recent|trending: pull then run that feed once.

set -e

DEPLOY_HOST="${DEPLOY_HOST:-}"
if [ -z "$DEPLOY_HOST" ]; then
  echo "Error: DEPLOY_HOST not set. Example: DEPLOY_HOST=nextdoor@scraper-server ./scripts/deploy-to-server.sh"
  exit 1
fi

FEED_TYPE="${1:-}"

if [ -n "$FEED_TYPE" ]; then
  ssh "$DEPLOY_HOST" "cd ~/nextdoor && git pull && . .venv/bin/activate && ./scripts/run-scrape.sh $FEED_TYPE"
else
  ssh "$DEPLOY_HOST" "cd ~/nextdoor && git pull"
  echo "Done. Next cron run will use the updated code."
fi
