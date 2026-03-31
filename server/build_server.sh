#!/bin/bash
# build_server.sh — Compile the DALi Preview Server binary (run once).
# Usage: ./server/build_server.sh [dali_prefix]
#   dali_prefix  Optional path to DALi installation prefix (e.g. /usr/local).
#                Defaults to /usr if not provided.

set -e

DALI_PREFIX="${1:-/usr}"
OUT_DIR="/tmp/dali_preview"
OUT_BIN="${OUT_DIR}/preview_server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPT_DIR}/preview_server.cpp"

mkdir -p "${OUT_DIR}"

PKG_CONFIG_PATH="${DALI_PREFIX}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig"
export PKG_CONFIG_PATH

CFLAGS=$(pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)
LIBS=$(pkg-config --libs dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)

g++ -std=c++17 -O2 \
    ${CFLAGS} \
    "${SRC}" \
    ${LIBS} \
    -L"${DALI_PREFIX}/lib" \
    -Wl,-rpath-link,"${DALI_PREFIX}/lib" \
    -ldl \
    -o "${OUT_BIN}"

echo "Preview server built: ${OUT_BIN}"
