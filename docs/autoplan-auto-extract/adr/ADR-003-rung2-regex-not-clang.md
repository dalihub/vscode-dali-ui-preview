# ADR-003 — Rung2 의존성 수집: host 정규식 (clang/clangd 아님)

## Status
Accepted (M2). Rung1(clangd) 은 M3 이후 best-effort.

## Context
의존성 폐포(헬퍼·타입·상수 transitive 수집)를 어디서·무엇으로 계산할지 결정해야 한다.
선택지마다 배포 비용과 정밀도가 다르다.

코드로 확정된 제약:
- **컨테이너에 clang 없음**: `Dockerfile.runtime`은 경량 정책상 clang(~150MB)을 의도적으로 안 깐다(critique S3, MEMORY: dali-ui 전용 경량 이미지). 추가 시 이미지 재빌드 + pull 시간 악화 → Inv-5 위반.
- **`compile_commands.json` repo 0개**: Tizen 앱은 GBS/CDT-Make 빌드라 이 파일을 안 가질 확률 높음(critique 전체). clangd Rung1의 정밀 폐포 트리거(clangd + compile_commands)가 거의 미충족 → "Tizen 앱 기대 rung = Rung2"(plan.md).
- **`RTLD_NOW`(server:999)가 stub 본문을 강제**: 정밀 타입(clang)이 없어도 weak void-stub로 "컴파일 통과"는 가능. 즉 정밀도가 낮아도 목표(컴파일+dlopen+PNG) 달성엔 충분.
- **재사용 자산**: `cppParser.ts:101 tokenize()`가 IDENT/SCOPE(`::`)/STRING/주석/숫자를 이미 분해. 식별자 추출·정의 경계 탐지에 그대로 재사용 가능.

## Decision
Rung2 의존성 수집을 **호스트 측 정규식 + `cppParser` 토크나이저 재사용**으로 구현한다
(신규 `src/sliceBuilder.ts`). 알고리즘:
1. instrumented 본문을 토큰화 → 호출/타입/상수 후보 식별자 집합(dali/std/키워드/`__tag` 제외).
2. 같은 파일 + `#include "..."` 동반 헤더(워크스페이스 내부)에서 각 식별자의 정의를 정규식+토크나이저로 탐색(함수 정의는 시그니처~매칭 `}`까지, 타입은 `struct/class ... {};`, 상수는 `const/constexpr ...`).
3. 수집 정의를 위상정렬(정의 before 사용)로 globals emit. 수집 후 남은 미정의 → weak-stub(ADR-004).

clang/clangd/libclang은 **채택하지 않는다**(M0..M3). Rung1(clangd via VS Code commands)은
인터페이스만 열어두고 M3 이후 별도 트랙.

## Alternatives considered
- **컨테이너 clang `-MM`/libclang**: 정밀 헤더 폐포 가능하나 이미지 ~150MB 비대 → Inv-5 위반, pull/온보딩 악화. dev 이미지 opt-in으로 미뤄도 M3 범위 밖. 기각.
- **host libclang ffi**: AST 정밀도 최고지만 native 빌드 의존 → `package.json` deps 0 결정 위반, 크로스플랫폼 배포 부담. 기각.
- **Rung1 clangd via VS Code 명령(executeDefinitionProvider 등)**: ship 0이고 가장 정밀하나 (a) Tizen 앱은 compile_commands 없어 트리거 미충족, (b) 매 키스트로크 N-hop LSP 폐포는 latency 회귀(critique latency), (c) 인덱싱 중 비결정 rung(critique missing #5). plan.md가 "검증 핵심=Rung2"로 명시. M3 이후로 연기.
- **정규식만(토크나이저 없이)**: 문자열/주석 안의 식별자를 오탐. `cppParser` 토크나이저가 이미 그 경계를 처리하므로 재사용이 정확·저비용. 토크나이저 재사용 채택.

## Consequences
**Good**
- deps 0, 이미지 변경 0(Inv-5). 호스트 TS만.
- `cppParser` 토크나이저 재사용 → 문자열/주석 오탐 회피, 신규 코드 최소.
- RTLD_NOW가 어차피 stub 본문 강제 → 정밀도 낮아도 M3 성공 기준(컴파일+dlopen+PNG) 충족.

**Bad**
- 매크로/템플릿/ADL/오버로드 폐포는 정규식으로 못 풂(AST 4대 구멍, critique hardestBoundaries). → 그 케이스는 weak-stub 폴백 또는 Rung4(수동) — M2는 "흔한 케이스(같은 파일 헬퍼/상수) 다수 해결"이 목표지 100% 아님.
- 타입 정밀도 낮음(맥락 휴리스틱) → 잘못 추론 시 컴파일 실패 가능 → S7 1회 보정으로 완화.

**Neutral**
- Rung1 인터페이스를 `rung: 'lsp'` 값으로 미리 열어둠 → 미래 확장 비파괴.

## Affected milestones
- **M2** (직접): 정규식+토크나이저 수집.
- **M3**: 매트릭스가 "Rung2까지 도달, Rung1은 미구현" 을 정직 기록.
</content>
