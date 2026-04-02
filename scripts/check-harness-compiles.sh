#!/usr/bin/env bash
# check-harness-compiles.sh — DALi Preview 하니스 C++ 컴파일 통합 테스트
#
# 사용법:
#   ./scripts/check-harness-compiles.sh [DALI_PREFIX]
#
# 인수가 없으면 DESKTOP_PREFIX 환경 변수를 사용합니다.
# DALi SDK, pkg-config, g++가 있는 머신에서 실행하세요.
#
# 종료 코드:
#   0 — 모든 하니스 컴파일 성공
#   1 — 하나 이상의 하니스 컴파일 실패 (상세 내용 stdout 출력)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVER_DIR="${PROJECT_ROOT}/server"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

DALI_PREFIX="${1:-${DESKTOP_PREFIX:-}}"

# ── 의존성 사전 체크 ─────────────────────────────────────────────────────────

check_dep() {
    if ! command -v "$1" &>/dev/null; then
        echo "ERROR: '$1' not found on PATH."
        echo "       조치: $2"
        exit 1
    fi
}

check_dep g++        "sudo apt-get install build-essential"
check_dep pkg-config "sudo apt-get install pkg-config"

if [[ -z "${DALI_PREFIX}" ]]; then
    echo "ERROR: DALi prefix를 찾을 수 없습니다."
    echo "       DALI_PREFIX 인수를 전달하거나 DESKTOP_PREFIX 환경 변수를 설정하세요."
    exit 1
fi

if [[ ! -f "${DALI_PREFIX}/lib/libdali2-core.so" ]]; then
    echo "ERROR: DALi SDK를 찾을 수 없습니다: ${DALI_PREFIX}/lib/libdali2-core.so"
    exit 1
fi

PKG_CONFIG_PATH="${DALI_PREFIX}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig"
export PKG_CONFIG_PATH

echo "DALi prefix: ${DALI_PREFIX}"
echo ""

# ── 최소 사용자 코드 (모든 템플릿에 주입할 내용) ────────────────────────────

MINIMAL_USER_CODE="return View::New();"

PASS=0
FAIL=0

# ── 템플릿 컴파일 헬퍼 ──────────────────────────────────────────────────────

compile_template() {
    local template_name="$1"
    local template_path="${SERVER_DIR}/${template_name}"
    local out_src="${TMP_DIR}/${template_name%.template}.cpp"
    local out_bin="${TMP_DIR}/${template_name%.template}.out"
    local extra_flags="${2:-}"      # e.g. "-shared -fPIC" for plugin
    local output_flag="-o ${out_bin}"

    echo -n "컴파일 테스트: ${template_name} ... "

    if [[ ! -f "${template_path}" ]]; then
        echo "SKIP (파일 없음)"
        return
    fi

    # 플레이스홀더 치환
    sed \
        -e "s|{{USER_CODE}}|${MINIMAL_USER_CODE}|g" \
        -e "s|{{PREVIEW_WIDTH}}|360.0f|g" \
        -e "s|{{PREVIEW_HEIGHT}}|720.0f|g" \
        -e "s|{{OUTPUT_PATH}}|/tmp/test_preview.png|g" \
        -e "s|{{METADATA_PATH}}|/tmp/test_metadata.json|g" \
        -e "s|{{BACKGROUND_COLOR}}|Vector4(0.1f, 0.1f, 0.12f, 1.0f)|g" \
        -e "s|{{FONT_SETUP}}||g" \
        "${template_path}" > "${out_src}"

    local cflags
    cflags="$(PKG_CONFIG_PATH="${PKG_CONFIG_PATH}" pkg-config --cflags \
        dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0 2>/dev/null || true)"
    local libs
    libs="$(PKG_CONFIG_PATH="${PKG_CONFIG_PATH}" pkg-config --libs \
        dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0 2>/dev/null || true)"

    local compile_out
    if compile_out="$(g++ -std=c++17 -O0 ${extra_flags} \
            ${cflags} \
            "${out_src}" \
            ${libs} \
            -L"${DALI_PREFIX}/lib" -Wl,-rpath-link,"${DALI_PREFIX}/lib" \
            ${output_flag} 2>&1)"; then
        echo "PASS"
        PASS=$((PASS + 1))
    else
        echo "FAIL"
        echo "--- 컴파일 오류 ---"
        echo "${compile_out}"
        echo "-------------------"
        FAIL=$((FAIL + 1))
    fi
}

# ── 각 템플릿 컴파일 ─────────────────────────────────────────────────────────

compile_template "preview_harness.cpp.template"
compile_template "preview_interactive.cpp.template"
compile_template "preview_plugin.cpp.template" "-shared -fPIC"

# ── 결과 요약 ────────────────────────────────────────────────────────────────

echo ""
echo "결과: ${PASS} 통과 / $((PASS + FAIL)) 전체"

if [[ ${FAIL} -gt 0 ]]; then
    echo "FAILED: ${FAIL}개 하니스가 컴파일되지 않음."
    exit 1
fi

echo "모든 하니스 컴파일 성공."
exit 0
