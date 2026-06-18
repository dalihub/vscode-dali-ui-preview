# M3 spec — config 빌드-전 install + 갤러리

> 한 줄 요약: `// @preview-config:` 노브(theme/locale/fontScale)를 **실제로 적용**한다. 오늘은 대부분 파싱만 하고 효과가 없거나(fontScale=env 스텁, locale=무시), 배경색만 바꾼다(theme). M3는 dali-ui 전역 싱글톤(`UiColorManager`/`UiScaleManager`/`UiLocalizationManager`/`UiConfig`)을 **트리가 빌드되기 전**에 install해서 — fontScale은 글자가 실제로 커지고, theme=dark는 토큰(`UiColor("token")`)을 다크로 reskin하고, locale=ar은 레이아웃을 RTL로 미러하고, 미번역 `IDS_` 키는 (가짜 번역 대신) 정직하게 키+배지로 보인다. 그리고 변형들을 **이미 존재하는** webview 그리드(`#previewGrid`)에 나란히 모아 보여준다(`@preview-preset:`이 config 줄 여러 개로 확장). 검증은 **기존 러너 재사용** — 보이는 노브(fontScale/theme/locale)는 단일-config 골든 샘플 1장씩으로 `npm run test:e2e`(harness 골든)에서 Tier-1 픽셀 비교, 서버 토큰(F3.3)은 `npm run test:e2e:server`, preset 확장은 codeExtractor 단위 테스트, 갤러리 패널은 ✋ 시각 사인오프. 새 러너 신설 안 함.

| WU | 한 줄 | Tier | server/*.cpp? | ✋ |
|---|---|---|---|---|
| WU-M3.1 | 템플릿 install slot 신설 + TS plumbing 골격 (`{{UI_CONFIG_SETUP}}`/`{{PRE_BUILD_INSTALL}}`/`{{PALETTE_DEFS}}`) — 모든 노브의 토대 | 3 | no (harness/plugin 템플릿) | no |
| WU-M3.2 | fontScale 실배선 (`UiScaleManager::SetScale` runtime + `UiConfig::SetScalingFactor` frozen 양배선) + 골든 1장 | **1**(+3 smoke) | no | **yes** |
| WU-M3.3 | theme=dark 토큰 override(`SetColorOverride`) + static 다크 팔레트(`{{PALETTE_DEFS}}`) + bg-only 정직 경계 + 골든 1장 | **1**(+3 smoke) | no | **yes** |
| WU-M3.4 | 서버 `UiColor("token")` 해석 (`SBParseUiColor` + 서버 override install) + 서버 골든 1장 | **1**(+3 smoke) | **yes** (`docker/preview_server.cpp`) | **yes** |
| WU-M3.5 | locale=ar RTL 미러 (`SetTextLayoutDirectionMode` frozen + per-view `SetLayoutDirection`) + 골든 1장 | **1**(+3 smoke) | no | **yes** |
| WU-M3.6 | 미번역 `IDS_` 배지 (`SetLocalizedStringOverride` static fn + provenance `untranslated` 채널) | 3(+2 host-merge) | no | yes (배지 시각) |
| WU-M3.7 | `// @preview-preset:` 파싱 + configs[] 확장 (codeExtractor + static preset map) | 3(+2 단위) | no | no |
| WU-M3.8 | 갤러리: 다중 변형을 기존 `#previewGrid`에 나란히(orchestrator config별 install plumbing) | 3(+2 메시지계약) | no | **yes** |

근거 파일은 모두 직접 읽어 `파일:라인`으로 인용. **새 러너/새 webview 0** — 전부 기존 인프라 확장(ADR-004 install site + 기존 `goldenTestRunner`/`serverGoldenRunner`/`#previewGrid`).

---

## 1. Goal / Out of scope

**Goal**: 한 `.preview.dali.cpp`(또는 마커 파일)에 `// @preview-config:` 줄을 달면 노브가 **실제로** 적용된다 —
- **fontScale=1.5** → 텍스트가 1.0 대비 **눈에 띄게 커진다**(패널만 바뀌는 게 아니라 렌더된 글자 크기 자체).
- **theme=dark** → 토큰 기반 색(`UiColor("OnSurface")` 류)이 **다크로 reskin**(배경뿐 아니라 토큰을 쓴 위젯).
- **locale=ar**(또는 RTL 로케일) → 레이아웃이 **좌우 미러**(번역 없이도 i18n 레이아웃 버그를 잡음).
- **미번역 `IDS_`** → 카탈로그가 없으면 키를 **가짜 번역하지 않고** 그대로 + "미번역" 배지로 정직하게 표시.
- 변형들이 **나란히**(기존 webview 그리드) 보이고, `// @preview-preset:`이 config 줄 여러 개로 확장.

검증 path: 보이는 노브 3종(fontScale/theme/locale)은 harness 경로(`npm run test:e2e`)에서 **단일-config 골든 샘플 1장씩**으로 Tier-1 픽셀 비교(1.0 대비 커진 글자 / 다크로 바뀐 토큰 / 미러된 레이아웃이 골든으로 박힘). 서버 토큰(F3.3)은 서버 경로(`npm run test:e2e:server`). preset 확장·갤러리 구조는 단위/계약 테스트 + 갤러리 패널은 ✋ 시각 사인오프.

**Out of scope (이 마일스톤에서 명시적으로 안 함 — CUT/정직 경계)**:
- **번역 위조 = CUT(정직)**: 카탈로그 없는 locale은 **RTL 레이아웃 미러(F3.4) + `IDS_` 미번역 배지(F3.5)만**. dali-ui `SetLocalizedStringOverride`는 "키를 그대로 반환 + untranslated 플래그"로만 동작 — 도구가 임의 번역 문자열을 지어내지 않는다(ADR-004 §2, ADR-007 `untranslated`). locale 카탈로그 로딩 경로는 M3 범위 밖.
- **per-variant focus = M5**: 다중-config 갤러리에서 `// @preview-state: focus=`는 적용 안 됨(현재 orchestrator가 경고만 — `previewOrchestrator.ts:907-911`). focus 링은 단일-config harness 경로에서만(M2). 다중-config focus + provenance `focus-approx`는 M5(ADR-007).
- **theme 토큰 풀세트 = 최소(정직)**: 다크 팔레트는 **빌드 시 emit하는 static map의 소수 토큰만**(ADR-004 §3 "토큰→색 테이블은 코드 상수, M3 범위 제한"). 사용자 정의 토큰 테마/임의 토큰 풀세트는 안 함. **hex 색(`UiColor(0x...)`)은 theme=dark로 절대 안 바뀜**(정직: 토큰 기반일 때만 reskin) — 이 경계가 안 지켜진 변형엔 provenance `bg-only-theme` 배지(ADR-007, 소비는 M5지만 호스트가 M3에서 식별).
- **사용자 정의 preset = CUT**: preset 테이블은 `previewConfig.ts`의 **static map**(예: `light-dark`, `locales`). 미등록 이름은 무시 + outputChannel 경고(ADR-001 §2). 사용자 정의 preset/거대 신규 webview 금지.
- **새 갤러리 webview = 금지**: 변형 나란히 보기는 **이미 존재하는** `media/preview.html`의 `.preview-grid`/`#previewGrid`(CSS Grid, `:420-462`, `:1087`) + `updateMultiImage` 핸들러(`:2249-2309`)를 재사용. F3.6은 **새 레이아웃 0** — preset 확장 + config별 install plumbing만.
- **provenance 배지 webview 렌더 = M5(ADR-007)**: M3는 호스트가 빌드 시 `bg-only-theme`/`untranslated`를 **식별**하고 metadata에 머지할 수 있게 한다(채널 준비). 배지 칩의 시각 렌더는 M5 F5.3에서 소비. M3는 식별/플래깅까지.
- **fontScale의 어느 API가 텍스트를 키우나** = M0 스파이크가 확정: warm 서버(plugin)=`UiScaleManager::SetScale`(runtime), harness=`UiConfig::SetScalingFactor`(frozen). **둘 다 배선**(택일 아님 — ADR-004 §2). M3가 실측으로 "Scale이 warm에서 실제로 커지는가"를 골든으로 확인(스파이크 미해결분 종결).

---

## 2. Work units

### WU-M3.1 — 템플릿 install slot 신설 + TS plumbing 골격 (F3.1~3.5 토대)

ADR-004의 placeholder 4종 중 M2가 이미 추가한 `{{POST_BUILD_FOCUS}}`를 제외한 **신규 3종**(`{{UI_CONFIG_SETUP}}`/`{{PRE_BUILD_INSTALL}}`/`{{PALETTE_DEFS}}`)을 harness/plugin 템플릿에 뚫고, `buildRunner`/`standaloneBuildRunner`의 치환 함수에 빈-문자열 기본값으로 배선한다. **이 WU 단독은 동작 변화 0**(모든 slot이 `''`로 치환되면 byte-identical) — 후속 WU들이 채울 토대.

- **Files (touch)**:
  - `server/preview_harness.cpp.template` — 신규 slot 3개 추가:
    - `{{PALETTE_DEFS}}`: `__tag` 정의(:24-29) 직후 + `{{USER_GLOBALS}}`(:30) 근처 — static free function 팔레트가 여기 emit됨(파일 전역).
    - `{{UI_CONFIG_SETUP}}`: `main`의 `UiConfig::New().SetAlwaysShowFocus(true).Apply();`(:346) 체인 **Apply 전**에 frozen setter(`SetScalingFactor`/`SetTextLayoutDirectionMode`)가 끼도록 — 즉 `UiConfig::New(){{UI_CONFIG_SETUP}}.SetAlwaysShowFocus(true).Apply();` 형태(빈 치환이면 byte-identical).
    - `{{PRE_BUILD_INSTALL}}`: `OnInit`의 `View root = CreatePreviewUI();`(:287) **직전** — runtime override(`SetColorOverride`/`SetScale`/`SetLocalizedStringOverride`)가 트리 빌드 전에 install되도록(ADR-004 표).
  - `server/preview_plugin.cpp.template` — `{{PALETTE_DEFS}}`(전역, `{{USER_GLOBALS}}` :62 근처), `{{PRE_BUILD_INSTALL}}`(`extern "C" View CreatePreview()` :85-88 본문 첫 줄 — warm 서버라 runtime override만; `{{UI_CONFIG_SETUP}}`은 plugin엔 **N/A** — warm 서버가 이미 Apply함, ADR-004 표).
  - `src/buildRunner.ts` — `renderHarness`(:141-172)에 3개 slot 치환 추가(기본 `''`). `compilePlugin`(:268-309)의 plugin 치환(:284-292)에 `{{PALETTE_DEFS}}`/`{{PRE_BUILD_INSTALL}}` 추가(기본 `''`). `buildAndRun`(:319) 시그니처에 `locale?`/`fontScale?`(theme는 이미 :323) 추가 — 빈값이면 slot `''`.
  - `test/e2e/standaloneBuildRunner.ts` — `buildAndCapture`/`buildAndCaptureDocker`의 치환 체인(:198-208, :244-254)에 3개 slot 추가(기본 `''`). `StandaloneBuildOptions`(:9-27)에 `theme?`/`locale?`/`fontScale?` 옵션 추가(미설정 → `''`/현행 dark bg 유지). **Inv-6**: slot은 빈 줄 자리, 단순 텍스트 치환.
- **사용자 관점 acceptance**: 이 WU 후에도 **기존 23 harness 골든 + 6 서버 골든이 전부 그대로 통과**(slot이 전부 `''`로 치환 → 렌더 byte-identical). 즉 "토대를 깔았는데 아무것도 안 깨졌다". 새 노브 효과는 없음(후속 WU).
- **Tier 3 (smoke)** — slot이 모두 빈값일 때 회귀 0 확인.
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test
  npm run test:e2e            # 23 harness 골든 전부 PASS (slot='' → byte-identical)
  npm run test:e2e:server     # 6 서버 골든 전부 PASS (plugin/server 무변경)
  ```
- **server/*.cpp 영향**: 없음(harness/plugin **템플릿**만). 이미지 재빌드 불요.

---

### WU-M3.2 — fontScale 실배선 + 골든 1장 (F3.1)

`fontScale=` 디렉티브가 (M0 스파이크 결론대로) warm 서버(plugin)는 `UiScaleManager::SetScale(f)`(runtime, ui-scale-manager.h:124), harness는 `UiConfig::SetScalingFactor(f)`(frozen, ui-config.h:177)를 호출해 **텍스트가 실제로 스케일**된다. **둘 다 배선**(ADR-004 §2: plugin=Scale, harness=ScalingFactor — 택일 아님).

- **Files (touch)**:
  - `src/buildRunner.ts` — WU-M3.1의 `fontScale?`가 set이면: harness `{{UI_CONFIG_SETUP}}`에 `.SetScalingFactor(<f>)` emit(Apply 전 체인). plugin `{{PRE_BUILD_INSTALL}}`에 `UiScaleManager::Get().SetScale(<f>);` emit. fontScale 값은 `FONTSCALE_MIN/MAX`(0.5~2.0, codeExtractor.ts:44-45)로 이미 검증된 `PreviewConfig.fontScale`에서 옴.
  - `test/e2e/standaloneBuildRunner.ts` — `fontScale?` 옵션이 set이면 harness `{{UI_CONFIG_SETUP}}`에 `.SetScalingFactor(<f>)` emit(buildRunner와 동일 로직 — 의도적 중복, vscode 의존 분리; `buildPostBuildFocus` 중복과 동일 패턴 :39 주석).
  - `test/e2e/goldenTestRunner.ts` — `parseConfigSize`(:179-188) 옆에 신규 `parseConfigKnobs(filePath): { theme?, locale?, fontScale? }` 추가 — **샘플의 첫(유일) `@preview-config:` 줄에서 fontScale/theme/locale을 읽어** `runSample`(:227)이 `opts`에 실어 standaloneBuildRunner로 plumb. (오늘은 width/height/focus만 plumb — :247-259.) **단일-config 샘플만** 대상(다중-config는 갤러리 — WU-M3.8/시각).
  - NEW `test/samples/font-scale-15.preview.dali.cpp` — `// @preview-config: name="Large", fontScale=1.5` + 큰 Label 몇 개. (1.0 baseline은 기존 `hello-label`이 이미 커버하므로 별도 baseline 샘플 불요 — 골든이 1.5 글자 크기를 박는다.)
- **사용자 관점 acceptance**: `font-scale-15.preview.dali.cpp`(fontScale=1.5)를 렌더하면 같은 코드를 fontScale 없이(1.0) 렌더한 것보다 **글자가 눈에 띄게 크다**. 골든 PNG가 그 커진 글자를 박고, 회귀 시(스케일이 안 먹으면) 글자 크기가 달라져 골든이 빨갛게 뜬다. ✋ 첫 골든 생성 시 사람이 "1.0 대비 실제로 커졌나"를 눈으로 확인(env 스텁이었으면 안 커졌을 것).
- **Tier 1 (골든)** + Tier 3(smoke: 기존 골든 회귀 0).
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test
  UPDATE_GOLDENS=1 npm run test:e2e   # 신규 font-scale-15 골든 생성 (✋ 1.0 대비 커졌는지 육안 확인)
  npm run test:e2e                     # 24 골든 PASS (신규 1 + 기존 23 회귀 0)
  ```
- **server/*.cpp 영향**: 없음(harness 템플릿 + plugin 템플릿 runtime install). **단, plugin path의 SetScale은 warm 서버(local-backend)에서만 실측 가능** — golden은 harness 경로(`SetScalingFactor`)가 증명. plugin `SetScale`의 "warm에서 실제 커지는가"는 ✋ 라이브 프리뷰(local backend)에서 별도 확인(스파이크 미해결분 — `SetScale`이 layout-root 등록 필요할 수 있음, spike-findings.md:12 ⚠).

---

### WU-M3.3 — theme=dark 토큰 override + static 다크 팔레트 + 골든 1장 (F3.2)

`theme=dark`가 배경색만 바꾸던 것에서(`buildRunner.themeToBackgroundColor` :84-88) → 빌드 전 `UiColorManager::Get().SetColorOverride(&__DarkOverride)`(runtime, ui-color-manager.h:254) 설치로 바뀌어, 토큰색(`UiColor("OnSurface")` 류)이 다크로 해석된다. 팔레트는 **static free function**(no-capture — ADR-004 §2/Inv-5).

- **Files (touch)**:
  - `src/buildRunner.ts` — `theme==='dark'`이면: `{{PALETTE_DEFS}}`에 `bool __DarkOverride(StringView id, Vector4& out){ static const struct{const char* k; ... } table[]={...}; ... return false for unknown; }` free function emit(소수 토큰만 — ADR-004 §3, 정직 범위 제한). `{{PRE_BUILD_INSTALL}}`에 `UiColorManager::Get().SetColorOverride(&__DarkOverride);` emit. **hex 색은 팔레트를 안 거치므로 불변**(정직 경계). theme→bg 색은 기존대로 유지(토큰 미사용 앱도 배경은 다크). 팔레트 토큰 셋은 코드 상수로 명시(예: `OnSurface`/`Surface`/`Primary`/`OnPrimary` 등 — 정확한 키 목록은 impl이 dali-ui 기본 팔레트에서 소수 선정).
  - `test/e2e/standaloneBuildRunner.ts` — `theme?`가 `'dark'`이면 동일 `__DarkOverride` emit + install(buildRunner 중복). `theme` 미설정 시 현행 하드코딩 dark bg(`Vector4(0.1f,0.1f,0.12f,1.0f)` :206)는 유지 — **단 토큰 override는 `theme==='dark'` 명시 시에만**(기존 골든은 토큰을 안 써서 회귀 0).
  - `test/e2e/goldenTestRunner.ts` — WU-M3.2의 `parseConfigKnobs`가 `theme`도 plumb.
  - NEW `test/samples/theme-dark-tokens.preview.dali.cpp` — `// @preview-config: name="Dark", theme=dark` + `UiColor("OnSurface")`/`UiColor("Primary")` 같은 **토큰 기반** 색을 쓰는 위젯(hex 아님). 토큰이 다크로 reskin됨을 골든이 박는다.
- **사용자 관점 acceptance**: `theme-dark-tokens.preview.dali.cpp`(theme=dark)를 렌더하면 `UiColor("OnSurface")` 토큰을 쓴 위젯들이 **다크 팔레트 색**으로 나온다(배경만이 아니라). 같은 코드를 theme=light로 렌더하면 토큰이 라이트 색으로 — 두 골든이 시각적으로 다르다. **hex(`UiColor(0x...)`)를 쓴 위젯은 theme과 무관하게 동일**(정직 경계가 골든으로 증명). ✋ 첫 골든 시 사람이 "토큰이 진짜 reskin됐나(배경만 바뀐 게 아니라)"를 확인.
- **Tier 1 (골든)** + Tier 3(smoke).
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test
  UPDATE_GOLDENS=1 npm run test:e2e   # 신규 theme-dark-tokens 골든 (✋ 토큰 reskin 육안 확인)
  npm run test:e2e                     # 25 골든 PASS (신규 1 + 기존 회귀 0)
  ```
- **server/*.cpp 영향**: 없음(harness 템플릿). F3.3의 **서버** override는 WU-M3.4 별도.

---

### WU-M3.4 — 서버 `UiColor("token")` 해석 + 서버 override install + 서버 골든 1장 (F3.3)

WU-M3.3의 override(다크 팔레트)가 **서버 바이너리에도 설치**된 상태에서, 서버 scene-builder의 `SBParseUiColor`(docker/preview_server.cpp:438-512)에 `UiColor("name")`(문자열 인자, 따옴표) 분기를 추가해 `UiColorManager::Get().GetColor(name, out)`(ui-color-manager.h:152, `bool GetColor(StringView, Vector4&)`)로 해석한다. **server/*.cpp 변경 → 이미지 재빌드 필요**.

- **Files (touch)**:
  - `docker/preview_server.cpp`:
    - `SBParseUiColor`(:438) — 기존 hex `UiColor(0x...)` 분기(:464-477)·named `Color::*`(:479-503) 옆에 신규 `UiColor("<name>")` 분기: prefix `UiColor("` + 끝 `")` 면 안쪽 문자열을 추출해 `Vector4 v; if(UiColorManager::Get().GetColor(name, v)) { result=UiColor(v); resolved=true; }`. **미해결 토큰은 기존 magenta fallback**(:506-507) 유지(정직: 안 풀리면 검정 아닌 magenta로 보이게).
    - `main`(:1297-1304) 또는 서버 셋업 — 다크 override install 지점. `UiConfig::New().Apply()`(:1300)는 frozen이라 그대로 두되, **runtime** `SetColorOverride`는 RENDER_JSON이 theme=dark일 때 install/clear 가능(ADR-004 §1: SetColorOverride는 warm-server-safe, "All View bindings refreshed"). RENDER_JSON 프로토콜은 이미 `theme` 필드를 받음(preview_server.cpp:805-806, `DoRenderJson` bg apply :989). → `DoRenderJson`에서 `req.theme=="dark"`면 `SetColorOverride(&__DarkServerOverride)`, 아니면 `ClearColorOverride()` (per-render, warm-safe). 서버용 static 팔레트 `__DarkServerOverride`는 buildRunner가 emit하는 harness 팔레트와 **동일 토큰 셋**(desync 방지 — 코드 상수 공유 원칙).
  - `test/samples/server-path/` — NEW `color-token.preview.dali.cpp`: `UiColor("Primary")` 같은 토큰 색을 쓰는 T1-파서블 샘플(`parseChainExpression`이 파싱 가능한 단순 체인). serverGoldenRunner가 RENDER_JSON으로 렌더.
  - **주의 (server 프로토콜)**: serverGoldenRunner(`renderJson` :115-121)는 theme을 안 넘김(현행 RENDER_JSON 호출이 width/height만). 토큰 reskin 골든을 보려면 **theme=dark가 install된 상태**여야 함 → 두 옵션:
    1. (선호) 서버가 RENDER_JSON theme=dark면 자동 override install(위) + `color-token` 샘플에 `// @preview-config: theme=dark` 줄 + serverGoldenRunner가 그 줄을 읽어 `renderJson(..., theme)` 전달(serverGoldenRunner의 `readSampleCode` :66은 config 줄을 strip하므로, 별도 `parseTheme`로 theme만 추출해 renderJson에 전달 — 소량 추가).
    2. (대안) 토큰을 항상 다크로 install(theme 무관) — 정직성 약함, 기각.
- **사용자 관점 acceptance**: `color-token.preview.dali.cpp`(theme=dark + `UiColor("Primary")`)를 **서버 경로**로 렌더하면 그 토큰 색이 **다크 팔레트 색**으로 나온다(이전엔 magenta fallback 또는 검정). 골든이 그 색을 박고, 회귀 시 magenta/검정으로 돌아가면 빨갛게 뜬다. ✋ 첫 골든 시 "토큰이 서버에서 풀렸나(magenta 아님)" 확인.
- **Tier 1 (서버 골든)** + Tier 3(smoke: 기존 6 서버 골든 회귀 0).
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test
  # server/*.cpp 변경 → local-backend serverGoldenRunner가 네이티브 server 재컴파일(자동, 첫 run ~30-60s)
  UPDATE_GOLDENS=1 npm run test:e2e:server   # 신규 color-token 서버 골든 (✋ 토큰 reskin 확인)
  npm run test:e2e:server                     # 7 서버 골든 PASS (신규 1 + 기존 6 회귀 0)
  ```
- **server/*.cpp 영향**: **있음** (`docker/preview_server.cpp`). serverGoldenRunner는 **local-backend(네이티브)** 경로라 `docker/preview_server.cpp`를 `daliPrefix`로 재컴파일(serverGoldenRunner.ts:210-244, M0 인프라) — docker 이미지 재빌드는 라이브 프리뷰(docker backend) 배포 시 필요(MEMORY: 서버변경 baked-in).

---

### WU-M3.5 — locale=ar RTL 미러 + 골든 1장 (F3.4)

`locale=ar`(또는 RTL 로케일)가 빌드 전 RTL 레이아웃 방향을 적용한다. M0 스파이크: `UiConfig::SetTextLayoutDirectionMode(Text::LayoutDirectionMode::RTL)`(frozen, ui-config.h:549)는 `{{UI_CONFIG_SETUP}}`(harness Apply 전), 또는/추가로 per-view `View::SetLayoutDirection(RIGHT_TO_LEFT)`(runtime, `{{PRE_BUILD_INSTALL}}`에서 root에). **번역 없이 레이아웃만 미러**(정직 — F3.6 번역 위조 CUT).

- **Files (touch)**:
  - `src/buildRunner.ts` — locale이 RTL 집합(예: `ar`/`he`/`fa`/`ur` — `ar`로 시작 등 단순 prefix 매칭)이면: harness `{{UI_CONFIG_SETUP}}`에 `.SetTextLayoutDirectionMode(Dali::Toolkit::Text::LayoutDirection::Type 또는 dali-ui enum — text-enumerations.h:79 RTL)` emit. 추가로 `{{PRE_BUILD_INSTALL}}`(또는 `{{POST_BUILD_FOCUS}}` 인접 — root 가시 시점)에서 `root.SetProperty(Actor::Property::LAYOUT_DIRECTION, ...)` 또는 `View::SetLayoutDirection`로 per-view RTL(frozen UiConfig가 안 먹는 plugin path 대비). RTL 로케일 판정은 `previewConfig.ts`의 작은 RTL set 상수.
  - `test/e2e/standaloneBuildRunner.ts` — `locale?`가 RTL이면 동일 RTL emit(buildRunner 중복). `locale` 미설정 → 현행(LTR) 유지.
  - `test/e2e/goldenTestRunner.ts` — `parseConfigKnobs`가 `locale` plumb(WU-M3.2 확장).
  - NEW `test/samples/locale-ar-rtl.preview.dali.cpp` — `// @preview-config: name="Arabic", locale=ar` + 좌우 비대칭 ROW 레이아웃(SPACE_BETWEEN/패딩 차이 등 미러가 눈에 보이는 구성) + 라벨 몇 개. 미러된 레이아웃을 골든이 박는다.
- **사용자 관점 acceptance**: `locale-ar-rtl.preview.dali.cpp`(locale=ar)를 렌더하면 좌우 비대칭 레이아웃이 **미러**된다(왼쪽에 있던 게 오른쪽으로). 같은 코드를 locale 없이 렌더한 LTR 골든과 시각적으로 좌우 반전. ✋ 첫 골든 시 "레이아웃이 진짜 미러됐나" 확인. (번역은 안 일어남 — 텍스트는 그대로, 방향만.)
- **Tier 1 (골든)** + Tier 3(smoke).
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test
  UPDATE_GOLDENS=1 npm run test:e2e   # 신규 locale-ar-rtl 골든 (✋ 미러 육안 확인)
  npm run test:e2e                     # 골든 PASS (신규 1 + 기존 회귀 0)
  ```
- **server/*.cpp 영향**: 없음(harness/plugin 템플릿). frozen `SetTextLayoutDirectionMode`는 harness 경로가 증명; plugin(warm) path는 per-view `SetLayoutDirection`(runtime)이 담당.

---

### WU-M3.6 — 미번역 `IDS_` 배지 + provenance 채널 식별 (F3.5)

카탈로그가 없어 키가 그대로 노출되는 `IDS_` 텍스트에 "미번역" 표식을 붙인다(**가짜 번역 금지**). `UiLocalizationManager::SetLocalizedStringOverride(&__LocaleOverride)`(runtime, static fn — ui-localization-manager.h, ADR-004 §2)가 "`IDS_` 키는 그대로 반환 + untranslated 플래그"로 동작. 호스트는 빌드 시 `untranslated` provenance를 식별해 metadata에 머지(ADR-007 채널 — **칩 렌더는 M5**).

- **Files (touch)**:
  - `src/buildRunner.ts` — locale이 set이고 카탈로그가 없을 때(M3는 카탈로그 로딩 안 함 → locale set이면 항상): `{{PALETTE_DEFS}}`에 `bool __LocaleOverride(StringView key, ...){ /* IDS_ 키는 false 반환 = 미번역, 원본 키 유지 */ return false; }` static fn emit, `{{PRE_BUILD_INSTALL}}`에 `UiLocalizationManager::Get().SetLocalizedStringOverride(&__LocaleOverride);` emit. (override가 false를 반환 → dali-ui가 키 원문을 그대로 표시 = 정직.)
  - `src/previewOrchestrator.ts` — `applySuccessfulBuild`의 metadata 읽기(:532 부근, ADR-007 §2)에서 locale-config + `IDS_` 사용 감지 시 `provenance:[{kind:'untranslated', detail:'IDS_... shown as key (no catalog)'}]`를 metadata JSON에 **호스트 머지**(server.cpp 무변경 — ADR-007 §2 host-merge). 단 **배지 칩 webview 렌더는 M5 F5.3** — M3는 provenance 배열을 metadata에 싣는 것까지(채널 준비).
  - `src/previewConfig.ts` 또는 metadata 타입 — `provenance?: {kind: string; detail: string}[]` top-level 필드(ADR-007 §1 스키마, 닫힌 enum 6종 중 `untranslated`).
  - NEW `test/unit/buildRunner.localeOverride.test.ts` (또는 기존 buildRunner 테스트 확장) — locale set일 때 harness가 `SetLocalizedStringOverride` install 코드를 emit하고 `__LocaleOverride`가 false 반환(미번역) 구조인지 **문자열 단위** 검증(C++ 컴파일 없이 치환 결과 문자열 assert — 기존 buildRunner 단위 테스트 패턴).
- **사용자 관점 acceptance**: locale을 단 변형에서 `IDS_TITLE` 같은 키를 쓰는 라벨이 **키 그대로**(`IDS_TITLE`) 렌더되고(도구가 임의 번역을 지어내지 않음), 호스트 metadata에 `untranslated` provenance가 실린다. (배지 칩 자체는 M5에서 보임 — M3는 "가짜 번역 안 함 + 채널에 플래그 실림"까지가 acceptance.) ✋ locale 변형에서 키가 위조 번역이 아니라 원문 키로 보이는지 확인.
- **Tier 3 (smoke)** + Tier 2(buildRunner 치환 문자열 단위 테스트 = host-merge/emit 검증). **C++ 골든 아님** — "미번역 = 가짜 안 함"은 픽셀이 아니라 emit된 override 코드 + host provenance 머지로 증명(배지 시각은 M5).
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test        # buildRunner.localeOverride 단위 테스트 포함
  npm run test:e2e                    # 기존 골든 회귀 0 (locale 없는 골든은 override 미설치)
  ```
- **server/*.cpp 영향**: 없음(harness/plugin 템플릿 runtime override + 호스트 머지).

---

### WU-M3.7 — `// @preview-preset:` 파싱 + configs[] 확장 (F3.6 파서)

`// @preview-preset: light-dark` 같은 줄이 **등록된 preset 이름**을 여러 `PreviewConfig`로 확장해 `configs[]`에 push한다(ADR-001 §2: `light-dark` → `[{name:"light",theme:"light"},{name:"dark",theme:"dark"}]`). preset 테이블은 `previewConfig.ts`의 static map. 미등록 이름은 무시 + outputChannel 경고. **순수 파싱/확장 작업 — 단위 테스트 가능.**

- **Files (touch)**:
  - `src/codeExtractor.ts` — 신규 `PREVIEW_PRESET_RE = /^\/\/\s*@preview-preset:\s*([A-Za-z][\w\-]*)\s*$/`(ADR-001 EBNF `preset-name := identifier`). 세 추출 모드(preview-file :180-194, marker :353-366)의 라인 루프에서 `parsePreviewConfigLine` **호출 직전에** preset 줄 검사(ADR-001 §2) — 매치하면 `expandPreset(name)`이 반환한 `PreviewConfig[]`를 `configs`에 push, 그 줄은 코드에서 제외(config 줄과 동일 처리). 미등록 이름 → `log.warn` + 무시.
  - `src/previewConfig.ts` — 신규 `export const PREVIEW_PRESETS: Record<string, PreviewConfig[]>`(예: `'light-dark': [{name:'Light',theme:'light'},{name:'Dark',theme:'dark'}]`, `'locales': [{name:'EN'},{name:'Arabic',locale:'ar'}]` 등 소수 — ADR-001 §2 static map). 신규 `export function expandPreset(name: string): PreviewConfig[] | null`(미등록 → null).
  - NEW `test/unit/codeExtractor.preset.test.ts` — 확장 단위 테스트(아래 acceptance를 케이스로).
- **사용자 관점 acceptance**: `// @preview-preset: light-dark` 한 줄을 달면 추출 결과의 `configs`가 **2개**(`Light`/theme=light, `Dark`/theme=dark)로 확장되고, 그 줄은 컴파일 코드에서 제외된다(다중-config처럼 동작 → 갤러리 path 진입). `@preview-preset`과 `@preview-config`를 섞어 쓰면 둘 다 `configs`에 합쳐진다(append). 미등록 `// @preview-preset: bogus`는 무시되고 outputChannel에 "unknown preset 'bogus'" 경고(조용한 오류 아님). 빈 `configs`면 갤러리 안 뜸(기존 단일 렌더).
- **Tier 3 (smoke)** + Tier 2(파서 단위 테스트).
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test        # codeExtractor.preset 단위 테스트 (확장/append/미등록 경고)
  ```
- **server/*.cpp 영향**: 없음(TS 파서만).

---

### WU-M3.8 — 갤러리: 다중 변형을 기존 그리드에 나란히 (F3.6 갤러리)

다중 config(`@preview-config` 여러 줄 또는 WU-M3.7 preset 확장)가 **이미 존재하는** webview 그리드(`#previewGrid`)에 나란히 렌더된다. **새 레이아웃 0** — 핵심 작업은 `runMultiPreview`(previewOrchestrator.ts:974)가 **config별 theme/locale/fontScale install을 빌드에 plumb**하는 것(오늘은 plumb은 하나 install이 WU-M3.1~3.5 전엔 효과 없었음). harness/plugin 경로 라우팅(ADR-004 §3: frozen-필요 config는 harness로).

- **Files (touch)**:
  - `src/previewOrchestrator.ts` — `runMultiPreview`(:974-1075):
    - warm 경로(plugin reload, :1031-1034)는 이미 `locale, fontScale`을 `previewServer.reload`로 넘김(:1033) — 이제 그게 **실제로 install**됨(WU-M3.2 plugin `SetScale` + WU-M3.3 server override + WU-M3.5 per-view RTL). theme override(runtime)는 warm 유지.
    - **frozen-필요 config 라우팅(ADR-004 §3)**: fontScale(harness `SetScalingFactor` fallback)·locale-RTL(frozen `SetTextLayoutDirectionMode`)이 필요한 변형은 warm dlopen으로 frozen API 적용 불가 → 그 config는 `buildAndRun`(harness, :1054 분기 확장)으로 라우팅하고 `buildAndRun`에 `theme/locale/fontScale` 전달(WU-M3.1에서 시그니처 확장). 단순 runtime override(theme-only)는 warm 유지.
  - `src/previewServer.ts` — `reload`(:148-150)는 이미 theme/locale/fontScale/font 필드를 RELOAD 명령으로 전송(:179). 서버(docker/preview_server.cpp RELOAD parse :891-901)가 이 필드를 **실제 install**하도록 — 단 이는 docker backend(라이브) 경로이고 **이미지 재빌드 필요**. (서버 RELOAD install은 WU-M3.4의 서버 override + plugin `SetScale`/RTL과 같은 baked-in. M3 골든은 harness 경로가 증명하므로, 서버 RELOAD install은 라이브 프리뷰 ✋ 확인 항목.)
  - `media/preview.html` — **변경 없음(재사용)**. `updateMultiImage` 핸들러(:2249-2309)가 config별 `{name,uri,error,metadata}`를 `#previewGrid`(.preview-grid CSS Grid)에 이미 나란히 렌더. config 이름이 `.preview-grid-header`(:2270)에 뜸.
  - NEW/확장 `test/samples/gallery-variants.preview.dali.cpp`(또는 기존 `multi-config.preview.dali.cpp` 활용) — `@preview-preset: light-dark` 또는 다중 `@preview-config: theme=light` / `theme=dark`로 변형 2~3개를 토큰 색 위젯과 함께. (시각 사인오프용 — 갤러리 픽셀은 골든 안 함.)
  - 선택 `test/unit/previewManager.test.ts` 확장 — `updateMultiImage`가 config별 `{name,uri/error,metadata}` 페이로드를 올바른 형태로 postMessage하는지 **메시지 계약** 단위 테스트(에이전트 조사: 현재 `updateMultiImage` 테스트 0 — 신규). webview DOM이 아니라 **호스트가 보내는 메시지**를 검증(jsdom 불요).
- **사용자 관점 acceptance**: `gallery-variants.preview.dali.cpp`(preset 또는 다중 config)를 저장하면 webview에 변형들이 **나란히**(그리드) 뜨고, 각 칸 헤더에 config 이름(Light/Dark 등)이 보이며, **각 변형이 자기 노브를 실제 반영**(Dark 칸은 토큰이 다크 reskin, Large 칸은 글자 큼, Arabic 칸은 미러). ✋ 갤러리 패널이 변형을 나란히 + 각자 노브 적용되어 보이는지 사람이 확인(webview라 픽셀 골든 불가).
- **Tier 3 (smoke)** + Tier 2(메시지 계약 단위 테스트). **갤러리 패널 자체는 ✋ 시각 사인오프**(에이전트 확인: `#previewGrid`는 이미 존재·동작, 픽셀 골든 부적합 — webview). 노브의 실제 적용은 WU-M3.2~3.5 골든이 이미 Tier-1으로 증명하므로, 이 WU는 "변형들이 그리드에 모여 각자 노브로 렌더"를 시각+계약으로 확인.
- **EXACT 검증 명령**:
  ```
  npm run compile && npm test        # updateMultiImage 메시지 계약 단위 테스트
  npm run test:e2e                    # 기존 골든 회귀 0
  # ✋ 라이브 프리뷰(local backend)에서 gallery-variants.preview.dali.cpp 열어 그리드에 변형 나란히 + 각자 노브 적용 육안 확인
  ```
- **server/*.cpp 영향**: 간접(서버 RELOAD install은 WU-M3.4 서버 변경에 포함 — docker 이미지 재빌드 시 반영). 갤러리 자체(webview/orchestrator/TS)는 server 무변경.

---

## 3. Dependency order

```
WU-M3.1 (템플릿 slot + plumbing 골격) ─── 모든 노브의 토대
   ├─→ WU-M3.2 (fontScale)        ┐
   ├─→ WU-M3.3 (theme 토큰 override)│ 보이는 노브 — 각자 Tier-1 골든 (상호 비의존, 병렬 가능)
   │      └─→ WU-M3.4 (서버 토큰)   │  ※ 서버 override는 M3.3 팔레트 토큰 셋을 공유(같은 상수)
   ├─→ WU-M3.5 (locale RTL)       ┘
   └─→ WU-M3.6 (IDS_ 배지/provenance 채널)  ※ M3.1의 {{PALETTE_DEFS}}/{{PRE_BUILD_INSTALL}}에 의존

WU-M3.7 (preset 파싱) ─── 독립(TS 파서만, M3.1 무관)
   └─→ WU-M3.8 (갤러리)  ※ M3.8은 M3.7(preset→configs)과 M3.2~3.5(config별 install이 실제 효과)에 의존
```

- **루트**: **WU-M3.1**(템플릿 slot + plumbing 골격) — 동작 변화 0이지만 M3.2~M3.6의 install 코드가 들어갈 자리를 뚫음. 먼저 land해 회귀 0(기존 23+6 골든)을 확인하고 시작.
- **보이는 노브 3종(M3.2/M3.3/M3.5)**: M3.1 위에서 상호 비의존 → 병렬 가능. 각자 단일-config 골든 1장(Tier-1).
- **M3.4(서버 토큰)**: M3.3의 다크 팔레트 토큰 셋을 서버 override가 **공유**(desync 방지)하므로 M3.3 뒤. 유일하게 `docker/preview_server.cpp` 변경(서버 골든 러너로 검증).
- **M3.6(IDS_/provenance)**: M3.1의 `{{PALETTE_DEFS}}`/`{{PRE_BUILD_INSTALL}}`에 override emit하므로 M3.1 뒤. 배지 칩 소비는 M5(채널만 준비).
- **M3.7(preset)**: 순수 TS 파서 — M3.1과 무관, 아무 때나(독립 트랙). M3.8 전에만.
- **M3.8(갤러리)**: M3.7(preset→configs 확장)과 M3.2~M3.5(config별 install이 실제 효과를 내야 갤러리 칸이 의미)에 의존 → **마지막**. webview는 재사용(변경 0), 핵심은 orchestrator의 config별 install plumbing + frozen-필요 라우팅.

**권장 순서**: M3.1 → (M3.2 ∥ M3.3 ∥ M3.5) → M3.4 → M3.6 → M3.7 → M3.8. (M3.7은 M3.1과 병렬로 일찍 시작해도 무방.)

**server/*.cpp(이미지 재빌드/네이티브 재컴파일) vs harness 템플릿(test:e2e) 구분**:
- **harness/plugin 템플릿 변경(test:e2e로 검증, 이미지 재빌드 불요)**: M3.1, M3.2, M3.3, M3.5, M3.6.
- **`docker/preview_server.cpp` 변경(test:e2e:server로 검증 = M0 local-backend 네이티브 재컴파일; docker 라이브는 이미지 재빌드)**: **M3.4만**(서버 `SBParseUiColor` 토큰 + 서버 override install). M3.8의 서버 RELOAD install은 M3.4 서버 변경에 포함되는 baked-in(라이브 ✋).

---

## Self-Review

- **Placeholder scan**: TODO/TBD/??? 없음. 8개 WU 전부 제목 + 사용자 관점 acceptance + tier + EXACT 검증 명령 + server/*.cpp 영향 표기. 미해결(스파이크 미종결 `SetScale` warm 동작, 팔레트 정확 토큰 키 목록)은 본문에 "impl이 확정"으로 유보 표기하거나 OPEN_QUESTIONS로 승격 — 임의 가정 없음. 모든 API/파일은 직접 읽어 `파일:라인` 인용(`UiScaleManager::SetScale` ui-scale-manager.h:124, `SetColorOverride` ui-color-manager.h:254, `GetColor` :152, `SBParseUiColor` preview_server.cpp:438, `#previewGrid` preview.html:1087, `renderHarness` buildRunner.ts:141, `runMultiPreview` previewOrchestrator.ts:974 — 전부 실재 확인).
- **Internal consistency**: 의존 그래프(§3)와 각 WU의 "Files/server 영향"이 일치. M3.1이 토대(slot 3종 신설) → M3.2~M3.6이 그 slot을 채움 — slot 이름(`{{UI_CONFIG_SETUP}}`/`{{PRE_BUILD_INSTALL}}`/`{{PALETTE_DEFS}}`)이 ADR-004 표와 1:1. M3.3 팔레트 토큰 셋 ↔ M3.4 서버 override 토큰 셋 "공유(같은 상수)"로 desync 방지 명시. CUT(번역 위조/per-variant focus/사용자 preset/새 webview)는 Out of scope에 박혀 어떤 WU에도 등장 안 함. Tier 규칙 충족: 8개 WU 전부 ≥Tier-3 smoke; 보이는 노브(M3.2 fontScale/M3.3 theme/M3.5 locale)는 Tier-1 골든; 서버 토큰(M3.4)도 Tier-1 서버 골든.
- **Scope check**: M3 = plan.md F3.1~F3.6 전부 커버(F3.1=M3.2, F3.2=M3.3, F3.3=M3.4, F3.4=M3.5, F3.5=M3.6, F3.6=M3.7+M3.8). 각 WU가 단일 impl 패스로 land+test 가능한 입자(슬롯 1세트/노브 1종/파서 1개/orchestrator plumbing 1개). 새 컴포넌트 0 — 기존 템플릿/러너/그리드 확장. 갤러리는 ✋ 시각으로 정직하게 스코프(에이전트 실측: `#previewGrid` 이미 존재·동작 → 새 레이아웃 0, 픽셀 골든 부적합). provenance는 채널 준비까지(칩 렌더 M5)로 정직 경계.
- **Ambiguity**: 남은 긴장 3곳 명시 — (a) **goldenTestRunner의 config plumbing 부재**: 현재 width/height/focus만 plumb(:247-259), theme/locale/fontScale은 안 함 → M3.2가 `parseConfigKnobs` 신설로 **단일-config 샘플의 첫 config 노브**를 plumb(다중-config 갤러리는 1-샘플-1-골든 러너에 안 맞음 → 갤러리는 ✋ 시각, 노브 효과는 단일-config 골든이 증명). 이 분리가 "보이는 노브=Tier1 / 갤러리 패널=✋"의 근거. (b) **fontScale warm path(`SetScale`) 미종결**: M0 스파이크가 "layout-root 등록 필요할 수 있음"(spike-findings.md:12)으로 남김 → harness `SetScalingFactor`는 골든 증명, plugin `SetScale`은 ✋ 라이브 확인(둘 다 배선, 골든은 harness가 담당). (c) **서버 RENDER_JSON theme 전달**: serverGoldenRunner의 `renderJson`이 theme 미전달(:115-121) → M3.4가 샘플의 theme 줄을 읽어 전달하거나 서버 자동 install — impl이 택1(선호: 샘플 theme 줄 + parseTheme).

OPEN_QUESTIONS:
1. **다크 팔레트 토큰 셋의 정확한 키 목록**: ADR-004 §3은 "소수 토큰만(코드 상수, 범위 제한)"이라 하나 정확한 토큰 키(`OnSurface`/`Surface`/`Primary`/`OnPrimary`/...)는 dali-ui 기본 팔레트에서 무엇을 채택할지 미정 — impl 시 dali-ui `ui-color-manager.h` 기본 색 ID 목록을 확인해 데모 가치 있는 소수(4~6개)를 선정해야 함(M3.3/M3.4 공유 상수). 데모 샘플(`theme-dark-tokens`/`color-token`)이 쓰는 토큰과 일치해야 골든이 의미.
2. **RTL enum 정확 타입**: spike-findings.md는 `UiConfig::SetTextLayoutDirectionMode`(frozen, ui-config.h:549) + enum `text/text-enumerations.h:79`을 가리키나, 그 enum이 `Dali::Toolkit::Text::LayoutDirection` 인지 dali-ui 자체 enum인지 impl이 헤더로 확정 필요(M3.5). per-view `View::SetLayoutDirection` vs `Actor::Property::LAYOUT_DIRECTION` 중 dali-ui View가 제공하는 정확 API도 헤더 확인.
3. **`@preview-preset` 표준 preset 카탈로그**: `light-dark` 외에 어떤 preset을 기본 제공할지(예: `locales`=en/ar, `font-sizes`=1.0/1.5) — ADR-001 §2가 `light-dark`/`locales`를 예시하나 확정 목록은 미정. M3.7 impl이 static map에 데모 가치 있는 2~3개를 정의(사용자 정의는 CUT이므로 카탈로그가 곧 표면).
