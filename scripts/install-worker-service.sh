#!/usr/bin/env bash
# Install and enable the nextdoor-worker systemd unit (start on boot, start now).
# Run with sudo after setup-server.sh and after editing scraper/.env.
#
# Usage: sudo ./scripts/install-worker-service.sh
# Or from anywhere: sudo /home/nextdoor/nextdoor/scripts/install-worker-service.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_NAME="nextdoor-worker"
UNIT_FILE="$REPO_ROOT/scripts/nextdoor-worker.service"
SYSTEMD_DIR="/etc/systemd/system"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (sudo)."
  exit 1
fi

if [ ! -f "$UNIT_FILE" ]; then
  echo "Error: unit file not found: $UNIT_FILE"
  exit 1
fi

echo "Installing $SERVICE_NAME systemd unit..."
cp "$UNIT_FILE" "$SYSTEMD_DIR/$SERVICE_NAME.service"
chmod 644 "$SYSTEMD_DIR/$SERVICE_NAME.service"

echo "Reloading systemd..."
systemctl daemon-reload

echo "Enabling $SERVICE_NAME (start on boot)..."
systemctl enable "$SERVICE_NAME"

echo "Starting $SERVICE_NAME..."
systemctl start "$SERVICE_NAME"

echo ""
echo "Done. Checking status:"
systemctl status "$SERVICE_NAME" --no-pager || true
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME   # current status"
echo "  journalctl -u $SERVICE_NAME -f       # follow logs"
echo ""
echo "Cron (scraper schedule) is already set by setup-server.sh. To confirm:"
echo "  sudo -u nextdoor crontab -l"
