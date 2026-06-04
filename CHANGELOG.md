# Changelog

All notable changes to the **DALi UI Preview** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.37.2] - 2026-06-04 — User-facing README rewrite

### Changed

- **README rewritten as a user-facing guide** (English + Korean). The old README
  read like a development-planning document — a feature/phase status matrix, a
  cross-framework comparison table, and internal-implementation notes. Replaced
  with: a value-focused intro, a grouped feature list, explicit Requirements, a
  4-step Quick Start, runtime setup (Docker vs native), preview authoring
  (`.preview.dali.cpp`, markers, `@preview-config`/multi-preview, CodeLens), and
  reference tables for **Commands**, **Settings**, and **Troubleshooting**.
- Documentation now reflects the shipped v0.37 feature set — Docker runtime as the
  default, the guided setup walkthrough, runtime update policy + version picker,
  multi-preview, Widget Inspector, Code-to-Preview, interactive (VNC) mode, and
  device preview — instead of the obsolete "Phase 2/3/4 — planned" framing. Code
  examples corrected to the real `.Set*` chaining API.

### Fixed

- `package.json` `repository.url` corrected to the canonical
  `https://github.com/dalihub/vscode-dali-ui-preview` (was a stale fork URL), so
  the Marketplace "Repository" link resolves correctly.

## [0.37.1] - 2026-06-04 — DALi 2.5.24 runtime + harness compat fix

### Fixed

- **Harness templates compile against the latest DALi.** An upstream dali
  `signal.h` refactor (2026-04-21: `SignalMixin`, raw-Impl ptr) broke the
  standard member `Signal::Connect(this, &Class::Method)` — it mis-resolves to
  the functor overload and fails to compile on dali 2.5.19+. Converted all
  member Connects to lambdas (functor path) in `preview_server` and the
  harness / animation / interactive templates. Verified: renders `dali_2.5.24`
  to a 1024×600 PNG.

### Changed

- **Runtime image refreshed to `dali_2.5.24`** (was `dali_2.5.18`), pushed to
  `ghcr.io/lwc0917/dali-preview-runtime` as `dali_2.5.24` + `latest`. With
  `daliVersionTag=latest` (default) clients pick it up automatically.
- **Dockerfile: dropped the dali-toolkit build stage.** dali-ui is an
  independent UI framework that doesn't link `dali2-toolkit`, and
  preview_server/harness use `dali-ui-foundation` only — so toolkit was built
  but never linked. Removing it shrinks the image and speeds the build.

## [0.37.0] - 2026-06-04 — Update policy + version picker

### Added

- **`daliPreview.runtimeUpdatePolicy`** setting (`off` / `notify` / `auto`).
  The daily update check follows it: `notify` (default) shows a status-bar
  badge + "Update now" notification; `auto` downloads and applies the update in
  the background; `off` disables checking entirely.
- **`dali.selectRuntimeVersion`** command — lists the available image tags from
  the registry (GHCR), lets you pick one, then pulls it and restarts the
  preview server on that version.
- `registryClient.listRemoteTags` — anonymous GHCR token + `/v2/.../tags/list`.

### Changed

- Replaced the boolean `daliPreview.autoCheckRuntimeUpdate` with the three-way
  `daliPreview.runtimeUpdatePolicy` (`off` == the old `false`; `notify`/`auto`
  == the old `true`, now with a choice of how the update is applied).

## [0.36.3] - 2026-06-04 — Setup UX polish

### Fixed

- The runtime-image download progress notification now closes as soon as the
  pull hits 100%. The completion toast is fire-and-forget instead of awaited —
  awaiting it had kept the "100% — complete" bar on screen until dismissed.

### Changed

- The install terminal now **auto-runs** the install command, so you go
  straight to the sudo password prompt instead of pressing Enter first.
- The Docker-setup wait notification shows a plain "Installing Docker —
  waiting for it to become available…" message instead of an "attempt n/150"
  counter that looked like you had to wait for 150 tries.

## [0.36.2] - 2026-06-04 — Visible Docker-setup progress

### Added

- **Progress notification while waiting for Docker.** After the install/setfacl
  step, a cancellable "DALi Preview · Docker setup" notification shows
  "Waiting for Docker access… (attempt n/max)" so the wait is never silent. On
  success it hands off to the image-download progress bar; on timeout it
  surfaces a "did not become available" warning instead of hanging quietly.
- `DockerAccessPoller` gained `onTick` (per-probe progress) and `onGiveUp`
  (exhaustion) callbacks; the install / verify / guidance / use-docker paths
  all route through the new progress-wrapped watcher.

## [0.36.1] - 2026-06-04 — Setup guidance fixes

### Fixed

- The activation `docker-not-installed` guidance now drives the no-reboot
  install flow (`installDockerCommand`: pre-install modal → terminal with the
  setfacl chain → access poller) instead of only printing manual instructions
  to the Output channel. The previous "Install instructions" button was a dead
  end — it never opened the install terminal or started the poller.
- `buildRunner`'s docker-unavailable error no longer says "re-launch VS Code";
  it now points to **"DALi: Install Docker via Terminal"** (no reboot needed).

## [0.36.0] - 2026-06-02 — Runtime image update management

### Added

- **Update detection via digest comparison.** `DockerRuntime` gained
  `getLocalDigest` / `getRemoteDigest` / `isUpdateAvailable`, comparing the
  locally-cached image's `RepoDigest` against the registry manifest digest
  (`docker buildx imagetools inspect`, falling back to `docker manifest
  inspect`). Works for any tag (rolling `latest` or pinned) with no auth/HTTP
  handling, and never throws — offline/unknown is treated as "no update".
- **`dali.checkRuntimeUpdate`** command — manual "check for updates"; on a
  newer image, offers "Update now" → force re-pull → restarts the preview
  server on the new image.
- **Daily background auto-check** on activation (docker mode only), throttled
  to once per day via `globalState`, gated by the new
  `daliPreview.autoCheckRuntimeUpdate` setting (default `true`). Non-blocking
  and silent when offline or up to date.
- **Status-bar "Update available"** affordance — click it to run the update
  check.

### Note

Digest comparison detects a changed image for the *configured* tag; it does
not enumerate new version tags in the registry. To move to a new DALi version
tag, set `daliPreview.daliVersionTag`.

## [0.35.0] - 2026-06-02 — Seamless no-reboot Docker setup

### Added

- **No-reboot Docker setup.** The install flow now grants the current
  VS Code session docker socket access immediately via `setfacl` (file
  ACLs are evaluated at connect-time, so the already-running editor picks
  them up) — no logout or reboot. A new background poller
  (`DockerAccessPoller`) watches for access to become available after the
  install and continues setup automatically.
- **`ensureRuntimeImage`** — the runtime image is auto-pulled with a
  progress notification before the preview server launches (and on the
  harness fallback path), instead of letting `docker run` cold-pull
  ~290 MB past the 15 s startup timeout and silently fail.
- **"Fix for this session"** action on the docker permission-denied
  guidance — applies the same immediate `setfacl` fix for users who
  already installed Docker but whose session never picked up the group.

### Changed

- **Pre-install modal** before the install terminal opens: "enter your
  password once; the rest is automatic; no reboot or reload."
- **`dali.useDockerRuntime`** now ensures the image and (re)starts the
  preview server in place instead of asking the user to reload the window.
- `installDockerCommand` / `showInstallDocs` / walkthrough step 3 no longer
  tell the user to reboot.

### Note on ACL persistence

The `setfacl` socket ACL bridges the current session only; it is lost if
the docker daemon recreates the socket (e.g. `systemctl restart docker`).
The permanent path is the `usermod -aG docker` group membership, which
applies to every future session — re-run "Verify Docker Access" →
"Fix for this session" if access ever drops mid-session.

## [0.34.5] - 2026-04-29 — Default debounce 0ms (instant live preview)

### Changed

- `daliPreview.livePreviewDebounce` default flipped from `300` ms to
  `0` ms. With the parser fast path running inside the long-running
  docker container (~100 ms per update), the 300 ms wait was the
  largest single contributor to perceived latency on every keystroke.
  Users on the slow harness path can raise this back to 300+ to
  coalesce edits.

### Note on first-render slowness

If your very first preview takes ~1.5–2 s and the Output channel
shows `buildAndRun (full harness): ~1800ms`, the docker `preview_server`
container hadn't finished starting yet when you hit save. Reload the
window once after the extension finishes activating — the first
`>>>READY` log line confirms the container is up. Subsequent renders
hit the parser fast path (~100 ms).

## [0.34.4] - 2026-04-29 — Visible runtime download + walkthrough completion fix

### Fixed

- **Walkthrough steps marked done at unintended times.** Step 2 (Pick
  Runtime) used `onSettingChanged:daliPreview.runtimeMode` as its
  completion event, which could fire as a side effect of other
  settings changes. Tightened to button-driven events:
  `onCommand:dali.useDockerRuntime` or
  `onCommand:dali.useNativeRuntime`. Same approach applied across the
  walkthrough — each step now completes only when its own button is
  clicked, not when an unrelated setting changes.
- After installing Docker via the walkthrough, no visible
  download/install of the DALi runtime image happened — the image
  pull was silently deferred to the first preview render, leaving the
  user with no progress feedback during the ~290 MB download.

### Added

- **`dali.pullRuntimeImage`** command — pulls the DALi runtime image
  from GHCR with a VS Code progress notification (percentage in the
  bottom-right). Skips silently when the image is already cached.
- **New walkthrough step "Download DALi Runtime Image"** between
  Install Docker and Open Sample. After the user verifies Docker
  access in step 3, an info message offers to download the image
  immediately so step 6 (Open Sample) is instant.
- **Auto-prompt after Verify Docker.** When `dali.verifyDocker`
  succeeds, the user gets an info message offering to download the
  runtime image right away. Opting in kicks off the pull with the
  progress notification.

### Changed

- Walkthrough is now 6 steps (was 5) — the new "Download DALi Runtime
  Image" step makes the previously invisible pull step visible.

## [0.34.3] - 2026-04-29 — Walkthrough UX polish

### Changed

- **Walkthrough now has 5 steps and presents both runtime options.**
  Previously the flow assumed Docker; users with an existing native
  DALi install had no in-walkthrough path. Reorganised:
  1. **Welcome** — overview of how the extension works
  2. **Choose Your Runtime** — Docker (Recommended) ⭐ vs Native
     buttons
  3. **Install Docker (Recommended path)** — pre-fills install
     command in terminal
  4. **Configure Native DALi (alternative path)** — runs the legacy
     setup wizard against an existing host install
  5. **Open a Sample** — moved to the **end**, after the runtime is
     ready
- "Open Documentation" link in the Welcome step now opens the bundled
  README.md in VS Code's markdown preview (was incorrectly opening
  the Settings page).
- `dali.useDockerRuntime` command title gains "(Recommended)" badge.

### Added

- **`dali.useNativeRuntime`** command — confirms with the user, sets
  `daliPreview.runtimeMode` to `'native'`, prompts reload. The setup
  wizard then fires for prefix selection.
- **`dali.showReadme`** command — opens the bundled README.md as a
  markdown preview. Wired to the Welcome step.

## [0.34.2] - 2026-04-29 — Docker by default + suppress legacy first-run popups

### Changed

- **`daliPreview.runtimeMode` default flipped from `native` to `docker`.**
  Existing users with the setting explicitly set are unaffected. New
  installs now go through the walkthrough's docker setup path by
  default, matching the rest of the first-run UX.

### Fixed

- The "Select your DALi installation folder" dialog and the "Required
  dependencies missing" toast still appeared on first install in
  v0.34.1 because the previous fix only skipped them when
  `runtimeMode === 'docker'` — but the **default was still `native`**,
  so a fresh install always tripped both popups before reaching the
  walkthrough. v0.34.2 suppresses both whenever the walkthrough has
  not yet been shown on this machine (`globalState` flag), regardless
  of the resolved runtime mode. The walkthrough alone drives the
  initial UX.

## [0.34.1] - 2026-04-29 — Skip native setup wizard in docker mode

### Fixed

- The legacy "Select your DALi installation folder" dialog from
  `setupWizard.ts` was firing on first activation regardless of
  `runtimeMode`, blocking the new walkthrough behind a modal that
  asked docker-mode users to point at a host DALi prefix that
  doesn't exist. The wizard now runs only when `runtimeMode ===
  'native'`. The `validateEnvironment` host-deps check (g++ / Xvfb /
  pkg-config / native DALi prefix) is also skipped in docker mode
  since those live inside the runtime image.

## [0.34.0] - 2026-04-29 — Phase 5 — Docker Runtime + Walkthrough

### Highlights

The extension now ships a fully-Dockerized DALi runtime, so users no
longer have to install DALi on their host machine. All three preview
paths (parser / dlopen / full harness) work inside a long-running
container, with measured performance close to native mode on small
canvases:

- **parser path**: 45–150 ms per text-change (warm)
- **dlopen path**: ~500 ms per change (uses `docker exec` against the
  running preview server, avoids cold-container startup)
- **full harness path**: ~1.5 s (fallback)

A 4-step walkthrough opens automatically on first launch, guiding users
through Docker install → switching to docker mode → opening a bundled
sample. New maintenance commands let users free disk space and reset
the docker state without touching the CLI directly.

### Added

- **`docker/Dockerfile.runtime`** — multi-stage build producing
  `ghcr.io/lwc0917/dali-preview-runtime:dali_2.5.18` (290 MB pull).
  Pins `dali-core/adaptor/toolkit` to specific SHAs (dali_2.5.18 + 4
  commits, where the Extents API moved from uint16 → int16) and
  `dali-ui` to commit `bec04e3` (devel branch HEAD that uses
  integration-api/visual-renderer.h). Includes Tizen-patched `tizenvg`
  built from `git://review.tizen.org/git/platform/core/graphics/tizenvg`
  (upstream ThorVG lacks the SVG fixes DALi needs).
- **`docker/entrypoint.sh`** — one-shot full-harness compile + render
  for the slow-path docker run.
- **`docker/serve.sh`** — long-running preview_server entry. The
  preview_server binary is now pre-compiled in the image, so the
  extension never compiles it on the user's machine in docker mode.
- **`src/dockerRuntime.ts`** — `DockerRuntime` class wrapping `docker
  info`, image hash check, image pull, and two compile/render entry
  points (`buildAndCapture` for full harness, `compilePlugin` for
  dlopen). `compilePlugin` uses `docker exec` against the running
  preview_server container when available, saving ~300–500 ms of
  container startup per compile.
- **`src/dockerAccessCheck.ts`** — probes `docker info`, classifies the
  failure (CLI missing / daemon down / permission denied / unknown),
  and surfaces a contextual modal. Notably, the `permission-denied`
  case explains why logout/login isn't always enough on Linux and
  guides the user toward a reboot when their session has cached the
  old group list.
- **`src/dockerMaintenance.ts`** — three maintenance commands:
  `dali.cleanRuntimeImages` (multi-select QuickPick of cached images,
  stops dependent containers first), `dali.resetExtension` (containers
  + images + cache volumes in one shot), and `dali.verifyDocker`
  (re-check after the user reboots).
- **`src/walkthroughController.ts`** — first-launch detection via
  `globalState`, syncs across machines via `setKeysForSync`. The
  walkthrough is registered under `contributes.walkthroughs` with 4
  steps, each backed by a markdown file in `media/walkthrough/`.
- **`src/installDocker.ts`** — pre-fills the install-and-add-to-group
  command in an integrated terminal; user supplies sudo password once.
- **`src/sampleCommand.ts`** — `dali.openSample` copies the bundled
  `samples/hello-dali.preview.dali.cpp` into the workspace and opens
  it. `dali.useDockerRuntime` flips the setting and prompts for reload.
- **`samples/hello-dali.preview.dali.cpp`** — annotated starter sample
  for the walkthrough's "Open Sample" step.
- **`media/walkthrough/01-welcome.md`** through **`04-first-preview.md`** —
  walkthrough step content.
- **`scripts/build-runtime-local.sh`** — local Dockerfile build with
  GHCR alias auto-tagging and a smoke test.
- **`.github/workflows/docker-publish.yml`** — weekly cron + manual
  trigger that resolves the latest dali-toolkit tag, builds the image,
  pushes to GHCR, and prunes versions older than the last 12.
- **Settings**: `daliPreview.runtimeMode` (`native` | `docker`),
  `daliPreview.dockerImage` (defaults to
  `ghcr.io/lwc0917/dali-preview-runtime`), `daliPreview.daliVersionTag`
  (defaults to `latest`).
- **Commands**: `dali.verifyDocker`, `dali.cleanRuntimeImages`,
  `dali.resetExtension`, `dali.openSample`, `dali.useDockerRuntime`,
  `dali.installDocker`, `dali.rerunSetup`.

### Changed

- **`src/previewServer.ts`** — when `runtimeMode === 'docker'`, spawns
  `docker run -i --rm --name dali-preview-server-<hash> ...
  --entrypoint /usr/local/bin/dali-preview-serve <image>` instead of a
  native binary. The container name is registered with `DockerRuntime`
  so dlopen plugin compiles can `docker exec` into the same container.
  Stale containers are removed before spawn, the workspace folder is
  bind-mounted (read-only) so absolute asset paths in user code resolve
  inside the container, and stdout/stderr are line-buffered before
  filtering so log lines split across docker chunks aren't echoed to
  the Output channel as fragments. Adds `LP_NUM_THREADS=0` and
  `GALLIUM_DRIVER=llvmpipe` env vars for portable mesa multi-threaded
  software rendering.
- **`src/buildRunner.ts`** — `buildAndRunDocker` (full harness) and a
  docker branch in `compilePlugin` (dlopen). DockerRuntime is passed
  in the constructor.
- **`src/extension.ts`** — instantiates `DockerRuntime`; runs
  `checkDockerAccess()` before initializing PreviewServer in docker
  mode and shows guidance modal on failure; passes workspace folders +
  `fontDirectories` as bind-mount paths; calls `maybeOpenWalkthrough`
  on activation; registers all the new commands.
- **`src/configurationService.ts`** — getters for the three new
  settings.
- **`src/logger.ts`** — adds the `'Docker'` log category.
- **`.vscodeignore`** — excludes coverage / nyc / Docs / report
  artifacts so the VSIX stays small (310 KB).

### Known limitations

- Large preview canvases (e.g., a 2520×4480 phone-style mock,
  ~11 M pixels) take ~800 ms in docker mode because mesa software
  rendering is the only portable backend. Most samples (small canvas)
  hit the parser-path 100 ms target. See `Docs/Phase5.md` for the
  resolution-cap experiment that was reverted (DALi absolute coords
  don't scale).
- The default `dockerImage` points to
  `ghcr.io/lwc0917/dali-preview-runtime` rather than the dalihub org
  namespace, because dalihub's package-visibility policy currently
  blocks members from making container packages public. Once an org
  admin grants public-package permission, the default will switch
  back to `ghcr.io/dalihub/dali-preview-runtime`.

### Performance (32-core dev machine)

| Path | Cold first render | Warm subsequent |
|---|---|---|
| parser  | 200 ms (incl. shader compile) | 45–150 ms |
| dlopen  | 600 ms                        | 460–594 ms |
| harness | 1.5 s                         | ~1.5 s |

---

## [0.33.0] - 2026-04-28 — Inspector Read-Only + Multi-Config UX Polish

### Highlights

- Inspector becomes a faithful read-only view of runtime state; the
  source-rewriting property editor is gone. ~1100 LOC removed.
- Multi-config previews finally show all configs reliably and respond
  to UI controls (theme toggle, bg color picker) consistently.
- Inspector finally reports the user's actual color (text color for
  Label, background color for View) instead of the actor tint
  multiplier (which was always white).
- A dedicated diagnostic setting replaces the no-longer-working
  "delete the binary" instruction for measuring the full harness path.

### Added

- **`daliPreview.disablePreviewServer`** boolean setting. When true the
  preview server is never spawned, so every build falls through to the
  full g++ harness path (~1100 ms). Useful for measuring or reproducing
  the slow path. Reflected in the toolbar status as "compile" mode.
- **Inspector color swatch**: color/textColor/backgroundColor properties
  now render as a 12 px swatch + `#RRGGBB` label, with the raw RGBA
  visible in the tooltip.
- **Click-to-code expands the inspector tree**: clicking a bbox in the
  preview unfolds every collapsed ancestor and scrolls the matching
  node into view, instead of silently selecting an invisible node.

### Changed

- **Inspector is now read-only.** The property editor (regex-based
  rewrites of `.SetX(...)` calls in the user's source) is removed
  along with its 600 LOC of tests. Live preview + direct source edit
  is the supported flow; GUI input forms only beat keyboard editing
  for color and opacity, and both were too fragile to keep.
- **Inspector button disables in multi-config and welcome modes** with
  a tooltip explaining why. Inspector relies on per-actor metadata
  that only single-preview produces.
- **Multi-config grid layout** switched from flex-wrap with vertical
  centering (which pushed the 3rd config off-screen on narrow panels)
  to CSS grid with `auto-fit, minmax(220px, 1fr)` and `align-content:
  start`. Each thumbnail capped at 60vh so multi-row layouts fit.
- **Multi-config dimensions label** moved below the canvas to match
  single-preview layout. Name stays above; size sits below using the
  shared `.dimensions-label` style.
- **Theme toggle now applies globally in multi-config.** Once the user
  flips theme via the UI in a session, every config follows that
  choice — including configs that pin `theme=` in `@preview-config`.
  Per-config theme is still honored on initial render so dark/light
  comparison configs default correctly.
- **Theme / bg color rebuild trigger** now resolves the target document
  via `lastDocument` fallback when `vscode.window.activeTextEditor` is
  undefined (the typical case while the webview panel has focus). The
  picker no longer silently no-ops.
- **Active editor switch auto-rebuilds the preview** for the new
  previewable file (single-preview or VNC hot-reload). Switching files
  no longer leaves a stale preview from the previous file.
- **FlexLayout Explorer button** toggles the panel + direction-arrow
  overlay together. It used to flip only the easy-to-miss arrow
  overlay; the panel itself only opened on tree-node selection so
  the button felt unresponsive. Active state stays in sync with
  panel visibility from both entry points.
- **Sample API alignment**: `.Direction()` → `.SetDirection()`,
  `.AlignItems()` → `.SetAlignItems()`, `.JustifyContent()` →
  `.SetJustifyContent()`, `.Wrap()` → `.SetWrap()`,
  `.SetViewPadding()` → `.SetPadding()` across 24 preview samples.
  Several samples no longer compiled against the current API.
- **path3-fullbuild.preview.dali.cpp header** rewritten with
  instructions that actually work (toggle the new
  `disablePreviewServer` setting + Reload Window). The previous "kill
  the process / delete the binary" steps were silently undone within
  hundreds of milliseconds by the extension's auto-respawn and
  auto-rebuild logic, so they no longer measured the slow path.

### Fixed

- **Inspector showed every actor as `#FFFFFF`.** The harness was
  reading `Actor::Property::COLOR`, which is the actor tint multiplier
  (always white by default), not the user-set color. Now reads
  `Label::GetTextColor()` for Label / InputField (emitted as
  `textColor`) and `View::GetBackgroundColor()` for everything else
  (emitted as `backgroundColor`). All four metadata emitters updated:
  `preview_server.cpp`, `preview_harness.cpp.template`,
  `preview_animation.cpp.template`, `preview_interactive.cpp.template`.
- **Preview window kept previous file's huge size.** Opening
  `boarding-pass.preview.dali.cpp` (2520 × 4480) and then a cfg-less
  file used to keep the 2520 × 4480 canvas. Orchestrator now tracks
  the last cfg-supplied width/height and resets to settings defaults
  when the cfg key disappears between files. Webview-driven manual
  resize is preserved when the cfg key is unchanged.
- **Marker-mode multi-config silently failed to update.** When a
  `@dali-preview-begin` file failed to compile, the multi-grid kept
  the previous file's previews intact and only added an error banner
  on top. Saves looked like no-ops. The "keep last good grid on
  all-failed" branch is removed; per-cell error text replaces it.
- **`TextLabel::New(...)` in `multi-config-marker.cpp`** never built
  because `Dali::Toolkit::TextLabel` is not in scope (the plugin
  template links only dali-ui-foundation, not dali-toolkit). Replaced
  with `Label::New(...)` which is in `Dali::Ui`.
- **`gallery.preview.dali.cpp`** had `.Wrap(FlexWrap::WRAP)` which
  doesn't exist on `FlexLayout`. Renamed to `.SetWrap(...)`.

### Removed

- **`src/propertyEditor.ts`** (254 LOC) and
  **`test/unit/propertyEditor.test.ts`** (605 LOC). See "Inspector is
  now read-only" above.

## [0.32.1] - 2026-04-17 — First-Preview Image Fix

### Fixed

- **Preview server: images missing on first preview**: The preview server captured screenshots immediately after building the scene, before asynchronous image decoding completed. Images only appeared on subsequent previews due to DALi's internal texture cache. Added `AreAllResourcesReady()` polling (min 300ms, up to 3s timeout) to `DoReload()` and `DoRenderJson()` — matching the existing harness template behavior.

### Changed

- **Animation sample simplified**: Removed unnecessary FlexLayout wrapper, increased animation duration to 3s and travel distance to 200px for clearer visual feedback.

## [0.32.0] - 2026-04-17 — Mid-Project Stability Overhaul

### Added

- **PreviewOrchestrator** (`src/previewOrchestrator.ts`): Extracted all preview pipeline logic from `extension.ts` into a dedicated orchestrator class. Reduces `extension.ts` from ~1,237 lines to ~612 lines, making it testable and maintainable.
- **Strategy Pattern**: Three build strategies (`ParserStrategy`, `DlopenStrategy`, `HarnessStrategy`) replace the monolithic `runPreview()` switch logic, enabling clean addition of future rendering backends.
- **95 new tests** (414 → 509): `xvfbManager.test.ts` (26), `previewCodeLens.test.ts` (32), `integration.test.ts` (36 — including 7 P0 pipeline scenarios).
- **c8 coverage reporting**: V8-native code coverage with HTML reports (`npm run coverage`).
- **`server/check-harness-compiles.sh`**: CI script that syntax-checks all C++ harness templates, preventing v0.15.x-style include path regressions.

### Changed

- **Error messages unified to English**: All user-facing strings across 6 source files and `preview.html` translated from Korean to English for marketplace consistency.
- **`package.json` OS restriction**: Added `"os": ["linux"]` to prevent installation on unsupported platforms.
- **CI hardened**: `npm audit --audit-level=moderate` added to ci.yml, release.yml; harness template compilation check added to golden-test.yml.
- **Coverage tooling**: Switched from nyc to c8 (V8-native) for compatibility with the vscode module mock.

### Fixed

- **statusBar test**: Updated assertions to match English tooltip text after i18n unification.

## [0.31.0] - 2026-04-16 — 구조화 로거 통합 + FlexLayout Explorer 안정화

### Added

- **구조화 로거 (`src/logger.ts`)**: LogLevel(ERROR/WARN/INFO/DEBUG/TRACE) + LogCategory(Extraction/Build/Execute/Render/FlexLayout 등) 기반 카테고리별 필터링 지원. VS Code output channel에 구조화된 포맷으로 출력
- **ConfigurationService**: `daliPreview.*` 설정을 중앙화된 싱글턴으로 읽기. 설정 변경 즉시 반영
- **공유 타입 (`src/types.ts`)**: BuildResult 등 중복 정의 인터페이스 통합

### Changed

- **FlexLayout 메타데이터 보강 경로**: 메타데이터 읽기 실패 시 `log.trace` 로 정확한 오류 추적 가능
- **전체 모듈 로거 통합**: buildRunner, codeExtractor, extension, previewManager, previewServer, vncManager, xvfbManager, sdbManager 등 모든 주요 모듈에 구조화 로거 적용
- **buildRunner**: workspace별 임시 디렉토리 (`/tmp/dali_preview_<hash>`) 사용으로 멀티윈도우 충돌 방지
- **CI**: 보안 감사 단계(`npm audit`) 추가

### Fixed

- **하네스 골든 파일**: `AreAllResourcesReady()` 함수 + `mTickCount` 멤버 반영 — `harnessGeneration` 테스트 1건 통과 복구

## [0.30.0] - 2026-04-16 — VNC 인터랙티브 모드 안정화 + ImageView 프리뷰 수정

### Fixed

- **VNC RFB 버퍼 동기화 오류**: `_handleFBUpdate()`에서 불완전 데이터 소비 후 남은 바이트가 메시지 타입으로 잘못 해석되던 문제 수정 (peek-then-consume 패턴 적용)
- **VNC 캔버스 크기 불일치**: VNC 전용 Xvfb(4096x4096)를 별도 시작하고, DALi가 보고하는 실제 윈도우 크기로 x11vnc `-clip` 적용
- **VNC 핫리로드 시 VNC 인프라 파괴**: `restartDaliApp()` 중 이전 DALi 프로세스 exit 핸들러가 x11vnc/websockify/Xvfb를 전부 정리하던 문제 수정 (`_restarting` 플래그)
- **VNC 핫리로드 디스플레이 불일치**: `restartDaliApp()`이 메인 Xvfb 대신 VNC 전용 디스플레이를 사용하도록 수정
- **VNC 모드에서 `@preview-config` width/height 미적용**: `startVncMode()`과 `hotReloadVnc()`에서 config 파싱 추가
- **VNC 모드 전환 시 캔버스 중복**: `RFB.disconnect()`에서 canvas를 DOM에서 제거하도록 수정
- **ImageView 정적 프리뷰 미출력**: preview_server의 scene assembler가 `ImageView`를 `View::New()`로 대체하던 문제 수정. `ImageView::New(url)` 분기 추가
- **이미지 리소스 로딩 전 캡처**: preview_harness에서 `View::IsResourceReady()` 폴링 도입 (100ms 간격, 최대 3초 대기)

### Added

- **VNC 마우스/키보드 이벤트 포워딩**: rfb.js에 mousedown/up/move/wheel → `sendPointerEvent`, keydown/up → `sendKey` (X11 keysym 변환) 추가
- **SetColourMapEntries 핸들러**: RFB 메시지 타입 1 처리 추가
- **VNC 의존성 Setup Wizard 통합**: `x11vnc`, `websockify`를 `installMissingDependencies()`에 추가
- **VNC 전용 Xvfb 관리**: `VncManager`에 별도 Xvfb(`:96/:95/:94`) 시작/정리 로직 추가
- **DALi 실제 윈도우 크기 보고**: interactive 템플릿이 `READY <width> <height>` 출력, VncManager가 파싱하여 x11vnc clip에 반영

## [0.29.0] - 2026-04-16 — 10개 쇼케이스 샘플 + instrumentCode 안정성 + 프리뷰 UX 개선

### Added

- **10개 프로덕션 급 쇼케이스 샘플**: Music Player, Weather Forecast, Fitness Dashboard, Food Delivery, Boarding Pass, Crypto Portfolio, Smart Home, 그리고 Flow Banking 앱 프로젝트(Home/Card/Transfer 3화면). 실제 이미지, 그라디언트, rounded corners, markup 텍스트, bar chart, 바코드 등 DALi UI Foundation의 다양한 기능을 시연.
- **`test/samples/assets/`**: 쇼케이스 샘플용 이미지 자산 13개 (portrait, food, interior, album art).
- **`test/samples/flow-banking/`**: 동일 브랜드(teal `#00d4a8`) 컨셉의 3화면 뱅킹 앱 프로젝트. 프로젝트 내 UI Preview 시연 목적.

### Fixed

- **`instrumentCode()` 문자열 내 `)` 처리**: 기존 regex `[^)]*`가 `Label::New(")")` 같은 문자열 안의 `)` 를 함수 닫는 괄호로 오인하여 `__tag()` 래핑이 깨지는 버그 수정. balanced-parenthesis walker로 교체하여 문자열 리터럴과 중첩 괄호를 정확히 처리.
- **`@preview-config` 파일의 click-to-code 라인 오프셋**: `.preview.dali.cpp` 파일에서 `@preview-config` 줄을 제거한 뒤 `startLine: 0` 으로 고정하여 라인 번호가 config 줄 수만큼 밀리던 문제. `startLine: configLineCount`로 수정.
- **`validateDaliPrefix()` 강화**: `libdali2-core.so` 만 확인하던 것에 `dali2-ui-foundation.pc` 존재도 검증. 여러 DALi 설치가 있을 때 `Dali::Ui::View` 없는 구버전이 선택되는 문제 방지.
- **단일 `@preview-config` 인스펙터 지원**: config가 1개일 때 multi-preview 대신 single-preview 경로로 라우팅하여 위젯 인스펙터와 click-to-code 오버레이가 정상 동작.
- **Multi-preview 에러 시 이전 이미지 유지**: 빌드 전체 실패 시 이전 성공 렌더를 보존하고 에러 배너만 오버레이.

### Improved

- **프리뷰 그리드 가운데 정렬**: multi-preview 이미지가 패널 중앙에 표시. `max-height`도 `60vh`에서 `calc(100vh - 90px)`로 확대.
- **인스펙터 트리 텍스트 확대**: `.tree-node` 12→14px, toggle 9→11px, name 11→13px.
- **에러 메시지 복사 가능**: `.preview-grid-error`에 `user-select: text` 추가.

## [0.28.0] - 2026-04-16 — Parser-first 클릭-투-코드 호환 + 애니메이션 컴파일 수정 + 임시 파일 정리

### Fixed

- **클릭-투-코드 회귀 수정** (v0.23.0부터): Phase 4-2 parser-first 경로가 `instrumentCode()`를 건너뛰면서 scene JSON에 `__L` 라인 태그가 없어 프리뷰 클릭 / 위젯 인스펙터 양방향 하이라이트가 모두 실패. `parseChainExpression`이 토큰 라인을 추적해 `SceneNode.sourceLine`에 기록하고, C++ 서버가 이를 읽어 `Actor::Property::NAME = "__L{line}"`으로 태깅하도록 전 파이프라인 정비.
- **애니메이션 샘플 컴파일 에러**: `instrumentCode`가 `Animation::New()`, `Timer::New()`, `Capture::New()` 등 non-Actor 핸들까지 `__tag()`로 래핑하면서 `SetProperty(Actor::Property::NAME, ...)` 호출이 컴파일 실패 (`‘class Dali::Animation’ has no member named ‘SetProperty’`). Actor 파생 타입 allowlist(15개) 도입으로 해결.
- **Stale preview_server 바이너리**: IPC 프로토콜을 변경한 릴리즈 업데이트 후에도 `/tmp/dali_preview/preview_server`가 구버전 그대로 캐시되어 구 프로토콜을 내보내면서 RENDER_JSON 응답 파싱 실패 → 프리뷰 무응답. `ensureServerBinary()`가 소스 파일 mtime을 바이너리와 비교해 소스가 더 새로우면 자동 재빌드.

### Added

- **`src/cppParser.ts`**: 토크나이저가 토큰별 1-based `line` 번호 추적. `SceneNode`에 `sourceLine?: number` 필드 추가. `parseChainExpression(code, startLine?)` 시그니처로 절대 라인 오프셋 전달, 각 `::New()` 노드에 `(tokenLine - 1) + startLine` 값 주입. LRU 캐시 키도 `startLine:code` 복합 키로 확장.
- **`server/preview_server.cpp`**: `SceneNodeJson`에 `int sourceLine = -1` 필드 + `JReadNumber` 헬퍼 + `JParseNode`의 `sourceLine` 키 처리. `SBBuildNode` 래퍼가 `SBBuildNodeRaw` 결과를 `__L{sourceLine}`로 태깅. 재귀 호출도 자동으로 같은 래퍼 경유해 자식 노드까지 일괄 태깅.
- **`src/buildRunner.ts`**: `cleanupBuildTmpDir(tmpDir)` 순수 함수 export. `dispose()`가 extension 종료 시 `/tmp/dali_preview/`의 플러그인 `.so`/`.cpp`, 렌더 PNG, metadata JSON, `anim_frames/` 등 모든 임시 아티팩트를 제거. `preview_server` 바이너리는 재빌드 비용 회피 및 위 mtime 체크 로직으로 staleness가 해소되므로 보존.
- **`src/previewServer.ts`**: `ensureServerBinary()`가 mtime 비교로 자동 재빌드. "Source newer than binary — rebuilding to avoid IPC protocol drift." 로그.
- **`test/e2e/click_to_code_e2e.py`**: 독립 실행형 릴리즈 회귀 테스트. Xvfb 자동 기동 + preview_server 스폰 후 두 경로 검증 — **Path A** (RELOAD): `__tag()` 래핑 plugin 컴파일 + RELOAD, **Path B** (RENDER_JSON): `sourceLine` 필드가 든 scene JSON 직접 기입. 메타데이터 JSON의 `__L` 태그 개수로 검증.
- **`package.json` 스크립트**: `npm run test:click-to-code` (e2e 단독) 및 `npm run test:release` (`test:unit` + `test:click-to-code`, 릴리즈 게이트).
- **단위 테스트 확장**:
  - `test/unit/codeExtractor.test.ts`: Actor allowlist 동작 6건 (FlexLayout / View / TextLabel / ImageView / ScrollView / Control 래핑, Animation / Timer / Capture 미래핑, mixed 스니펫).
  - `test/unit/cleanupBuildTmpDir.test.ts` (신규): cleanup 로직 5건 — preview_server 보존, 재귀 디렉토리 삭제, 다수 파일 일괄 정리, 없는/빈 디렉토리 처리.

### Changed

- **`src/extension.ts`**: Phase 4-2 parser-first 경로 재활성화, `parseChainExpression`에 `extraction.startLine` 전달. parser-first 성능 이득(~200ms 절감)과 click-to-code 호환 양립.

### Tests

- 단위 테스트 415건 통과 (+11 신규: allowlist 6 + cleanup 5)
- E2E click-to-code Path A + Path B 모두 통과
- 애니메이션 샘플 실제 컴파일 + Xvfb 실행 검증: 20/20 프레임 캡처

---

## [0.27.1] - 2026-04-10 — 골든 테스트 샘플 API 수정 + 골든 이미지 갱신

### Fixed

- **`test/samples/animation.preview.dali.cpp`**: `.SetSize()` → `.SetRequestedWidth()` + `.SetRequestedHeight()`, `.SetParentOrigin()` + `.SetAnchorPoint()` 제거 (View API 미지원 메서드)
- **`test/samples/multi-config-locale.preview.dali.cpp`**: `TextLabel::New()` → `Label::New()` (올바른 API로 교체)
- **`test/samples/multi-config.preview.dali.cpp`**: `FlexLayout::COLUMN` → `FlexDirection::COLUMN`, `.SetDirection()` → `.Direction()`, `TextLabel::New()` → `Label::New()` (올바른 API로 교체)
- **`test/e2e/imageComparator.ts`**: `require('pixelmatch')` ESM 기본 내보내기 처리 — `.default ?? fallback` 패턴으로 `pixelmatch is not a function` 오류 수정
- **`test/golden/animation.harness.cpp`**: 수정된 animation 샘플에 맞게 골든 파일 업데이트

### Updated

- **`test/golden/screenshots/`**: 13개 전체 샘플 골든 PNG 갱신 (수정된 샘플 반영)

---

## [0.27.0] - 2026-04-10 — Phase 3-4: 스크린샷 골든 테스트 — pixelmatch 기반 회귀 테스트 시스템 (DAL-18)

### Added

- **E2E 골든 테스트 러너** (`test/e2e/goldenTestRunner.ts`): `test/samples/*.preview.dali.cpp` 샘플을 자동 빌드+실행하여 PNG를 `actual/`에 저장. `UPDATE_GOLDENS=1`로 골든 업데이트, 그 외에는 pixelmatch로 회귀 비교.
- **독립 실행형 빌드 러너** (`test/e2e/standaloneBuildRunner.ts`): vscode 의존성 없는 순수 Node.js 빌드+캡처 모듈. `DALI_PREFIX` / `DESKTOP_PREFIX` 환경변수 또는 공통 경로로 DALi 자동 감지. `USE_CCACHE` 모듈 상수화로 per-compile 서브프로세스 제거. `execute()` 성공 판정 순서 수정(exit code 우선), `LD_LIBRARY_PATH` trailing colon 제거, stale binary 삭제, C++ 경로 이스케이프 처리.
- **이미지 비교 모듈** (`test/e2e/imageComparator.ts`): pixelmatch + pngjs 래퍼. 픽셀 차이 1% 미만 시 PASS, 초과 시 diff PNG 생성. dimension 불일치 시 `sizeMismatch` 필드로 명확한 오류 보고. PASS 시 diff Buffer 미할당(2-pass 최적화).
- **GitHub Actions 워크플로우** (`.github/workflows/golden-test.yml`): self-hosted runner에서 골든 테스트 실행. concurrency 제어, job timeout(20분), Xvfb xdpyinfo 폴링 대기, DALi SDK pre-flight 검증, /tmp 정리, 실패 시 diff + actual 아티팩트 업로드(14일 보존).
- **`package.json` 스크립트**: `test:e2e` (회귀 비교), `test:golden:update` (골든 파일 갱신).
- **골든 이미지 디렉토리** (`test/golden/screenshots/`): 기준 PNG 저장 위치.
- **`.gitignore`**: `test/e2e/actual/`, `test/e2e/diff/` 추가.
- **의존성**: `pixelmatch ^7.1.0`, `pngjs ^7.0.0`, `@types/pngjs ^6.0.5` 추가.

---

## [0.26.0] - 2026-04-10 — CodeLens Preview + // @preview 단일 마커 지원

### Added
- **`src/previewCodeLens.ts`** (신규): `PreviewCodeLensProvider` 구현. C++ 파일에서 DALi View를 반환하는 함수(`CreatePreview`, `BuildScene`, `@preview` 주석 표시 함수) 위에 `▶ Preview` 버튼 자동 표시. `provideCodeLenses()`는 함수 반환 타입 패턴(View/FlexLayout/StackLayout 등) 감지.
- **`src/codeExtractor.ts`**: `// @preview` 단일 마커 지원 추가 — 마커가 있는 줄부터 해당 함수 바디 끝까지를 프리뷰 코드로 추출. `extractFunctionBody(doc, startLine, endLine)` 함수 추가 — CodeLens에서 선택한 함수 범위를 직접 추출.
- **`src/extension.ts`**: `dali.previewFunction` 커맨드 등록 — CodeLens에서 호출. `lastCodeLensFunc` 상태로 라이브 프리뷰 시 마지막 CodeLens 대상 유지. `preExtracted` 파라미터로 `runPreview()`에 추출 결과 직접 전달.
- **`package.json`**: `dali.previewFunction` 커맨드 등록.
- **`test/samples/codelens-example.cpp`** (신규): CodeLens 시나리오용 샘플 — `CreatePreview()`, `BuildCard()` 등 View-returning 함수 포함.
- **`test/samples/single-marker.cpp`** (신규): `// @preview` 단일 마커 시나리오 샘플.
- **`test/samples/path1-parser.preview.dali.cpp`** (신규): 파서 경로 테스트용 샘플 (FlexLayout chain).
- **`test/samples/path2-dlopen.preview.dali.cpp`** (신규): dlopen 서버 경로 테스트용 샘플 (복잡한 C++ 표현식).
- **`test/samples/path3-fullbuild.preview.dali.cpp`** (신규): 풀 빌드 경로 테스트용 샘플 (DALi 고급 API).

### Changed
- **`test/unit/codeExtractor.test.ts`**: `extractFunctionBody()` 및 `// @preview` 마커 파싱 테스트 추가.
- **`test/samples/marker-example.cpp`**: `// @preview` 단일 마커 예시 포함하도록 업데이트.
- **`.vscode/launch.json`**: 디버그 실행 시 `test/samples` 폴더를 워크스페이스로 자동 오픈 — CodeLens 미리보기 수동 테스트 편의.

## [0.25.0] - 2026-04-10 — 성능 계측 로그 추가 + Debounce 범위 조정

### Added
- **`src/extension.ts`**: `[Perf]` 타이밍 로그 추가 — `T2 runPreview start`, `extract+instrument`, `previewServer 상태`, `parse`, `renderJson`, `compilePlugin`, `server.reload`, `buildAndRun`, `metadata read+enrich`, `T5 postMessage sent` 각 단계의 소요 시간 출력. 전체 파이프라인 지연(텍스트 변경 → 업데이트) 계측 가능.
- **`src/extension.ts`**: `lastTextChangeTime` 변수 추가 — 텍스트 변경 시각 기록, 디바운스 발화(`T1`) 및 T5 시점과의 elapsed time 계산에 활용.
- **`src/extension.ts`**: `[LivePreview] Debouncer created` 및 설정 변경 로그 추가.

### Changed
- **`package.json`**: `daliPreview.livePreviewDebounce` 범위 100~5000ms → 0~3000ms 변경. 0ms 설정 시 즉시 트리거 가능.

## [0.24.0] - 2026-04-10 — 렌더 캡처 최적화

### Changed
- **`server/preview_server.cpp`**: `Timer::New(200)` 제거 — 캡처 지연 타이머 대신 `OnStartCapture()` 직접 호출. DALi Capture API가 내부적으로 `RenderTask(REFRESH_ONCE)`를 사용하여 레이아웃 패스 완료 후 캡처를 스케줄링하므로 별도 지연 불필요.
- **`src/previewServer.ts`**: `renderJson()` 완료 후 임시 scene JSON 파일(`/tmp/*.scene.json`) 자동 정리 (`fs.promises.unlink`) — 디스크 공간 누수 방지.

## [0.23.0] - 2026-04-10 — Preview Server IPC 안정화

### Added
- **`src/previewServer.ts`**: ANSI 이스케이프 코드 스트리핑 (`stripAnsi()`) 추가 — 터미널 컬러 코드가 포함된 서버 출력도 올바르게 파싱.
- **`test/unit/previewServer.test.ts`**: `>>>` 프로토콜 및 ANSI 스트리핑 관련 테스트 추가.

### Changed
- **`server/preview_server.cpp`**: IPC 출력 프로토콜 접두사 추가 — `READY` → `>>>READY`, `OK:` → `>>>OK:`, `ERROR:` → `>>>ERROR:`. 일반 로그 출력과 IPC 메시지를 명확하게 구분.
- **`src/previewServer.ts`**: stdout 파싱 로직을 `>>>` 접두사 기반으로 업데이트. `[Server stdout]` 디버그 로깅 추가.

## [0.22.0] - 2026-04-10 — 위젯 인스펙터 개선 (속성 편집 + 레이아웃 정책)

### Added
- **`src/propertyEditor.ts`**: `PropertyEditor` 클래스에 `INSERT` 모드 지원 추가 — 속성 삽입 위치를 정밀하게 제어. `EditResult` 타입 개선으로 실패 원인 반환.
- **`media/preview.html`**: 인스펙터 UI 개선:
  - 레이아웃 정책 드롭다운 (`SetRequestedWidth` / `SetRequestedHeight`) — MATCH_PARENT / WRAP_CONTENT / 숫자 값 선택 가능.
  - `__L` 접두사 속성 숨김 처리 (내부 레이아웃 힌트 표시 제거).
  - 노드 재선택 후에도 인스펙터 선택 상태 유지 (선택 보존 로직).
  - 치수 행(dimension row) 추가 — 너비/높이를 한 행에 표시.

### Changed
- **`server/preview_server.cpp`**: `SBParseLayoutLength()` → `SBParseDimension()` 대체. MATCH_PARENT=-2.0f, WRAP_CONTENT=-1.0f 반환하도록 변경 (DALi-UI-Foundation API 호환성 개선).
- **`server/preview_server.cpp`**: `FontClient::Get()` → `Dali::TextAbstraction::FontClient::Get()` 전체 네임스페이스 명시 (링커 충돌 방지).
- **`src/flexMetadata.ts`**: FlexLayout 파서 데이터 병합 로직 개선.
- **`test/helpers/setup.ts`**: 테스트 헬퍼 설정 업데이트.

## [0.21.0] - 2026-04-06 — Phase 4-5: FlexLayout Explorer (레이아웃 시각화 도구) — DAL-35

### Added

- **`src/flexMetadata.ts`** (신규): `enrichMetadataWithFlexProps()` 유틸리티. TypeScript 파서 트리(SceneNode)에서 `Direction`/`AlignItems`/`JustifyContent`/`Wrap` 속성을 추출하여 런타임 메타데이터 노드에 `flexProps` 키로 주입. DFS 순서로 트리를 매칭하며, 자식 수 불일치 시 graceful degradation.
- **`src/extension.ts`**: 파서 패스 성공 시 `parserScene` 보존 → 메타데이터 로드 후 `enrichMetadataWithFlexProps()` 호출하여 FlexLayout 속성 병합.
- **`media/preview.html`**: FlexLayout Explorer 기능 추가:
  - Inspector 패널 하단에 "FlexLayout Explorer" 섹션 — FlexLayout 노드 선택 시 direction/alignItems/justifyContent/wrap 표시 (direction은 화살표 아이콘 시각화: →↓←↑).
  - 툴바에 ◆ 토글 버튼 추가 — FlexLayout 노드가 씬에 있을 때만 표시.
  - 토글 활성화 시 프리뷰 이미지 위에 방향 화살표 + `flex direction` 레이블 오버레이 렌더링.
- **`server/preview_harness.cpp.template`**: `CollectActorMetadata()`에 FlexLayout 런타임 속성 추출 추가 — `FlexDirection`/`FlexAlign`/`FlexJustify`/`FlexWrap` enum → 문자열 변환 헬퍼 함수, `FlexLayout::DownCast()` + getter 호출, `flexProps` JSON 키 출력.
- **`server/preview_server.cpp`**: 동일한 FlexLayout 메타데이터 추출 적용 (RENDER_JSON 경로).
- **`test/unit/flexMetadata.test.ts`** (신규): 8개 테스트 — null scene, FlexLayout 주입, enum 정규화, 비-FlexLayout 스킵, 중첩 병합, 기본값 제공, 자식 수 불일치, 빈 루트 처리.
- **`test/samples/flex-explorer.preview.dali.cpp`** (신규): FlexLayout Explorer 기능 확인용 샘플 파일.

### Changed

- **`test/golden/red-box.harness.cpp`**: 하네스 템플릿에 FlexLayout 헬퍼 함수 추가 반영하여 재생성.

## [0.20.0] - 2026-04-03 — Phase 4-4: Tizen 실기기 프리뷰 (SDB 배포 + 스크린샷 캡처) — DAL-34

### Added

- **`src/sdbManager.ts`** (신규): `SdbManager` 클래스 구현. `checkDependencies()` (sdb 설치 여부 확인), `getDevices()` + `parseDevices()` (sdb devices 파싱), `selectDevice()` (QuickPick UI로 디바이스 선택), `push()`, `pull()`, `shell()`, `forward()`, `removeForward()` 메서드 제공.
- **`src/buildRunner.ts`**: `buildAndRunOnDevice()` 메서드 추가. 파이프라인: 하네스 생성 → 로컬 컴파일(크로스 컴파일 지원) → `sdb push` 바이너리 → `sdb shell` 실행 → `sdb pull` PNG + 메타데이터. `compileCrossDevice()` private 메서드 추가 (arm-linux-gnueabi-g++ + sysroot 기반 pkg-config). `SdbManager` import 추가.
- **`src/extension.ts`**: `sdbManager` 인스턴스 추가 및 라이프사이클 관리. `dali.selectDevice` 커맨드 (디바이스 선택 → workspace state 저장). `dali.devicePreview` 커맨드 (SDB 없으면 에러 안내). `runDevicePreview()` 함수 구현. `deactivate()`에 `sdbManager.dispose()` 추가.
- **`src/statusBar.ts`**: `showMode()` 타입에 `'device'` 모드 추가 (`📱 Device` 레이블).
- **`package.json`**: `dali.selectDevice`, `dali.devicePreview` 커맨드 등록. `daliPreview.sdbPath`, `daliPreview.tizenSysroot`, `daliPreview.targetDevice` 설정 추가.
- **`test/unit/sdbManager.test.ts`** (신규): `checkDependencies()` 3케이스, `parseDevices()` 5케이스 (단일 디바이스, 다중 디바이스, 빈 출력, 헤더 스킵, offline 상태), `dispose()` 1케이스.
- **`test/unit/buildRunner.device.test.ts`** (신규): `buildAndRunOnDevice()` 6케이스 — sdb push 실패, 디바이스 출력 `OK:` 없음, sdb pull 실패, 성공 경로(pngPath 확인), 크로스 컴파일 실패 전파, compile 실패 시 sdb 미호출.

### Fixed

- **[보안] `src/sdbManager.ts`**: `checkDependencies()`에서 `execSync`를 `spawnSync`로 교체하여 셸 인젝션 방지 (sdbPath 사용자 입력값이 셸을 경유하지 않음).
- **[보안] `src/buildRunner.ts`**: `compileCrossDevice()`의 `sysroot` 이스케이프 강화 — `"`, 백틱, `$` 모두 이스케이프하여 악성 workspace 설정값 주입 차단.
- **[버그] `src/extension.ts`**: `currentDeviceSerial` 복원을 `context.workspaceState.get` → `vscode.workspace.getConfiguration('daliPreview').get('targetDevice')` 로 변경하여 저장/읽기 스토리지 일치.
- **[버그] `src/sdbManager.ts`**: `getDevices()`의 `.catch()` 체인 및 dead code 제거 — `exec(['devices'])` 단일 호출로 단순화. CLAUDE.md 스타일 규칙(`no raw .catch() chains`) 준수.
- **[버그] `src/statusBar.ts`**: `showMode()` 첫 줄에 `clearRevertTimer()` 추가 — 진행 중인 revert 타이머가 device 모드 상태를 덮어쓰는 race condition 수정.

## [0.19.0] - 2026-04-03 — DALi Preview 설정 UI 커맨드 추가 — DAL-33

### Added

- **`package.json`**: `dali.openSettings` 커맨드 등록 (`DALi Preview: Open Settings`). Ctrl+Shift+P 명령 팔레트에서 접근 가능.
- **`src/extension.ts`**: `dali.openSettings` 커맨드 핸들러 추가. VS Code 기본 설정 UI를 `daliPreview` 검색어로 필터링하여 오픈. debounce 타임, 프리뷰 크기, 테마, VNC 포트 등 모든 `daliPreview.*` 설정이 한 곳에서 관리됨.

## [0.18.0] - 2026-04-03 — Phase 4-3: 애니메이션 프리뷰 (GIF 연속 캡처 + 타임라인 스크러빙) — DAL-31

### Added

- **`src/previewConfig.ts`**: `PreviewConfig`에 `animation`, `duration`, `fps` 필드 추가. `MultiPreviewResult`에 `gifPath`, `frameCount` 추가.
- **`src/codeExtractor.ts`**: `@preview-config`에서 `animation=true/false`, `duration=N` (500~10000ms), `fps=N` (5~30) 파라미터 파싱. 범위 외 값은 조용히 무시.
- **`server/preview_animation.cpp.template`** (신규): 멀티프레임 연속 캡처 C++ 하네스. 레이아웃 안정화 500ms 대기 → `FRAME:N/TOTAL` 프로토콜 출력 → `ANIM_DONE:N` + 메타데이터 내보내기. 프레임 캡처 실패 시 해당 프레임 스킵 후 계속.
- **`src/buildRunner.ts`**: `AnimationBuildResult` 인터페이스 추가. `buildAndRunAnimation()` 메서드: 하네스 생성 → g++ 컴파일 → 실행 → ffmpeg `palettegen+paletteuse` 필터로 고품질 GIF 합성. `ffmpegAvailable()` 런타임 감지, 미설치 시 첫 프레임 PNG 폴백.
- **`src/previewManager.ts`**: `updateAnimation(gifOrPngPath, buildTimeMs, frameCount, metadata)` 메서드 추가. `onAnimationSpeedChange()` 콜백 시스템 추가. `handleMessage`에 `animationSpeedChange` case 추가.
- **`media/preview.html`**: 애니메이션 재생 UI 추가. GIF 표시 컨테이너 (`animationContainer`), 재생/일시정지 버튼, 처음부터 버튼, 속도 슬라이더 (0.25x~3x, 500ms 디바운싱). `updateAnimation` 메시지 핸들러. `updateImage` 수신 시 애니메이션 컨테이너 숨김 처리.
- **`src/extension.ts`**: `runAnimationPreview()` 헬퍼 추가. `runPreview()`에서 `animation=true` config 감지 시 애니메이션 경로로 분기.
- **`test/unit/codeExtractor.test.ts`**: 애니메이션 config 파싱 테스트 11건 추가 (범위 검증 포함).
- **`test/samples/animation.preview.dali.cpp`** (신규): DALi Animation API를 사용하는 애니메이션 프리뷰 샘플.
- **`test/golden/animation.harness.cpp`** (신규): 애니메이션 하네스 골든 파일 (치환 정확성 검증).
- **`test/unit/buildRunner.test.ts`**: `buildAndRunAnimation()` 8케이스, `ffmpegAvailable()` 2케이스, `executeAnimation()` 출력 파싱 3케이스, `assembleGif()` 2케이스, `runAnimationPreview()` 라우팅 3케이스 추가.
- **`test/unit/previewManager.test.ts`**: `updateAnimation()` isGif 분기 3케이스, `onAnimationSpeedChange()` 4케이스 추가.
- **`test/unit/harnessGeneration.test.ts`**: `animationHarnessGeneration` describe 블록 추가 (플레이스홀더 검증·치환·골든 파일 비교·getHarnessCodeOffset).

### Fixed

- **`server/preview_animation.cpp.template`**: `TriggerNextFrame()` 재진입 시 이전 `FinishedSignal().Disconnect()` 추가 → mFrameIndex 중복 증가 위험 제거.
- **`server/preview_animation.cpp.template`**: `ExportSceneMetadata` 호출 위치를 첫 프레임 캡처 직후(`mFrameIndex == 1`)로 이동 → Click-to-Code 좌표가 초기 레이아웃 기준으로 수집됨.
- **`src/buildRunner.ts`**: `executeAnimation` maxBuffer 50MB 명시 → 300+ 프레임 stdout 오버플로 방지.
- **`src/buildRunner.ts`**: `ffmpegAvailable()` 정적 캐시 추가 → 매 빌드마다 `which ffmpeg` 서브프로세스 재호출 제거.
- **`src/buildRunner.ts`**: `buildAndRunAnimation()` `displayPath` 빈 문자열 가드 추가.
- **`src/buildRunner.ts`**: `animConfig.duration ?? 2000` → 0값 오처리 방지.
- **`src/extension.ts`**: `runAnimationPreview()` 오류 경로에서 `startLine` 하드코딩(0) → `extraction.startLine` 올바르게 전달 (마커 모드 에러 라인 오프셋 버그 수정).

### Design

- **단계 1 완료**: 연속 캡처 GIF (ffmpeg 의존)
- **단계 2 설계 반영**: VNC 스트리밍 방식 (Phase 4-1 인프라 활용 예정)
- **단계 3 설계 반영**: 타임라인 스크러빙 (`Animation::SetCurrentProgress` API 예정)
- **ffmpeg 폴백**: 미설치 환경에서 첫 프레임 PNG로 자동 폴백, 경고 로그 출력

### Tests

- 테스트 총계: **365개** (이전 308개 → +57).

---

## [0.17.0] - 2026-04-02 — Phase 4-2: C++ 파서 기반 즉시 프리뷰 (~200ms) — DAL-30

### Added

- **`src/cppParser.ts`** (신규): dali-ui 체이닝 C++ 코드를 SceneNode JSON AST로 변환하는 재귀 하강 파서. 삼항 연산자·제어 흐름·전처리기 감지 시 `null` 반환 → 컴파일 폴백 트리거. LRU 캐시 10개.
- **`server/preview_server.cpp`**: `RENDER_JSON` IPC 명령 추가. 미니멀 JSON 파서 + 씬 빌더 (`FlexLayout`, `StackLayout`, `Label`, `View` 지원).
- **`src/previewServer.ts`**: `renderJson(scene, ...)` 메서드 추가 (async, 요청별 고유 임시 파일 사용).
- **`src/extension.ts`**: 파서-우선 하이브리드 로직 (파서 성공 ~200ms / 실패 → 컴파일 ~500ms 폴백). renderJson 실패 후 generation check 추가.
- **`src/statusBar.ts`**: `showMode('parser')` 지원. non-vnc 모드 status bar text 업데이트 버그 수정.
- **`test/unit/cppParser.test.ts`** (신규): 파서 단위 테스트 (빈 입력, 블록 커멘트, 음수, new/delete 키워드, LRU 정확성 포함).
- **`test/unit/previewServer.test.ts`**: `renderJson()` IPC 테스트 8건, `RENDER_JSON` 구조 테스트 5건 추가.
- **`test/unit/statusBar.test.ts`**: `showMode('parser')` 및 non-vnc 모드 text 테스트 4건 추가.

### Fixed

- **`src/previewServer.ts`**: `renderJson()` 내 `fs.writeFileSync` → `fs.promises.writeFile` 비동기화.
- **`src/previewServer.ts`**: 경쟁 조건 방지를 위해 요청별 고유 `scene-<timestamp>.json` 임시 파일 사용.
- **`src/cppParser.ts`**: LRU 캐시가 FIFO로 동작하던 버그 수정 (cache hit 시 `_cacheOrder` 순서 갱신).
- **`src/cppParser.ts`**: `FAIL_KEYWORDS`에서 `'auto'` 중복 제거, `new`/`delete`/`throw`/`operator` 추가.
- **`server/preview_server.cpp`**: `JReadStringArray`/`JReadNodeArray` 예상치 못한 토큰 시 무한루프 방지.
- **`src/statusBar.ts`**: `showMode()` non-vnc 모드에서 `statusBarItem.text` 미업데이트 버그 수정.

### Tests

- 테스트 총계: **308개** (이전 283개 → +25).

---

## [0.16.0] - 2026-04-02 — 프로젝트 안정화 — DAL-28

### Fixed

- **preview_interactive 템플릿 font-client.h 경로 수정** (`server/preview_interactive.cpp.template`): DAL-23에서 `preview_harness`·`preview_server`의 경로를 수정했으나 `preview_interactive.cpp.template`가 누락됨. `dali/devel-api/adaptor-framework/font-client.h` → `dali/devel-api/text-abstraction/font-client.h`로 통일.

### Added

- **시작 시 환경 검증 강화** (`src/daliEnvironment.ts`, `src/extension.ts`): 확장 활성화 시 `validateEnvironment()`로 g++, pkg-config, Xvfb, DALi SDK 유무를 사전 체크. 누락된 의존성은 `outputChannel`에 구체적인 설치 명령(`apt-get install ...`)과 함께 기록되고 VS Code 경고 알림으로 표시됨.
- **에러 메시지 UX 개선** (`src/errorParser.ts`, `src/extension.ts`): `formatRawError()` 함수 추가. `parseGccErrors()`가 사용자 코드 에러를 찾지 못할 때 raw g++ 출력 대신 첫 번째 의미 있는 오류 줄을 `"Line N, Col M: ..."` 형식으로 변환해 표시.
- **하니스 컴파일 통합 테스트 스크립트** (`scripts/check-harness-compiles.sh`): DALi SDK 환경에서 세 개 C++ 하니스 템플릿(`preview_harness`, `preview_interactive`, `preview_plugin`)을 실제 g++로 컴파일해 include 경로·타입 오류를 CI 단계에서 조기 발견.

### Tests

- `test/unit/errorParser.test.ts`: `formatRawError()` 케이스 5개 추가.
- `test/unit/daliEnvironment.test.ts`: `validateEnvironment()` 케이스 6개 신규 추가 (의존성 주입으로 실제 셸 명령 없이 테스트).

### Fixed (QA 리뷰)

- **g++ 체크 버그 수정** (`src/daliEnvironment.ts`): `checkDependencies()`에서 `gcc` 대신 `g++`를 체크하도록 수정.
- **불필요한 동적 import 제거** (`src/extension.ts`): `findDaliPrefix`를 정적 import로 변경.
- **Raw `.then()` 제거** (`src/extension.ts`): `showWarningMessage` 호출을 `await`로 변환.
- **Shell 스크립트 symlink 감지 수정** (`scripts/check-harness-compiles.sh`): `-f` → `-e`로 변경.

---

## [0.15.3] - 2026-04-02 — 버그픽스: Dali::String.CStr() 완전 수정 — DAL-26

### Fixed

- **Dali::String.CStr() 변환** (`server/preview_harness.cpp.template`, `server/preview_server.cpp`, `server/preview_interactive.cpp.template`, `test/golden/red-box.harness.cpp`): DAL-25 수정이 불완전 — `std::string(actor.GetTypeName())`은 `std::string` 생성자가 `Dali::String`을 받을 수 없어 동일 에러 재발. `.CStr()` 메서드로 `const char*` 변환 후 `std::string` 생성: `std::string(actor.GetTypeName().CStr())`.

---

## [0.15.2] - 2026-04-02 — 버그픽스: Dali::String → std::string 타입 불일치 수정 — DAL-25

### Fixed

- **Dali::String 명시적 변환** (`server/preview_harness.cpp.template`, `server/preview_server.cpp`, `server/preview_interactive.cpp.template`): `actor.GetTypeName()`이 반환하는 `Dali::String`을 `ShortTypeName(const std::string&)` 에 전달할 때 발생하는 타입 불일치 에러 수정. `std::string(actor.GetTypeName())`으로 명시적 변환 추가.

---

## [0.15.1] - 2026-04-02 — 버그픽스: font-client.h 경로 수정 — DAL-23

### Fixed

- **font-client.h 경로 수정** (`server/preview_harness.cpp.template`, `server/preview_server.cpp`): `dali/devel-api/adaptor-framework/font-client.h`는 존재하지 않는 경로. 실제 위치인 `dali/devel-api/text-abstraction/font-client.h`로 수정. 이 버그로 인해 익스텐션 실행 시 항상 컴파일 에러가 발생하여 프리뷰가 불가능했음.

---

## [0.15.0] - 2026-04-02 — Phase 4-1: 인터랙티브 모드 (VNC) — DAL-22

### Added

- **VncManager** (`src/vncManager.ts`): x11vnc + websockify + DALi 앱 프로세스 생명주기 관리. 포트 자동 탐색 (5900-5910, 6080-6090), graceful shutdown, hot reload 지원.
- **VNC 하니스 템플릿** (`server/preview_interactive.cpp.template`): `app.MainLoop()` 진입 방식 하니스. READY 시그널 stdout 출력, 메타데이터 JSON 내보내기 유지 (Click-to-Code 호환).
- **BuildRunner.buildInteractive()** (`src/buildRunner.ts`): VNC 전용 바이너리 빌드 메서드. `buildEnv()` 유틸리티로 DALi 실행 환경 변수 생성.
- **noVNC RFB 클라이언트** (`media/vendor/noVNC/rfb.js`): RFB 3.8 프로토콜 구현 (None 보안, Raw + CopyRect + DesktopSize 인코딩). VS Code webview CSP 호환 로컬 번들.
- **VNC 모드 UI** (`media/preview.html`): 툴바 VNC 토글 버튼, VNC 컨테이너 + 캔버스, 연결 상태 표시, 핫 리로드 오버레이. CSP에 `connect-src ws:` 추가.
- **PreviewManager VNC 통합** (`src/previewManager.ts`): `startVncMode()` / `stopVncMode()` / `notifyVncReloading()` / `notifyVncReloaded()` 메서드. VNC 콜백 (onStartVnc, onStopVnc, onVncConnected, onVncDisconnected). rfb.js webview URI 주입.
- **dali.toggleInteractiveMode 명령** (`src/extension.ts`): VNC 모드 시작/중지, 파일 저장 시 핫 리로드, 의존성 체크 후 툴바 버튼 노출.
- **StatusBarManager.showMode('vnc')** (`src/statusBar.ts`): VNC 모드 상태 표시.
- **설정 추가** (`package.json`): `daliPreview.vncPort` (기본 5900), `daliPreview.websocketPort` (기본 6080).

### Tests

- `test/unit/vncManager.test.ts` 신규: checkDependencies, findAvailablePort, isRunning, startInteractiveMode 의존성 오류 처리 테스트.
- 테스트 총계: **236개** (이전 228개 → +8)

---

## [0.13.1] - 2026-04-01 — Phase 3-3 QA 2차 수정 (DAL-17)

### Fixed

- **C1 SetPositionX/Y 우선** (`src/propertyEditor.ts`): x/y 속성 편집 시 `SetPositionX(float)` / `SetPositionY(float)`을 1순위 매처로 추가. 기존 `SetPosition(x, y)` 2인수 패턴은 fallback으로 유지.
- **C2 UiColor 형식 지원** (`media/preview.html`, `src/propertyEditor.ts`): 색상 피커 출력을 `Vector4(...)` → `UiColor(0xRRGGBB)` 로 변경 (DALi 샘플 코드 스타일과 동일). color validator가 `UiColor(0x...)` 형식을 허용하도록 갱신.
- **H1 SetProperty(VISIBLE) 우선** (`src/propertyEditor.ts`): visible 속성 편집 시 `SetProperty(Actor::Property::VISIBLE, bool)` 공개 API를 1순위로, `SetVisible()` 내부 API는 fallback으로 변경.
- **H2 NaN sourceLine 방어** (`src/previewManager.ts`): `typeof n === 'number'`는 NaN도 통과하므로 `Number.isInteger(sourceLine)` 검증 추가.
- **H3 propName allowlist 검증** (`src/previewManager.ts`): `EDITABLE_PROPS.includes(propName)` 검사 추가로 미등록 속성명 전달 차단.
- **H4 색상 피커 디바운싱** (`media/preview.html`): `<input type="color">` change 핸들러에 100ms 디바운스 추가. 드래그 중 연속 postMessage 방지.

### Tests

- SetPositionX / SetPositionY 기본 매처 테스트 추가
- SetPosition(x, y) fallback 테스트 명칭 정비
- `SetProperty(Actor::Property::VISIBLE)` 테스트 추가 + 우선순위 검증
- `UiColor(0xRRGGBB)` / `UiColor(0xRRGGBBAA)` color 형식 테스트 추가
- 테스트 총계: **228개** (이전 223개 → +5)

---

## [0.13.0] - 2026-04-01 — Phase 3-3: 속성 편집기 (Property Editor — DAL-17)

### Added

- **`src/propertyEditor.ts` 신규**: `PropertyEditor` 클래스. Inspector 속성 패널에서 편집된 값을 소스코드에 자동 반영. `vscode.workspace.applyEdit` 사용으로 VS Code undo/redo 완전 지원.
- **편집 가능한 속성 패널** (`media/preview.html`): `__L<line>` 태그가 있는 Actor(소스 라인 매핑 가능)의 속성을 직접 편집.
  - `x`, `y`, `w`, `h` → `<input type="number">` 숫자 입력
  - `opacity` → 슬라이더 (0.0 ~ 1.0)
  - `visible` → 체크박스 토글
  - `color` → `<input type="color">` 색상 피커 (hex → `Vector4` 변환 자동)
- **소스 매핑 불가 속성 시각적 구분** (`media/preview.html`): `__L<line>` 태그 없는 Actor 속성은 이탤릭 회색(`readonly`) 스타일로 읽기 전용 표시.
- **`PreviewManager.onEditProperty()`** (`src/previewManager.ts`): Webview `editProperty` 메시지를 Extension으로 전달하는 콜백 등록 API.
- **Extension 연결** (`src/extension.ts`): `PropertyEditor` 인스턴스 생성 및 `onEditProperty` 이벤트 수신. 편집 실패 시 `outputChannel` 로깅 + `showWarningMessage`.
- **`workspace.applyEdit` + `WorkspaceEdit` mock** (`test/helpers/setup.ts`): PropertyEditor 단위 테스트를 위한 vscode mock 확장.
- **단위 테스트** (`test/unit/propertyEditor.test.ts`): PropertyEditor 21개 + PreviewManager.onEditProperty 3개 — 총 **24개 테스트** 신규 추가. 누적 214개.

### Changed

- **속성 패널 CSS 확장** (`media/preview.html`): `.prop-input`, `.prop-opacity-wrap`, `.readonly` 등 편집 위젯 스타일 추가.

---

## [0.12.0] - 2026-04-01 — Phase 3-2: 위젯 트리 Inspector (DAL-16)

### Added

- **위젯 트리 Inspector** (`media/preview.html`): Scene Graph 트리 뷰 + 속성 패널. 노드 클릭 시 프리뷰 이미지에 bounding box 하이라이트 + 속성 패널 갱신.
- **Inspector 토글 버튼** (`media/preview.html`): 툴바의 🔍 버튼으로 Inspector 패널 on/off. 멀티 프리뷰 모드 진입 시 자동 비활성화.
- **프리뷰 ↔ 트리 양방향 연동** (`media/preview.html`): 프리뷰 이미지 클릭(Click-to-Code) → 트리 노드 자동 선택 + 스크롤. 트리 노드 클릭 → bounding box 하이라이트.
- **Code-to-Preview** (`src/extension.ts`): 에디터 커서 위치 변경 시 200ms 디바운스 후 해당 Actor를 프리뷰 + Inspector 트리에서 하이라이트.
- **Scene Graph JSON 확장** (`server/preview_harness.cpp.template`, `server/preview_server.cpp`): `type`, `visible`, `opacity`, `properties.color` 필드 추가. `JsonEscapeStr` / `ShortTypeName` 헬퍼 함수 추가.
- **`PreviewManager` 신규 메서드** (`src/previewManager.ts`): `highlightElement(line)`, `setInspectorVisible(visible)`, `onInspectorToggle(callback)`.
- **단위 테스트** (`test/unit/inspector.test.ts`): 하네스 JSON 구조, `highlightElement`, `setInspectorVisible`, `onInspectorToggle`, 상태 복원 등 **195개 테스트** (신규 22개 포함).

### Fixed (QA 리뷰)

- **JsonEscapeStr 제어문자 누락** (`server/preview_harness.cpp.template`, `server/preview_server.cpp`): RFC 8259 §7 미준수 — 0x00–0x1F 범위 제어문자를 `\uXXXX` 포맷으로 이스케이프하지 않던 버그 수정. Actor 이름에 제어문자 포함 시 Webview JSON 파싱 오류 가능성 제거.
- **NaN/Inf 미검증** (`server/preview_harness.cpp.template`, `server/preview_server.cpp`): `opacity`·`color` RGBA 컴포넌트에 `std::isfinite()` 가드 추가. 미초기화 Actor 속성에서 비정상 float 출력 시 JSON 파싱 실패 방지.
- **color 포맷 비표준** (`server/preview_harness.cpp.template`, `server/preview_server.cpp`): `"color":"r,g,b,a"` (문자열) → `"color":[r,g,b,a]` (JSON 배열)로 변경. 표준 JSON 포맷 준수.
- **`onInspectorToggle` Disposable 미등록** (`src/extension.ts`): 반환된 `vscode.Disposable`을 `context.subscriptions`에 추가하지 않아 패널 소멸 시 콜백이 정리되지 않던 문제 수정.
- **Inspector 상태 미복원** (`src/previewManager.ts`, `media/preview.html`): 패널 재생성 후 Inspector on/off 상태가 초기화되던 버그 수정. Webview 로딩 완료 시 `webviewReady` 메시지를 전송하고 저장된 상태를 복원.
- **`as boolean` 불필요한 타입 캐스트 제거** (`src/previewManager.ts`): `inspectorToggle` 핸들러에서 `typeof` 가드 전 `as boolean` 캐스트 제거. 런타임 타입 검증 의도를 명확히 표현.

### Changed

- **골든 파일 업데이트** (`test/golden/red-box.harness.cpp`): `CollectActorMetadata()` 변경 반영 — `#include <cmath>`, 제어문자 이스케이프, NaN/Inf 가드, color JSON 배열 포맷 포함.

---

## [0.11.0] - 2026-04-01 — Phase 3-1: @preview-config locale/fontScale/font 파라미터 지원 (DAL-15)

### Added

- **`@preview-config` locale 파라미터** (`src/codeExtractor.ts`, `src/buildRunner.ts`, `server/preview_server.cpp`): `locale=ko_KR` 형식 파싱. Phase 1 harness 실행 시 `LANG=ko_KR.UTF-8` 환경변수, Phase 2 서버 모드에서 `setenv("LANG", ...)` 적용.
- **`@preview-config` fontScale 파라미터** (`src/codeExtractor.ts`, `src/buildRunner.ts`): `fontScale=1.5` 형식 파싱. 유효 범위 0.5~2.0 강제. 하네스 실행 시 `DALI_FONT_SCALE` 환경변수 전달.
- **`@preview-config` font 파라미터** (`src/codeExtractor.ts`, `src/buildRunner.ts`, `server/preview_server.cpp`): `font=NotoSansKR.ttf` 형식 파싱. `FontClient::Get().AddCustomFontDirectory()` 호출 코드 삽입 (Phase 1: 하네스 템플릿, Phase 2: dlopen 전 DoReload에서 적용).
- **`PreviewConfig` 인터페이스 확장** (`src/previewConfig.ts`): `locale?: string`, `fontScale?: number`, `font?: string` 필드 추가.
- **IPC RELOAD 프로토콜 확장** (`src/previewServer.ts`, `server/preview_server.cpp`): 11-필드 포맷 `RELOAD so png meta w h theme bgColor locale fontScale font`. 빈 필드는 `-` placeholder (하위 호환).
- **`{{FONT_SETUP}}` 플레이스홀더** (`server/preview_harness.cpp.template`): font 파라미터 지정 시 `AddCustomFontDirectory()` 코드 삽입, 미지정 시 빈 문자열 치환.
- **테스트 샘플** (`test/samples/multi-config-locale.preview.dali.cpp`): locale/fontScale/font 파라미터 조합 샘플 추가.

### Fixed (QA 리뷰)

- **FontClient 헤더 누락** (`server/preview_harness.cpp.template`): `{{FONT_SETUP}}` 치환 시 필요한 `#include <dali/devel-api/adaptor-framework/font-client.h>` 추가. 미추가 시 font 파라미터 지정 시 컴파일 오류 발생.
- **FontClient 호출 타이밍 오류** (`server/preview_harness.cpp.template`): `{{FONT_SETUP}}` 위치를 `main()` 상단(Application 초기화 전)에서 `OnInit()` 내부(Adaptor 초기화 후)로 이동. DALi FontClient singleton은 Adaptor 초기화 후에만 유효.
- **DALI_FONT_SCALE setenv 누락** (`server/preview_server.cpp`): Phase 2 서버 모드(dlopen) `DoReload()`에서 `fontScale` 필드를 파싱했으나 `setenv("DALI_FONT_SCALE", ...)` 호출이 빠져 있던 버그 수정. Phase 1 harness와 동작 일관성 확보.
- **IPC font 필드 프로토콜 불일치** (`src/extension.ts`, `server/preview_server.cpp`): 서버 모드에서 `font` 파일명 그대로 전송 → `rfind('/')` 시 `"."` 폴백으로 `AddCustomFontDirectory(".")` 호출되던 문제 수정. TypeScript 측(`runMultiPreview`)에서 `daliPreview.fontDirectories` 설정을 조회해 폰트 파일이 존재하는 절대 경로를 IPC에 전달하도록 변경. C++ 서버는 해당 경로를 바로 `AddCustomFontDirectory()`에 사용.
- **fontDir C++ 문자열 리터럴 인젝션** (`src/buildRunner.ts`): `fontDir`을 `FontClient::Get().AddCustomFontDirectory("${fontDir}")` 로 삽입할 때 `"` 및 `\` 미이스케이프 문제 수정. `fontDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"')` 처리 추가.
- **locale 정규식 숫자/하이픈 불허** (`src/codeExtractor.ts`): `[a-zA-Z_]+` → `[a-zA-Z][a-zA-Z0-9_\-]+`로 확장. BCP 47 하이픈 형식(`zh-Hans`) 및 숫자 포함 locale 지원.
- **IPC locale/font 공백 인젝션 방어** (`src/previewServer.ts`): 기존 whitespace guard가 soPath/pngPath/metadataPath만 검사했으나 locale/font 필드도 포함하도록 확장.

### Tests (QA 리뷰 추가)

- **파서 단위 테스트 8건 추가** (`test/unit/codeExtractor.test.ts`): locale 파싱, fontScale 범위 내 파싱, fontScale 범위 초과(0.1/3.0) 무시, font 파싱, fontScale+font 동시 파싱, 전체 파라미터 조합, 기존 파라미터 하위 호환 검증.
- **fontScale 경계값 테스트 4건 추가** (`test/unit/codeExtractor.test.ts`): 하한 경계(0.5) 허용, 상한 경계(2.0) 허용, 하한 직하(0.49) 거부, 상한 직상(2.01) 거부.
- **buildRunner fontSetup 테스트 3건 추가** (`test/unit/buildRunner.test.ts`): font 파일 발견 시 `AddCustomFontDirectory()` 삽입 검증, font 미지정 시 snippet 없음 검증, fontDir 내 `"` 이스케이프 처리 검증.
- **IPC 테스트 3건 업데이트 + 3건 추가** (`test/unit/previewServer.test.ts`): 11-필드 포맷 검증, bgColor placeholder 동작 검증, locale/fontScale/font 위치 검증, omit 시 `-` placeholder 검증.
- **preview_server.cpp 구조 테스트 3건 추가** (`test/unit/previewServer.test.ts`): setenv LANG, setenv DALI_FONT_SCALE, AddCustomFontDirectory 코드 존재 검증.
- **harness 템플릿 테스트 업데이트** (`test/unit/harnessGeneration.test.ts`): `{{FONT_SETUP}}` placeholder 존재 및 치환 검증. golden 파일 업데이트.

## [0.10.0] - 2026-04-01 — 버그 수정: 컬러 팔레트 배경색 렌더링 파이프라인 연결 (DAL-13)

### Fixed

- **배경색 미적용 버그** (`src/buildRunner.ts`, `src/previewServer.ts`, `src/extension.ts`, `server/preview_server.cpp`): 컬러 팔레트에서 선택한 배경색이 웹뷰 HTML 컨테이너에만 적용되고 실제 DALi 렌더링 PNG에는 반영되지 않던 구조적 결함 수정. `#RRGGBB` 색상을 전체 빌드 파이프라인(Phase 1 harness compile / Phase 2 dlopen RELOAD / multi-preview)에 전달.
- **색상 변경 시 리빌드 미트리거** (`src/extension.ts`): `onBackgroundChange` 콜백에서 색상 저장 후 300ms 디바운스 후 `runPreview()` 호출. 컬러 피커 드래그 시 과다 빌드(g++ 과부하) 방지. Ctrl+S 없이도 팔레트 선택 후 즉시 렌더링 반영.
- **테마 전환 시 커스텀 색상 잔류** (`src/extension.ts`): 다크↔라이트 테마 전환 시 `currentBgColor` 초기화 추가. 커맨드 팔레트 토글과 웹뷰 토글 버튼 모두 처리.
- **`hexToVector4()` 유효하지 않은 입력 시 NaN 주입** (`src/buildRunner.ts`): `#RRGGBB` 형식이 아닌 입력(빈 문자열, 접두사 없음, 길이 오류, 비16진 문자)에 대해 다크 테마 폴백 반환. 잘못된 입력이 C++ 하네스에 `NaN` 리터럴로 삽입되어 컴파일 오류를 유발하던 문제 차단.
- **`HexToColor()` 비정상 입력 시 서버 프로세스 크래시** (`server/preview_server.cpp`): `stoul()` 호출을 `try/catch(...)` 블록으로 감싸 유효하지 않은 16진 문자(예: `#GG0000`)로 인한 `std::invalid_argument` 예외가 Preview Server 프로세스를 종료하던 문제 수정. 파싱 실패 시 다크 테마 폴백 색상 반환.

### Added

- **`BuildRunner.hexToVector4()`** (`src/buildRunner.ts`): `#RRGGBB` 16진 색상 → DALi `Vector4` 리터럴 변환 static 메서드 추가.
- **`HexToColor()`** (`server/preview_server.cpp`): C++ 서버에서 `#RRGGBB` 문자열을 `Vector4`로 변환하는 static 헬퍼 추가.
- **RELOAD 프로토콜 옵셔널 색상 필드** (`src/previewServer.ts`, `server/preview_server.cpp`): `RELOAD` IPC 명령에 8번째 옵셔널 `#RRGGBB` 필드 추가. 미전송 시 기존 테마 색상 폴백 유지 (하위 호환).

### Tests

- **`BuildRunner.hexToVector4()` 단위 테스트 11건** (`test/unit/buildRunner.test.ts`): 유효한 색상(red/black/white/uppercase/mid-range) 5건 + 유효하지 않은 입력(빈 문자열, 접두사 없음, 너무 짧음, 너무 긺, 비16진 문자) 6건 — 폴백 동작 검증 포함.
- **`PreviewServer.reload()` bgColor 파라미터 테스트 3건** (`test/unit/previewServer.test.ts`): 유효한 bgColor 포함 시 RELOAD 명령에 색상 필드 추가 확인, 유효하지 않은 hex 및 undefined 시 필드 생략 확인.
- **`preview_server.cpp` HexToColor 구조 테스트 3건** (`test/unit/previewServer.test.ts`): `HexToColor` 함수 존재, bgColor 토큰 파싱, stoul try/catch 존재 검증.

## [0.9.0] - 2026-03-31 — Phase 2-4 UX: 다크/라이트 모드 전환 발견가능성 개선

### Added

- **테마 전환 상태 바 버튼** (`src/statusBar.ts`): `ThemeStatusBarItem` 클래스 추가. 상태 바 오른쪽 Secondary zone에 `$(moon)` / `$(sun)` 아이콘으로 현재 테마 표시. 클릭 시 즉시 라이트 ↔ 다크 전환. 현재 테마 상태 툴팁으로 표시.
- **커맨드 팔레트 명령** (`package.json`, `src/extension.ts`): `DALi Preview: Toggle Theme` 명령 등록. 커맨드 팔레트에서 "DALi Preview: Toggle Theme"으로 접근 가능.
- **High Contrast 테마 CSS** (`media/preview.html`): `body.vscode-high-contrast` / `body.vscode-high-contrast-light` CSS 규칙 추가. VS Code 고대비 테마 사용 시 툴바, 버튼, 텍스트가 올바르게 표시.

### Changed

- **테마 상태 바 동기화** (`src/extension.ts`): 웹뷰 내 테마 버튼 클릭과 커맨드 팔레트 명령 모두 `themeStatusBar`를 동기화하여 일관된 상태 표시.
- **`package.json` 버전**: `0.8.0` → `0.9.0`.

## [0.8.0] - 2026-03-31 — Phase 2-2 UX: 실시간 프리뷰 사용성 개선

### Added

- **마지막 성공 이미지 유지** (`media/preview.html`): 빌드 에러 발생 시 이전 성공 스크린샷을 지우지 않고 이미지 위에 상단 배너만 표시.
- **에러 배너 CSS** (`media/preview.html`): `.overlay-error`를 전체 커버에서 상단 고정 배너로 변경. 불투명 빨간 배경(`rgba(200,30,30,0.95)`), `max-height: 40%`, 스크롤 가능.
- **`clearError` 메시지 핸들러** (`media/preview.html`): `clearError` 명령 수신 시 에러 배너만 숨기고 나머지 상태 유지.
- **`clearError()` 메서드** (`src/previewManager.ts`): Extension에서 Webview로 `clearError` 명령을 전달하는 메서드 추가.
- **에러 표시 500ms debounce** (`src/extension.ts`): `scheduleShowError()` / `cancelErrorDebounce()` 헬퍼 함수 추가. 빌드 실패 후 500ms 이상 지속될 때만 에러 배너 표시하여 타이핑 중 깜빡임 방지.
- **포커스 보호** (`src/previewManager.ts`, `src/extension.ts`): `show(preserveFocus = false)` 파라미터 추가. 자동 트리거(save, text change, file open)에서 `show(true)` 호출로 에디터 포커스 이탈 방지. 사용자가 명시적으로 `DALi: Open Preview` 커맨드를 실행할 때만 포커스 이동.

### Changed

- `PreviewManager.show()` 시그니처: `show()` → `show(preserveFocus = false)`. `panel.reveal()` 및 `createWebviewPanel`에 `preserveFocus` 전달.
- 빌드 성공 시 `cancelErrorDebounce()` 호출로 대기 중인 에러 타이머 취소 + 에러 배너 즉시 제거.

## [0.7.0] - 2026-03-31 — Phase 2-5: 배경색 컬러 피커

### Added

- **컬러 피커 버튼** (`media/preview.html`): 툴바에 현재 배경색을 표시하는 색상 사각형 버튼 추가. 클릭 시 팝업 패널 열림.
- **컬러 피커 팝업** (`media/preview.html`): 세 가지 입력 방식 지원.
  - 네이티브 `<input type="color">` (브라우저 색상 휠)
  - HEX 텍스트 입력 (`#rrggbb` 포맷) — 유효성 검사 포함, blur 시 이전 값으로 복원
  - R / G / B 개별 숫자 입력 (0–255)
  - 세 입력 간 양방향 동기화
  - "기본값으로 초기화" 버튼 — 기본 배경색 `#1a1a2e`로 복원
- **배경색 즉시 반영**: 색상 변경 시 `previewContainer.style.background`에 즉시 적용.
- **`changeBackground` 메시지**: 색상 변경 시 Webview → Extension으로 선택된 HEX 값 전송.
- **`setBackgroundColor(color)` 메서드** (`src/previewManager.ts`): Extension이 Webview에 현재 배경색을 동기화하는 postMessage API.
- **`onBackgroundChange` 콜백** (`src/previewManager.ts`): Webview에서 수신한 `changeBackground` 명령을 Extension 쪽에서 구독하는 콜백 시스템.
- **`currentBgColor` 상태 + `workspaceState` 저장** (`src/extension.ts`): 선택된 배경색을 `daliPreview.backgroundColor` 키로 workspaceState에 자동 저장/복원.
- **신규 단위 테스트 5개** (`test/unit/previewManager.test.ts`):
  - `setBackgroundColor()` postMessage 전송 검증
  - `onBackgroundChange()` 콜백 호출 검증 (단일/다중/dispose 후/color 없음 케이스)
- **vscode 테스트 목 보강** (`test/helpers/setup.ts`): `ViewColumn`, `Disposable`, `createWebviewPanel` 추가.

### Changed

- 기존 다크/라이트 테마 토글 동작에 영향 없음 — 컬러 피커는 HTML 영역 배경색만 제어.

## [0.6.0] - 2026-03-31 — Phase 2-4: 다크/라이트 모드 전환

### Added

- **테마 토글 버튼** (`media/preview.html`): 툴바에 🌙/☀️ 버튼 추가. 클릭 시 `toggleTheme` 메시지를 Extension으로 전송하고 버튼 아이콘이 즉시 전환됨.
- **`setTheme(theme)` 메서드** (`src/previewManager.ts`): Extension이 webview에 현재 테마 상태를 동기화하는 `setTheme` postMessage API.
- **`onThemeToggle` 콜백** (`src/previewManager.ts`): webview에서 수신한 `toggleTheme` 명령을 Extension 쪽에서 구독하는 콜백 시스템.
- **`currentTheme` 상태 + `workspaceState` 저장** (`src/extension.ts`): 마지막 선택 테마를 `daliPreview.theme` 키로 VS Code workspaceState에 자동 저장/복원.
- **빌드 파이프라인 theme 연결** (`src/extension.ts`): 단일 프리뷰와 멀티 프리뷰 모두 `currentTheme`을 buildAndRun/previewServer.reload에 전달. 멀티 프리뷰 시 `config.theme`이 설정되면 우선 적용.
- **`{{BACKGROUND_COLOR}}` 템플릿 플레이스홀더** (`server/preview_harness.cpp.template`): 하드코딩된 배경색을 치환 가능한 플레이스홀더로 교체.
- **`BuildRunner.themeToBackgroundColor()`** (`src/buildRunner.ts`): 테마 문자열을 DALi `Vector4` 색상 리터럴로 변환하는 정적 헬퍼. `buildAndRun()`에 `theme` 파라미터 추가.
- **서버 모드 theme 지원** (`server/preview_server.cpp`, `src/previewServer.ts`): RELOAD IPC 프로토콜에 옵셔널 7번째 인자 `theme`(`dark`|`light`) 추가. `ThemeToColor()` 정적 함수로 배경색 전환.
- **신규 단위 테스트 4개**:
  - `buildRunner.test.ts`: `themeToBackgroundColor('dark')`, `themeToBackgroundColor('light')` 검증 2개.
  - `harnessGeneration.test.ts`: dark/light 테마 배경색 치환 검증 2개. `{{BACKGROUND_COLOR}}` 플레이스홀더 존재 확인 추가.

### Changed

- `src/buildRunner.ts`: `buildAndRun()` 시그니처에 `theme: 'light' | 'dark' = 'dark'` 파라미터 추가 (기본값 dark, 하위 호환).
- `src/previewServer.ts`: `reload()` 시그니처에 `theme: 'light' | 'dark' = 'dark'` 파라미터 추가.
- `server/preview_harness.cpp.template`: 배경색 `Vector4(0.1f, 0.1f, 0.12f, 1.0f)` → `{{BACKGROUND_COLOR}}` 치환.

## [0.5.0] - 2026-03-31 — Phase 2-3: 멀티 프리뷰 (여러 해상도/테마 동시 표시)

### Added

- **`@preview-config` 주석 파싱** (`src/codeExtractor.ts`): `@dali-preview-begin` 블록 또는 `.preview.dali.cpp` 파일 상단에 `// @preview-config: name="...", width=N, height=N, theme=light|dark` 주석을 선언하면 여러 설정을 동시에 프리뷰할 수 있음.
- **`PreviewConfig` / `MultiPreviewResult` 타입** (`src/previewConfig.ts`): 멀티 프리뷰 설정 및 빌드 결과를 담는 공유 인터페이스 파일.
- **config별 독립 `.so` 생성** (`src/buildRunner.ts`): `compilePlugin(userCode, configName?)` — configName 제공 시 `preview_plugin_{sanitized_name}.so`로 명명. 정적 메서드 `sanitizeConfigName()` 추가.
- **`updateMultiImage(results)` 메서드** (`src/previewManager.ts`): `MultiPreviewResult[]`를 받아 webview에 `updateMultiImage` 메시지 전송. 각 결과에서 PNG URI와 metadata JSON을 로드하여 포함.
- **그리드 레이아웃** (`media/preview.html`): `updateMultiImage` 메시지 수신 시 auto-fit 그리드로 여러 PNG를 동시에 표시. config 이름·해상도 라벨 및 실패 시 에러 메시지 표시. 각 프리뷰 아이템에 click-to-code 오버레이 독립 적용.
- **멀티 config 오케스트레이션** (`src/extension.ts`): `extraction.configs`가 있으면 `runMultiPreview()` 경로로 분기. configs가 없으면 기존 단일 프리뷰 동작 유지 (하위 호환). Phase 2 서버 모드와 Phase 1 폴백 모두 지원.
- **신규 단위 테스트 22개**:
  - `codeExtractor.test.ts`: `@preview-config` 단일/복수 파싱, name/width/height/theme 추출, 코드 제외, 하위 호환, `.preview.dali.cpp` 파싱, malformed 무시, optional 필드 등 7개.
  - `buildRunner.test.ts`: config별 `.so` 파일명, 기본 파일명, `sanitizeConfigName()` 동작 5종 (소문자, 공백, 특수문자, 연속 구분자, 앞뒤 제거) 등 7개.
- **샘플 파일** (`test/samples/`): `multi-config.preview.dali.cpp`, `multi-config-marker.cpp` 추가.

### Changed

- `src/codeExtractor.ts`: `ExtractionResult`에 `configs?: PreviewConfig[]` 필드 추가 (optional, 하위 호환).
- `media/preview.html`: 단일 이미지 업데이트 시 그리드 영역을 숨기고 previewArea를 표시하도록 보강.

## [0.4.0] - 2026-03-31 — Phase 2-2: 실시간 프리뷰 (debounce)

### Added

- **실시간 프리뷰** (`extension.ts`): `onDidChangeTextDocument` 이벤트에 debounce 300ms를 적용해 파일 저장 없이 타이핑 중 자동으로 프리뷰가 갱신됨.
- **`LivePreviewDebouncer<T>`** (`src/livePreviewDebouncer.ts`): 제네릭 debounce 스케줄러 클래스. `schedule()`, `cancel()`, `dispose()`, `setDebounceMs()` API 제공.
- **빌드 generation 카운터** (`extension.ts`): 진행 중인 빌드보다 최신 요청이 있을 때 오래된 결과를 자동 폐기(soft cancel).
- **pending rebuild 큐** (`extension.ts`): 빌드 진행 중 새 트리거 수신 시 최신 doc을 큐에 저장해 빌드 완료 후 즉시 재실행.
- **새 VS Code 설정 항목**:
  - `daliPreview.livePreview` (boolean, 기본 `true`): 실시간 프리뷰 on/off 토글.
  - `daliPreview.livePreviewDebounce` (number, 기본 `300`, 100–5000): debounce 간격(ms) 설정.
- **`test/unit/livePreviewDebouncer.test.ts`**: `LivePreviewDebouncer` 단위 테스트 9개 — debounce 동작, 취소, `isPending` 상태, `setDebounceMs`, dispose 검증.

### Changed

- `extension.ts`: `runPreview()` 함수에 `livePreview: boolean` 파라미터 추가. live preview 빌드는 로딩 오버레이 없이 마지막 성공 이미지를 유지하며 갱신.
- `extension.ts`: `deactivate()` 시 `liveDebouncer?.dispose()` 호출 추가.

## [0.3.0] - 2026-03-31 — Phase 2-1: dlopen 상주 서버

### Added

- **dlopen 상주 서버** (`server/preview_server.cpp`): DALi Application을 1회 초기화 후 stdin RELOAD 명령을 폴링하는 C++ 바이너리. 매 프리뷰마다 전체 하네스를 재컴파일/재실행하지 않아 갱신 속도가 대폭 향상됨.
- **플러그인 템플릿** (`server/preview_plugin.cpp.template`): 유저 코드만 `.so`로 컴파일하는 경량 템플릿. `extern "C" CreatePreview()` 심볼 export.
- **서버 빌드 스크립트** (`server/build_server.sh`): 서버 바이너리를 1회 컴파일하는 셸 스크립트. `-ldl` 링킹 포함.
- **`PreviewServer` TypeScript 클래스** (`src/previewServer.ts`): 서버 프로세스 라이프사이클 관리, stdin/stdout IPC, 자동 재시작(최대 3회), Phase 1 fallback 지원.
- **`BuildRunner.compilePlugin()`** (`src/buildRunner.ts`): 유저 코드를 `-shared -fPIC`으로 컴파일해 `.so`를 생성하는 메서드.
- **`getPluginCodeOffset()`** (`src/errorParser.ts`): 플러그인 템플릿에서 `{{USER_CODE}}` 위치를 반환. 에러 라인 오프셋 매핑에 사용.
- **`StatusBarManager.showMode()`** (`src/statusBar.ts`): 서버 모드(⚡) / 컴파일 모드(🔨) 표시.
- **`test/unit/buildRunner.test.ts`**: `compilePlugin()` 단위 테스트 3개 신규 추가 (prefix 미탐지 시 실패, 템플릿 치환 검증, 컴파일 에러 반환).
- **`test/unit/statusBar.test.ts`**: `StatusBarManager.showMode()` 단위 테스트 2개 신규 추가.
- **PreviewServer IPC 행동 테스트** (`test/unit/previewServer.test.ts`): `_spawn` 주입 방식으로 8개 신규 — READY/OK:/ERROR: IPC 프로토콜, concurrent reload 방어, 서버 크래시 처리, MAX_RESTARTS 한계, READY_TIMEOUT, 경로 유효성 검사.

### Changed

- `extension.ts`: `runPreview()` 함수가 서버 가용 시 dlopen 경로를, 불가 시 기존 Phase 1 경로를 자동 선택.
- `errorParser.parseGccErrors()`: `isPlugin` 파라미터 추가 — `preview_plugin` 또는 `preview_harness` 파일 에러를 선택적으로 파싱.

### Fixed (QA 리뷰 C1–C8, H1–H6, M4–M5 반영)

- **C1** `server/preview_server.cpp`: `stof()` 호출을 try/catch로 감싸 malformed RELOAD 시 서버 크래시 방지.
- **C2** `server/preview_server.cpp`: `substr(7)` 전 `line.size() >= 6` 경계 검사 추가.
- **C3** `server/preview_server.cpp`: `mStdinBuf` 멤버 변수 + `ReadLine()` 라인 버퍼링 구현 — OS 버퍼 다중 줄 동시 도착 시 IPC 커맨드 유실 방지.
- **C4** `server/preview_server.cpp`: `dlerror()` 이중 호출 제거 — 첫 번째 호출 결과를 로컬 변수에 저장.
- **C5** `src/previewServer.ts`: `execSync()` → `util.promisify(exec)` + `await` — VS Code UI 스레드 블로킹(최대 60초) 제거.
- **C6** `src/previewServer.ts`: `PreviewServer` TypeScript 클래스 IPC 행동 테스트 신규 추가.
- **C7** `src/buildRunner.ts`: `compilePlugin()` 신규 메서드 단위 테스트 신규 추가.
- **C8** `src/statusBar.ts`: `StatusBarManager.showMode()` 단위 테스트 신규 추가.
- **H1** `src/previewServer.ts`: 동시 `reload()` 방어 — 기존 pending request를 에러로 먼저 resolve 후 새 요청 등록.
- **H2** `src/previewServer.ts`: RELOAD 경로 공백/개행 검사 추가 — IPC 커맨드 주입 방지.
- **H3** `src/previewServer.ts`: 재시작 타이머 핸들 `restartTimer` 저장 + `stop()`에서 `clearTimeout` — ghost process 방지.
- **H4** `src/previewServer.ts`: 프로세스 "error" 이벤트 핸들러에 `clearTimeout(readyTimer)` 추가.
- **H5** `src/previewServer.ts`: `pendingResolve` → `pendingRequest: { resolve, metadataPath }` — `.png` 치환 취약성 제거.
- **H6** `src/extension.ts`: `initPreviewServer()` unhandled rejection에 `.catch()` 추가.
- **M4** `src/previewServer.ts`: 재시작 `spawnServer()` 호출에 `.catch(() => {})` 추가.
- **M5** `test/unit/previewServer.test.ts`: `PLUGIN_OFFSET` 하드코딩 제거 → `getPluginCodeOffset()` 동적 파생.
- **vscode 모크** (`test/helpers/setup.ts`): `StatusBarAlignment` 및 `createStatusBarItem` 추가.

---

## [0.2.0] - 2026-03-30

### Added

- **Click-to-Code**: Click any UI element in the preview to jump to its source code line in the editor.
  - Code instrumentation via `__tag()` helper injects `Actor::Property::NAME` with source line numbers.
  - Scene graph metadata export (JSON) with bounding boxes for all actors.
  - Transparent bounding box overlay on the preview image with hover tooltips.
  - 2-second blue highlight on the corresponding source code line.
- Linker `-rpath-link` flag for resolving indirect dependencies (e.g., thorvg).

### Changed

- `BuildResult` interface now includes `metadataPath` for scene graph metadata.
- `updateImage` IPC message now carries optional `metadata` payload.
- Harness template updated with `__tag`, `CollectActorMetadata`, `ExportSceneMetadata` functions.
- Golden test file updated to match new harness template.

## [0.1.0] - 2026-03-25

### Added

- Live preview panel that renders DALi C++ code inside a VS Code webview on Ctrl+S.
- Support for `.preview.dali.cpp` dedicated preview files (file content is the function body, starts with `return`).
- Support for `@dali-preview-begin` / `@dali-preview-end` inline markers in regular `.cpp` files.
- Resizable preview canvas: resolution presets, manual dimension input, and drag-resize.
- Headless rendering via Xvfb -- no DALi window appears on screen.
- Optional ccache integration for sub-second recompilation.
- DALi auto-detection from environment variables and setenv files, plus first-run setup wizard.
- Smart error mapping: g++ errors are translated to user code line numbers with in-editor diagnostics.
- Status bar indicator showing build progress.
- Configurable DALi install prefix (`daliPreview.daliPrefix`) and canvas dimensions (`previewWidth`, `previewHeight`).
- 37 unit tests: codeExtractor (17), errorParser (13), harnessGeneration (7).
- CI/CD pipeline via GitHub Actions (`.github/workflows/ci.yml`) -- runs tests on push and PR.
- AI-Driven Development infrastructure: `claude.yml` workflow, `CLAUDE.md` project rules, issue templates (`feature.yml`, `bug.yml`).
- One-line installer script (`install.sh`).

[0.3.0]: https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.3.0
[0.2.0]: https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.2.0
[0.1.0]: https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.1.0
