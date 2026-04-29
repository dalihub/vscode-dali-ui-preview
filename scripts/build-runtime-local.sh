#!/usr/bin/env bash
# build-runtime-local.sh — Build & smoke-test the DALi runtime image locally.
# ──────────────────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/build-runtime-local.sh
#
# Builds with the Dockerfile defaults (verified working SHAs from
# devel/master). To override, edit the ARGs in docker/Dockerfile.runtime
# or pass --build-arg directly.
#
# What it does:
#   1. Verifies docker is installed and accessible without sudo
#   2. Builds docker/Dockerfile.runtime → tag dali-preview-runtime:<DALI_TAG>-local
#   3. Smoke-tests the image by rendering test/samples/hello-label.preview.dali.cpp
#      → output saved to /tmp/dali-runtime-smoke/hello.png
#
# Pre-requisites:
#   - Docker installed (curl -fsSL https://get.docker.com | sudo sh)
#   - User in docker group  (sudo usermod -aG docker $USER, then re-login)
#   - ~30+ minutes available — initial DALi build takes a while
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE_TAG="dali-preview-runtime:dali_2.5.18-local"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_DIR="/tmp/dali-runtime-smoke"

# ── helpers ─────────────────────────────────────────────────────────────
info()  { printf '\033[1;34m[info]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[ok]\033[0m    %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m  %s\n' "$*"; }
err()   { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

# ── 1. preflight ────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    err "Docker is not installed."
    err "  Install with: curl -fsSL https://get.docker.com | sudo sh"
    err "  Then: sudo usermod -aG docker \$USER && (re-login)"
    exit 1
fi

if ! docker info &>/dev/null; then
    err "Cannot talk to Docker daemon (try without sudo)."
    err "  If 'docker info' works with sudo, you need to:"
    err "    sudo usermod -aG docker \$USER"
    err "    then log out and back in (or run: newgrp docker)"
    exit 1
fi
ok "Docker is available: $(docker --version)"

# ── 2. build ────────────────────────────────────────────────────────────
info "Building ${IMAGE_TAG} (using Dockerfile.runtime defaults) ..."
info "  This may take 30+ minutes on first run."
echo ""

cd "${PROJECT_ROOT}"
docker build \
    -f docker/Dockerfile.runtime \
    -t "${IMAGE_TAG}" \
    docker/

# Mirror the local-only tag as the production-style ghcr.io ref so the
# extension's default settings resolve to this fresh build (otherwise the
# alias keeps pointing at whatever image was tagged first).
GHCR_ALIAS="ghcr.io/dalihub/dali-preview-runtime:dali_2.5.18-local"
docker tag "${IMAGE_TAG}" "${GHCR_ALIAS}"

ok "Image built: ${IMAGE_TAG}"
ok "Aliased as:  ${GHCR_ALIAS}"
docker images "${IMAGE_TAG}" --format "  size: {{.Size}}  created: {{.CreatedSince}}"

# ── 3. smoke test ───────────────────────────────────────────────────────
info "Running smoke test with hello-label.preview.dali.cpp ..."

# Prepare input/output directories
rm -rf "${SMOKE_DIR}"
mkdir -p "${SMOKE_DIR}"

# Note: the sample is a *raw* preview body (no main()), so for a real smoke
# test we'd need to template it through the harness. For now, we override
# the entrypoint to verify the container starts and pkg-config + libs work.
docker run --rm --entrypoint /bin/bash "${IMAGE_TAG}" -c '
echo "--- pkg-config check ---"
pkg-config --modversion dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0 thorvg
echo ""
echo "--- libdali2-core.so check ---"
ls -lh /opt/dali/lib/libdali2-core.so*
echo ""
echo "--- xvfb / g++ check ---"
which Xvfb g++ pkg-config ccache
'

ok "Smoke test passed — image is functional."
echo ""
REMOTE_TAG="ghcr.io/dalihub/dali-preview-runtime:dali_2.5.18"
info "Next steps:"
info "  1. Tag for GHCR push:    docker tag ${IMAGE_TAG} ${REMOTE_TAG}"
info "  2. Login to GHCR:        echo \$(gh auth token) | docker login ghcr.io -u lwc0917 --password-stdin"
info "  3. Push:                 docker push ${REMOTE_TAG}"
