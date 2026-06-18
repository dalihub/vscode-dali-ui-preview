# ADR-003 — Server scene-builder extension pattern (M1)

## Status
Accepted (M1). ADR-002의 server 골든이 게이트.

## Context
`docker/preview_server.cpp`의 scene-builder가 충실도 갭의 원천이다. 현재 상태(grep 확인):
- `SBApplyCommonProps` (:491): `SetRequestedWidth/Height`, `SetBackgroundColor`, `SetPadding/Margin`만. **`SetCornerRadius`/
  `SetOpacity`/`SetVisibility`/Borderline 없음** → 각진 모서리/불투명 고정.
- `SBParseUiColor` (:438): `UiColor(0x...)` 리터럴만 파싱. 그 외(named `Color::RED`, 토큰 `UiColor("OnSurface")`)는
  **`UiColor(0x000000)` 검정 fallback**(:452) → silent-black 버그.
- `SBBuildNodeRaw` (:563): Label 텍스트는 `constructorArgs[0]`만(:569) — **메서드형 `.SetText()` 무시**(빈 라벨).
  `SetMarkupEnabled` 없음. ImageView URL은 `constructorArgs[0]`만(:621) — 메서드형 `.SetResourceUrl()` 무시.

파서가 이미 메서드형을 properties로 넘긴다: `cppParser`의 `node.properties[method] = args`(:308). 즉 `.SetText("x")`는
scene JSON에 `"properties":{"SetText":["\"x\""]}`로 들어온다 — 서버가 이 키를 **읽기만 하면** 된다(파서 변경 불요).

dali-ui API 시그니처(검증, 헤더 인용):
- `View::SetCornerRadius(float radius)` — view.h:867 (Vector4 :885, 4-corner :877)
- `Label::SetText(const Dali::String&)` — label.h:200; `SetMarkupEnabled(bool)` — :414; `SetFontSize(float)` — :228; `SetTextColor(const UiColor&)` — :271
- `ImageView::SetResourceUrl(const Dali::String&)` — image-view.h:176
- `Actor::SetProperty(Actor::Property::OPACITY/VISIBLE, ...)` (DALi core) — opacity/visibility는 Actor 속성

**CUT 확정**: 메서드형 `SetOrientation`은 **View에 API 없음**(StackLayout 생성자 인자뿐) → 추가하지 않음(research §CUT).

## Decision
세 helper의 **setter-dispatch 패턴을 그대로 확장**한다(새 추상화 도입 없음). 모든 추가는 ADR-002 server 골든의
베이스라인(hex/Flex/Stack/생성자 Label)을 **깨지 않아야** 한다(Inv-1).

### 1) `SBApplyCommonProps` (:491) — 공통 setter 추가 (F1.1, F1.6)
기존 `if/else if` 체인에 추가(모든 View 파생에 적용되므로 공통이 옳다):
```
else if (n == "SetCornerRadius")  view.SetCornerRadius(SBParseFloat(a0));        // view.h:867
else if (n == "SetOpacity")       view.SetProperty(Actor::Property::OPACITY, SBParseFloat(a0));
else if (n == "SetVisible" || n == "SetVisibility")
                                  view.SetProperty(Actor::Property::VISIBLE, (a0=="true"||a0=="1"));
else if (n == "SetBorderlineWidth") view.SetProperty(/* DevelControl borderline */ ...);  // M1: 정직 fallback
else if (n == "SetBorderlineColor") view.SetBackgroundColor 등과 동일 색 파싱
```
- `SetCornerRadius`는 메서드형(`.SetCornerRadius(12.0f)`)으로 들어온다 — properties 키. **단일 float만** 지원
  (Vector4/4-corner 형태는 저빈도 DEFER).
- Borderline은 dali-ui View가 직접 노출하지 않을 수 있으므로 M1은 "정직 fallback"(가능한 속성으로 근사, 불가하면 무시 +
  ADR-007 배지 후보). 무리한 매핑 금지(research §5b DEFER 경계).

### 2) `SBParseUiColor` (:438) — named-color 테이블 + `.WithAlpha` (F1.5)
기존 `UiColor(0x...)` 분기 **앞에** named 분기 추가(리터럴 우선순위 유지):
```
static const std::pair<const char*, uint32_t> kNamedColors[] = {
    {"RED",0xFF0000FF},{"GREEN",0x00FF00FF},{"BLUE",0x0000FFFF},{"WHITE",0xFFFFFFFF},
    {"BLACK",0x000000FF},{"YELLOW",...},{"CYAN",...},{"MAGENTA",...},{"TRANSPARENT",0x00000000}, ... };
```
- `Color::RED` / `Color::WHITE` → 테이블 룩업. scope를 `find("RED")`류 substring로(SBApplyFlexProps의 `a0.find(...)` 패턴 :518 답습).
- `.WithAlpha(<f>)` 변형: `Color::RED.WithAlpha(0.5f)` → 베이스 색 룩업 후 alpha 채널만 교체.
- **미지 토큰은 검정 fallback 유지하되**(ADR-002가 잡음), `UiColor("name")` 토큰 형태는 **여기서 처리하지 않음** —
  M3에서 ADR-004의 `SetColorOverride` 설치 후 별도 분기(F3.3). M1은 named C++ 상수만.

### 3) Per-type 분기 (`SBBuildNodeRaw` :563) — 메서드형 텍스트/URL/markup (F1.2, F1.3, F1.4)
Label 분기(:567)에 **constructorArgs가 비었을 때 properties의 `SetText`로 폴백** + markup/색 처리:
```
// 생성자 text가 비면 메서드형 SetText 사용
if (text.empty() && props에 "SetText") text = stripQuotes(props["SetText"][0]);
Label lbl = Label::New(text);
... 기존 SetFontSize/SetTextColor 루프(:579) 유지 ...
if (props에 "SetMarkupEnabled") lbl.SetMarkupEnabled(a0=="true");   // label.h:414  — Label::New 직후, SetText 반영 전이면 재-Set
```
- **메서드형이 생성자형보다 우선**할지: 둘 다 있으면(드묾) 생성자 인자를 베이스로 두고 메서드형으로 덮음(빌더 시맨틱과 일치).
- ImageView 분기(:619): 같은 패턴 — 생성자 URL이 비면 `props["SetResourceUrl"]`로 폴백 → `ImageView::New(url)` 또는
  `iv.SetResourceUrl(url)`(image-view.h:176). 픽셀(실제 이미지)은 M5 placeholder; M1은 URL 메타만 세팅(빈 박스 제거).

### 파싱 헬퍼 컨벤션 (재사용)
- 스칼라: `SBParseFloat`(:430, 후행 `f` 제거). bool: `a0=="true"||a0=="1"`. 색: `SBParseUiColor`. Extents: `SBParseExtents`(:455).
- 문자열 인자: `constructorArgs`/properties 값은 C++ 리터럴 따옴표 포함(`"\"Hello\""`) → 기존 `stripQuotes`(Label :571) 재사용.
- enum/method-form 분기는 SBApplyFlexProps의 `a0.find("VALUE")` substring 매칭(:518) 답습 — 정확 일치보다 견고(`FlexDirection::COLUMN` 같은 scope 접두 흡수).

## Alternatives considered
- **파서(`cppParser.ts`)를 고쳐 메서드형을 생성자로 정규화**: *기각* — 파서는 이미 메서드형을 properties로 충실히 넘김(:308).
  서버가 그 키를 안 읽을 뿐. 서버 수정이 최소 변경. 파서를 건드리면 harness/dlopen 경로(메서드형이 이미 동작)에 회귀 위험.
- **`SBBuildNodeRaw`를 데이터 주도 테이블로 리팩터**: *기각* — M1 범위(6 setter)에 과투자. 기존 if/else 체인에 라인 추가가
  Inv-1(베이스라인 불변) 위험이 가장 낮고 리뷰가 쉽다. 큰 리팩터는 별도 트랙.
- **Borderline/Grid/Scroll/InputField/gradient까지 풀매핑**: *기각/DEFER*(research §5b) — 저빈도. 샘플이 요구할 때만.
  M1은 고빈도(cornerRadius/text/url/markup/named색/opacity)만.
- **named 색을 호스트(`buildRunner`)에서 hex로 치환 후 JSON 전송**: *기각* — 색 해석을 두 곳(host+server)에 분산. 서버가
  scene JSON의 single source. 또한 토큰 색(M3)은 어차피 server가 override 테이블로 풀어야 해 server-side 해석이 일관.

## Consequences
**Good**
- silent-wrong(각진 모서리/빈 라벨/검정 배경)이 데모/첫인상 path에서 사라짐 — 신뢰 backbone.
- 파서 무변경 → harness/dlopen 경로(AXIS-C) 회귀 0. server만 똑똑해짐.
- 모든 추가가 기존 dispatch 체인 라인 → 리뷰·롤백 단순, Inv-1 위험 최소.

**Bad**
- baked-in: 모든 setter가 이미지 재빌드 전엔 docker에 안 들어감(MEMORY 반복 경고). 검증/개발은 local backend(ADR-002).
  릴리즈 시 이미지 재빌드+push 필요.
- named-color 테이블이 하드코딩 → dali-ui가 더 많은 named 상수를 가지면 수동 동기화. 단 표준 16색 + transparent로 실전 커버 충분.

**Neutral**
- 가치 범위가 좁음(fact 3): single-fn T1 path만 AXIS-S 도달(`previewOrchestrator.ts:692`). heuristic/`.Play()`는 AXIS-C(full DALi,
  갭 없음). 이는 정직하게 받아들인 제약 — ADR-002 골든도 같은 범위만 검증.

## Affected milestones
- **M1** (직접): F1.1(cornerRadius)/F1.2(메서드형 SetText)/F1.3(메서드형 SetResourceUrl)/F1.4(markup)/F1.5(named색)/F1.6(opacity·visibility·borderline).
- **M3**: F3.3 `UiColor("token")` 해석은 이 `SBParseUiColor`에 **별도 분기**로 추가(ADR-004의 `SetColorOverride` 설치 후 warm 서버에서).
- **ADR-002**가 게이트; 모든 setter는 server 골든으로 증명.
