#!/usr/bin/env bash
# Run the one-time production host setup as root. Prompts for sudo password.
# Usage: ./scripts/bootstrap-host.sh
# Optional: GIT_REPO=<url> ./scripts/bootstrap-host.sh (default: origin remote of current repo)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GIT_REPO="${GIT_REPO:-$(cd "$REPO_ROOT" && git remote get-url origin 2>/dev/null || true)}"

if [ -z "$GIT_REPO" ]; then
  echo "Error: GIT_REPO not set and could not read git remote origin. Set GIT_REPO and re-run."
  exit 1
fi

echo "This will run setup-server.sh as root to:"
echo "  - Install system packages (Python 3.11, make, curl, Chromium deps)"
echo "  - Create user 'nextdoor' and clone repo to /home/nextdoor/nextdoor"
echo "  - Create venv, install scraper, Playwright Chromium, cron jobs"
echo ""
echo "GIT_REPO=$GIT_REPO"
echo ""
echo "Run the following in your terminal (you will be prompted for your sudo password):"
echo ""
echo "  sudo GIT_REPO='$GIT_REPO' $REPO_ROOT/scripts/setup-server.sh"
echo ""

read -p "Run it now? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  exec sudo GIT_REPO="$GIT_REPO" "$REPO_ROOT/scripts/setup-server.sh"
else
  echo "Skipped. Run the command above when ready."
  exit 0
fi
