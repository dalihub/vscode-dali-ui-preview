#!/usr/bin/env bash
# serve.sh — Start Xvfb and exec preview_server in long-running mode.
# ─────────────────────────────────────────────────────────────────────
# Used when the container is launched via the extension's PreviewServer
# (parser / dlopen fast paths). The server reads commands from stdin and
# writes responses to stdout, so we use `exec` after Xvfb starts to keep
# the process tree shallow (preview_server inherits stdin/stdout from
# whatever launched the container).
#
# Environment:
#   PREVIEW_WIDTH       Xvfb screen width  (default: 1024)
#   PREVIEW_HEIGHT      Xvfb screen height (default: 600)
#   XVFB_DISPLAY        X display number   (default: :99)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

WIDTH="${PREVIEW_WIDTH:-1024}"
HEIGHT="${PREVIEW_HEIGHT:-600}"
DISPLAY_NUM="${XVFB_DISPLAY:-:99}"

Xvfb "${DISPLAY_NUM}" -screen 0 "${WIDTH}x${HEIGHT}x24" -ac -nolisten tcp >/dev/null 2>&1 &
XVFB_PID=$!
export DISPLAY="${DISPLAY_NUM}"

cleanup() {
    kill "${XVFB_PID}" 2>/dev/null || true
    wait "${XVFB_PID}" 2>/dev/null || true
}
trap cleanup EXIT

# Wait up to 5s for Xvfb to be ready
for _ in $(seq 1 50); do
    if xdpyinfo -display "${DISPLAY_NUM}" >/dev/null 2>&1; then
        break
    fi
    sleep 0.1
done

# Ensure shader cache dir exists (it's bind-mounted as a volume but the
# DALi binary expects it pre-existing in some setups).
mkdir -p /root/.cache/dali_common_caches

# Replace shell with preview_server — stdin/stdout flow straight through
# to the docker host extension.
exec "${DESKTOP_PREFIX:-/opt/dali}/bin/preview_server"
