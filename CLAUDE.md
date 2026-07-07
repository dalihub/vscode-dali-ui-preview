# CLAUDE.md - Project Rules for AI Agents

## Project Overview

DALi Preview is a VS Code extension that provides live UI preview for Tizen DALi (Dynamic Animation Library) applications. Developers write C++ UI code using the DALi framework, and this extension renders a real-time preview directly inside VS Code.

The extension extracts preview code from C++ source files, compiles it with a lightweight C++ harness, runs the resulting binary under Xvfb (virtual framebuffer), and captures a screenshot to display in a VS Code webview panel.

## Tech Stack

- **Extension**: TypeScript, VS Code Extension API (vscode ^1.85.0)
- **Harness / Runtime**: C++ (DALi Toolkit), compiled with pkg-config and g++
- **Display**: Xvfb (headless X11) for off-screen rendering
- **Package manager**: npm
- **Build tool**: TypeScript compiler (`tsc`)
- **Packaging**: vsce

## Build & Test Commands

```bash
npm run compile       # Compile TypeScript to JavaScript (out/)
npm test              # Run full test suite (if configured)
npm run test:unit     # Run unit tests only (if configured)
npm run watch         # Incremental compile on file changes
npm run package       # Package as .vsix with vsce
```

## Code Style

- TypeScript strict mode enabled (`tsconfig.json`)
- Use `async/await` for all asynchronous operations; avoid raw `.then()` chains
- Log errors and diagnostics to `outputChannel` (the VS Code output panel), never to `console.log` in production paths
- Use single quotes for strings
- Prefer `const` over `let`; never use `var`

## Architecture (src/)

| File | Purpose |
|---|---|
| `extension.ts` | Extension entry point; registers commands, wires components together |
| `previewManager.ts` | Manages the webview panel lifecycle, triggers build & screenshot capture |
| `codeExtractor.ts` | Extracts preview code from `.preview.dali.cpp` files or `@dali-preview-begin`/`@dali-preview-end` markers in regular C++ files |
| `buildRunner.ts` | Compiles extracted C++ code with the DALi harness using g++ and pkg-config |
| `errorParser.ts` | Parses g++ compiler errors and maps them back to the original source lines |
| `daliEnvironment.ts` | Detects and validates the DALi SDK installation (prefix path, pkg-config) |
| `setupWizard.ts` | Guided first-run setup to configure the DALi environment |
| `statusBar.ts` | Manages the VS Code status bar item showing preview state |
| `xvfbManager.ts` | Starts/stops Xvfb and manages the virtual display for headless rendering |

## Preview Code Extraction Modes

1. **Preview file mode**: Files named `*.preview.dali.cpp` are treated as pure preview code (entire file content is used).
2. **Marker mode**: Regular `.cpp` or `.h` files use comment markers to delimit the preview region:
   ```cpp
   // @dali-preview-begin
   FlexLayout root = FlexLayout::New();
   root.AddChildren({ /* ... */ });
   return root;
   // @dali-preview-end
   ```

> **dali-ui API note:** dali-ui removed the fluent chaining API (2026-06). Builder
> setters (`SetBackgroundColor`, `SetFontSize`, `SetDirection`, …) now return `void`,
> and `View::Children(...)` was renamed to `View::AddChildren(...)`. Preview code is
> non-fluent: declare a named local, call setters as separate statements, add children
> via `AddChildren`, then `return` the root. The runtime is built from dali-ui
> `v2.5.28.10837` (see `docker/Dockerfile.runtime`).
>
> **dali-ui v2.5.28 focus-API change (2026-07):** `UiConfig::SetAlwaysShowFocus(bool)`
> was removed; the focus indicator is now device-driven. The harness/CLI codegen was
> migrated: `UiConfig::SetDefaultFocusIndicatorEnabled(true)` (global enable) plus, in
> the `{{POST_BUILD_FOCUS}}` slot, forcing the target's `ViewState::FOCUS_INDICATED`
> via **integration-api** (`Dali::Ui::Integration::View::SetState`, `<dali-ui-foundation/
> integration-api/view-integ.h>`) — a plain programmatic `SetCurrentFocusView` no
> longer draws a ring in a static render (verified: focus child count 0→1 only after
> the state+re-enable sequence). The header reorg in the same release (headers moved
> under `views/`, `types/`, `configuration/`, …) is absorbed by the umbrella header.
>
> **Stale-runtime symptom (read this before "fixing" the code):** a preview error
> like `'class Dali::Ui::FlexLayout' has no member named 'AddChildren'; did you mean
> 'Children'?` — OR `'class Dali::Ui::UiConfig' has no member named
> 'SetDefaultFocusIndicatorEnabled'` / `'SetAlwaysShowFocus'` — does **not** mean the
> code is wrong — it means the **runtime is out of sync with the code** (usually the
> runtime is older, predating the `Children→AddChildren` rename or the v2.5.28 focus
> API). The fix depends on `daliPreview.runtimeMode`, and BOTH must be checked — they
> fail identically:
> - **docker** → refresh the image: re-pull the CONFIGURED image:tag (the "Update DALi
>   Runtime" command does this). The image name auto-detects — inside Samsung it is the
>   BART GHCR proxy `ghcr-docker-remote.bart.sec.samsung.net/lwc0917/dali-preview-runtime`,
>   externally `ghcr.io/lwc0917/dali-preview-runtime` (same repo path, `src/registry.ts`).
>   e.g. `docker pull ghcr-docker-remote.bart.sec.samsung.net/lwc0917/dali-preview-runtime:latest`
>   (or `ghcr.io/...` off-network; or `:dali_2.5.28`). NOT by reverting samples.
> - **local** → the **native DALi prefix** (`daliPreview.daliPrefix`) predates the code;
>   rebuild that prefix, or switch `runtimeMode` to `docker`.
>
> Self-diagnosis: `errorParser.detectRuntimeApiSkew` appends an actionable hint to the
> error panel. ⚠️ g++ quotes identifiers with **Unicode curly quotes** (U+2018/U+2019),
> not ASCII — the detector regex MUST accept both (an ASCII-only regex silently never
> fires on real output; tests must use real curly-quote fixtures). Verify previews in
> your actual mode with `npm run verify:previews` (native) / `verify:previews:docker`,
> which compile every `*.preview.dali.cpp` — the golden runners only cover
> `test/samples/` in docker, so a stale **native** prefix went unverified once.
> (The `parser`/`renderJson` path is insulated from the rename — it speaks a JSON
> scene the in-runtime server translates — so only the g++ **compile** paths skew.)
>
> **Image assets:** `ImageView::New("…")` / `SetResourceUrl("…")` local-file URLs are
> staged into the build mount by `BuildRunner.stageImageAssets` (called in
> `previewOrchestrator.prepareSlice`) — use a path **relative to the preview file**
> (e.g. `assets/foo.jpg`); it is copied into the container and the URL rewritten to
> `/work/<name>`. Sample image paths must resolve on disk (guarded by
> `sampleAssets.test.ts`). Remote/unresolvable URLs fall back to the broken-image
> placeholder.

> **Golden tests:** the e2e golden runner (`test/e2e/`) re-implements extraction +
> harness codegen because it can't import the `vscode`-dependent `codeExtractor`/
> `buildRunner` — when you change those, mirror the change in the runner or it silently
> drifts. Golden renders run through the **local Docker runtime** (a `.githooks/pre-push`
> hook runs `test:e2e` on push); github-hosted CI can't render complex DALi scenes, so
> `golden-test.yml` is on-demand only.

> **Click-to-code metadata coordinates:** the webview overlays each actor's exported
> screen rect on the PNG, so those rects MUST be true screen coordinates. Compute them
> with `Actor::CalculateScreenExtents()` (dali-core public-api) — NOT hand-rolled
> `PARENT_ORIGIN/PIVOT` math, which dali-ui v2.5.28 broke by changing the default actor
> coordinate convention (render stayed correct, regions went off-screen; pixel goldens
> can't see it). Both exporters must match: `docker/preview_server.cpp` (server/parser
> fast path — **baked into the runtime image, so a change needs an image rebuild**) and
> `server/preview_harness.cpp.template` (full-build path — compiled fresh, no rebuild).
> `test/e2e/metadataCheck.ts` (`checkMetadataOnScreen`) guards this in both e2e runners:
> any drawn actor at a negative / off-left-top screen position fails the suite.

## Testing Requirements

**MANDATORY**: All of the following must pass before any PR is merged:

1. `npm run compile` must succeed with zero errors
2. All existing tests must pass — never skip or delete a passing test
3. New features **must** include corresponding tests
4. Test sample files live in `test/samples/`

## PR Guidelines

- Link every PR to its corresponding GitHub issue
- Test with all sample files in `test/samples/`
- Update `CHANGELOG.md` with a summary of changes
- Keep commits focused: one logical change per commit

## Key File Locations

- Extension manifest: `package.json`
- TypeScript config: `tsconfig.json`
- Compiled output: `out/`
- C++ harness / server: `server/`
- Test samples: `test/samples/`
- Extension icon: `images/icon.png`
- Changelog: `CHANGELOG.md`
