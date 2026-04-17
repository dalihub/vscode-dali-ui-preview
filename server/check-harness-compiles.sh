#!/bin/bash
# Verify that all C++ harness templates compile (syntax-only).
# Runs during CI on self-hosted runners that have the DALi SDK installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DALI_PREFIX="${DALI_PREFIX:-/home/woochan/tizen/generativeUI/dali-env/opt}"

export PKG_CONFIG_PATH="${DALI_PREFIX}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig"

CFLAGS=$(pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)

FAILURES=0

for TEMPLATE in "${SCRIPT_DIR}"/*.cpp.template; do
  [ -f "$TEMPLATE" ] || continue
  BASENAME=$(basename "$TEMPLATE")

  # Create a temporary .cpp with placeholders replaced by dummy values
  TMP_SRC=$(mktemp /tmp/harness_check_XXXXXX.cpp)
  sed \
    -e 's/{{PREVIEW_WIDTH}}/1024.0f/g' \
    -e 's/{{PREVIEW_HEIGHT}}/600.0f/g' \
    -e 's/{{USER_CODE}}/\/\/ placeholder/g' \
    -e 's/{{OUTPUT_PATH}}/"\/tmp\/preview.png"/g' \
    -e 's/{{FONT_DIRS}}/\/usr\/share\/fonts/g' \
    -e 's/{{[A-Z_]*}}/0/g' \
    "$TEMPLATE" > "$TMP_SRC"

  echo -n "Checking ${BASENAME} ... "
  if g++ -std=c++17 -fsyntax-only ${CFLAGS} "$TMP_SRC" 2>&1; then
    echo "OK"
  else
    echo "FAILED"
    FAILURES=$((FAILURES + 1))
  fi

  rm -f "$TMP_SRC"
done

if [ "$FAILURES" -gt 0 ]; then
  echo ""
  echo "ERROR: ${FAILURES} template(s) failed syntax check."
  exit 1
fi

echo ""
echo "All harness templates passed syntax check."
