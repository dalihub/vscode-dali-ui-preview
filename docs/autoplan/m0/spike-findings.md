# M0 spike findings (F0.4 + F0.5)

> 헤더 실측(native prefix) + preview 바이너리 grep. ADR-004 가정 검증 결과.

## F0.4 — config override 멱등성 (warm 서버 vs harness)

**핵심: `UiConfig`는 "immutable-after-init"** (ui-config.h:52). 모든 setter는 `Apply()` 전에만 호출 가능 — 이후 호출 시 **assertion 실패**(ui-config.h:57-58). `Apply()`는 **1회만**(2회째 assert, ui-config.h:166). warm resident 서버는 시작 시 `UiConfig::New().Apply()`를 1회 호출(preview_server.cpp:1210) → **렌더마다 UiConfig 재적용 불가**.

| 기능 | API | warm-server 호출 가능? | 결정 |
|---|---|---|---|
| **fontScale** | `UiConfig::SetScalingFactor(f)` (ui-config.h:177) | ❌ frozen-after-Apply | harness 1회 경로만 |
| **fontScale (대체)** | `UiScaleManager::SetScale(f)` (ui-scale-manager.h:124, void) | ✅ 런타임 | **M3/F3.1: warm 서버는 SetScale, harness는 SetScalingFactor** ⚠️SetScale은 layout-root 등록 필요할 수 있음 → M3에서 확인 |
| **theme override** | `UiColorManager::SetColorOverride(fn)` (ui-color-manager.h:254) | ✅ 런타임("called before every color lookup") | **M3/F3.2: 런타임 override.** 단 **순수 fn-ptr** `bool(*)(StringView,Vector4&)` — 캡처 람다/멤버 금지(ui-color-manager.h:52,233) → 다크 팔레트는 **static free function** |
| **locale override** | `UiLocalizationManager::SetLocalizedStringOverride(fn)` | ✅ 런타임(동일 fn-ptr 패턴) | M3/F3.5: 런타임 override(static fn). 카탈로그 경로는 별도 |
| **RTL 방향** | `UiConfig::SetTextLayoutDirectionMode` (frozen) / `View::SetLayoutDirection` (per-view) | UiConfig는 ❌ / per-view ✅ | M3/F3.4: per-view `SetLayoutDirection(RIGHT_TO_LEFT)` 빌드 직후, 또는 harness 1회 |
| **broken image** | `UiConfig::SetBrokenImageUrl` (frozen) | ❌ | M5/F5.1: 템플릿 UiConfig 셋업에서 Apply 전 1회 설정 |

**Verdict**: 런타임 override(theme/locale color/scale)는 **warm 서버에서 동작(override-path OK)**. UiConfig setter류(SetScalingFactor·SetBrokenImageUrl·SetAlwaysShowFocus·RTL-direction)는 **needs-harness/templates** — 템플릿의 `UiConfig::New()...Apply()` 체인에 Apply 전에 끼우거나 one-shot harness 경로로.

## F0.5 — focus-ring 가용성

`UiConfig::SetAlwaysShowFocus(bool)` **존재**(ui-config.h:372) + `IsFocusIndicatorAlwaysShown()`(:379). `FocusManager::SetCurrentFocusView(View)` 존재(focus-manager.h:90, returns bool).

**현재 상태**: preview 바이너리들이 `UiConfig::New().Apply()`만 호출 — **SetAlwaysShowFocus 미설정**:
- `server/preview_harness.cpp.template:318` → `UiConfig::New().Apply();`
- `docker/preview_server.cpp:1210` → `UiConfig::New().Apply();`
→ 정적 렌더에 **현재 포커스 링이 안 나옴**.

**focus-ring available: YES (with change)**. M2/F2.5가 해야 할 것:
1. **focus 경로 템플릿(harness + plugin)**의 `UiConfig::New().Apply()` → `UiConfig::New().SetAlwaysShowFocus(true).Apply()` (Apply 전, frozen 제약 준수). focus는 ADR-006상 AXIS-C(full DALi=harness/dlopen) 경로 → 그 템플릿을 고침.
2. 빌드 직후 `FocusManager::Get().SetCurrentFocusView(<target>)` 호출 → 링 표시.
3. (server scene-builder 경로는 focus 안 함 — RENDER_JSON엔 focus 의미 없음. preview_server.cpp의 UiConfig는 M2 대상 아님.)

## M0 결론이 다음 마일스톤에 주는 입력
- **M2/F2.5**: harness/plugin 템플릿에 `SetAlwaysShowFocus(true)` 추가(Apply 전) + post-build `SetCurrentFocusView`.
- **M3/F3.1**: warm 서버 fontScale = `UiScaleManager::SetScale`; harness = `SetScalingFactor`. (ADR-004 PRE_BUILD_INSTALL은 런타임 override, UI_CONFIG_SETUP은 frozen 셋업으로 분리한 게 맞음.)
- **M3/F3.2·F3.5**: 다크 팔레트/locale 표는 **static free function**(캡처 금지).
