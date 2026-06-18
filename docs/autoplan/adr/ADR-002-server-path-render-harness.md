# ADR-002 — Server-path render verification harness (M0/F0.1)

## Status
Accepted (M0). 모든 M1 작업의 게이트.

## Context
**Fact 1 (캠페인을 좌우):** `npm run test:e2e`(`test/e2e/goldenTestRunner.ts:18`)는 **harness 템플릿**
(`server/preview_harness.cpp.template`)을 `standaloneBuildRunner.buildAndCapture`(:88)/`buildAndCaptureDocker`(:147)로
컴파일·렌더한다. 이 경로는 `CreatePreviewUI()`(harness :32)를 호출해 **사용자 C++을 그대로 컴파일**한다 —
`docker/preview_server.cpp`의 scene-builder(`SBBuildNode` :552)는 **전혀 거치지 않는다**.

즉 M1이 고치려는 server 충실도(`SBApplyCommonProps`/`SBParseUiColor`/per-type 분기)는 **기존 골든으로 증명 불가**.
별도의 server-path 렌더 검증을 신설해야 한다(plan.md M0 = 진짜 신규 인프라).

**Fact 2:** server `.cpp` 변경은 docker 이미지 baked-in(`Dockerfile.runtime`). 검증은 (a) local backend(native prefix
`/home/woochan/tizen/generativeUI/dali-env/opt`에서 `preview_server` 즉시 재빌드 — `previewServer.ensureServerBinary` :85,
mtime 기반) 또는 (b) 이미지 재빌드+push. → M0 러너는 **local backend Tier1**로 검증한다.

server 경로의 진입은 RENDER_JSON IPC다: `previewServer.renderJson(scene, ...)`(:219)가 scene을 임시 JSON으로 쓰고
`RENDER_JSON <json> <png> <meta> <w> <h> <theme> <bg>`(:257)를 stdin으로 보내면, 서버 `DoRenderJson`(:868)이
`JParseNode`→`SBBuildNode`→`Capture`로 PNG를 만든다.

## Decision
**`npm run test:e2e:server` 신규 엔트리** — `test/e2e/serverGoldenRunner.ts`(신규). 기존 harness 러너와 **별개 파일·별개 골든 디렉터리**.

### 렌더 경로 (harness 러너와의 대조)
| | 기존 `test:e2e` (harness) | 신규 `test:e2e:server` (M0) |
|---|---|---|
| 진입 | `CreatePreviewUI()` 컴파일 (harness.cpp :32) | T1 파서 → `SBBuildNode` (server.cpp :552) |
| 빌드 | g++ full 컴파일(`buildAndCapture` :88) | server 바이너리 1회 빌드 후 RENDER_JSON IPC |
| 무엇을 증명 | 사용자 C++ → DALi 전체 | scene JSON → server scene-builder 충실도 |
| 골든 dir | `test/golden/screenshots/` | `test/golden/server-screenshots/` (신규) |

### 러너 구현 골격 (코드 작성은 impl 단계; 여기선 계약만)
1. **scene 생성**: 각 server 샘플(`.preview.dali.cpp`)의 코드를 추출 → `cppParser.parseChainExpression(code, 0)`(:457)로
   `SceneNode` 트리 생성. **null이면 그 샘플은 server-path 부적격**(T1만 server를 탐 — fact 3, `previewOrchestrator.ts:692`
   `slice.rung==='single-fn'`)이므로 SKIP 표시(혼동 방지). 단 cppParser는 vscode 의존이 없어 node 러너가 직접 import 가능
   (`goldenTestRunner.ts:89`의 "codeExtractor는 vscode 의존이라 못 쓴다"와 달리 cppParser는 순수).
2. **server 기동**: native prefix로 `preview_server.cpp` 컴파일(`previewServer.ensureServerBinary`의 g++ 라인 :106 재사용 또는
   standalone 등가물) → Xvfb display(`:99`)에서 spawn → `>>>READY`(server.cpp:680) 대기.
3. **RENDER_JSON**: scene JSON을 임시 파일로 쓰고 `RENDER_JSON <json> <png> <meta> <w> <h> dark -` 전송 → `>>>OK:<png>`
   또는 `>>>ERROR:`(server.cpp:1128/702) 수신.
4. **golden 비교**: `imageComparator.compareImages`(`test/e2e/imageComparator.ts`, 기존 재사용) → diffPercent. `UPDATE_GOLDENS=1`로 갱신.
5. **종료/정리**: server stdin EOF로 종료. 임시 JSON 정리(renderJson :250 패턴).

### 검증 백엔드 = local (native), docker 폴백 옵션
- 기본: native prefix(`detectDaliPrefix` :33 재사용 — `DALI_PREFIX`/`~/tizen/*/dali-env/opt`). server `.cpp` 변경이
  **즉시** 반영(재빌드)되므로 M1 setter 작업의 빠른 피드백 루프.
- `SERVER_GOLDEN_DOCKER=1`(옵션): 이미지 재빌드 후 검증(릴리즈 게이트). M0는 native만 요구.

### npm 스크립트
`package.json`에 `"test:e2e:server": "tsc && node out/test/e2e/serverGoldenRunner.js"` 추가(기존 `test:e2e` 패턴 답습).
`test:release`(MEMORY: unit+click-to-code+e2e)에 합류는 M1 완료 후(M0는 러너 + 1 baseline만).

## Alternatives considered
- **기존 harness 골든에 server setter 검증을 얹기**: *기각* — harness는 `SBBuildNode`를 안 거침(fact 1). 골든이 통과해도
  server 충실도는 1픽셀도 증명 안 됨. M1 전체가 가짜 검증이 됨.
- **RENDER_JSON 대신 직접 `SBBuildNode` 유닛 호출**: *기각* — `SBBuildNode`는 DALi 런타임(Window/Capture)을 요구해 순수
  유닛 불가. 실제 렌더(PNG 골든)가 "가짜 금지" 원칙(project-goal). IPC 경유가 실제 경로와 동일.
- **새 IPC 명령 추가(RENDER_CPP: 서버가 직접 파싱)**: *기각* — 서버는 JSON만 받게 설계됨(`DoRenderJson` :868). 파싱은
  호스트 `cppParser` 책임(분리 유지). 새 명령은 server.cpp 표면을 늘려 baked-in 비용↑.
- **docker만으로 검증(native 생략)**: *기각* — server `.cpp` 매 수정마다 이미지 재빌드+push(수 분)는 M1의 setter 반복
  작업(6 WU)에 치명적 느림. native 즉시 재빌드(mtime, :96)가 적합. docker는 릴리즈 옵션으로 둠.

## Consequences
**Good**
- M1의 모든 setter가 **실제 렌더 PNG**로 증명됨(가짜 금지 충족). F0.3의 "각진 cornerRadius 골든"→F1.1 "둥근 골든"의
  실패→통과 데모가 깔끔.
- server 회귀 안전망(Inv-1): 누가 `SBApplyCommonProps`를 건드려 hex/Flex/Stack 베이스라인을 깨면 빨갛게 뜸.
- cppParser가 vscode-free라 node 러너가 추출까지 재사용(harness 러너의 codeExtractor 제약 회피).

**Bad**
- 두 골든 스위트(harness + server) 유지 → 같은 샘플이 두 곳에 골든을 가질 수 있어 업데이트 시 양쪽 갱신 필요. 디렉터리
  분리(`server-screenshots/`)로 혼동은 줄이되 CI 시간은 증가.
- native prefix 필수(release/e2e 절차의 기존 제약과 동일) — prefix 없는 환경에선 SKIP.

**Neutral**
- T1 파서가 null 반환하는 샘플은 자동 SKIP → server 러너는 "깨끗한 단일식" 샘플만 다룬다(fact 3 범위와 일치).

## Affected milestones
- **M0** (직접): F0.1 러너, F0.2 baseline 골든(hex/Flex/Stack/생성자 Label), F0.3 cornerRadius "각진" 골든 시드.
- **M1**: 이 러너가 게이트 — F1.1~F1.6의 모든 setter가 server 골든으로 검증(F0.3 각진→둥근 갱신).
- **F0.4/F0.5 스파이크**도 이 local-backend warm 서버에서 수행(override 멱등성·focus-ring 가용성) → ADR-004/ADR-006 입력.
