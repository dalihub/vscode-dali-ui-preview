#!/usr/bin/env bash
# entrypoint.sh — Compile a templated DALi C++ harness and render it.
# ─────────────────────────────────────────────────────────────────────
# Invoked by the VS Code extension (via DockerRuntime.buildAndCapture).
# The extension is responsible for templating preview_harness.cpp.template
# (substituting {{USER_CODE}}, {{OUTPUT_PATH}}, etc.) before mounting the
# resulting source into /work/.
#
# Usage:
#   dali-preview-entrypoint <source.cpp> [extra g++ flags...]
#
# The source must already contain main() and a baked-in OUTPUT_PATH.
# Both source and output PNG are read/written inside the bind-mounted
# /work/ directory (host extension manages the mount).
#
# Environment:
#   PREVIEW_WIDTH       Xvfb screen width  (default: 1024)
#   PREVIEW_HEIGHT      Xvfb screen height (default: 600)
#   XVFB_DISPLAY        X display number   (default: :99)
#   DALI_PKG_MODULES    pkg-config modules (default: dali2-core dali2-adaptor
#                                                    dali2-ui-foundation
#                                                    dali2-ui-components glib-2.0)
#
# Exit codes:
#   0  success — compile + render completed
#   1  bad arguments
#   2  compile failure (g++ stderr printed to stdout)
#   3  Xvfb failed to start
#   4  binary execution failure
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SOURCE="${1:-}"
shift || true
EXTRA_FLAGS=("$@")

if [[ -z "${SOURCE}" || ! -f "${SOURCE}" ]]; then
    echo "ERROR: source file not provided or not found: '${SOURCE}'" >&2
    echo "Usage: dali-preview-entrypoint <source.cpp> [extra g++ flags...]" >&2
    exit 1
fi

WIDTH="${PREVIEW_WIDTH:-1024}"
HEIGHT="${PREVIEW_HEIGHT:-600}"
DISPLAY_NUM="${XVFB_DISPLAY:-:99}"
PKG_MODULES="${DALI_PKG_MODULES:-dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0}"

# ── Start Xvfb ───────────────────────────────────────────────────────
Xvfb "${DISPLAY_NUM}" -screen 0 "${WIDTH}x${HEIGHT}x24" -ac -nolisten tcp >/dev/null 2>&1 &
XVFB_PID=$!
export DISPLAY="${DISPLAY_NUM}"

cleanup() {
    [[ -n "${BINARY:-}" && -f "${BINARY}" ]] && rm -f "${BINARY}"
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
if ! xdpyinfo -display "${DISPLAY_NUM}" >/dev/null 2>&1; then
    echo "ERROR: Xvfb on ${DISPLAY_NUM} never became ready" >&2
    exit 3
fi

# ── Compile ──────────────────────────────────────────────────────────
BINARY="$(mktemp /tmp/dali-preview.XXXXXX)"

# shellcheck disable=SC2086
CFLAGS="$(pkg-config --cflags ${PKG_MODULES})"
# shellcheck disable=SC2086
LIBS="$(pkg-config --libs ${PKG_MODULES})"

if ! compile_log="$(g++ -std=c++17 -O0 \
        ${CFLAGS} \
        "${SOURCE}" \
        ${LIBS} \
        "${EXTRA_FLAGS[@]}" \
        -o "${BINARY}" 2>&1)"; then
    echo "--- COMPILE FAILURE ---"
    echo "${compile_log}"
    echo "-----------------------"
    exit 2
fi

# ── Run ──────────────────────────────────────────────────────────────
# The binary itself writes the PNG to the path baked in at template time.
# stdout/stderr from the binary is forwarded so the extension can parse
# any [Perf] / error logs.
if ! "${BINARY}"; then
    echo "ERROR: preview binary exited non-zero" >&2
    exit 4
fi

exit 0
