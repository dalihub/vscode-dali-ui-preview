# ADR-006 — Focus target resolution (M2)

## Status
Accepted (M2). ADR-001(파싱)·ADR-004(install site)에 부착.

## Context
TV 앱의 핵심은 "어느 항목이 포커스됐나"를 보는 것인데 현재 프리뷰엔 **전무**. plan.md M2 F2.4/F2.5:
`// @preview-state: focus=<id>`(ADR-001이 파싱)의 `<id>`를 실제 `View` 핸들로 해석해
`FocusManager::SetCurrentFocusView`(focus-manager.h:90)에 넘겨 포커스 링/룩을 입힌 한 장을 캡처한다.

usability 제약(research): **존재하지 않는 id를 새로 만들게 강요하면 안 된다**. 개발자가 이미 코드에 쓴 핸들/변수명을 그대로
`focus=`에 넣으면 잡혀야 한다. dali-ui/DALi가 주는 해석 수단:
- `Actor::FindChildByName(Dali::StringView)` (dali core actor.h:899) — 액터를 NAME 속성으로 찾음.
- 프리뷰는 이미 모든 Actor에 `Actor::Property::NAME`을 `__tag`로 세팅한다(harness :24-29, plugin :17-22, server SBBuildNode :558)
  — 단 그 값은 click-to-code용 `__L<line>`이라 사용자 변수명이 아님.
- focus-ring 가시성: `UiConfig::SetAlwaysShowFocus(bool)`(ui-config.h:372, frozen) — 켜져 있지 않으면 링이 안 보일 수 있음
  (M0 F0.5 스파이크가 확인).
- 폴백 탐색: `FocusManager::MoveFocus(FocusDirection)`(:124) / `GetCurrentFocusView()`(:113)로 첫 focusable로 이동 가능.

## Decision
`focus=<id>`를 **세 단계 폴백**으로 해석한다. 절대 사용자가 id를 발명하게 강요하지 않는다.

### 해석 순서 (빌드 후, `{{POST_BUILD_FOCUS}}` install site — ADR-004)
1. **인라인 태그(우선)**: 사용자가 `focus="Card1"`처럼 문자열을 줬고 코드의 어떤 노드에 그 이름이 붙어 있으면
   (사용자가 직접 `SetProperty(NAME,...)` 했거나, M2가 제공하는 가벼운 태그 헬퍼로), `root.FindChildByName("Card1")`(actor.h:899)로 해석.
2. **변수/핸들 이름 바인드**: `focus=card`(따옴표 없는 식별자)면, 빌드 시 **그 변수명을 NAME 속성으로 추가 태그**한다.
   - 구현: instrument 단계(`codeExtractor.instrumentCode` :430이 이미 `__tag(Type::New(...), "__L<line>")`를 주입)와 유사하게,
     `state.focus`가 식별자면 해당 변수 선언/대입을 찾아 `__focusTag(<var>, "<var>")`로 한 번 더 태그(click-to-code의 `__L`은
     유지하고 focus용 별칭 NAME을 보조 속성 또는 동일 NAME 덮어쓰기). 그러면 `FindChildByName("<var>")`로 잡힘.
   - 사용자는 **이미 쓴 변수명**(`View card = ...`)을 그대로 `focus=card`에 넣으면 됨 — 새 id 발명 0(usability 충족).
3. **Nth focusable 폴백**: 1·2가 실패하거나 `focus=`가 숫자(예: `focus=2`)면, 트리를 DFS로 walk해 N번째 focusable View를 잡는다
   (또는 `FocusManager::MoveFocus`를 N회). 존재하지 않는 이름이어도 "첫 focusable"이라도 보여줘 빈손 방지(정직: 못 찾았으면
   ADR-007 배지로 "focus 근사" 표시).

### focus-ring 가시성 (M0 스파이크 결론)
- install site(ADR-004 `{{UI_CONFIG_SETUP}}`)에서 `UiConfig::SetAlwaysShowFocus(true)`(:372)를 **무조건 켠다**(focus 디렉티브
  유무와 무관 — 켜져도 focus 없으면 무해). frozen API이므로 harness `main`의 `UiConfig::New()` 체인 또는 plugin이 Apply 전.
  M0 F0.5가 "이게 링을 그리는가, 아니면 다른 경로가 필요한가"를 확인 → 안 그리면 스파이크 로그의 "how"를 따라 보정.
- 해석된 View에 `FocusManager::Get().SetCurrentFocusView(view)`(:90) 호출 후 한 update 사이클 돌려 캡처(server `DoRenderAt`의
  "한 사이클 후 캡처" 패턴 :1066-1069 답습).

### server-path(AXIS-S)에서의 focus
- T1 server 경로는 RENDER_JSON(scene)만 다루고 focus는 컴파일 path(harness/plugin)의 관심사. focus 디렉티브가 있으면
  orchestrator가 **컴파일 path로 라우팅**(focus 해석/링이 full DALi를 요구). 즉 focus는 AXIS-C에서만 — M1 server 충실도와 독립.

## Alternatives considered
- **사용자에게 명시적 id 부여 강요(`focus-id="x"` 속성을 코드에 달게)**: *기각* — usability 위반(research). 개발자가 프리뷰
  위해 코드에 인공 id를 심어야 함 = Compose보다 나쁨. 이미 쓴 변수명/이름에 bind가 원칙.
- **NAME 속성을 click-to-code `__L`에서 focus용으로 재사용만**: *부분 채택* — `__L<line>`은 사용자 의미가 없어 `focus=`로
  못 씀. 그래서 식별자 focus는 **추가 태그**(변수명 NAME)를 주입. click-to-code NAME은 보존(별 속성 또는 우선순위).
- **항상 첫 focusable만**: *기각* — 특정 항목을 보고 싶은 케이스(TV 그리드의 3번째 카드)를 못 함. 이름/변수 바인드가 1순위,
  Nth는 폴백.
- **focus를 server scene-builder가 처리**: *기각* — server는 scene JSON만. focus 해석은 변수명/트리 walk가 필요해 컴파일
  path가 적합(ADR-004 install site). server 충실도(M1)와 섞지 않음.

## Consequences
**Good**
- 개발자가 **이미 쓴 변수/이름**을 `focus=`에 그대로 → 새 id 발명 0(usability 핵심). 못 찾아도 Nth 폴백으로 빈손 방지.
- focus는 AXIS-C(full DALi)에서만 → M1 server 충실도와 완전 독립, harness/dlopen로 검증 가능(plan.md M2 Demonstration).
- `SetAlwaysShowFocus(true)`를 무조건 켜 링 가시성 불확실성 제거(스파이크는 재확인).

**Bad**
- 식별자 focus의 "추가 태그" 주입은 instrument 로직 확장 → 변수 선언 탐지 엣지(멤버/람다 캡처 변수)에서 못 잡을 수 있음 →
  Nth 폴백 + 배지로 정직 처리.
- focus 디렉티브가 있으면 server fast-path를 못 타 harness/dlopen(상대적으로 느림) — 단 focus는 "한 장" 데모라 빈도 낮음.

**Neutral**
- Nth 폴백이 잡은 게 의도와 다르면 ADR-007 배지("focus 근사")가 정직 신호.

## Affected milestones
- **M2** (직접): F2.4(타깃 해석 bind+Nth fallback)/F2.5(링 렌더 1장, `SetCurrentFocusView`+`SetAlwaysShowFocus`).
- **ADR-001**이 `state.focus` 파싱, **ADR-004**가 install site(`{{POST_BUILD_FOCUS}}` + `SetAlwaysShowFocus`), **ADR-007**이 "focus 근사" 배지.
- **M0 F0.5**가 focus-ring 가용성 확인(이 ADR의 `SetAlwaysShowFocus` 결정을 재확인).
