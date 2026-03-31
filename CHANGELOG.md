# Changelog

All notable changes to the **DALi UI Preview** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — Phase 2-1: dlopen 상주 서버

### Added

- **dlopen 상주 서버** (`server/preview_server.cpp`): DALi Application을 1회 초기화 후 stdin RELOAD 명령을 폴링하는 C++ 바이너리. 매 프리뷰마다 전체 하네스를 재컴파일/재실행하지 않아 갱신 속도가 대폭 향상됨.
- **플러그인 템플릿** (`server/preview_plugin.cpp.template`): 유저 코드만 `.so`로 컴파일하는 경량 템플릿. `extern "C" CreatePreview()` 심볼 export.
- **서버 빌드 스크립트** (`server/build_server.sh`): 서버 바이너리를 1회 컴파일하는 셸 스크립트. `-ldl` 링킹 포함.
- **`PreviewServer` TypeScript 클래스** (`src/previewServer.ts`): 서버 프로세스 라이프사이클 관리, stdin/stdout IPC, 자동 재시작(최대 3회), Phase 1 fallback 지원.
- **`BuildRunner.compilePlugin()`** (`src/buildRunner.ts`): 유저 코드를 `-shared -fPIC`으로 컴파일해 `.so`를 생성하는 메서드.
- **`getPluginCodeOffset()`** (`src/errorParser.ts`): 플러그인 템플릿에서 `{{USER_CODE}}` 위치를 반환. 에러 라인 오프셋 매핑에 사용.
- **`StatusBarManager.showMode()`** (`src/statusBar.ts`): 서버 모드(⚡) / 컴파일 모드(🔨) 표시.
- **23개 신규 단위 테스트** (`test/unit/previewServer.test.ts`): 플러그인 템플릿 구조, 오프셋 계산, 플러그인 모드 에러 파싱, 빌드 스크립트, C++ 서버 파일 검증.

### Changed

- `extension.ts`: `runPreview()` 함수가 서버 가용 시 dlopen 경로를, 불가 시 기존 Phase 1 경로를 자동 선택.
- `errorParser.parseGccErrors()`: `isPlugin` 파라미터 추가 — `preview_plugin` 또는 `preview_harness` 파일 에러를 선택적으로 파싱.

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

[0.2.0]: https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.2.0
[0.1.0]: https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.1.0
