#!/usr/bin/env bash
# Run scraper pipeline (scrape + score + recount) with Healthchecks.io monitoring.
# Usage: ./scripts/run-scrape.sh [for_you|nearby|recent|trending]
# Do NOT pass --score-only here; that skips scraping and only runs score/embed.
# Set HEALTHCHECK_URL in scraper/.env (e.g. https://hc-ping.com/your-uuid)
# If unset, skips healthcheck ping.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SCRAPER_DIR="$REPO_ROOT/scraper"
FEED_TYPE="${1:-recent}"

case "$FEED_TYPE" in
  for_you|nearby|recent|trending) ;;
  *)
    echo "Error: feed must be one of: for_you, nearby, recent, trending. Got: $FEED_TYPE"
    exit 1
    ;;
esac

# Load scraper env (required for credentials and optional HEALTHCHECK_URL)
if [ -f "$SCRAPER_DIR/.env" ]; then
  set -a
  source "$SCRAPER_DIR/.env"
  set +a
fi

PYTHON="${REPO_ROOT}/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  echo "Error: .venv not found. Run 'make venv install' first."
  exit 1
fi

echo "$(date -Iseconds): Starting $FEED_TYPE scrape..."

cd "$SCRAPER_DIR"
# Full scrape (no --score-only): scrape feed, then score and embed
if "$PYTHON" -m src.main --feed-type "$FEED_TYPE" --max-posts 250; then
  echo "$(date -Iseconds): Scrape successful, recounting topic frequencies..."
  if "$PYTHON" -m src.recount_topics; then
    echo "$(date -Iseconds): Recount complete."
  fi
  if [ -n "$HEALTHCHECK_URL" ]; then
    curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL" > /dev/null 2>&1 || true
  fi
else
  echo "$(date -Iseconds): Scrape failed."
  if [ -n "$HEALTHCHECK_URL" ]; then
    curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL/fail" > /dev/null 2>&1 || true
  fi
  exit 1
fi
