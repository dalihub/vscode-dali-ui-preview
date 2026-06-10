# ADR-001 — 3-슬롯 템플릿 (byte-identical 빈 슬롯)

## Status
Accepted (M1)

## Context
현재 플러그인 템플릿(`server/preview_plugin.cpp.template` L23-26)은 사용자 코드를
**함수 본문 안**에 붙여넣는다:

```cpp
extern "C" View CreatePreview()
{
{{USER_CODE}}        // ← L25, 본문 statement 시퀀스
}
```

슬라이스(헬퍼 함수 정의, 타입, 상수, `#include`, weak-stub)는 **함수 본문 안에 넣으면
C++ 문법 에러**다(전역 정의/include 불가). 따라서 본문에 욱여넣을 수 없고, 파일 최상위/전역
슬롯을 새로 파야 한다.

동시에 **회귀 0**이 절대 제약(CLAUDE.md MANDATORY, Inv-1, Inv-4): 자기완결 코드(현 24개
샘플)는 새 슬롯이 빈 문자열일 때 생성 .cpp가 기존과 **byte-identical**이어야 한다. 골든 테스트
(`harnessGeneration.test.ts:116` `expect(generated).to.equal(golden)`)가 전체 문자열
동등을 검사하므로 빈 줄 1개라도 어긋나면 실패한다. errorParser·offset 계산도
`{{USER_CODE}}` placeholder 위치에 의존한다(`errorParser.ts:97-108` `getHarnessCodeOffset`).

## Decision
1슬롯 → **3슬롯** `{{USER_INCLUDES}}` / `{{USER_GLOBALS}}` / `{{USER_BODY}}` 로 확장한다.
적용 템플릿: `preview_plugin`, `preview_harness`, `preview_interactive`, `preview_animation`
(4개 모두 `{{USER_CODE}}` 보유 — `grep` 확인).

**byte-identical 보장 기법 (핵심)**: 신규 두 슬롯의 placeholder를 *템플릿의 기존 빈 줄
위치*에 그대로 놓는다. 치환은 단순 `String.replace(/\{\{SLOT\}\}/g, value)`:
- 빈 슬롯(`value=''`) → placeholder 토큰만 사라지고 **그 줄은 빈 줄로 잔존** = 원본의 빈 줄 복원 = byte-identical.
- 값 있음 → 슬롯 값이 그 줄을 채우고, 값은 **자기 앞뒤 개행을 스스로 포함**(SliceBuilder가 `\n<defs>` 형태로 emit)해 전역 영역을 형성.

배치(검증된 원본 빈 줄 자리):
- plugin: `{{USER_INCLUDES}}` = 원본 L9 빈 줄, `{{USER_GLOBALS}}` = 원본 L21 빈 줄, `{{USER_BODY}}` = 원본 L25(`{{USER_CODE}}`).
- harness: `{{USER_INCLUDES}}` = L15 빈 줄, `{{USER_GLOBALS}}` = L30 빈 줄, `{{USER_BODY}}` = L34.

buildRunner의 6개 `{{USER_CODE}}` 치환(`buildRunner.ts:166,291,375,564,664,835`)은
`applySlots(tpl, { includes='', globals='', body })` 헬퍼로 통합. 기존 호출은
`{ body: userCode }`만 넘김 → includes/globals 빈 → byte-identical. `getHarnessCodeOffset`은
`{{USER_CODE}}` → `{{USER_BODY}}` 토큰으로 갱신(테스트 동기화).

## Alternatives considered
- **1슬롯 유지 + 본문에 인라인**: C++ 문법상 전역 정의/include가 함수 본문에 불법 → 컴파일 자체 실패. 기각.
- **별도 prelude 파일 + 멀티 TU 링크**: `.so` 빌드 스크립트(`dockerRuntime.ts:505`)는 단일 `.cpp` 가정. 멀티 TU는 빌드 스크립트·마운트 변경 유발(Inv-5 위협). 기각.
- **placeholder를 새 줄로 추가(빈 줄 점유 아님)**: 빈 슬롯이 빈 줄을 **추가로** 남겨 golden과 1줄 차이 → byte-identical 붕괴(critique missing #6이 정확히 경고). 기각.
- **빈 슬롯 시 placeholder+개행을 함께 제거(`/\{\{SLOT\}\}\n/`)**: 가능하나, 원본의 "있던 빈 줄"까지 삭제해 오히려 줄이 하나 줄어듦 → byte-identical 붕괴. "빈 줄 점유 + 단순치환"이 더 단순하고 안전. 기각.

## Consequences
**Good**
- 빈 슬롯 byte-identical → 579 테스트 무회귀(Inv-1/4). 단순 `replace`라 추론 쉬움.
- `server/*.cpp`·이미지 무변경(Inv-5). 템플릿 텍스트 + buildRunner TS만.
- 전역 슬롯이 생겨 M2 슬라이스가 얹힐 결합 지점 1곳 확보.

**Bad**
- 4개 템플릿 + 6개 치환부 + errorParser offset + 골든 테스트를 **동시에** 개명·동기화해야 함(누락 시 회귀, critique S6 경고). → `applySlots` 단일 헬퍼로 표면적 축소.
- 골든이 1슬롯 기준 → plugin용 골든 신규 추가 필요(현재 harness/animation 골든만 존재).

**Neutral**
- `{{USER_BODY}}` 개명은 의미 보존(본문 자리 동일). interactive/animation도 같은 규칙.

## Affected milestones
- **M1** (직접): 3슬롯 + 치환 배관 + offset 갱신.
- **M2**: globals/includes 슬롯에 SliceBuilder 산출 주입.
- **M3**: byte-identical 깨지면 24샘플 실빌드 회귀.
</content>
