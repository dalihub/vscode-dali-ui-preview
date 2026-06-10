# ADR-004 — weak void-stub for RTLD_NOW (미정의 심볼 본문 합성)

## Status
Accepted (M2)

## Context
Rung2 수집 후에도 정의를 못 찾는 식별자가 남는다: 멤버필드 `this->mX`, 외부 모델 `vm`,
시그니처 모르는 외부 자유함수. 이들을 **컴파일·렌더 가능하게** 채워야 한다.

코드로 확정된 결정적 제약(`server/preview_server.cpp:999`):
```cpp
mPluginHandle = dlopen(req.soPath.c_str(), RTLD_NOW | RTLD_LOCAL);
```
`RTLD_NOW` = 로드 시점에 **모든 심볼을 즉시 해석**. 미정의 strong 심볼이 하나라도 있으면
**dlopen 즉사**(`>>>ERROR`). 링커 트릭(`--unresolved-symbols=ignore-all`,
`--allow-shlib-undefined`)은 무용 — 링크는 통과해도 dlopen이 죽는다. weak 심볼도 **선언만**이면
호출 시 SIGSEGV. → **모든 외부 심볼은 실제 stub 본문을 가져야 한다**(Inv-2). "미정의인 채
두기"는 원천 불가.

## Decision
미해결 식별자마다 `__attribute__((weak))` **본문 있는** 정의를 globals 슬롯에 코드생성한다.
weak이므로, 동반수집(Rung2)이 진짜 정의를 가져오면 strong 정의가 weak stub을 덮어쓰는 안전망.

최소 type 휴리스틱(정밀 타입 모를 때, 토크나이저로 본문 사용맥락만 보고 추정):

| 사용 맥락 | 합성 stub |
|---|---|
| `View`-반환 헬퍼 (`Make*`/`Build*` 네이밍, child로 쓰임) | `__attribute__((weak)) Dali::Ui::View f(...) { return Dali::Ui::View::New(); }` |
| `for(auto& x : ID)` 의 컨테이너 `ID` | `auto ID = std::vector<...>{ E, E, E };`  (N=3 더미 — 비우면 루프 0회=빈 화면) |
| 문자열 맥락 (`Label::New(ID)`) | `std::string ID = "Sample";` |
| 스칼라 맥락 (산술/비교) | `int ID = 0;` / `float ID = 0.0f;` |
| 그 외 | weak 빈-본문 자유함수 또는 `auto ID = decltype(...){};`; `unresolvedStubs`에 기록 |

S7 컴파일 후 `undeclared X` 에러가 남으면 X를 weak-stub로 **1회 재분류** 후 재시도(reducer
oracle 원리만 차용, 실행 아님; fixpoint 금지). 이것이 "2분할이 안전망처럼 보이지만 실제론
'정의 있음' 가지가 폐포를 놓치면 즉사"(critique overOptimistic)에 대한 실질 방어.

## Alternatives considered
- **선언만 stub**(`View f();`): `RTLD_NOW`에서 미정의 → dlopen 즉사 / 호출 시 SIGSEGV. 절대 불가. 기각.
- **링커 unresolved 무시 플래그**: 링크만 통과, dlopen 즉사. 무용. 기각.
- **strong stub (weak 아님)**: 동반수집한 진짜 정의와 **중복 정의(ODR) 링크 에러**. weak이라야 진짜 정의가 우선. 기각.
- **gmock/PowerFake/FSeam 차용**: gmock=가상함수 전용, PowerFake/FSeam=수동 나열. 자유함수/멤버필드 자동 합성엔 부적합. 자체 코드생성 채택.
- **빈 기본값 정밀(clang RecordDecl::fields())**: 타입 정밀하나 clang 의존(ADR-003에서 기각). 맥락 휴리스틱으로 대체 — 컴파일 통과 우선.

## Consequences
**Good**
- dlopen 즉사 회피(Inv-2) → M3 PNG 생성 가능.
- weak 의미론이 "진짜 정의 우선" 안전망 → Rung2 수집이 부분 성공해도 깨지지 않음.
- vector N=3 더미가 "빈 화면" 대신 "카드 형상"이라도 그림.

**Bad**
- **silent-wrong**: 빈/더미 데이터는 "컴파일·레이아웃 보존이지 의미 보존 아님"(critique S4). `mTransactions`의 실제 이름·금액은 코드에 부재(정보이론적 한계). → 사용자가 "빈 카드"를 버그로 오인 가능. M2는 `unresolvedStubs` outputChannel 진단으로만 노출(시각 배지=M3 out-of-scope, plan.md 성공기준=컴파일+dlopen+PNG).
- 타입 오추론 시 컴파일 실패 → S7 1회 보정. 매크로 지옥은 자동 탈출 없음(Rung4).

**Neutral**
- `unresolvedStubs`는 M3 Rung 매트릭스의 "어디서 stub됐나" 입력.

## Affected milestones
- **M2** (직접): weak-stub 합성 + 1회 보정.
- **M3**: dlopen 성공이 stub 본문 완전성에 직결. 매트릭스가 패턴별 stub 의존 기록.
</content>
