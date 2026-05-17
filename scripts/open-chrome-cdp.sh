#!/usr/bin/env bash
set -euo pipefail

CHROME_APP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE_DIR="${LINKEDIN_CORIVO_CHROME_USER_DATA_DIR:-$HOME/Library/Application Support/Google/Chrome}"
PROFILE_NAME="${LINKEDIN_CORIVO_CHROME_PROFILE:-Default}"
PORT="${LINKEDIN_CORIVO_CHROME_DEBUG_PORT:-9222}"

if pgrep -f -- "--remote-debugging-port=$PORT" >/dev/null; then
  echo "Chrome with remote debugging port $PORT is already running."
  exit 0
fi

if pgrep -x "Google Chrome" >/dev/null; then
  echo "Google Chrome is already running without remote debugging."
  echo "Quit Chrome first, then run: pnpm chrome"
  echo "This is required because Chrome locks the active profile directory."
  exit 1
fi

exec "$CHROME_APP" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --profile-directory="$PROFILE_NAME"
