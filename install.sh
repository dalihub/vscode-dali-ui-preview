#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DALi UI Preview for VS Code — one-line installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/dalihub/vscode-dali-ui-preview/main/install.sh | bash
#
# Or with a custom repo:
#   DALI_PREVIEW_REPO="nicejackg/generativeUI" bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Configurable repository (owner/repo)
PRIMARY_REPO="${DALI_PREVIEW_REPO:-dalihub/vscode-dali-ui-preview}"
FALLBACK_REPO="nicejackg/generativeUI"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# ── helpers ──────────────────────────────────────────────────────────────────

info()  { printf '\033[1;34m[info]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[ok]\033[0m    %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m  %s\n' "$*"; }
err()   { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

check_cmd() {
    if command -v "$1" &>/dev/null; then
        ok "$1 found: $(command -v "$1")"
        return 0
    else
        warn "$1 not found"
        return 1
    fi
}

download_vsix() {
    local repo="$1"

    info "Resolving latest release of ${repo} ..."

    # NOTE: We deliberately avoid the GitHub REST API
    # (api.github.com/repos/.../releases/latest). Anonymous API requests are
    # capped at 60/hour *per IP*; behind a shared corporate proxy/NAT that
    # limit is exhausted collectively, returning HTTP 403 to everyone.
    # The endpoints below are served by github.com (not api.github.com) and
    # are NOT subject to that rate limit.

    # 1. Resolve the latest tag from the releases/latest redirect.
    local final_url tag
    final_url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' \
        "https://github.com/${repo}/releases/latest") || return 1
    tag=$(printf '%s' "$final_url" | sed -E 's#.*/tag/([^/?#]+).*#\1#')

    if [[ -z "$tag" || "$tag" == http* ]]; then
        # No /tag/ in the final URL => repo has no releases.
        return 1
    fi
    info "Latest release: ${tag}"

    # 2. Find the .vsix asset URL from the (non-API) expanded_assets fragment.
    local path
    path=$(curl -fsSL "https://github.com/${repo}/releases/expanded_assets/${tag}" \
        | grep -oE "/${repo}/releases/download/[^\"]+\.vsix" \
        | head -1)

    if [[ -z "$path" ]]; then
        return 1
    fi

    local asset_url="https://github.com${path}"
    info "Downloading ${asset_url} ..."
    curl -fSL -o "${TMPDIR}/dali-preview.vsix" "$asset_url"
}

# ── main ─────────────────────────────────────────────────────────────────────

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │   DALi UI Preview — VS Code Extension    │"
echo "  │            Installer v0.1.0              │"
echo "  └──────────────────────────────────────────┘"
echo ""

# 1. Ensure VS Code CLI is available
if ! command -v code &>/dev/null; then
    err "'code' command not found. Please install VS Code and ensure"
    err "the 'code' CLI is in your PATH."
    err "  https://code.visualstudio.com/docs/setup/linux"
    exit 1
fi

# 2. Download the .vsix
downloaded=false

if download_vsix "$PRIMARY_REPO"; then
    downloaded=true
else
    warn "Could not fetch from ${PRIMARY_REPO}, trying fallback ..."
    if download_vsix "$FALLBACK_REPO"; then
        downloaded=true
    fi
fi

if [[ "$downloaded" != "true" ]]; then
    err "Failed to download the .vsix from either repository."
    err "You can set a custom repo: DALI_PREVIEW_REPO=\"owner/repo\" bash install.sh"
    err "Or download manually from the GitHub Releases page."
    exit 1
fi

# 3. Install the extension
info "Installing extension ..."
code --install-extension "${TMPDIR}/dali-preview.vsix" --force
ok "Extension installed successfully."

# 4. Install missing dependencies automatically
echo ""
info "Checking build dependencies ..."

missing_pkgs=()
check_cmd g++    || missing_pkgs+=("g++")
check_cmd Xvfb   || missing_pkgs+=("xvfb")
check_cmd ccache || missing_pkgs+=("ccache")

if [[ ${#missing_pkgs[@]} -gt 0 ]]; then
    echo ""
    info "Installing missing packages: ${missing_pkgs[*]} ..."
    sudo apt install -y "${missing_pkgs[@]}"
    ok "Dependencies installed."
else
    ok "All dependencies are already installed."
fi

# 5. Done
ok "Installation complete!"
echo ""
echo "  Quick start:"
echo "    1. Open a DALi C++ project in VS Code"
echo "    2. Open the Command Palette (Ctrl+Shift+P)"
echo "    3. Run \"DALi: Open Preview\""
echo ""
echo "  If DALi is installed in a non-standard location, set:"
echo "    Settings → daliPreview.daliPrefix → /path/to/dali-env/opt"
echo ""
