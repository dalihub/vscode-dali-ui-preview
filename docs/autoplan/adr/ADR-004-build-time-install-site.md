# ADR-004 — Build-time singleton install site (M2/M3/M5)

## Status
Accepted (M2 진입; M3/M5 확장).

## Context
theme/locale/fontScale/focus/placeholder는 **dali-ui 전역 싱글톤**(`UiColorManager`/`UiScaleManager`/`UiLocalizationManager`/
`UiConfig`/`FocusManager`)에 install해야 효과가 난다. 어디서·언제 호출하느냐가 캠페인의 hard 제약을 결정한다.

**제약 1 — frozen vs runtime (헤더로 확정, 스파이크는 재확인용):**
- `UiConfig::SetScalingFactor`(ui-config.h:177)/`SetBrokenImageUrl`(:335)/`SetAlwaysShowFocus`(:372)/
  `SetTextLayoutDirectionMode`(:549)는 **`Apply()` 전에만** 호출 가능 — frozen-after-Apply(:57 "may only be called before
  the config is applied", :174/:262 `@pre not frozen`; `Apply()` 두 번 호출 시 assert :166). 한 번 `Apply()`된
  **warm 서버에선 재설정 불가** → 매 reload마다 새 process가 필요한 경로(harness one-shot, 또는 plugin이 Apply 전 install)에서만.
- 반면 `UiColorManager::SetColorOverride`(:254)/`ClearColorOverride`(:261), `UiScaleManager::SetScale`(:124),
  `UiLocalizationManager::SetLocalizedStringOverride`(:346), `FocusManager::SetCurrentFocusView`(:90)는 **runtime-callable**
  — "All View bindings are refreshed"(:237) 식으로 살아있는 트리에 재적용 → **warm 서버에서도 동작**.

**제약 2 — no captures (헤더로 확정):**
- `ColorOverrideFunc = bool (*)(StringView colorId, Vector4& outColor)`(ui-color-manager.h:52) 와
  `LocalizedStringOverrideFunc = bool (*)(StringView, ...)`(ui-localization-manager.h:67)는 **plain 함수 포인터** —
  "This parameter is a plain function pointer"(:232). std::function/람다 캡처 **불가**. → 팔레트는 **static free function +
  static 테이블**이어야 한다(Inv-5).

**install site 후보(템플릿):**
- harness: `OnInit`(:257)의 `{{FONT_SETUP}}`(:259)가 `CreatePreviewUI()`(:263, 트리 빌드) **직전**. `main`의
  `UiConfig::New().Apply()`(:318)는 `PreviewApp` 생성 후·`MainLoop` 전 — 즉 `OnInit`보다 **먼저** 실행된다(MainLoop이 InitSignal을 발화).
  → frozen setter는 `main`의 `UiConfig::New()` 체인에 들어가야 하고, runtime override/focus는 `OnInit`에서 가능.
- plugin(dlopen): `{{USER_GLOBALS}}`(:62) + `CreatePreview`(:64). plugin은 **이미 Apply된 warm 서버**에 dlopen되므로
  frozen setter 불가 → runtime override만. focus는 `CreatePreview` 반환 후 서버가 트리에 적용(ADR-006).

`previewOrchestrator`/`buildRunner`가 directive 값(`configs[].theme|locale|fontScale`, `state.focus|progress`)을 빌드로 plumb한다.

## Decision
**install은 TS 레이어도 server scene-builder(컴파일 path)도 아닌, plugin/harness 템플릿의 "트리 빌드 전/후" install site에서 한다.**
frozen/runtime 구분에 따라 site를 나눈다.

### 1) 새 템플릿 placeholder (Inv-6: 빈 줄 자리, 단순 치환)
| placeholder | 위치 | 무엇 | frozen? |
|---|---|---|---|
| `{{UI_CONFIG_SETUP}}` | harness `main`의 `UiConfig::New()` 체인(:318 대체); plugin은 N/A(warm) | `SetScalingFactor`/`SetBrokenImageUrl`/`SetAlwaysShowFocus`/`SetTextLayoutDirectionMode` | **frozen** → Apply 전 |
| `{{PRE_BUILD_INSTALL}}` | harness `OnInit` 트리 빌드 직전(:263 위); plugin `CreatePreview` 본문 첫 줄(:66 위) | `UiColorManager::SetColorOverride`(theme), `UiScaleManager::SetScale`(fontScale runtime), `UiLocalizationManager::SetLocalizedStringOverride`(locale) | runtime |
| `{{POST_BUILD_FOCUS}}` | harness `OnInit` `window.Add(root)` 직후(:264); plugin은 서버가 처리(ADR-006) | `FocusManager::SetCurrentFocusView` | runtime |
| `{{PALETTE_DEFS}}` | harness/plugin 전역(`{{USER_GLOBALS}}` 근처) | static free function 팔레트(dark theme map, locale RTL/배지 함수) | — |

### 2) frozen setter는 harness 경로로 (M0 스파이크 결론 우선)
- **fontScale**: 우선 `UiScaleManager::SetScale(f)`(runtime, :124)를 `{{PRE_BUILD_INSTALL}}`에 넣어 warm 서버(plugin)에서도 동작 시도.
  M0 F0.4 스파이크가 "텍스트가 실제로 커지는가"를 확인 — **안 커지면** harness 경로의 `{{UI_CONFIG_SETUP}}`에서
  `UiConfig::SetScalingFactor(f)`(frozen, :177)로 fallback. **둘 다 코드에 둔다**(택일 아님): plugin=Scale, harness=ScalingFactor.
  orchestrator가 fontScale 디렉티브가 있으면 frozen-필요로 판단해 dlopen 대신 harness로 라우팅하는 옵션(아래 3).
- **placeholder(M5)**: `UiConfig::SetBrokenImageUrl`(frozen, :335)는 `{{UI_CONFIG_SETUP}}`(harness Apply 전). warm 서버 plugin엔
  적용 불가 → M5 placeholder는 harness 경로 또는 server.cpp의 ImageView 분기에서 정직 placeholder(ADR-003 F1.3 연장).
- **RTL(M3 F3.4)**: `UiConfig::SetTextLayoutDirectionMode(Text::LayoutDirectionMode::RTL)`(frozen, :549;
  enum text/text-enumerations.h:79)는 `{{UI_CONFIG_SETUP}}`. locale 미번역 배지(F3.5)는 runtime
  `SetLocalizedStringOverride`로 "IDS_ 키는 그대로 반환 + 배지 플래그"(번역 위조 금지).

### 3) TS→build plumbing
- `buildRunner.renderHarness`(:141)/`compilePlugin`(:192)에 새 placeholder 치환 추가. directive 값은
  `ExtractionResult.configs[]`/`state`(ADR-001)에서 옴.
- **frozen 디렉티브가 있으면 라우팅 영향**: fontScale/locale-RTL/placeholder처럼 frozen API가 필요한 config는 warm dlopen으로
  적용 불가 → orchestrator가 그 config의 렌더를 harness 경로로 보낸다(현재 multi-config가 이미 config별 1프레임을
  `compilePlugin`+reload로 도는데(`runMultiPreview` :999), frozen-필요 config는 `buildAndRun`(harness) 분기 :1032로 우회).
  단순 runtime override(theme)는 warm 경로 유지.
- 팔레트(dark theme)는 **빌드 시 생성된 static map**: `buildRunner`가 `{{PALETTE_DEFS}}`에 `bool __DarkOverride(StringView id,
  Vector4& out){ static const ... table; ... }` free function을 emit하고 `{{PRE_BUILD_INSTALL}}`에서
  `UiColorManager::Get().SetColorOverride(&__DarkOverride)`(:254, no-capture 충족). 토큰→색 테이블은 코드 상수(M3 범위 제한).

### 4) `UiColor("token")` 해석(F3.3)은 server에서
override가 설치된 warm 서버라면, server scene-builder의 `SBParseUiColor`(ADR-003)에 `UiColor("name")` 분기를 추가해
`UiColorManager::Get().GetColor(name, out)`(ui-color-manager.h:152)로 해석. install(override)은 이 ADR, 해석은 ADR-003.

## Alternatives considered
- **TS 레이어에서 색/스케일을 미리 계산해 scene JSON에 박기**: *기각* — 토큰 reskin은 "어떤 토큰이 어떤 색인지"를 dali-ui
  팔레트가 정함. TS가 팔레트를 복제하면 desync + dali-ui 업데이트에 취약. 싱글톤 install이 single source.
- **server scene-builder에서 config install(컴파일 path도)**: *기각* — server는 RENDER_JSON(scene)만 안다. config는
  컴파일 path(harness/plugin)의 관심사. 또 frozen setter는 server `main`의 `UiConfig::New().Apply()`(:1210)가 이미 한 번
  호출 → warm 서버에선 재설정 불가. 컴파일 path 템플릿이 옳은 site.
- **std::function/람다 팔레트**: *컴파일 불가*(Inv-5, fn-ptr only). static free function 강제.
- **`UiConfig::Apply()`를 매 reload 재호출**: *불가* — 두 번째 Apply는 assert(:166). runtime override 경로가 우회책.
- **focus를 frozen UiConfig로**: 부적절 — focus 타깃은 트리가 빌드된 *후*에만 존재. `SetCurrentFocusView`(runtime, :90)를
  `{{POST_BUILD_FOCUS}}`(빌드 직후). 단 focus-ring 가시성은 `SetAlwaysShowFocus`(frozen, :372)가 필요 → `{{UI_CONFIG_SETUP}}`에서
  **무조건 켠다**(ADR-006).

## Consequences
**Good**
- frozen/runtime 분리가 명확 → "warm 서버에서 안 먹는다"는 함정을 라우팅으로 회피(frozen-필요 config는 harness).
- 팔레트가 static free function → no-capture 컴파일 제약 충족, 리뷰가 "캡처 썼나"만 보면 됨(Inv-5).
- install이 템플릿 텍스트라 server.cpp 무변경(이미지 재빌드 0 for theme/locale/focus의 runtime 부분).

**Bad**
- frozen-필요 config(fontScale fallback/RTL/placeholder)는 warm dlopen fast-path를 못 타고 harness(느림)로 → 그 변형만 렌더가 느려짐.
  단 multi-config는 어차피 config당 1프레임(이미 느린 경로) → 체감 영향 작음.
- 팔레트가 코드 상수(M3) → 사용자 정의 토큰 테마 불가(과투자 금지 원칙; 정직: 토큰 기반 앱만 효과, hex는 불변).
- M0 스파이크 전엔 fontScale의 "어느 API가 텍스트를 키우나"가 미확정 → 둘 다 배선해 위험 회피(코드 약간 중복).

**Neutral**
- focus install이 ADR-006으로 위임(id→handle 해석은 거기). 이 ADR은 "어디서 호출하나"만.

## Affected milestones
- **M2**: focus install site(`{{POST_BUILD_FOCUS}}` + `SetAlwaysShowFocus` on) — F2.5. zero-arg 진입점 컴파일(ADR-001/F2.2)도 이 템플릿.
- **M3**: theme override(F3.2, runtime `SetColorOverride` + `{{PALETTE_DEFS}}`), fontScale(F3.1, Scale/ScalingFactor 양배선),
  RTL(F3.4, frozen `SetTextLayoutDirectionMode`), 미번역 배지(F3.5, runtime `SetLocalizedStringOverride`). `UiColor("token")`(F3.3)은 ADR-003 해석.
- **M5**: placeholder(F5.1, frozen `SetBrokenImageUrl` 또는 server ImageView 분기), progress(F5.4, 0.42 스크러버 재사용 — RENDER_AT, install 불요).
- **Inv-4/Inv-5**가 이 ADR의 핵심 제약.
