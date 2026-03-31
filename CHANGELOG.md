# Changelog

All notable changes to the **DALi UI Preview** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.2.0
[0.1.0]: https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.1.0
