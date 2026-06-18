# ADR-005 — Cross-file resolution + error-line mapping (M4)

## Status
Accepted (M4). M2(진입점/멤버 합성 컨벤션)에 의존. research에서 "유일한 구조적 승리"로 평가된 cross-file을 견고화.

## Context
현재 cross-file 해석은 두 조각으로 동작한다:
- **읽기(BFS)**: `previewOrchestrator.resolveProjectIncludes`(:289) — 문서가 `#include "..."`한 프로젝트-로컬 헤더 + 같은-스템
  `.cpp`를 BFS로 따라간다(MAX_HOPS=4 :296, 워크스페이스 containment guard :309). 시스템 `<...>`은 따라가지 않음.
- **수집/슬라이스**: `sliceBuilder.buildSlice`(:396) — 읽어온 소스에서 helper/type/const 정의를 정규식+brace 매칭으로 수집해
  **globals 슬롯에 인라인**(`includes=''` :485, fixpoint 라운드 :455로 중첩 타입까지). 미해결은 weak stub(:495).

선행 프로젝트(auto-extract) **ADR-006**(`docs/autoplan-auto-extract/adr/ADR-006-app-within-dali-ui-boundary.md`)이 정한
현재 계약: **헤더를 마운트(`-I`)하지 않고 정의를 globals에 인라인**한다. 근거는 `compilePlugin` exec 빠른 경로(서버 컨테이너
안에서 컴파일, `tmpDir:tmpDir` 동일경로 마운트 — `previewServer.ts:335`)를 100% 보존하기 위해(헤더 마운트 불필요).

문제(plan.md M4):
- 정규식 수집은 매크로/`#define`·복잡한 템플릿·조건부 컴파일에서 취약. `samples/flow-wallet/`의 `WalletScreen::Build()`처럼
  screens/widgets/model/theme로 흩어진 실전 앱은 현재 **수동 docker 컴파일로만** 증명됨(자동 e2e 없음).
- 에러 라인 매핑: g++ 에러가 생성된 plugin/harness의 줄 번호로 나와 사용자가 자기 파일의 어느 줄인지 모름. `errorParser.ts`가
  offset 보정은 하지만(`getPluginCodeOffset`), globals 슬롯에 인라인된 cross-file 정의의 에러는 원본 파일·라인으로 안 돌아감.

## Decision

### 1) cross-file 수집: BFS+인라인 **유지**, `-I/-D` 주입을 **보강**으로 추가 (compile_commands 활용)
- **기본 경로 유지**: ADR-006의 "정의를 globals에 인라인"을 **계승**(exec 빠른 경로 보존, 헤더 마운트 0). `buildSlice`의
  fixpoint 수집(:455)을 견고화 — 멤버 필드 타입(`parseMemberFields` :302)·struct 샘플 합성(`synthSampleInit` :358)·helper
  팩토리 탐지(:490)의 엣지(중첩 네임스페이스, `using` alias, 다중 `.cpp`)를 F4.2/F4.4에서 보강.
- **보강(신규)**: 프로젝트가 `compile_commands.json`을 가지면 그 `-I`(헤더 루트)/`-D`/`-std`를 **컴파일 인자로 주입**(F4.3).
  - local backend `compile`(:154)/server `ensureServerBinary`(:106)의 g++ 라인에 워크스페이스 헤더 루트 `-I`를 추가.
  - **인라인을 대체하지 않고 보완**: 인라인은 dlopen exec 경로(헤더 마운트 불가 컨테이너)를 위해 남기고, `-I` 주입은
    프로젝트 헤더(`theme/tokens.h` 등)를 `#include`로 직접 해결할 수 있을 때(local backend, 또는 마운트된 워크스페이스) 사용.
  - `compile_commands.json` 없으면(repo 다수가 그렇다 — auto-extract architecture §1) BFS+인라인만으로 동작(현 동작 보존).

### 2) 에러 라인 매핑: `#line` 주입 (F4.5)
- 슬라이스가 본문/globals를 emit할 때 각 조각 앞에 `#line <원본라인> "<원본파일>"`을 삽입. g++ 에러의 파일·라인이 **원본**으로 나옴.
- **slice-빼고-재시도 폴백**(현재 dlopen 경로의 Rung3 폴백 패턴 :157 답습): 슬라이스 컴파일이 실패하면 globals 없이 재컴파일해
  사용자가 **자기 코드의 정직한 에러**(생성된 stub 코드 에러 아님)를 보게 한다. 이미 `previewOrchestrator.ts:160`이
  `compilePlugin(code)` (no globals)로 폴백 — 이를 에러 표시 경로로도 활용.
- `errorParser.ts`를 **동적 sourcePaths 집합**(`SliceResult.sourcePaths` :27)으로 보강해 `#line`이 바꾼 원본 파일명을
  드롭하지 않게 한다(현재 정적 `includes('preview_plugin')` 게이트는 원본 파일명 에러를 조용히 버림 — auto-extract ADR-005가
  이미 동적 집합을 결정; M4는 cross-file sourcePaths까지 확장).

### 3) 검증: 멀티파일 e2e (F4.1)
- `samples/flow-wallet/`를 입력으로 cross-file 슬라이스→빌드→렌더를 도는 e2e 신설(현재 그런 검증 없음). harness 골든 러너
  (`goldenTestRunner.ts`)를 확장하거나 병렬 러너 추가 — `.preview.dali.cpp` 단일 파일이 아니라 **다중 .cpp 프로젝트**를 입력으로 받음.
- 일부러 심볼을 깨면 컴파일 에러가 원본 파일·라인에 매핑됨을 검증(F4.5 데모).

## Alternatives considered
- **clangd/`vscode.executeDefinitionProvider`로 정밀 해석**: *기각(후순위 트랙)* — auto-extract architecture가 이미 평가
  (clangd 폐포를 매 키스트로크 돌리면 latency 회귀; Tizen 앱은 `compile_commands.json`이 거의 없어 clang 정밀도 이점도 못 살림).
  M4는 BFS+정규식 견고화가 ROI 우위. clangd는 M4 이후 별도 트랙.
- **인라인을 버리고 `-I` 헤더 마운트로 전환**: *기각* — dlopen exec 빠른 경로(서버 컨테이너 내 컴파일)는 워크스페이스 헤더를
  못 본다(컨테이너는 `tmpDir`만 마운트). 인라인이 그 제약을 우회하는 핵심. `-I`는 **보강**으로만(local backend/마운트 가능 시).
  auto-extract ADR-006을 뒤집지 않고 확장.
- **무한 hop BFS**: *기각* — MAX_HOPS=4(:296)는 워크스페이스 경계 + 성능 가드. plan.md "무한 hop 금지, 워크스페이스 경계까지만".
- **libclang FFI로 정확 파싱**: *기각* — native 빌드 의존 → `package.json` deps 0 정책 위반(auto-extract architecture §1).

## Consequences
**Good**
- 실전 cross-file 앱(`flow-wallet`)이 **재작성 없이** 렌더 — research가 꼽은 유일한 구조적 승리가 자동 e2e로 증명됨.
- `#line` 매핑으로 미해결 심볼 에러가 사용자 자기 파일·라인에 떠 디버깅 가능(F4.5) → cross-file을 *usable*하게.
- ADR-006(인라인)을 계승해 exec 빠른 경로 보존 — 회귀 0. `-I`는 가산적 보강.

**Bad**
- BFS+정규식은 본질적으로 best-effort — 매크로 헤비/조건부 컴파일 코드는 여전히 weak stub로 떨어질 수 있음(정직: 미해결은
  배지 + 에러 라인으로 표시, ADR-007). 완전 해석은 clangd 트랙(미래).
- `compile_commands.json` 의존 보강은 그 파일이 있는 프로젝트에서만 — 없으면 BFS만(현 수준).

**Neutral**
- M4는 M2(멤버 합성/진입점 컨벤션)에 의존하지만 M3과는 상호 비의존 → plan.md의 M3↔M4 스왑 여지와 일치(순서 자유).

## Affected milestones
- **M4** (직접): F4.1(멀티파일 e2e)/F4.2(cross-file 심볼 견고화)/F4.3(`-I/-D` 주입)/F4.4(멤버 스크린 합성 견고화)/F4.5(`#line` 매핑).
- **ADR-007**: 미해결 심볼이 weak stub로 떨어지면 provenance 배지(sample-data/stub)로 표시 — 정직 보증.
- 선행 auto-extract **ADR-006**(인라인 경계)을 계승·확장(대체 아님).
