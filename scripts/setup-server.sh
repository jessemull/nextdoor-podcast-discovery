#!/usr/bin/env bash
# One-time production host setup: install dependencies, clone repo, venv, scraper,
# Playwright Chromium, .env from example, log directory, and cron entries.
#
# Prerequisites: Ubuntu 22.04, Ubuntu 24.04, Debian 12, or Amazon Linux 2 (or similar). SSH and
# key-based access configured. Network access for git clone and pip/Playwright.
# On Ubuntu 24.04, uses system Python (3.12) and libasound2t64 when python3.11 is not in repos.
#
# Usage:
#   As root (full setup): clone repo to /home/nextdoor/nextdoor, then
#     cd /home/nextdoor/nextdoor && sudo ./scripts/setup-server.sh
#   Or set GIT_REPO and run as root; script will clone to /home/nextdoor/nextdoor.
#   As target user (app only): REPO_DIR=~/nextdoor ./scripts/setup-server.sh
#     If REPO_DIR does not exist, set GIT_REPO and the script will clone.
#
# After running: edit scraper/.env with production credentials. Start the workers
# with: sudo ./scripts/install-worker-service.sh (recompute + permalink). See docs/DEPLOYMENT.md.

set -e

SETUP_USER="${SETUP_USER:-nextdoor}"
REPO_DIR="${REPO_DIR:-$1}"
REPO_DIR="${REPO_DIR:-$HOME/nextdoor}"
LOG_DIR="${LOG_DIR:-$(dirname "$REPO_DIR")/nextdoor-logs}"

# -----------------------------------------------------------------------------
# Root phase: install packages, create user, clone or chown repo, re-exec as user
# -----------------------------------------------------------------------------
if [ "$(id -u)" = "0" ]; then
  echo "Running as root: installing packages and creating user ${SETUP_USER}..."

  if command -v apt-get &>/dev/null; then
    apt-get update -qq
    # Ubuntu 24.04 (noble) uses libasound2t64; older use libasound2
    ASOUND_PKG="libasound2"
    if [ -f /etc/os-release ]; then
      # shellcheck source=/dev/null
      . /etc/os-release
      case "${ID:-}-${VERSION_CODENAME:-}" in
        ubuntu-noble) ASOUND_PKG="libasound2t64" ;;
        *) ;;
      esac
    fi
    # Use system Python (3.11+); on Ubuntu 24.04 use python3/python3-venv (3.12) if 3.11 not in repos
    if apt-cache show python3.11-venv &>/dev/null; then
      PYTHON_PKGS="python3.11 python3.11-venv"
    else
      PYTHON_PKGS="python3 python3-venv"
    fi
    apt-get install -y -qq curl make $PYTHON_PKGS git \
      libnss3 libatk-bridge2.0-0 libxss1 $ASOUND_PKG libgbm1 libgtk-3-0 \
      libxshmfence1 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxi6
  elif command -v yum &>/dev/null || command -v dnf &>/dev/null; then
    PKGS="curl make python3.11 python3.11-venv git nss at-spi2-atk libXScrnSaver alsa-lib libgbm gtk3 libXcomposite libXcursor libXdamage libXi"
    (command -v dnf &>/dev/null && dnf install -y -q $PKGS || yum install -y -q $PKGS) 2>/dev/null || true
  else
    echo "Unsupported package manager (apt-get or yum/dnf required). Install Python 3.11+, git, and Playwright/Chromium deps manually."
    exit 1
  fi

  if ! id "$SETUP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$SETUP_USER"
    echo "Created user $SETUP_USER."
  fi

  TARGET_REPO="/home/${SETUP_USER}/nextdoor"
  # If GIT_REPO is set and target already exists, remove and re-clone so we get latest (avoids stale script after push)
  if [ -n "${GIT_REPO:-}" ] && [ -d "$TARGET_REPO" ]; then
    echo "Warning: $TARGET_REPO already exists. Removing and re-cloning to get latest (any local changes there will be lost)."
    rm -rf "$TARGET_REPO"
  fi
  if [ ! -d "$TARGET_REPO/.git" ]; then
    if [ -n "${GIT_REPO:-}" ]; then
      # Use HTTPS for clone so nextdoor user does not need SSH keys (works for public repos)
      CLONE_URL="$GIT_REPO"
      if [[ "$GIT_REPO" =~ ^git@github\.com:(.+)$ ]]; then
        CLONE_URL="https://github.com/${BASH_REMATCH[1]}"
        [[ "$CLONE_URL" != *.git ]] && CLONE_URL="${CLONE_URL}.git"
        echo "Using HTTPS clone URL for nextdoor user (no SSH keys): $CLONE_URL"
      fi
      sudo -u "$SETUP_USER" git clone "$CLONE_URL" "$TARGET_REPO"
      echo "Cloned repository to $TARGET_REPO."
    else
      echo "Error: $TARGET_REPO does not exist. Set GIT_REPO and re-run, or clone the repo there and run again."
      exit 1
    fi
  else
    chown -R "${SETUP_USER}:${SETUP_USER}" "$TARGET_REPO"
  fi

  SCRIPT_PATH="$TARGET_REPO/scripts/setup-server.sh"
  [ -x "$SCRIPT_PATH" ] || chmod +x "$SCRIPT_PATH"
  echo "Re-running as $SETUP_USER..."
  exec su - "$SETUP_USER" -c "REPO_DIR=$TARGET_REPO LOG_DIR=/home/$SETUP_USER/nextdoor-logs $SCRIPT_PATH"
fi

# -----------------------------------------------------------------------------
# App phase: venv, install-scraper, Playwright, .env, log dir, cron
# -----------------------------------------------------------------------------
echo "Setting up application in $REPO_DIR..."

if [ ! -d "$REPO_DIR/.git" ]; then
  if [ -n "${GIT_REPO:-}" ]; then
    git clone "$GIT_REPO" "$REPO_DIR"
  else
    echo "Error: $REPO_DIR does not exist and GIT_REPO is not set. Clone the repo or set GIT_REPO."
    exit 1
  fi
fi

cd "$REPO_DIR"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  make venv
fi

echo "Installing scraper dependencies and Chromium..."
set +e
. .venv/bin/activate && make install-scraper
ACTIVATE_EXIT=$?
set -e
if [ "$ACTIVATE_EXIT" -ne 0 ]; then
  echo "make install-scraper failed. Fix errors and re-run."
  exit 1
fi

set +e
. .venv/bin/activate && cd scraper && playwright install chromium
PLAYWRIGHT_EXIT=$?
set -e
cd "$REPO_DIR"
if [ "$PLAYWRIGHT_EXIT" -ne 0 ]; then
  echo "Playwright Chromium install failed. On Debian/Ubuntu you may need: sudo $REPO_DIR/.venv/bin/playwright install-deps"
  exit 1
fi

if [ ! -f "scraper/.env" ]; then
  cp scraper/.env.example scraper/.env
  echo "Created scraper/.env from example. Edit it with production credentials before running the scraper."
fi

mkdir -p "$LOG_DIR"
if ! grep -q "SCRAPER_LOG_DIR" scraper/.env 2>/dev/null; then
  echo "" >> scraper/.env
  echo "# Log directory (created by setup-server.sh)" >> scraper/.env
  echo "SCRAPER_LOG_DIR=$LOG_DIR" >> scraper/.env
fi

CRON_MARKER="nextdoor run-scrape"
if ! crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
  (
    crontab -l 2>/dev/null || true
    echo "# $CRON_MARKER"
    echo "0 2 * * * cd $REPO_DIR && . .venv/bin/activate && ./scripts/run-scrape.sh for_you >> $LOG_DIR/cron.log 2>&1"
    echo "0 6 * * * cd $REPO_DIR && . .venv/bin/activate && ./scripts/run-scrape.sh recent >> $LOG_DIR/cron.log 2>&1"
    echo "0 10 * * * cd $REPO_DIR && . .venv/bin/activate && ./scripts/run-scrape.sh nearby >> $LOG_DIR/cron.log 2>&1"
    echo "0 18 * * * cd $REPO_DIR && . .venv/bin/activate && ./scripts/run-scrape.sh trending >> $LOG_DIR/cron.log 2>&1"
  ) | crontab -
  echo "Added cron entries for run-scrape.sh (for_you, recent, nearby, trending)."
else
  echo "Cron entries already present; skipping."
fi

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit scraper/.env with production Supabase URL and service key, API keys, and (if used) APP_URL and INTERNAL_API_SECRET."
echo "  2. Start the workers: sudo ./scripts/install-worker-service.sh (recompute + permalink workers)."
echo "See docs/DEPLOYMENT.md."
