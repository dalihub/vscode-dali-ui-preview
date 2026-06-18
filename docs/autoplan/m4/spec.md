# M4 spec — cross-file/멤버 견고화 + 에러 라인 매핑

> 한 줄 요약: **실측 결과, cross-file 슬라이스의 "수집·컴파일·렌더"는 이미 동작한다** — `WalletScreen::Build()`(멤버함수, `cards.cpp`의 cross-file 팩토리 3개, `theme/tokens.h` 상수, `mVm` 멤버)가 **재작성·`-I` 주입 없이** 480×320 PNG로 실제 렌더됨을 g++ 풀빌드+Xvfb로 증명(이 spec의 §2 probe). 따라서 M4의 진짜 갭은 **(a) 그 동작을 잠그는 멀티파일 e2e가 없음**, **(b) 미해결/오타 심볼의 g++ 에러가 생성된 `preview_harness.cpp`의 줄로 떠서 원본 파일·라인(특히 inline된 globals→`cards.cpp`)으로 안 돌아감**, **(c) 실제 확장 흐름의 진입점 플러밍 한 칸**(`// @preview` 마커가 헤더 선언에만 있어 `.cpp` 본문이 `isPreviewable`=false). ADR-005대로 **BFS+인라인 유지**, `compile_commands.json`/`-I` 주입은 **있으면 보강·없으면 현행**(repo엔 없음 → 사실상 stretch), `#line` 매핑이 핵심 신규 작업. clangd LSP는 **불필요(CUT)** — probe가 정규식 슬라이스로 충분함을 보였다.

| 갭 | 실측 상태 | M4가 하는 일 |
|---|---|---|
| cross-file 심볼 수집(팩토리/타입/상수) | ✅ **이미 동작**(unresolvedStubs=0) | 회귀 잠금(e2e) + 엣지 characterization. 재구현 안 함 |
| 멤버-VM 합성(`mVm`→샘플데이터 3행) | ✅ **이미 동작**(렌더 증명됨) | e2e로 잠금 + 빈-화면 회귀 가드 |
| 멀티파일 e2e | ❌ **없음**(수동 docker만) | **신설**(F4.1) — 헤드라인 |
| `-I`/`-D`/`compile_commands.json` 주입 | ❌ 없음(BUT 인라인으로 불필요) | **조건부 보강**(F4.3) — `compile_commands.json` 있으면만. 없으면 no-op |
| `#line` 원본 매핑 | ❌ 없음(에러가 생성파일 줄로) | **신설**(F4.5) — 두 번째 헤드라인 |
| 진입점(`.cpp` 본문 previewable) | ⚠️ 마커가 헤더 선언에만 | `.cpp` 정의에 `// @preview` 1줄(F4.1 fixture 보정) |

---

## 1. Goal + Out of scope

**Goal**: 실전 멀티파일 dali-ui 앱(`samples/flow-wallet/`)의 멤버함수 `WalletScreen::Build()`를 **재작성 없이** slice→build→render하는 멀티파일 e2e를 신설해 "이미 동작하는 cross-file 경로"를 **회귀로 잠그고**, 미해결/오타 심볼의 컴파일 에러를 `#line` 으로 **원본 파일·라인**(inline globals는 그 정의가 온 `cards.cpp`/`tokens.h`)으로 되돌려 cross-file을 *디버그 가능*하게 만든다.

**두 개의 헤드라인 데모** (사용자에게 보이는 증명):
1. **재작성 없이 렌더**: 멀티파일 e2e가 `flow-wallet`의 `Build()`를 컴파일→PNG→골든 비교 PASS.
2. **원본 라인 에러**: 일부러 깬 심볼(예: `theme::ACCENT`→`theme::ACCENTX`)이 g++ 에러로 뜰 때, 메시지가 **`widgets/cards.cpp:38` / `screens/wallet_screen.cpp:28`** 처럼 사용자가 실제로 쓴 파일·줄을 가리킨다(생성된 `preview_harness.cpp:87` 아님).

**Out of scope (CUT/DEFER — 재도입 안 함)**:
- **full clangd / LSP cross-file 해석**: **CUT**. §2 probe가 BFS+정규식 인라인만으로 `flow-wallet` 전체가 `unresolvedStubs=0`으로 컴파일·렌더됨을 증명 → clangd 폐포(매 키스트로크 latency 회귀, Tizen 앱은 `compile_commands.json` 희소)는 ROI 없음(ADR-005 Alternatives). M4 이후 별도 트랙.
- **`vscode.executeDefinitionProvider`/libclang FFI**: CUT(deps 0 정책, ADR-005).
- **새 위젯/팩토리 자체 구현**: out of scope(plan.md M4). 위젯은 *수집*만, 렌더 충실도는 M1.
- **무한 hop BFS**: CUT — MAX_HOPS=4 유지(워크스페이스 경계+성능, previewOrchestrator.ts:391).
- **runtime/async**: 비동기 이미지·async fetch는 M5(placeholder/배지). M4는 정적 슬라이스만.
- **config/focus/theme**: 다른 M(M2/M3). 멀티파일 fixture는 그 디렉티브를 달지 않는다.
- **multi-config/device 경로 slice**: 현행대로 dlopen(T2)/harness 주경로만 slice를 받음(auto-extract final-report 다음단계 #2). 회귀 아님.

---

## 2. 검증된 사전조건 — 실제 feasibility probe 결과 (이 spec의 근거)

> 컴파일된 `out/src/sliceBuilder.js`의 **실제** `buildSlice`/`findPreviewFunction`을 구동 + `previewOrchestrator.resolveProjectIncludes`의 BFS(MAX_HOPS=4)를 동일 재현 + 렌더된 harness를 native prefix(`/home/woochan/tizen/generativeUI/dali-env/opt`)로 g++ 풀빌드+Xvfb 실행해 측정. (probe 스크립트는 일회성, repo 미커밋.)

**(a) cross-file 수집은 이미 완전히 동작한다 (핵심 발견)**
- `resolveProjectIncludes`의 BFS가 `wallet_screen.cpp` 진입에서 `wallet_screen.h → tokens.h → cards.h → cards.cpp → wallet_vm.h` 6개 소스를 **전부** 따라옴(same-stem `.cpp` 규칙으로 `cards.h`→`cards.cpp` 포함).
- `buildSlice` 결과: `rung='heuristic'`, **`unresolvedStubs=[]` (0개)**, `helpers=['MakeSectionHeader','MakeStatCard','MakeTransactionRow']`. globals 슬롯에 **theme 네임스페이스 상수 전체 + 팩토리 3개(cards.cpp에서) + `Transaction`/`WalletViewModel` struct + 샘플데이터로 합성된 `mVm`(3 트랜잭션)** 이 모두 인라인됨.
- `mVm` 멤버 합성:
  `__attribute__((weak)) WalletViewModel mVm = WalletViewModel{"Sample", "Sample", {Transaction{"Sample","Sample","Sample"}, …×3}};`
  → for-loop(`for (const auto& tx : mVm.recent)`)이 3행을 렌더하도록 채워짐(레일 친화 N=3).

**(b) 컴파일·렌더 둘 다 통과 (재작성·`-I` 0)**
- 렌더된 harness(453줄, globals 인라인) → `g++ -std=c++17 -fsyntax-only` (native prefix cflags, **`-I` 워크스페이스 주입 없음**) → **0 진단**.
- 풀빌드+링크 → 바이너리 → `xvfb-run` → **480×320 PNG 실제 생성**. 시각 확인: 다크 배경(`theme::BG=0x0d1117`), "My Wallet" 섹션 헤더(cross-file `MakeSectionHeader`), accent-teal 잔액("Sample" 샘플데이터, `theme::ACCENT`). → **헤드라인 1이 오늘 이미 성립** (단 e2e로 잠겨 있지 않을 뿐). pkg-config 모듈명은 `dali2-ui-foundation`(헤더는 `<dali-ui-foundation/...>` — 이미 backend가 올바르게 사용, localBackend.ts:13).

**(c) 에러 라인 매핑은 실제로 깨져 있다 (진짜 갭)**
- `theme::ACCENT`→`theme::ACCENTX`(오타) 주입 후 g++:
  ```
  /tmp/.../preview_harness.cpp:87:84: error: 'ACCENTX' is not a member of 'theme'  ← 실제론 cards.cpp:38
  /tmp/.../preview_harness.cpp:118:89: error: 'ACCENTX' is not a member of 'theme' ← 실제론 wallet_screen.cpp:28
  ```
- 두 에러 모두 **생성된 `preview_harness.cpp`의 줄**로 뜬다. 87번은 **inline globals(=cards.cpp 출처)** 에서 온 것이라 `errorParser`의 단일-offset(`{{USER_CODE}}` 기준) 산술로도 **절대 cards.cpp로 못 돌아감**(globals는 USER_CODE 위에 있어 offset이 음수→`mappedLine<0`로 drop). 118번(본문)은 offset 보정 대상이지만 `errorParser`의 파일명 게이트가 `filePath.includes('preview_harness')`만 통과시켜 **원본 파일명이 없으면 조용히 버려짐**(errorParser.ts:45–58). → ADR-005 §2(`#line`)·ADR-005 동적 sourcePaths가 정확히 이 지점.

**(d) 진입점 플러밍 한 칸 (작지만 실재)**
- `// @preview` 마커는 **`wallet_screen.h:18`(선언 `View Build();`)에만** 있다. `findPreviewFunction(wallet_screen.h)`=**NULL**(선언엔 body 없음). 실제 확장은 `extractPreviewCode(doc)`가 먼저 도는데 `isPreviewable(wallet_screen.cpp)`가 **false**(`.cpp`에 마커·region 없음 → codeExtractor.ts:443) → `.cpp`에선 preview가 *제안조차 안 됨*.
- 보정: **`wallet_screen.cpp:12` 정의 바로 위에 `// @preview` 한 줄 추가**하면 `isPreviewable`=true, Mode 2 추출이 본문을 잡고, 위 (a)~(b)가 **동일하게**(rung=heuristic, unresolvedStubs=0, helpers 3개, globals 2328자) 성립함을 실측 확인. (마커 없이도 `.cpp` 진입 시 `findPreviewFunction` 폴백이 첫 View-반환 함수=`Build`를 잡지만, 그 폴백은 `extractPreviewCode`가 null을 안 줄 때만 도달 — 실전 흐름엔 마커가 필요.) → F4.1 fixture가 이 1줄을 포함.

**재사용 자산**: `test/e2e/goldenTestRunner.ts`(harness 골든 러너), `test/e2e/standaloneBuildRunner.ts`(`buildAndCapture`/`buildAndCaptureDocker`, vscode 비의존), `test/e2e/imageComparator.ts`, `test/golden/screenshots/`, `src/sliceBuilder.ts`(`buildSlice`/`findPreviewFunction`), `src/errorParser.ts`. **핵심 제약**: `standaloneBuildRunner.ts`/`goldenTestRunner.ts`는 **vscode를 import하면 안 됨**(node 단독 실행) → `resolveProjectIncludes`(vscode.TextDocument 사용)는 그대로 못 씀 → 멀티파일 러너는 BFS의 **순수-fs 버전**을 inline해야 함(goldenTestRunner가 codeExtractor 로직을 inline 미러링하는 기존 패턴과 동일).

---

## 3. Work units

> Tier 정의: **T1**=픽셀 골든(렌더 비교), **T2**=로그/구조 단언(컴파일 산출물·매핑 결과 grep), **T3**=스모크(존재/통과 여부). 매 WU ≥ T3, 렌더 WU는 T1. 모든 assertion은 `npm run compile` 선행(TS→JS) 후 실행.

### WU-M4.1 — 멀티파일 e2e fixture + 러너 (F4.1) — **헤드라인 1**
- **Files**: NEW `test/e2e/multiFileGoldenRunner.ts`; `package.json`(스크립트 `test:e2e:multifile` 추가); EDIT `samples/flow-wallet/screens/wallet_screen.cpp`(정의 위 `// @preview` 1줄 — §2(d)); NEW 골든 `test/golden/multifile-screenshots/flow-wallet-wallet-screen.png`. 재사용: `src/sliceBuilder.ts`(`buildSlice`/`findPreviewFunction`), `test/e2e/standaloneBuildRunner.ts`(`buildAndCapture`), `test/e2e/imageComparator.ts`.
- **동작**: (1) 진입 `.cpp`(`wallet_screen.cpp`)를 읽고 **순수-fs BFS**(MAX_HOPS=4, same-stem `.cpp`, 워크스페이스 containment — `resolveProjectIncludes`의 fs-only 포팅)로 cross-file 소스 수집. (2) `findPreviewFunction`으로 body 추출 → `buildSlice(src, entryPath, body, extraSources, params)`. (3) `slice.includes/globals/body`를 harness 템플릿 3슬롯에 채워 `buildAndCapture`(native) 또는 `buildAndCaptureDocker`로 PNG 캡처. (4) `imageComparator`로 `test/golden/multifile-screenshots/<name>.png` 비교. `UPDATE_GOLDENS=1`이면 골든 갱신. **벡터-children 변환**(`transformVectorChildren`)은 flow-wallet이 `.Children({...})` initializer-list만 쓰므로 불필요(미사용 — 단, 러너가 `buildSlice`만 호출하고 instrument는 생략).
- **Acceptance (사용자 관점)**: `npm run test:e2e:multifile`를 돌리면 **재작성하지 않은** `flow-wallet`의 멤버함수 화면 1장이 렌더되어 골든과 비교, **PASS**가 보인다(여러 `.cpp`/헤더에 흩어진 실전 앱이 자동으로 합성·컴파일·렌더됨을 증명 — 현재는 이런 검증이 전무).
- **Tier 1**. **Assertion**:
  ```
  npm run compile && \
  UPDATE_GOLDENS=1 xvfb-run -a node out/test/e2e/multiFileGoldenRunner.js && \
  xvfb-run -a node out/test/e2e/multiFileGoldenRunner.js
  ```
  → 2회차 exit 0 且 stdout에 `flow-wallet` + `PASS`(또는 `✓`). (docker 기본 vs native는 `GOLDEN_NATIVE`/`PREVIEW_IMAGE` 환경변수로, goldenTestRunner와 동일 정책.)
- **✋**: yes — 최초 골든 PNG(`flow-wallet-wallet-screen.png`)가 **빈 화면이 아니라** 다크 배경+"My Wallet" 헤더+잔액/카드를 담고 있는지 사람이 1회 눈으로 확인(샘플데이터·cross-file 팩토리가 실제로 그려졌는지의 기준점). 이후 회귀는 픽셀 골든이 자동 판정.
- **Pre-conditions**: native prefix 존재(또는 docker 이미지). §2(b) 증명됨 → 통과 기대.
- **정직성**: 320px 뷰포트엔 헤더+잔액까지 보이고 stat 카드/트랜잭션 행은 아래로 잘릴 수 있음(레이아웃 높이). 골든 크기를 충실히 담으려면 fixture에 `width/height`를 키우거나(`@preview-config` 없이 러너 상수로) 세로를 늘릴 것 — **이건 렌더 *해상도* 실패가 아니라 뷰포트 크기 선택**이며, 골든이 그 선택을 잠근다.

### WU-M4.2 — cross-file 심볼 수집 견고화 + characterization (F4.2)
- **Files**: NEW unit `test/unit/sliceBuilder.crossfile.test.ts`; (필요시) EDIT `src/sliceBuilder.ts`(엣지 한정 보강); 재사용 fixture `samples/flow-wallet/*`, `test/fixtures/slice/*`.
- **동작**: §2(a)가 보인 대로 **현 수집은 flow-wallet에서 이미 완전**(`unresolvedStubs=0`) → 이 WU는 *재구현이 아니라* **(i) 그 결과를 unit으로 잠그고**, **(ii) ADR-005가 지목한 엣지**(중첩 네임스페이스 `wallet::theme::`, `using` alias, 다중 `.cpp` 동일 심볼)에서 **현재 동작을 characterization**(통과하는지/weak stub로 떨어지는지)해 *정직한 경계*를 기록한다. 깨지는 엣지가 발견되면 그 한 엣지만 최소 보강(예: same-stem 아닌 `.cpp`의 추가 탐색은 **하지 않음** — MAX_HOPS/containment 불변).
- **Acceptance**: `flow-wallet` 슬라이스가 `helpers=[MakeSectionHeader,MakeStatCard,MakeTransactionRow]` 와 `unresolvedStubs.length===0` 임이 unit으로 단언된다. 추가로 "이 엣지는 stub로 떨어진다"가 명시적 테스트로 문서화(미해결=배지 대상, ADR-007).
- **Tier 2**. **Assertion**:
  ```
  npm run compile && npm run test:unit
  ```
  → 신규 `sliceBuilder.crossfile.test` 통과(전체 그린, 0 회귀). 핵심 단언: `buildSlice(...).unresolvedStubs`가 `[]`, `helpers`가 3개 팩토리 포함.
- **✋**: no.
- **Pre-conditions**: 없음(순수 단위).

### WU-M4.3 — 프로젝트 include/define 주입 (`compile_commands.json` 보강) (F4.3)
- **Files**: EDIT `src/buildRunner.ts`(컴파일 인자에 선택적 `-I`/`-D`/`-std` 추가 경로) + `src/backends/localBackend.ts`(`compile`의 g++ 라인에 주입점); NEW `src/compileCommands.ts`(워크스페이스 루트에서 `compile_commands.json` 파싱→`-I`/`-D` 추출, 없으면 `[]`); NEW unit `test/unit/compileCommands.test.ts`.
- **동작**: ADR-005 §1대로 **인라인을 대체하지 않고 보강**. 프로젝트에 `compile_commands.json`이 있으면 그 엔트리의 `-I`(헤더 루트)·`-D`·`-std`를 **추출해 컴파일 인자로 주입**(local backend / 마운트 가능 경로에서). **없으면 `[]` → 현행 BFS+인라인만으로 동작(byte-identical, 회귀 0)**. ⚠️ **정직성**: §2(b)에서 보였듯 `flow-wallet`은 인라인 덕에 `-I` **없이도 컴파일**되므로, 이 WU의 실효는 *인라인이 못 잡는 매크로-헤비/조건부컴파일 헤더를 직접 include로 푸는* 미래 케이스 대비 + 계약 안정화다. repo 다수(그리고 `flow-wallet` 자체)엔 `compile_commands.json`이 **없음** → 실질적으로 **저위험 보강/사실상 stretch**. dlopen exec 빠른 경로(서버 컨테이너 내 컴파일, 헤더 마운트 불가)는 **건드리지 않음**(인라인 유지, ADR-006).
- **Acceptance**: `compile_commands.json`을 가진 (합성) 프로젝트에서 그 `-I`/`-D`가 컴파일 인자에 실린다. 없는 프로젝트(=flow-wallet)에선 **인자가 추가되지 않아** 기존 컴파일과 동일(회귀 0).
- **Tier 2** (compile_commands 파싱·주입 산출물 단언; 실제 렌더는 M4.1이 커버). **Assertion**:
  ```
  npm run compile && npm run test:unit
  ```
  → `compileCommands.test` 통과: (i) 샘플 `compile_commands.json`에서 `-I/path -DFOO=1` 추출, (ii) `compile_commands.json` 부재 시 `[]` 반환. + flow-wallet golden(M4.1)이 **여전히 PASS**(주입 경로가 기존 경로를 안 깸).
- **✋**: no.
- **Pre-conditions**: WU-M4.1(회귀 가드로 재실행).

### WU-M4.4 — 멤버 스크린 객체 합성 견고화 (F4.4)
- **Files**: NEW/EXTEND unit `test/unit/sliceBuilder.member.test.ts`(또는 기존 member 테스트 확장); 재사용 `test/fixtures/slice/member_field.cpp`, `samples/flow-wallet/model/wallet_vm.h`; (필요시) EDIT `src/sliceBuilder.ts`(`synthSampleInit`/`parseMemberFields` 엣지).
- **동작**: §2(a)가 보인 멤버-VM 합성(`mVm`→`WalletViewModel{...3 트랜잭션...}`)을 **잠그고**, ADR-005 §1이 지목한 엣지를 characterization: (i) 멤버 타입이 **중첩 struct**(WalletViewModel⊃vector<Transaction>)일 때 fixpoint 라운드가 Transaction까지 끌어와 N=3 샘플행을 만드는지, (ii) **스칼라/문자열 멤버**는 context weak stub로(빈 화면 방지) 떨어지는지, (iii) struct가 **프로젝트-로컬이 아닐 때**(미수집) `{}`로 안전 폴백하는지. 빈-화면 회귀(멤버 읽는 `Build()`가 채워져 렌더)가 가드된다.
- **Acceptance**: `WalletViewModel mVm`을 읽는 `Build()` 슬라이스가 **빈 `{}`가 아니라** `balance="Sample"` + `recent`에 **3개 Transaction**을 가진 초기화자를 합성함이 단언된다.
- **Tier 2**. **Assertion**:
  ```
  npm run compile && npm run test:unit
  ```
  → member 테스트 통과: `buildSlice(...).globals`가 정규식 `WalletViewModel mVm = WalletViewModel\{"Sample".*Transaction\{.*\}.*Transaction\{.*\}.*Transaction\{` (3행) 매치, **빈 `mVm = WalletViewModel{}` 아님**.
- **✋**: no (렌더로 채워짐은 M4.1의 ✋ 시각확인이 이미 커버).
- **Pre-conditions**: 없음.

### WU-M4.5 — 컴파일 에러 원본 라인 매핑 (`#line`) (F4.5) — **헤드라인 2**
- **Files**: EDIT `src/sliceBuilder.ts`(globals/body emit 시 각 조각 앞 `#line <원본라인+1> "<원본파일>"` 삽입 — `CollectedDef.line`/`sourcePaths` 이미 보유); EDIT `src/errorParser.ts`(파일명 게이트를 **동적 sourcePaths 집합**으로 확장: 생성 파일명뿐 아니라 `#line`이 심은 원본 파일명도 통과시켜 그 경로·라인을 그대로 보고); EDIT `src/previewOrchestrator.ts`(에러 표시 시 `slice.sourcePaths`를 errorParser에 전달; slice-빼고-재시도 폴백은 dlopen 경로에 이미 있음 — Rung3 fallback, previewOrchestrator.ts:173–177 — 이를 에러표시에도 활용); NEW unit `test/unit/errorParser.crossfile.test.ts`.
- **동작**: ADR-005 §2. 슬라이스가 emit하는 **각 collected def 앞**에 `#line`을 박아(예: `MakeStatCard` 정의 앞 `#line 16 "…/widgets/cards.cpp"`), body 앞에도 `#line <bodyLine> "<entry.cpp>"`. 그러면 §2(c)의 `ACCENTX` 에러가 **`widgets/cards.cpp:38` / `screens/wallet_screen.cpp:28`** 로 뜬다. `errorParser`는 현재 `filePath.includes('preview_harness'/'preview_plugin')` 만 통과(원본 파일명 drop) → **`SliceResult.sourcePaths`의 절대경로 집합**을 받아 그 중 하나면 **`#line`이 준 (파일, 라인)을 그대로 진단으로** 내보낸다(offset 산술 없이; `#line`이 이미 원본 좌표라서). 미해결이 진짜면 slice-빼고-재시도로 사용자 코드의 정직한 에러를 노출.
- **Acceptance (사용자 관점)**: cross-file 헬퍼/상수의 심볼을 깨면(오타·삭제) 에러가 **자기 파일의 정확한 줄**(헬퍼면 `cards.cpp`의 그 줄, 본문이면 `wallet_screen.cpp`의 그 줄)에서 뜬다 — 사용자가 본 적 없는 생성 코드(`preview_harness.cpp:NN`) 줄이 아니다.
- **Tier 2** (매핑 결과는 g++ stderr 파싱→진단 객체로 단언; 실제 빨간줄은 VS Code 런타임). **Assertion**:
  ```
  npm run compile && npm run test:unit
  ```
  → `errorParser.crossfile.test` 통과. 핵심: 합성한 g++ stderr(`<entry>.cpp:28: ... 'ACCENTX'`, `<cards>.cpp:38: ... 'ACCENTX'` — `#line` 적용 후 형태)를 `parseGccErrors`/`diagnoseGccErrors`에 `sourcePaths=[entry.cpp, cards.cpp]`로 넣으면, 진단이 **두 원본 파일·라인**(0-based 28-1, 38-1 근방)을 가리키고 **drop되지 않음**. + (선택, T1 보강) `#line` 박힌 슬라이스가 정상 케이스에서 **여전히 렌더 PASS**(M4.1 골든이 `#line` 추가 후에도 동일 — `#line`은 줄번호만 바꾸고 코드 의미 불변).
- **✋**: no (stderr→진단 단언으로 자동 검증; 실제 에디터 빨간줄 위치 최종 확인은 사용자 몫이나 핵심 매핑은 단위로 잠금).
- **Pre-conditions**: WU-M4.1(`#line` 추가가 골든을 안 깨는지 회귀 확인).
- **정직성**: `#line`은 **g++가 인식하는 표준** — 줄번호/파일명만 재지정, ABI/코드 무변경 → 렌더 회귀 0. 단 inline globals 조각들이 원본에서 비연속 줄을 차지하므로, **각 조각 앞에 1개씩** `#line`을 박아야 정확(조각 내부는 원본과 연속이라 OK). 다중 `.cpp`에서 **동명 심볼**이면 `#line`은 마지막 수집 출처를 가리킴(정직: characterization으로 알려진 한계, M4.2와 연동).

---

## 4. 헤드라인 범위 확정 — flow-wallet 그대로 간다 (축소 불필요)

plan/지시문은 "full flow-wallet 렌더가 불안정하면 더 작은 2~3파일 샘플로 축소하라"고 허용했으나, **§2 probe가 flow-wallet 전체(6소스, 멤버함수, cross-`.cpp` 팩토리 3개, 멤버-VM, theme 상수)를 `unresolvedStubs=0`으로 컴파일·480×320 PNG 렌더까지 실증** → **축소 안 함**. flow-wallet이 헤드라인 fixture다. 근거(정직):
- cross-file 수집/멤버합성/컴파일/렌더는 **이미 동작**(증명됨) → 신규 리스크는 *e2e 배선*과 *`#line` 삽입*뿐이고 둘 다 코드 의미를 안 바꾼다(러너는 기존 `buildAndCapture` 재사용; `#line`은 표준 무해 지시).
- 유일한 실 플러밍은 `.cpp`에 `// @preview` 1줄(§2(d)) — 샘플 1줄 편집, fixture 보정 수준.
- 만약 구현 중 docker/native 폰트 차이로 픽셀 골든이 **불안정**하면(서버 e2e가 `@render-only`로 우회하는 그 부류), **fallback**: 골든을 픽셀 비교 대신 **"컴파일 성공 + 비어있지 않은 PNG(파일 크기>임계) 생성 + 핵심 노드 수 metadata 단언"** 의 T2 스모크로 강등(여전히 멀티파일 슬라이스→빌드→렌더를 잠금). 이 경우에도 fixture는 flow-wallet 유지. (헤드라인 2(에러 라인)는 픽셀과 무관하므로 영향 없음.)

---

## Self-Review
- **Placeholder scan**: TODO/TBD/??? 없음. 모든 WU에 제목+파일+사용자관점 acceptance+tier+정확한 assertion 명령+✋ 부여. 라이브러리/구현 선택은 *기존 repo 파일·함수명*(`buildSlice`/`findPreviewFunction`/`resolveProjectIncludes`/`standaloneBuildRunner.buildAndCapture`/`errorParser.diagnoseGccErrors`/`SliceResult.sourcePaths`/`CollectedDef.line`)으로만 참조 — 전부 실재 확인(파일:라인 인용).
- **Probe honesty**: §2는 *추정이 아니라 실행 결과* — `out/src/sliceBuilder.js` 실구동(unresolvedStubs=0, helpers 3개, globals 2328자), native g++ 풀빌드+Xvfb로 PNG 실제 생성, 오타 주입으로 에러가 생성파일 줄로 뜸을 확인, 헤더-마커/`.cpp`-non-previewable 플러밍 갭까지 측정. "이미 동작하는 것"과 "진짜 갭"을 분리해 WU를 갭에만 배치(M4.2/M4.4는 *재구현이 아니라 잠금+characterization*으로 정직하게 축소).
- **Scope/ADR 일치**: clangd=CUT(probe가 불필요 입증, ADR-005 Alternatives와 일치), BFS+인라인 유지(ADR-006 계승), `-I`/compile_commands=보강·없으면 no-op(ADR-005 §1 — flow-wallet엔 파일 없음 → stretch로 정직 표기), `#line`+동적 sourcePaths=핵심 신규(ADR-005 §2). 무한hop·libclang·헤더마운트 전환=CUT(ADR-005). M4는 M2 의존·M3와 비의존(plan 그래프).
- **Tier 게이트**: 5개 WU 전부 ≥ T3 — 실제로 M4.1=T1(픽셀 골든, fallback T2 명시), M4.2/M4.3/M4.4/M4.5=T2(단위/구조 단언). 렌더 WU(M4.1)는 T1 골든. 기존 인프라 재사용 최대화(새 멀티파일 러너 1개만 신설; `buildAndCapture`/`imageComparator`/`buildSlice`/`errorParser` 재사용).
- **회귀 가드**: M4.3·M4.5가 기존 단일파일 골든/플러그인 경로를 안 깨는지(`compile_commands` 부재 시 byte-identical, `#line`은 의미 무변경) 각 assertion에 명시. `npm run test:unit` 전체 그린 + M4.1 골든 재PASS를 회귀 신호로.

OPEN_QUESTIONS: (1) 멀티파일 e2e의 **진입점 발견 규약** — 러너가 (a) `samples/<app>/` 디렉터리를 받아 `// @preview` 마커를 *어느 파일에서든* 찾고 그 심볼의 **정의(.cpp)** 를 진입으로 삼을지, 아니면 (b) 진입 `.cpp` 경로를 직접 받을지. §2(d)는 마커가 헤더 선언에만 있어 (a)면 "헤더 마커→정의 파일 해소" 한 단계가 더 필요(헤더의 `// @preview` 위 `View Build();`에서 클래스·심볼명 파싱 → 같은 디렉터리/스템 `.cpp`의 `WalletScreen::Build` 정의로 점프). 가장 싼 길은 **fixture의 `.cpp` 정의에 `// @preview`를 직접 달고(F4.1) 러너는 그 `.cpp`를 진입으로** 받는 것(이 spec의 기본안) — 헤더-마커→정의 점프는 별도 작은 WU/후속이 될 수 있음. 어느 규약을 정식 계약으로 삼을지 사용자/architect 확인 필요. (2) M4.3을 **정식 WU로 유지 vs stretch로 강등**: flow-wallet엔 `compile_commands.json`이 없어 실효가 미래 케이스 대비뿐 → M0~M3처럼 "데모로 증명되는 shippable" 기준에 약하다. 유지하면 계약 안정화 값이 있으나, 자율 사이클 예산상 **stretch(optional)** 로 빼고 M4.1/M4.5(두 헤드라인)+M4.2/M4.4(잠금)에 집중하는 편이 ROI 우위일 수 있음 — 우선순위 결정 필요. 그 외 none.
