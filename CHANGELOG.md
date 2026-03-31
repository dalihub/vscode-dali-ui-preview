# Changelog

All notable changes to the **DALi UI Preview** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — Phase 2-2: 실시간 프리뷰 (debounce)

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
