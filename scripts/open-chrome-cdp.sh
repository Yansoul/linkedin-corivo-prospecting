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
  echo "Quitting Chrome so it can be relaunched with remote debugging on port $PORT..."
  osascript -e 'tell application "Google Chrome" to quit' >/dev/null 2>&1 || true

  for _ in {1..30}; do
    if ! pgrep -x "Google Chrome" >/dev/null; then
      break
    fi
    sleep 1
  done

  if pgrep -x "Google Chrome" >/dev/null; then
    echo "Chrome did not quit within 30 seconds."
    echo "Quit Chrome manually with Cmd+Q, then run: pnpm chrome"
    exit 1
  fi
fi

"$CHROME_APP" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --profile-directory="$PROFILE_NAME" \
  >/dev/null 2>&1 &

echo "Chrome launched with remote debugging on port $PORT."
echo "Now run: pnpm dev"
