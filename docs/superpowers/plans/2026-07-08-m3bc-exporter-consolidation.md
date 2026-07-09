# M3b/M3c — Shared C++ Exporter + ABI Version + Mode-Aware Handshake

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Behavior-preserving where noted — the native server golden (`test:e2e:server`, 9/0) and docker harness golden (`test:e2e`, 26/0) are the ORACLES.

**Goal:** Make the metadata-exporter + screen-extents code that is currently **duplicated** in `docker/preview_server.cpp` (baked server; in local mode compiled fresh) and `server/preview_harness.cpp.template` (fresh harness) live in ONE shared header `server/preview_export.h`, so a dali-ui exporter change lands in **one place**. Add a plugin **ABI version** gate (M3c) and a **mode-aware exporter-version handshake** so an image/code mismatch fails loudly (docker) and is a no-op (local).

**Architecture:** `server/preview_export.h` holds the pure `inline` "Family-1" exporter functions. Both C++ files `#include` it. The header is **staged into the harness build dir** (never baked — preserves the harness no-rebuild property) and reached via `-I`/relative path for the server. The handshake is gated on docker mode only.

**Tech Stack:** C++ (DALi), TypeScript, docker. Verified natively first (fast), image rebuild last.

**Design source:** the M3b recon (`.superpowers/sdd` design brief). **Spec:** [../specs/2026-07-08-dali-ui-code-sync-automation-design.md](../specs/2026-07-08-dali-ui-code-sync-automation-design.md) Phase 2.

## Global Constraints

- **Behavior-preserving (T1–T4):** rendered pixels + exported screen rects UNCHANGED. Oracles: `npm run test:e2e` (docker harness) stays **26/0**; `npm run test:e2e:server` (native server, prefix `/home/woochan/tizen/generativeUI/dali-env/opt`) stays **9/0**. If either changes, STOP and report — do NOT regenerate goldens without sign-off.
- **`localX`/`localY` drift → use the SUPERSET (keep them).** The harness currently emits `localX`/`localY`; the server does not. The shared exporter emits them (superset), so the harness output is unchanged and the server merely gains two keys that JSON consumers (webview overlay, metadataCheck) ignore. This guarantees NO consumer loses a field. (Do NOT drop them — the webview click-to-code overlay is not covered by e2e and must not lose data.)
- **Include-path (highest risk):** the harness is compiled INSIDE the container from `/work/source.cpp`; the Dockerfile does NOT bake the header there. The header MUST be **staged into the harness work dir** alongside `source.cpp` (reuse the `stageImageAssets`/asset-copy mechanism). The baked server (`docker/preview_server.cpp`) reaches it via `COPY` into the build context; the local server (`ensureServerBinary`) via `-I<extensionPath>/server` or a relative include. **Never bake the header for the harness path** (would force an image rebuild per edit).
- **Handshake docker-only:** gate on the existing `!localConfig`/`isDockerMode` branch. In local mode server+harness are both fresh from the same checkout → versions always equal → genuine no-op.
- **ABI gate before optional symbols:** the `dali_preview_abi_version` check runs after `dlopen` and BEFORE `CreatePreview`; a MISSING symbol = mismatch (do not tolerate it like the optional animation symbols).
- TypeScript strict; single quotes; const. C++ matches surrounding style.

## File Structure

**Created:** `server/preview_export.h` — the single-source inline exporter (Family-1) + `dali_preview_export_version()`.
**Modified:** `docker/preview_server.cpp` (include header, drop its copy, ABI gate), `server/preview_harness.cpp.template` (include header, drop its copy, emit exporter version), `server/preview_plugin.cpp.template` (`dali_preview_abi_version`), `src/dockerRuntime.ts` + `src/backends/localBackend.ts` (stage header / include path), `src/previewServer.ts` (docker-only handshake), `src/buildRunner.ts` (stage header for harness), `docker/Dockerfile.runtime` (COPY header), `CHANGELOG.md`.

---

### Task 1: Create `server/preview_export.h` and adopt it in `docker/preview_server.cpp` (native-verified)

**Files:** Create `server/preview_export.h`; Modify `docker/preview_server.cpp`; Modify `src/previewServer.ts` (local compile include path if needed).

**Interfaces (exported inline from the header — signatures canonical from `docker/preview_server.cpp`, but the JSON emitter uses the SUPERSET incl. `localX`/`localY`):**
- `inline std::string JsonEscapeStr(const std::string&)`
- `inline std::string ShortTypeName(const std::string&)`
- `inline const char* FlexDirectionStr(...)` / `FlexAlignStr(...)` / `FlexJustifyStr(...)` / `FlexWrapStr(...)`
- `inline void CollectActorMetadata(Dali::Actor, std::ostream&, ...)` — the reflection + `Actor::CalculateScreenExtents()` emitter; emit `localX`/`localY` (superset)
- `inline void ExportSceneMetadata(Dali::Actor root, const std::string& metadataPath, float w, float h)`
- `inline bool AreAllResourcesReady(Dali::Actor)`
- `inline const char* dali_preview_export_version()` → a version string constant (used by T4)

- [ ] **Step 1: Read + extract**

Read `docker/preview_server.cpp:42-258` (the Family-1 exporter block) and `server/preview_harness.cpp.template:49-261` (its copy). Confirm they are logic-identical except `localX`/`localY` (harness has, server lacks) + cosmetic. The header's `CollectActorMetadata` MUST emit `localX`/`localY` (superset = harness shape).

- [ ] **Step 2: Create `server/preview_export.h`**

Header guard `#pragma once`. Move the Family-1 functions as `inline`, verbatim from `docker/preview_server.cpp` EXCEPT add the `localX`/`localY` emission to `CollectActorMetadata` (copy those two lines from the harness copy at `preview_harness.cpp.template:132,:179`). Add `#include` of whatever DALi headers those functions need (copy from preview_server.cpp's top includes). Add:
```cpp
inline const char* dali_preview_export_version() { return "m3b-1"; }
```
No server-only types (no `SB*`, `PreviewServer`, dlopen, Capture, IPC).

- [ ] **Step 3: Adopt in `docker/preview_server.cpp`**

Replace lines 42-258 with `#include "preview_export.h"`. Remove any now-duplicate helper. Ensure the file still compiles (the server-only code below still calls `CollectActorMetadata`/`ExportSceneMetadata` — now from the header).

- [ ] **Step 4: Local-server include path**

In `src/previewServer.ts` `ensureServerBinary` (the g++ command ~`:107-121`), ensure the compile can find `preview_export.h`: the server source is `docker/preview_server.cpp` and the header is `server/preview_export.h`, so add `-I<extensionPath>/server` to the g++ args (or copy the header next to the compiled source). Read the current `ensureServerBinary` command and add the include dir.

- [ ] **Step 5: Verify natively (the oracle for the server path)**

Run: `npm run compile && DALI_PREFIX=/home/woochan/tizen/generativeUI/dali-env/opt npm run test:e2e:server`
Expected: **9 passed, 0 failed** (identical to the probe). This recompiles `docker/preview_server.cpp` natively WITH the header — proving the server exporter still renders + metadataCheck passes. If red: STOP, report.

- [ ] **Step 6: Commit**
```bash
git add server/preview_export.h docker/preview_server.cpp src/previewServer.ts
git commit -m "refactor(export): extract shared exporter into server/preview_export.h; preview_server.cpp includes it"
```

---

### Task 2: Adopt the header in the harness template + stage it into the build (docker + local)

**Files:** Modify `server/preview_harness.cpp.template`; `src/buildRunner.ts` (+ `src/dockerRuntime.ts` and/or `src/backends/localBackend.ts`) to stage the header into the harness work dir; `docker/Dockerfile.runtime` if the baked server COPY needs the header; `test/e2e/standaloneBuildRunner.ts` (e2e harness build must also stage it).

- [ ] **Step 1: Adopt in the template**

Replace `server/preview_harness.cpp.template:49-261` with `#include "preview_export.h"`. Place the `#include` OUTSIDE any `{{SLOT}}` and ensure no slot regex mangles it. The harness's own code below still calls `ExportSceneMetadata`/`CollectActorMetadata` from the header.

- [ ] **Step 2: Stage the header next to the compiled source (docker)**

The harness compiles inside the container from `/work/source.cpp`. Find where the harness source is written into `workDir` (recon: `src/dockerRuntime.ts` ~`:625`; the e2e path: `test/e2e/standaloneBuildRunner.ts`) and ALSO copy `server/preview_export.h` into that same `workDir` so `#include "preview_export.h"` resolves relative to `/work/source.cpp`. Reuse the existing asset-copy mechanism (`BuildRunner.stageImageAssets` copies files into the mount — mirror it for the header). Do the SAME in `standaloneBuildRunner.ts` (it has its own build-dir setup).

- [ ] **Step 3: Baked server COPY (Dockerfile)**

If `docker/preview_server.cpp` (baked at `Dockerfile.runtime:167`) now `#include`s `preview_export.h`, add a `COPY server/preview_export.h` (or adjust the existing COPY) so the baked build finds it. Verify the Dockerfile build context includes it.

- [ ] **Step 4: Verify BOTH paths**

Run: `npm run compile`
Run: `npm run test:e2e` → **26 passed, 0 failed** (docker harness path, staged header).
Run: `DALI_PREFIX=/home/woochan/tizen/generativeUI/dali-env/opt npm run test:e2e:server` → **9/0** (still green).
Run: `npm run verify:previews:docker` → all previews compile.
If any fail: STOP (include-path or drift issue), report with the compile error / diff.

- [ ] **Step 5: Commit**
```bash
git add server/preview_harness.cpp.template src/buildRunner.ts src/dockerRuntime.ts test/e2e/standaloneBuildRunner.ts docker/Dockerfile.runtime
git commit -m "refactor(export): harness template includes shared exporter; stage header into build dir (docker+e2e)"
```

---

### Task 3 (M3c): Plugin ABI version gate

**Files:** Modify `server/preview_plugin.cpp.template`, `docker/preview_server.cpp`.

- [ ] **Step 1: Produce the symbol**

In `server/preview_plugin.cpp.template`, in the `extern "C"` block (~`:55`), add:
```cpp
extern "C" int dali_preview_abi_version() { return 1; }
```

- [ ] **Step 2: Gate in the server**

In `docker/preview_server.cpp`, after `dlopen` (~`:1204`) and BEFORE resolving `CreatePreview` (~`:1216`): `dlsym("dali_preview_abi_version")`; if the symbol is MISSING or its value != the server's compiled-in constant (`1`), print `>>>ERROR:abi mismatch (plugin=<X or missing>, server=1) — update runtime image`, `dlclose`, and bail (mirror the `CreatePreview`-missing bail at ~`:1219-1227`). Run this BEFORE the optional animation-symbol resolution (~`:1253`) so graceful optional-symbol handling is preserved.

- [ ] **Step 3: Verify**

Run: `npm run compile && DALI_PREFIX=/home/woochan/tizen/generativeUI/dali-env/opt npm run test:e2e:server` → 9/0 (matching version path renders).
Manual mismatch check: temporarily change the plugin's returned int to `999`, recompile a plugin, confirm the server prints `>>>ERROR:abi mismatch` and bails; then revert. Document the manual check in the report (this path — dlopen/plugin — is not in the golden runners).

- [ ] **Step 4: Commit**
```bash
git add server/preview_plugin.cpp.template docker/preview_server.cpp
git commit -m "feat(abi): plugin dali_preview_abi_version gate; server refuses mismatched/old plugin"
```

---

### Task 4: Mode-aware exporter-version handshake

**Files:** Modify `server/preview_harness.cpp.template` (emit the version into metadata), `src/previewServer.ts` / `src/buildRunner.ts` (compare, docker-only), `src/errorParser.ts` (reuse hint). Test: `test/unit/`.

- [ ] **Step 1: Emit the version**

In the harness (and the server's metadata emit), include `dali_preview_export_version()` in the exported metadata JSON (e.g. a top-level `"exportVersion"` key in `ExportSceneMetadata` — add it in the header so both emit it).

- [ ] **Step 2: Compare, docker-only**

In the extension, after a render, read `exportVersion` from the metadata and compare to the compiled-in constant known to the extension (`'m3b-1'`). Gate the check on docker mode only (the `!localConfig`/`isDockerMode` branch — `previewServer.ts:70,89`). On mismatch (docker), surface the existing stale-runtime hint (reuse `errorParser` RUNTIME_API_SKEW_HINT-style UX / "Update DALi Runtime"). In local mode, skip entirely (no-op).

- [ ] **Step 3: Unit test the mode gate**

Write a unit test (`test/unit/exportHandshake.test.ts`) asserting: docker mode + mismatched version → produces the hint; local mode → no check (no-op) regardless of version. Use the existing mode-branch seam; mock the metadata read.

Run: `npm run compile && npx mocha out/test/unit/exportHandshake.test.js --timeout 10000` → PASS.

- [ ] **Step 4: Full unit suite + commit**

Run: `npm run test:unit:no-coverage` → all green (~841+).
```bash
git add server/preview_harness.cpp.template server/preview_export.h src/previewServer.ts src/buildRunner.ts src/errorParser.ts test/unit/exportHandshake.test.ts
git commit -m "feat(handshake): docker-only exporter-version check; no-op in local mode"
```

---

### Task 5: Rebuild the runtime image + full-path verification + CHANGELOG

**Files:** `CHANGELOG.md`.

- [ ] **Step 1: Rebuild the runtime image (baked server + header)**

Build a LOCAL candidate image from `docker/` (do NOT push):
```bash
docker build -f docker/Dockerfile.runtime -t dali-preview-runtime:m3bc-local docker/ 2>&1 | tail -20
```
(If build-args are required — `DALI_UI_REF` etc. — copy them from `Dockerfile.runtime`'s defaults. This is ~30 min. If the build fails on network/egress, report — native verification (Tasks 1–4) already proves the C++ logic; the rebuild proves the baked handshake end-to-end.)

- [ ] **Step 2: Verify against the rebuilt image**

Run: `PREVIEW_IMAGE=dali-preview-runtime:m3bc-local npm run test:e2e` → **26/0** on the freshly-baked image (proves the baked server + staged harness header agree; handshake passes).

- [ ] **Step 3: CHANGELOG + commit**

Add a `CHANGELOG.md` entry (shared exporter header, ABI gate, mode-aware handshake).
```bash
git add CHANGELOG.md
git commit -m "docs(changelog): M3b/M3c shared exporter + ABI gate + handshake"
```

---

## Self-Review

**Spec coverage:** M3 "baked preview_server.cpp + fresh harness share the exporter via a common header" (T1–T2), "runtime handshake" (T4), "plugin ABI version" (T3). The `sed`-rule migration (M3d) + Family-2 (parser/scene-builder) extraction are separate (deferred; Family-2 needs a second consumer).

**Placeholder scan:** C++ blocks are "moved by line range" (they exist — move, not transcribe). Every task has explicit verify commands + expected counts.

**Risk gates:** include-path resolved in T2 (staged, not baked) and proven by `test:e2e` 26/0. `localX/localY` superset avoids any consumer loss. Behavior-preservation gated by native (9/0) + docker (26/0) goldens at every task. Image rebuild (T5) is the only heavy step and is LAST.

> **Order:** T1→T2→T3→T4→T5 (each depends on the prior; T2 needs T1's header; T5 needs all).
