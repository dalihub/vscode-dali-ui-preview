# ADR-002 — SliceBuilder 배치 + SliceResult 인터페이스

## Status
Accepted (M2)

## Context
자동추출의 결합 지점은 정확히 한 곳 — `compilePlugin`에 들어가는 **C++ 소스 문자열**을 더
똑똑하게 만드는 것(strategy 문서 §3, critique feasibilityVerdict). 나머지 배관(tier 폴백,
instrument, errorParser)은 인터페이스만 맞으면 재사용된다. 따라서 SliceBuilder는 새 tier가
아니라 **기존 runPreview 흐름 안에 끼워 넣는 변환 단계**여야 한다.

제약/함정:
- `instrumentCode`(`codeExtractor.ts:379-444`)는 본문의 `Type::New(`를 `__tag(...)`로 감싼다(L388 `CALL_START_RE`). 이건 **본문에만** 적용돼야 한다 — 수집한 헬퍼 정의에 instrument를 걸면 헬퍼의 `View::New()`가 잘못 태그되고, 안 걸면 헬퍼가 만든 actor를 click-to-code가 못 가리킨다(critique missing #3).
- `runPreview`(`previewOrchestrator.ts:460`)는 `extractPreviewCode` → (L505) `instrumentCode` → strategy 순. 현재 `DlopenStrategy.execute`(L118)는 instrumented `code: string`을 `compilePlugin(code)`(L135)로 단일 문자열 전달.
- 현 24샘플 전부 자기완결 single-fn → slice 경로 미실증. 비자기완결 경로(Rung2)는 신규.

## Decision
SliceBuilder를 **instrument 직후**(L505 다음)에 진입시킨다. 신규 `src/sliceBuilder.ts`가
`build(doc, extraction, instrumentedBody)` 를 제공하고 `SliceResult`를 반환:

```ts
interface SliceResult {
  includes: string;          // hoist된 #include ("" 가능)
  globals:  string;          // 위상정렬된 헬퍼/타입/상수 정의 + weak-stub ("" 가능, 비-instrument)
  body:     string;          // instrumented 진입 본문 (항상 non-empty)
  sourcePaths: string[];     // #line 원본 경로 집합 (errorParser 동적 게이트) — [0]=entry
  unresolvedStubs: string[]; // weak-stub로 메운 식별자명 (진단/매트릭스)
  rung: 'single-fn' | 'heuristic';
}
```

분기:
- **미해결 참조 0 → Rung3(`single-fn`)**: `{ body: instrumentedBody, includes:'', globals:'' }` 통과(passthrough). 빈 슬롯 → byte-identical(Inv-1).
- **미해결 존재 → Rung2(`heuristic`)**: 같은 파일/동반 헤더 정의 수집(비-instrument) → `globals`; 남은 미정의 → weak-stub; `#include` hoist → `includes`.

소유권: SliceBuilder 생성·소유 → orchestrator가 strategy로 전달 → buildRunner가 슬롯 치환 +
`sourcePaths`를 errorParser로 전달. `compilePlugin` 시그니처는 `(userCode: string)`과
`(slice: SliceResult)` 둘 다 수용(오버로드; 문자열이면 `{body}`로 승격 → 하위호환).

ParserStrategy(L41 `parseChainExpression`)는 `rung==='single-fn'` 일 때만 시도(현행 그대로).
slice가 globals를 생성한 경우 parser 경로는 본문만 보므로 **skip**하고 DlopenStrategy로.

## Alternatives considered
- **새 4번째 tier(SliceStrategy)로 추가**: tier 선택 로직(L542/564/599)이 복잡해지고, Rung2/3 모두 결국 `compilePlugin`을 타므로 중복. "변환 단계 + 기존 DlopenStrategy 재사용"이 더 단순. 기각.
- **extract 단계에서 슬라이스(instrument 전)**: 그러면 body에 instrument를 다시 걸 때 globals까지 휩쓸림. instrument 후 분리가 깔끔. 기각.
- **SliceResult 없이 `{includes,globals,body}` 튜플만**: `sourcePaths`(errorParser 동적 게이트)와 `unresolvedStubs`(진단/매트릭스)·`rung`(매트릭스)이 M3 demonstration에 필수. 구조체로 캡슐화. 채택.

## Consequences
**Good**
- 결합 지점 1곳 유지 → DlopenStrategy/errorParser/instrument 재사용. 신규 표면 최소.
- Rung3 passthrough가 회귀 0의 단일 메커니즘 → byte-identical 추론이 한 곳.
- `sourcePaths`/`unresolvedStubs`/`rung`이 M3 Rung 매트릭스 리포트의 데이터 소스.

**Bad**
- `compilePlugin` 오버로드(string|SliceResult)는 약간의 타입 분기. 단 호출 6곳 중 5곳은 string 유지(하위호환), DlopenStrategy만 SliceResult.
- instrument/globals 분리를 어기면 click-to-code 정합성 깨짐 → SliceBuilder가 "globals는 절대 instrument 안 함" 불변을 명시·테스트.

**Neutral**
- `*.preview.dali.cpp`는 보통 자기완결 → 거의 항상 Rung3 → 빠른 경로 100% 보존.

## Affected milestones
- **M2** (직접): SliceBuilder + orchestrator 통합 + Rung2 green 전환.
- **M0**: red baseline 픽스처가 이 인터페이스로 "현재 미정의" 확정.
- **M3**: rung/unresolvedStubs로 도달 매트릭스 산출.
</content>
