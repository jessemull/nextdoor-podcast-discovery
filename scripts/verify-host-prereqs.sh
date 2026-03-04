#!/usr/bin/env bash
# Verify host prerequisites for setup-server.sh (Ubuntu/Debian or RHEL-like, sudo, network).
# Usage: ./scripts/verify-host-prereqs.sh

set -e

FAIL=0

echo "Checking package manager..."
if command -v apt-get &>/dev/null; then
  echo "  apt-get found (Debian/Ubuntu)."
elif command -v dnf &>/dev/null || command -v yum &>/dev/null; then
  echo "  dnf/yum found (RHEL/Amazon Linux)."
else
  echo "  ERROR: Unsupported. Need apt-get or dnf/yum."
  FAIL=1
fi

echo "Checking /etc/os-release..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "  ID=$ID VERSION_ID=$VERSION_ID"
else
  echo "  WARN: /etc/os-release not found."
fi

echo "Checking sudo..."
if command -v sudo &>/dev/null; then
  if sudo -n true 2>/dev/null; then
    echo "  sudo available (passwordless)."
  else
    echo "  sudo available (password may be required)."
  fi
else
  echo "  ERROR: sudo not found."
  FAIL=1
fi

echo "Checking Python..."
if command -v python3 &>/dev/null; then
  python3 --version
else
  echo "  WARN: python3 not in PATH (setup-server.sh will install python3.11)."
fi

echo "Checking outbound connectivity (optional)..."
if command -v curl &>/dev/null; then
  if curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://supabase.co 2>/dev/null | grep -q .; then
    echo "  curl to supabase.co succeeded."
  else
    echo "  WARN: curl to supabase.co failed or timed out. Ensure outbound HTTPS works."
  fi
else
  echo "  WARN: curl not found. Install curl if you need healthchecks."
fi

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "Prerequisites check failed. Fix the errors above before running setup-server.sh."
  exit 1
fi

echo ""
echo "Prerequisites OK. Proceed with: sudo ./scripts/setup-server.sh (or set GIT_REPO and run as root)."
