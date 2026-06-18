# M1 spec — 서버 렌더 충실도 (clean-T1 path)

> Goal: T1 파서→서버 scene-builder(`SBBuildNode`) 경로의 silent-wrong을 제거한다 — 이미 들어온 코드를 *정확히* 그린다. 검증은 M0의 `npm run test:e2e:server`(local backend가 preview_server.cpp를 소스 재컴파일 → 서버 변경 즉시 반영). ADR-003 따름.
> 범위 정직화(fact 3): 이 수정은 깨끗한 단일식 T1 path(.preview.dali.cpp 데모/첫인상)에만 영향. 실전 멤버/헬퍼 코드는 이미 T2(harness)로 우회되어 정확.

## 구현 위치 (docker/preview_server.cpp, ADR-003)
- `SBApplyCommonProps`(:491) — View 공통 setter (cornerRadius/opacity/visibility/borderline).
- per-type 분기 `SBBuildNodeRaw`(:563) — Label 메서드형 SetText/SetMarkupEnabled, ImageView 메서드형 SetResourceUrl.
- `SBParseUiColor`(:438) — named-color 테이블 + `.WithAlpha`.
- 파서는 이미 모든 `.Method(args)`를 `node.properties`에 담음(cppParser.ts:308) → 서버가 읽기만 하면 됨. 파서 변경 없음.

## Work units
각 WU: 서버 분기 추가 + server-path 샘플(`test/samples/server-path/`) + 골든(red→green: 렌더가 정확해진 걸 육안 확인 후 골든 채택). Tier 1. Assertion 공통: `npm run compile && DALI_PREFIX=... npm run test:e2e:server` 에서 해당 샘플 PASS(+ 시각 정확성 오케스트레이터 확인).

### WU-M1.1 — View 공통 setter (F1.1 cornerRadius + F1.6 opacity/visibility/borderline)
- **Files**: docker/preview_server.cpp(`SBApplyCommonProps`); 기존 `corner-radius.preview.dali.cpp`(골든 square→round 갱신); NEW `test/samples/server-path/opacity-borderline.preview.dali.cpp`.
- **구현**: `SBApplyCommonProps`에 else-if 추가 — `SetCornerRadius`(`view.SetCornerRadius(SBParseFloat(a0))`, view.h:867), `SetOpacity`(view.h:405), `SetVisibility`(bool, view.h:389), `SetBorderlineWidth`(view.h:960)/`SetBorderlineColor`(view.h:979). 단일-arg 우선(4-corner overload는 DEFER).
- **Acceptance**: corner-radius 샘플의 teal 박스가 **둥근** 모서리로 렌더(이전 각짐). opacity-borderline 샘플이 반투명+테두리로 렌더. 골든 PASS.
- **✋**: yes — corner-radius가 실제로 둥근지 1회 육안.

### WU-M1.2 — named-color (F1.5)
- **Files**: docker/preview_server.cpp(`SBParseUiColor`); NEW `test/samples/server-path/named-color.preview.dali.cpp`.
- **구현**: `SBParseUiColor`에 `Color::RED/GREEN/BLUE/WHITE/BLACK/YELLOW/...` → Vector4 테이블(dali constants.h 값) + 체인 `.WithAlpha(<f>)` 처리(파싱된 properties에서). 미지 토큰은 검정 아닌 정직한 fallback(예: magenta 디버그색 또는 회색 — "unknown" 표식). `UiColor("token")` 해석은 M3(override 설치 후) — 여기선 named *상수*만.
- **Acceptance**: `Color::RED` 배경이 **빨강**으로(이전 검정), `.WithAlpha(0.5)` 반영. 골든 PASS.

### WU-M1.3 — Label 메서드형 (F1.2 SetText + F1.4 SetMarkupEnabled)
- **Files**: docker/preview_server.cpp(Label 분기); NEW `test/samples/server-path/label-methods.preview.dali.cpp`.
- **구현**: Label 분기에서 생성자 인자뿐 아니라 properties의 메서드형 `SetText("x")`(label.h:200, 따옴표 strip) + `SetMarkupEnabled(true)`(label.h:414) 반영. `Label::New().SetText("Hi")`가 빈칸 아닌 "Hi"로.
- **Acceptance**: `Label::New().SetText("Method Text")`가 글자로 렌더(이전 빈 라벨). markup(`<color>`) 텍스트가 무시되지 않음. 골든 PASS.

### WU-M1.4 — ImageView 메서드형 SetResourceUrl (F1.3)
- **Files**: docker/preview_server.cpp(ImageView 분기); NEW `test/samples/server-path/imageview-method-url.preview.dali.cpp`.
- **구현**: ImageView 분기가 메서드형 `.SetResourceUrl("...")`(image-view.h:176)도 URL로 받음(이전엔 생성자 인자만). 실제 픽셀(에셋)은 M5 placeholder — 여기선 ImageView가 **치수 가진 요소**로 렌더되는지(빈 View 아님)만.
- **Acceptance**: 메서드형 URL ImageView가 지정 치수의 요소로 렌더(크래시/빈 View 아님). 골든 PASS(치수 박스).
- **Note**: 시각 차이가 약함(에셋 없음) → 골든은 "sized box" 일관성만 검증.

## Dependency order
WU-M1.1 → M1.2 → M1.3 → M1.4 (전부 같은 파일; 순차. 서버 1회 재컴파일로 누적 검증).

## Out of scope
저빈도 매핑(Grid/Scroll/InputField 타입, gradient visual = DEFER). `UiColor("token")` 해석(M3). 파서 변경. config/focus/cross-file.

## Self-Review
- Placeholder scan: none. 각 WU files/acceptance/tier 부여.
- Internal consistency: F1.1~F1.6 ↔ WU-M1.1~M1.4 매핑(F1.6은 M1.1에 흡수, 6피처/4WU). ADR-003 위치 그대로. M0 러너로 검증.
- Scope check: 4 WU, 모두 단일 setter군 + 샘플. 같은 파일이라 linear.
- Ambiguity: F1.3 시각 약함을 Note로 명시(sized box 검증). 미지 토큰 fallback은 "검정 아닌 정직한 표식"으로(검정 금지).
