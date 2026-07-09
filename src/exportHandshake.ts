// M3bc Task 4 — mode-aware exporter-version handshake.
//
// The scene-metadata exporter lives in ONE header (server/preview_export.h),
// #included by BOTH the baked docker preview_server and the freshly-compiled
// harness. It stamps `dali_preview_export_version()` into the metadata JSON as a
// top-level `exportVersion` key. This module compares that runtime-emitted value
// against the extension's compiled-in EXPECTED_EXPORT_VERSION so a STALE docker
// image (whose baked server lags the code) surfaces a loud, actionable hint
// instead of a silent wrong-render.
//
// DOCKER-ONLY: in local mode the server and harness are compiled from the same
// checkout, so their versions can never disagree — the check is a genuine no-op
// (returns undefined without even inspecting the metadata).
//
// Intentionally vscode-free and pure so it is trivially unit-testable.

/**
 * The exporter-contract version this extension build was compiled against.
 * MUST equal `dali_preview_export_version()` in server/preview_export.h — the
 * whole handshake compares the runtime's emitted value against this constant.
 */
export const EXPECTED_EXPORT_VERSION = 'm3b-1';

/**
 * Actionable hint shown when a DOCKER render's exportVersion disagrees with
 * EXPECTED_EXPORT_VERSION — always a stale runtime image (the baked server
 * predates this extension's exporter contract). Mirrors the RUNTIME_API_SKEW_HINT
 * UX: name the cause and the one-click fix (pull a fresh image).
 */
export const EXPORT_VERSION_SKEW_HINT =
    '⚠️ Your DALi runtime image is out of sync with this extension (the scene '
    + 'exporter version differs between the baked runtime and this build) — almost '
    + 'always a STALE runtime image. Fix: Command Palette “DALi Preview: Download '
    + 'Runtime Image” (or “Check for Runtime Image Update”) to pull a fresh image.';

/**
 * Read the top-level `exportVersion` key from a parsed metadata object. Returns
 * undefined when metadata is null / not an object, or the key is absent / not a
 * string. (Host-side enrichment never sets this key, so reading it before or
 * after enrichMetadataWithFlexProps / mergeProvenance is equivalent.)
 */
export function extractExportVersion(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== 'object') {
        return undefined;
    }
    const v = (metadata as { exportVersion?: unknown }).exportVersion;
    return typeof v === 'string' ? v : undefined;
}

/**
 * Docker-only exporter-version handshake — the whole compare + gate in one pure
 * function.
 *
 * @param isDockerMode  true for the containerized runtime, false for the native
 *                      local server (`PreviewServer.isDockerMode`).
 * @param metadata      the parsed scene-metadata JSON produced by the render
 *                      (or null when none was produced / the read failed).
 * @param expected      the extension's compiled-in exporter version.
 * @returns the stale-runtime hint string when (and only when) we are in DOCKER
 *   mode, have a metadata object, and its exportVersion disagrees with `expected`
 *   — INCLUDING a missing key, which means a pre-handshake (stale) image. Returns
 *   undefined (no hint) in LOCAL mode (genuine no-op — metadata is not even
 *   inspected), when there is no metadata to inspect, or when the versions match.
 */
export function exportVersionHint(
    isDockerMode: boolean,
    metadata: unknown,
    expected: string = EXPECTED_EXPORT_VERSION,
): string | undefined {
    // LOCAL mode: server + harness are built from the same checkout, so a skew is
    // impossible. Genuine no-op — do not even read the metadata.
    if (!isDockerMode) {
        return undefined;
    }
    // No metadata (render produced none / read failed) is a different failure —
    // do not nag with a stale-runtime hint for it.
    if (!metadata || typeof metadata !== 'object') {
        return undefined;
    }
    const actual = extractExportVersion(metadata);
    return actual === expected ? undefined : EXPORT_VERSION_SKEW_HINT;
}
