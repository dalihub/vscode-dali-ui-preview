# M0 spec — 서버-path 렌더 검증 인프라 + 스파이크

> Goal: 서버 scene-builder(`SBBuildNode`) 경로를 **실제 렌더로 골든 검증**하는 e2e(`npm run test:e2e:server`)를 신설한다. 기존 `npm run test:e2e`(harness 템플릿, 전체 컴파일)는 서버 경로를 전혀 안 거치므로(fact 1), M1 서버 충실도 수정을 증명할 게이트가 없다 — 이걸 만든다. + config/focus 스파이크 2개로 M2/M3 API를 확정.

## 검증된 사전조건 (오케스트레이터 정찰)
- native prefix `/home/woochan/tizen/generativeUI/dali-env/opt` 에 `dali2-core/adaptor/ui-foundation/ui-components` pkg-config(v2.0.0) 전부 존재.
- `g++ -std=c++17 -fsyntax-only docker/preview_server.cpp` (native prefix cflags) **통과** → 서버가 로컬 컴파일 가능.
- `PreviewServer`(src/previewServer.ts)는 **이미 local 모드 지원**: `compileServer`가 `g++ -std=c++17 -O2 $(pkg-config --cflags/--libs DALI_PKG_MODULES)`로 preview_server.cpp 컴파일 후 spawn(:48 `spawnServer`). docker 인자 없으면 local.
- 서버 IPC: stdin 라인 프로토콜 `RENDER_JSON <json_path> <png_path> <metadata_path> <width> <height> [theme] [bgColor]`(preview_server.cpp:692). `previewServer.renderJson`(:216)이 tree를 JSON 파일로 써서 전송.
- 재사용: `cppParser.parseChainExpression`(scene tree 생성), `previewServer.renderJson`(local 모드), `test/e2e/imageComparator.ts`(골든 비교), `test/golden/` 패턴.

## Out of scope
- 어떤 서버 충실도 *수정*도 안 함(M1). config/focus/cross-file 기능 구현 없음(스파이크는 read/probe만). 새 webview UI 없음. docker 경로 변경 없음.

## Work units

### WU-M0.1 — 서버-path 골든 러너 + green 베이스라인 (F0.1 + F0.2)
- **Files**: NEW `test/e2e/serverGoldenRunner.ts`; `package.json`(스크립트 `test:e2e:server` 추가); NEW `test/samples/server-path/baseline-flex.preview.dali.cpp`; NEW 골든 `test/golden/server-screenshots/baseline-flex.png`. 재사용: `src/previewServer.ts`, `src/cppParser.ts`, `test/e2e/imageComparator.ts`.
- **동작**: `test/samples/server-path/*.preview.dali.cpp` 각각에 대해 → `parseChainExpression`로 scene tree → `PreviewServer`(local, native prefix) 띄워 `renderJson(tree)` → PNG → `test/golden/server-screenshots/<name>.png`와 `imageComparator` 비교. `UPDATE_GOLDENS=1`면 골든 갱신.
- **baseline-flex**: 서버가 *이미 올바르게* 그리는 단일식(예: `FlexLayout::New().SetDirection(COLUMN).SetBackgroundColor(UiColor(0x1b2330)).Children({ Label::New("Server Path OK").SetTextColor(UiColor(0xffffff)).SetFontSize(40) })`). → green baseline.
- **Acceptance (사용자 관점)**: `npm run test:e2e:server`를 돌리면 서버 경로로 렌더된 baseline-flex 1장이 골든과 비교되어 **PASS**가 보인다(러너가 실제로 `SBBuildNode`를 거쳤음).
- **Tier 1**. **Assertion**: `npm run compile && UPDATE_GOLDENS=1 xvfb-run -a node out/test/e2e/serverGoldenRunner.js`(최초 베이스라인 생성) 후 `xvfb-run -a node out/test/e2e/serverGoldenRunner.js` → exit 0 且 stdout에 `baseline-flex` + `PASS`(또는 `✓`). 30s 내.
- **✋**: no (픽셀 골든 자동).
- **Pre-conditions**: native prefix 존재.

### WU-M0.2 — cornerRadius characterization 샘플 (F0.3)
- **Files**: NEW `test/samples/server-path/corner-radius.preview.dali.cpp`(예: `View::New().SetCornerRadius(48.0f).SetBackgroundColor(UiColor(0x00d4a8)).SetRequestedWidth(300).SetRequestedHeight(300)`); 골든 `test/golden/server-screenshots/corner-radius.png`.
- **동작**: M0 시점엔 서버가 `SetCornerRadius`를 무시 → **각진(square) 사각형**이 그려진다. 그 현재 상태를 골든으로 박는다(= characterization baseline). M1/F1.1이 서버에 `SetCornerRadius`를 넣으면 둥근 모서리가 되어 이 골든과 diff(RED) → 골든 갱신(GREEN)으로 실패→통과 데모가 성립.
- **Acceptance**: corner-radius 샘플이 러너로 렌더되고 베이스라인 골든이 존재한다(현재는 각짐 — M1이 둥글게 바꿀 대상). 골든 옆 README/주석에 "square on purpose; M1 makes round" 명시.
- **Tier 1**. **Assertion**: `UPDATE_GOLDENS=1 xvfb-run -a node out/test/e2e/serverGoldenRunner.js` 후 재실행 → `corner-radius` PASS(자기 자신 골든과 일치). + `git show`로 골든 PNG가 추가됐는지.
- **✋**: yes — 사람이 corner-radius.png가 **각져 있음**을 1회 눈으로 확인(M1 red→green의 기준점이 맞는지). (URL/클릭 대신 "이미지 파일 열어 각진 모서리 확인".)
- **Pre-conditions**: WU-M0.1 green.

### WU-M0.3 — 스파이크: config-override 멱등성 + focus-ring 가용성 (F0.4 + F0.5)
- **Files**: NEW `docs/autoplan/m0/spike-findings.md`. (코드 변경 없음 — read 헤더 + 작은 컴파일 probe만.)
- **F0.4 probe**: native prefix 헤더에서 `UiColorManager::SetColorOverride`(ui-color-manager.h:254), `UiScaleManager::SetScale`(ui-scale-manager.h:124), `UiConfig::SetScalingFactor`(ui-config.h:177)의 시그니처/제약 확인 + 작은 `-fsyntax-only` 스니펫으로 "런타임 호출 가능 / Apply-후-frozen" 여부 판정. 결론: fontScale 경로(M3/F3.1)를 `SetScale`(warm-server OK) vs `SetScalingFactor`(harness fallback) 중 무엇으로 갈지.
- **F0.5 probe**: `UiConfig::SetAlwaysShowFocus`(ui-config.h:372) + preview 바이너리(harness/plugin 템플릿·preview_server.cpp)에서 현재 포커스 하이라이트가 켜져 있는지 grep. 결론: M2/F2.5가 `SetAlwaysShowFocus(true)`를 어디에 넣어야 링이 보이는지.
- **Acceptance**: `spike-findings.md`에 F0.4·F0.5 각각 **명확한 yes/no + 선택한 배선**이 기록된다.
- **Tier 3** (스파이크 — 산출물=findings 파일). **Assertion**: `test -f docs/autoplan/m0/spike-findings.md && grep -qiE "fontScale.*(SetScale|SetScalingFactor)" docs/autoplan/m0/spike-findings.md && grep -qiE "focus.*(SetAlwaysShowFocus|yes|no)" docs/autoplan/m0/spike-findings.md`.
- **✋**: no.
- **Pre-conditions**: none(독립).

## Dependency order
WU-M0.1 → WU-M0.2. WU-M0.3 독립(병렬 가능하나 순차 처리).

## Self-Review
- Placeholder scan: none. 각 WU에 files/acceptance/tier/exact-assertion 부여.
- Internal consistency: WU들이 plan.md M0(F0.1~F0.5)와 1:1. ADR-002(server-path harness) 설계 그대로. 사전조건 정찰로 검증됨.
- Scope check: 3 WU(인프라 마일스톤 적정). 모두 단일 impl 패스 단위.
- Ambiguity: corner-radius 골든이 "의도적으로 틀린(각진)" 베이스라인이라는 점을 acceptance에 명시(M1 red→green 기준점). 스파이크는 코드변경 없이 probe만.
