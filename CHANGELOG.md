# Changelog

All notable changes to the **DALi UI Preview** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
