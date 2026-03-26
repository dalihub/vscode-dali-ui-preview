#!/bin/bash
# Usage: ./build_preview.sh <source.cpp> <output_binary>
set -e

SOURCE="$1"
OUTPUT="$2"
DALI_PREFIX="${DALI_PREFIX:-/home/woochan/tizen/generativeUI/dali-env/opt}"

export PKG_CONFIG_PATH="${DALI_PREFIX}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig"

CFLAGS=$(pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)
LIBS=$(pkg-config --libs dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)

g++ -std=c++17 -O0 \
    ${CFLAGS} \
    "${SOURCE}" \
    ${LIBS} \
    -o "${OUTPUT}" 2>&1
