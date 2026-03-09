#!/usr/bin/env bash
# Install and enable both worker systemd units (recompute + permalink), start on boot and now.
# Run with sudo after setup-server.sh and after editing scraper/.env.
#
# Usage: sudo ./scripts/install-worker-service.sh
# Or from anywhere: sudo /home/nextdoor/nextdoor/scripts/install-worker-service.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="/etc/systemd/system"

RECOMPUTE_SERVICE="nextdoor-worker"
PERMALINK_SERVICE="nextdoor-permalink-worker"
RECOMPUTE_UNIT="$REPO_ROOT/scripts/nextdoor-worker.service"
PERMALINK_UNIT="$REPO_ROOT/scripts/nextdoor-permalink-worker.service"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (sudo)."
  exit 1
fi

for f in "$RECOMPUTE_UNIT" "$PERMALINK_UNIT"; do
  if [ ! -f "$f" ]; then
    echo "Error: unit file not found: $f"
    exit 1
  fi
done

echo "Installing $RECOMPUTE_SERVICE (recompute_final_scores)..."
cp "$RECOMPUTE_UNIT" "$SYSTEMD_DIR/$RECOMPUTE_SERVICE.service"
chmod 644 "$SYSTEMD_DIR/$RECOMPUTE_SERVICE.service"

echo "Installing $PERMALINK_SERVICE (fetch_permalink)..."
cp "$PERMALINK_UNIT" "$SYSTEMD_DIR/$PERMALINK_SERVICE.service"
chmod 644 "$SYSTEMD_DIR/$PERMALINK_SERVICE.service"

echo "Reloading systemd..."
systemctl daemon-reload

echo "Enabling and starting $RECOMPUTE_SERVICE..."
systemctl enable "$RECOMPUTE_SERVICE"
systemctl start "$RECOMPUTE_SERVICE"

echo "Enabling and starting $PERMALINK_SERVICE..."
systemctl enable "$PERMALINK_SERVICE"
systemctl start "$PERMALINK_SERVICE"

echo ""
echo "Done. Checking status:"
echo "--- $RECOMPUTE_SERVICE (Save & Recompute / Activate) ---"
systemctl status "$RECOMPUTE_SERVICE" --no-pager || true
echo ""
echo "--- $PERMALINK_SERVICE (permalink queue from UI) ---"
systemctl status "$PERMALINK_SERVICE" --no-pager || true
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $RECOMPUTE_SERVICE   # recompute worker"
echo "  sudo systemctl status $PERMALINK_SERVICE   # permalink worker"
echo "  journalctl -u $RECOMPUTE_SERVICE -f       # recompute logs"
echo "  journalctl -u $PERMALINK_SERVICE -f       # permalink logs"
echo ""
echo "Cron (scraper schedule) is already set by setup-server.sh. To confirm:"
echo "  sudo -u nextdoor crontab -l"
