# ADR-005 — errorParser 동적 출처집합 (#line 호환)

## Status
Accepted (M1)

## Context
M2 슬라이스는 globals 슬롯에 헬퍼/타입/상수/stub을 emit하므로 본문이 K줄 아래로 밀린다. 또
본문 컴파일 에러를 **원본 파일·라인**으로 되돌리려면 `#line N "원본.cpp"`를 본문 슬롯 앞에
주입해야 한다(strategy §5, §6).

그런데 현재 `parseGccErrors`(`errorParser.ts:27-60`)가 이를 두 가지로 깬다:
1. **정적 파일명 게이트**(L46 `isPluginFile = filePath.includes('preview_plugin')`, L58 미스매치면 `continue`). `#line N "원본.cpp"` 삽입 시 g++이 본문 에러 파일명을 `원본.cpp`로 보고 → `includes('preview_plugin')` false → **본문 에러 전부 조용히 드롭**(critique S6). "에러가 엉뚱한 줄"을 막으려다 "에러가 아예 안 뜸"이 됨.
2. **단일 offset 산수**(L66 `mappedLine = gccLine - harnessCodeOffset`). globals가 본문을 밀면 offset이 어긋남.
- 게다가 원본 basename은 문서마다 **동적** → 정적 `includes` 확장으로 못 잡고, 같은 basename 다른 디렉터리 충돌도 못 푼다(critique S6 correction).

## Decision
1. **시그니처 확장(하위호환)**: `parseGccErrors(stderr, offset, opts?)` 에 `opts.sourcePaths?: string[]` 추가. `sourcePaths` 미전달 시 **기존 정적 게이트·offset 산수 그대로**(579 테스트 무영향, Inv-4). 기존 `isPlugin`/`isInteractive`는 `opts`로 흡수하되 위치인자 형태도 유지.
2. **동적 게이트**: 채택 조건 = `isGeneratedFile(filePath) || sourcePaths.some(p => samePath(filePath, p))`. `isGeneratedFile` = `preview_plugin|preview_harness|preview_interactive` 포함(기존). `samePath` = `path.resolve` 정규화 후 비교(basename includes 아님 — 동적 파일명·동명이부 충돌 회피).
3. **`#line` 2곳 주입**(buildRunner가 슬롯 emit 시, Rung2만):
   - globals 슬롯 앞: `#line <헬퍼원본라인> "<헬퍼파일>"` → globals 영역 에러가 헬퍼 원본 가리킴.
   - body 슬롯 앞: `#line <entry본문라인> "<entry파일>"` → 본문 에러가 entry 원본 가리킴.
4. **매핑**: `#line`이 있으면 g++ 라인 = 원본 라인 → offset 산수 **0**(skip). `#line` 없는 Rung3는 기존 offset 산수 유지. `errorsToDiagnostics`(L168)는 M1 범위에서 **entry 문서 기준**만 표시(헬퍼 파일 진단은 메시지로만, best-effort).

orchestrator 호출부(L583 `parseGccErrors(err, offset, true)`, L644, L742, L832, L914)는
Rung2일 때만 `{ sourcePaths: slice.sourcePaths }` 추가; Rung3/하니스/애니/VNC는 기존 인자 유지.

## Alternatives considered
- **정적 basename `includes` 확장**(예: `includes('flow-banking')`): 원본 파일명이 런타임 동적이라 정적 매칭 불가; 같은 basename 다른 디렉터리 충돌(critique 명시). 기각.
- **`#line` 안 쓰고 offset만 보정**: globals 줄 수만큼 offset 더하면 본문은 잡으나, globals 영역 에러를 헬퍼 원본으로 못 되돌림(K줄 더한 가짜 라인). `#line`이 globals 영역까지 정확. 채택.
- **errorParser를 Rung2 전용으로 분기 신설**: 코드 중복. 옵셔널 `sourcePaths`로 한 함수에서 분기가 더 작음. 채택.

## Consequences
**Good**
- `#line` 본문 에러 드롭 회귀 제거 → 슬라이스 컴파일 에러가 사용자에게 보임(신뢰 유지).
- 옵셔널 파라미터라 기존 경로·테스트 무영향(Inv-4).
- 경로 정규화 비교 → 동명이부 파일 안전.

**Bad**
- M1 범위에서 헬퍼 파일 라인 정밀 진단은 entry 문서 기준만(헬퍼는 메시지). 헬퍼 파일에 직접 빨간 줄은 M2 이후 best-effort(✋ 큐, 진행 차단 아님).
- `#line` 2곳 주입은 buildRunner slot emit과 결합 → emit 순서 버그 시 라인 어긋남. → emit을 SliceBuilder가 globals/body와 함께 `#line` 포함해 산출(단일 책임).

**Neutral**
- `isGeneratedFile` 헬퍼 추출로 기존 3-way(`isHarness/isPluginFile/isInteractiveFile`) 가독성 향상.

## Affected milestones
- **M1** (직접): 동적 게이트 + `#line` 배관(F1.3).
- **M2**: 슬라이스 컴파일 에러 정확 표시.
- **M3**: 실빌드 실패 시 어느 패턴이 왜 막혔는지 진단 정확도.
</content>
