#!/usr/bin/env bash
# Run embedding generation with Healthchecks.io monitoring.
# Usage: ./scripts/run-embeddings.sh
# Set HEALTHCHECK_EMBED_URL in scraper/.env (or HEALTHCHECK_URL for same check)
# If unset, skips healthcheck ping.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SCRAPER_DIR="$REPO_ROOT/scraper"

# Load scraper env (required for API keys and optional HEALTHCHECK_EMBED_URL)
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

# Prefer dedicated embed check URL; fall back to generic HEALTHCHECK_URL
HC_URL="${HEALTHCHECK_EMBED_URL:-$HEALTHCHECK_URL}"

echo "$(date -Iseconds): Starting embedding generation..."

cd "$SCRAPER_DIR"
if "$PYTHON" -m src.embed; then
  echo "$(date -Iseconds): Embedding generation successful."
  if [ -n "$HC_URL" ]; then
    curl -fsS -m 10 --retry 3 "$HC_URL" > /dev/null 2>&1 || true
  fi
else
  echo "$(date -Iseconds): Embedding generation failed."
  if [ -n "$HC_URL" ]; then
    curl -fsS -m 10 --retry 3 "$HC_URL/fail" > /dev/null 2>&1 || true
  fi
  exit 1
fi
