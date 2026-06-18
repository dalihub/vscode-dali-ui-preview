#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DALi UI Preview for VS Code — one-line installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/dalihub/vscode-dali-ui-preview/main/install.sh | bash
#
# Or with a custom repo:
#   DALI_PREVIEW_REPO="owner/repo" bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Configurable repository (owner/repo)
REPO="${DALI_PREVIEW_REPO:-dalihub/vscode-dali-ui-preview}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# ── helpers ──────────────────────────────────────────────────────────────────

info()  { printf '\033[1;34m[info]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[ok]\033[0m    %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m  %s\n' "$*"; }
err()   { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

# curl wrapper that retries a few times to ride out transient network blips or
# GitHub 5xx responses (common behind a flaky corporate proxy). Passes args and
# stdout straight through, so it is a drop-in replacement for curl.
curl_retry() {
    local n=1 max=3
    while [ "$n" -le "$max" ]; do
        if curl "$@"; then
            return 0
        fi
        if [ "$n" -lt "$max" ]; then
            warn "network attempt ${n}/${max} failed; retrying ..."
            sleep 2
        fi
        n=$((n + 1))
    done
    return 1
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
    final_url=$(curl_retry -fsSLI -o /dev/null -w '%{url_effective}' \
        "https://github.com/${repo}/releases/latest") || return 1
    tag=$(printf '%s' "$final_url" | sed -E 's#.*/tag/([^/?#]+).*#\1#')

    if [[ -z "$tag" || "$tag" == http* ]]; then
        # No /tag/ in the final URL => repo has no releases.
        return 1
    fi
    info "Latest release: ${tag}"

    # 2. Find the .vsix asset URL from the (non-API) expanded_assets fragment.
    local path
    path=$(curl_retry -fsSL "https://github.com/${repo}/releases/expanded_assets/${tag}" \
        | grep -oE "/${repo}/releases/download/[^\"]+\.vsix" \
        | head -1)

    if [[ -z "$path" ]]; then
        return 1
    fi

    local asset_url="https://github.com${path}"
    info "Downloading ${asset_url} ..."
    curl_retry -fSL -o "${TMPDIR}/dali-preview.vsix" "$asset_url"
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
if ! download_vsix "$REPO"; then
    err "Failed to download the .vsix from ${REPO}."
    err "Set a custom repo with: DALI_PREVIEW_REPO=\"owner/repo\" bash install.sh"
    err "Or download it manually from the GitHub Releases page:"
    err "  https://github.com/${REPO}/releases/latest"
    exit 1
fi

# 3. Install the extension
info "Installing extension ..."
code --install-extension "${TMPDIR}/dali-preview.vsix" --force
ok "Extension installed successfully."

# 4. Done — the extension's first-run guided setup handles the runtime
#    (Docker by default), so the installer never touches system packages.
ok "Installation complete!"
echo ""
echo "  Next steps:"
echo "    1. Open (or reload) VS Code — DALi Preview guides you through runtime"
echo "       setup (Docker by default; no DALi build needed on your machine)."
echo "    2. Run \"DALi Preview: Open Sample File\" (Ctrl+Shift+P) for your"
echo "       first live preview."
echo ""
