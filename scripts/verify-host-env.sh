#!/usr/bin/env bash
# Load scraper/.env, validate required vars, and test Supabase connectivity.
# Run from repo root after editing scraper/.env with production values.
# Usage: ./scripts/verify-host-env.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f ".venv/bin/activate" ]; then
  . .venv/bin/activate
fi

if [ ! -f "scraper/.env" ]; then
  echo "Error: scraper/.env not found. Copy from scraper/.env.example and edit with production values."
  exit 1
fi

set -a
# shellcheck source=../scraper/.env.example
source scraper/.env
set +a

echo "Validating required environment variables..."
python3 scripts/validate-scraper-env.py

echo ""
echo "Testing Supabase connection..."
python3 scripts/test-supabase-connection.py

echo ""
echo "Host env verification passed."
