#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${LINKEDIN_CORIVO_CHROME_USER_DATA_DIR:-$HOME/.local/share/corivo-linkedin-chrome}"
PROFILE_NAME="${LINKEDIN_CORIVO_CHROME_PROFILE:-Default}"
PORT="${LINKEDIN_CORIVO_CHROME_DEBUG_PORT:-9223}"
LOG_PATH="${LINKEDIN_CORIVO_CHROME_LOG:-/tmp/linkedin-corivo-chrome-cdp.log}"
CDP_VERSION_URL="http://127.0.0.1:$PORT/json/version"
START_URL="${LINKEDIN_CORIVO_START_URL:-https://www.linkedin.com/feed/}"

is_cdp_ready() {
  curl -fsS --max-time 1 "$CDP_VERSION_URL" >/dev/null 2>&1
}

if pgrep -f -- "--remote-debugging-port=$PORT" >/dev/null; then
  if is_cdp_ready; then
    echo "Chrome with remote debugging port $PORT is already running."
    exit 0
  fi

  echo "A Chrome process has --remote-debugging-port=$PORT, but $CDP_VERSION_URL is not reachable."
  echo "Kill that stale Chrome process or choose another port with LINKEDIN_CORIVO_CHROME_DEBUG_PORT."
  exit 1
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use by another process:"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
  echo "Set LINKEDIN_CORIVO_CHROME_DEBUG_PORT to a free port and mirror it in config/linkedin-corivo-prospecting.example.json linkedin.cdpPort."
  exit 1
fi

mkdir -p "$PROFILE_DIR"
rm -f "$LOG_PATH"

open -na "Google Chrome" --args \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --profile-directory="$PROFILE_NAME" \
  "$START_URL" \
  >"$LOG_PATH" 2>&1

for _ in {1..30}; do
  if is_cdp_ready; then
    echo "Chrome launched with remote debugging on port $PORT."
    echo "Chrome user data dir: $PROFILE_DIR"
    echo "Now run: pnpm dev"
    exit 0
  fi
  sleep 0.5
done

echo "Chrome did not expose $CDP_VERSION_URL within 15 seconds."
echo "Chrome log:"
tail -40 "$LOG_PATH" || true
exit 1
