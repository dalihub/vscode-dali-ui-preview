# preview (DALi Preview)

VS Code extension that live-previews Tizen **dali-ui** C++ UI: extract preview code → compile with a C++ harness → render headless under Xvfb → screenshot into a webview. Two sibling tools share one runtime: this extension (`src/`) and the gitignored `dali-ui-preview-cli/` (Node CLI, `npx -y github:dalihub/dali-ui-preview-cli`).

## Three-component sync — extension · CLI · runtime-release
This preview system is **three coupled repos**; any change to shared behavior must consider all three:
- **This extension** (`dalihub/vscode-dali-ui-preview`, `src/`) — the VS Code UI.
- **The CLI** (`dalihub/dali-ui-preview-cli`) — same runtime, for agents/terminal. It **duplicates shared logic byte-for-byte** (skew signature, registry/tag resolution, pull-error diagnosis, exporter). Fix one → **mirror the other**, or they silently drift. (E.g. runtime-release's per-tag 4-segment image tags needed the *same* `pickFallbackTag`/`isRollingTag` fix in both.)
- **The runtime-release agent** (`lwc0917/dali-preview-runtime-release`) — auto-builds & publishes the GHCR runtime image and **owns the image tag naming / publish rules**. When it changes those (tag scheme, registry, DALi version), the consumers' tag parsing/selection here **and** in the CLI must match — check it whenever a runtime/registry change lands.

**Rules when you touch shared behavior:** (1) consider **all three**, not just the repo you're in — ask "does the CLI have this too? does it depend on a runtime-release rule?"; (2) update **docs in BOTH tools** (README EN/KO, CHANGELOG, relevant `docs/`) — never one-sided.

## Commands
| Task | Command |
|---|---|
| Compile TS → `out/` | `npm run compile` (`tsc -p ./`) |
| Unit tests | `npm run test:unit` (mocha + c8) |
| Golden render e2e | `npm run test:e2e[:server|:multifile|:all]` (Docker runtime, xvfb) |
| Preview compile sweep | `npm run verify:previews` (native) / `verify:previews:docker` |
| Full gate | `npm run verify` = compile + unit(no-cov) + e2e |
| Package | `npm run package` (`vsce package`) |

## Runtime model
- `daliPreview.runtimeMode`: **docker** (default) uses image `ghcr.io/lwc0917/dali-preview-runtime:dali_X.Y.Z` (inside Samsung: BART proxy `ghcr-docker-remote.bart.sec.samsung.net/lwc0917/...`, auto-detected in `src/registry.ts`); **local** compiles against host `daliPreview.daliPrefix`.
- Default preview res **1920×1080** (TV FHD, `configurationService.ts`).
- Three build paths, each tagged `[Perf]` in `previewOrchestrator.ts`: parse/renderJson (JSON scene, ~0.1s), compilePlugin dlopen reload, full docker harness (~1.2–1.8s).

## Gotchas (hard-won)
- **API-skew ≠ code bug.** A preview error like `'Dali::Ui::FlexLayout' has no member named 'AddChildren'` (or `SetDefaultFocusIndicatorEnabled`/`SetAlwaysShowFocus`) means the **runtime is out of sync**, not that the sample is wrong. Fix by mode — docker: re-pull the configured image (`dali_X.Y.Z`); local: rebuild `daliPrefix`. Do NOT revert samples. dali-ui is non-fluent: named local + void setters + `AddChildren` + return root.
- **Curly-quote regex.** g++ quotes identifiers with Unicode U+2018/U+2019, not ASCII. The skew detectors (`errorParser.detectRuntimeApiSkew`, `skewSignature.isRuntimeApiSkew`) accept `['‘’]`; ASCII-only regex silently never fires. Test fixtures MUST use real curly quotes.
- **Only the g++ compile paths skew.** The parser/renderJson JSON path is insulated (in-runtime server translates the scene).
- **Click-to-code coordinates.** Overlay rects must be true screen coords via `Actor::CalculateScreenExtents()` (in `server/preview_export.h` AND `docker/preview_export.h`) — never hand-rolled PARENT_ORIGIN/PIVOT math (dali-ui v2.5.28 changed the default coord convention; render stays right, regions go off-screen, pixel goldens can't catch it). The docker copy is **baked into the image → changing it needs an image rebuild**. `test/e2e/metadataCheck.ts` fails any actor at a negative screen pos.
- **Golden runner drifts.** `test/e2e/` re-implements extraction + harness codegen (can't import `vscode`-dependent `codeExtractor`/`buildRunner`) — mirror any change there or goldens silently drift.
- **Image assets** staged by `BuildRunner.stageImageAssets` (via `previewOrchestrator.prepareSlice`): use paths relative to the preview file; copied into the container as `/work/<name>`. Sample paths must resolve on disk (`sampleAssets.test.ts`).
- **CodeLens "Preview"** gated on a per-file dali-ui `::New()` scan (`previewCodeLens.ts`), so docker users with no host DALi still see it.

## Verify / CI
- `ci.yml` runs ONLY `npm ci` + compile + `test:unit:no-coverage` + `vsce package` — **no C++ compile, no render**. Render/click regressions pass CI silently; catch them locally with `test:e2e:all` (a `.githooks/pre-push` hook runs e2e) and `verify:previews[:docker]` in your actual mode. `golden-test.yml` is on-demand only.

## Paths / release
- Core: `src/previewOrchestrator.ts` (pipeline), `buildRunner.ts`, `harnessCodegen.ts`, `errorParser.ts`+`skewSignature.ts`, `registry.ts`, `previewCodeLens.ts`.
- Runtime C++: `docker/` (Dockerfile.runtime, preview_server.cpp, preview_export.h), `server/` (preview_harness.cpp.template, preview_export.h).
- Docs: `Docs/` = dated Korean-filename design docs; `docs/` = generated. Bump `CHANGELOG.md`. `.vsix` artifacts are committed at repo root.
- **Sibling CLI = separate co-owned repo, not part of this build.** The local `dali-ui-preview-cli/` is gitignored (consumed via npx github:dalihub) — don't treat that checkout as this repo's source. But it IS a sibling you co-own: mirror shared-logic + doc changes into its own repo **deliberately** and commit there (see *Three-component sync*). Never edit the dalihub DALi sources.

## 반복 실수 방지 (Do-not-repeat — 과거 세션 반복 실수)
- CI는 tsc+unit만 돌아 render·click-to-code 회귀를 못 잡는다 — '동작함/수정됨' 보고 전 실제 확장(또는 도커)에서 렌더 + click-to-code를 눈으로 확인.
- 도구 호출 후 턴을 끝내지 말고 결과를 기다렸다 끝까지 이어서 진행 (연출·가짜 데모 금지).
