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
    local api_url="https://api.github.com/repos/${repo}/releases/latest"

    info "Querying latest release from ${repo} ..."
    local asset_url
    asset_url=$(curl -fsSL "$api_url" \
        | grep '"browser_download_url".*\.vsix"' \
        | head -1 \
        | sed -E 's/.*"(https[^"]+\.vsix)".*/\1/')

    if [[ -z "$asset_url" ]]; then
        return 1
    fi

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
