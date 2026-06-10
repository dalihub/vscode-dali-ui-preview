# Research — 실전 dali-ui 앱의 zero-annotation 자동추출 preview

> 이 프로젝트는 신규 도메인이 아니라 **선행 리서치가 이미 완료된** 주제다. 직전 2개 멀티에이전트 워크플로(각 6리포트+적대검증)와 2개 전략문서가 1차 출처다. 본 research.md는 그것을 planner/architect 입력용으로 큐레이션한다(재조사 X — Pinned-Artifact 재사용).

## 1차 출처 (읽을 것)
- `Docs/auto_extract_strategy_0610.md` — 자동추출 전략(8단계 파이프라인·4단 degradation 사다리·6 한계). **가장 중요.**
- `Docs/code_preview_strategy_0610.md` — 18개 실전 코드패턴 매트릭스(P1~P18) + Phase 0~3 로드맵.
- `/tmp/wf2_pipeline.json`, `/tmp/wf2_critique.json` — 자동추출 8단계(S0~S7) + 적대검증 7이슈/6누락.
- `/tmp/wf2_report_{clangDeps,slicing,autoStub,buildConfig,priorArt,ourArch}.md` — 6방향 상세.
- `/tmp/wf_report_{api,patterns,engine,tizen}.md` — 코드패턴/엔진/Tizen 구조.

## Similar solutions (자동 의존성 추출/격리 렌더의 선례)
| Name | URL | Trade-off |
|---|---|---|
| Jetpack Compose `@Preview` + `PreviewParameterProvider` | developer.android.com/develop/ui/compose/tooling/previews | 어노테이션+픽스처 provider 필요(우리가 피하려는 것), 하지만 parameterless 진입점 규약은 직역 가치 |
| SwiftUI `#Preview` + `#sourceLocation` | developer.apple.com/documentation/swiftui/previews-in-xcode | 컴파일러 통합 깊음(C++ 직역 불가), 단 `#sourceLocation`→`#line` 에러매핑은 이식 |
| Storybook CSF `args` | storybook.js.org/docs/api/csf | export=진입점, args=픽스처. 웹 전용이나 "픽스처 주입" 모델 동일 |
| **IDE Extract Function (clangd/CLion)** | clangd.llvm.org | ★가장 가까운 선례 — 코드 영역의 의존성/캡처집합을 자동 계산. 우리 S2의 원형 |
| **clangd-mcp (schuay)** | github.com/schuay/clangd-mcp | ★callHierarchy→outgoingCalls, definition 매핑으로 의존성 폐포를 실제로 구현·작동 입증 |
| xeus-cling / cling | github.com/jupyter-xeus/xeus-cling | C++ 인터프리트로 스니펫 실행, 단 DALi 메인루프/EGL 통합 리스크 큼(비채택) |

## Dominant patterns (이 도메인에서 표준)
- **clangd 빌려쓰기** [검증됨]: 우리가 VS Code 익스텐션이라 `vscode.executeDefinitionProvider`/`prepareCallHierarchy`/`provideOutgoingCalls`/`executeHoverProvider`로 사용자 clangd 인덱스를 빌림 → clang ship 0. (clangd-mcp가 동일 매핑 입증)
- **2분할 라우팅** [고유]: 의존성을 "정의가 워크스페이스 안에 있음→동반수집(globals 인라인) vs 정의 없음→auto-stub". 우리만의 발명점.
- **3슬롯 템플릿**: `{{USER_INCLUDES}}`(top)/`{{USER_GLOBALS}}`(헬퍼·타입·상수·stub)/`{{USER_BODY}}`(본문). 함수 본문 안에 include/전역정의 불법이라 비-우회 핵심.
- **type-driven synth**: `synth(T)` — string→"Sample", vector<U>→{N개}, enum→첫enumerator, struct→필드재귀. clang `RecordDecl::fields()`.
- **graceful degradation**: Rung1(clangd+compile_commands)→Rung2(같은파일 정규식)→Rung3(현행 single-fn, 회귀0)→Rung4(수동 어노테이션 탈출구).

## Pitfalls (코드로 확정 — cite: 우리 repo 라인)
- `RTLD_NOW` (server/preview_server.cpp:999): 미정의 심볼=dlopen 즉사. weak도 **본문** 필수, 선언만이면 SIGSEGV. "미정의인 채 두기"는 원천 불가.
- `docker exec` 마운트 부재 (src/dockerRuntime.ts:516): `-v` 없음, `compilePlugin`에 extraMounts 인자조차 없음 → 헤더 마운트 인프라 대신 **정의 인라인**이 최경량.
- `#line` ↔ errorParser 게이트 (src/errorParser.ts:46/58): `filePath.includes('preview_plugin')` 정적 매칭 → #line 삽입 시 본문 에러 드롭. **동적 출처집합**으로 재설계 필요.
- 빈 stub=빈 화면: `std::string{}`=빈 라벨, `vector{}`=루프0회=빈 화면. "컴파일 통과"는 fully-auto지만 "그럴듯한 화면"은 아님 → 시각 배지로 표시.
- Tizen sysroot: 실전 앱이 `<dali-toolkit/...>`·`<app_common.h>` 의존 시 런타임 이미지(dali-ui 전용)가 못 넘음 → 1회 setup. **우리 (A) 샘플앱은 dali-ui 경계 안으로 한정**해 이 함정 회피.
- 테스트 공백: 현재 24샘플 전부 자기완결 single-fn → slice 경로 미실증. 비자기완결 픽스처 선행.

## Candidate stack (decision NOT made — architect 선택용)
- 추출/슬라이스: 신규 `src/sliceBuilder.ts` (TS). Rung2=정규식(cppParser 토크나이저 재사용 가능), Rung1=clangd via VS Code commands.
- AST 분석 위치: 익스텐션 호스트(libclang ffi) vs 정규식 폴백 vs 컨테이너 clang(이미지 비대 — 비권장). 1차는 정규식+weak-stub 권장(의존성 0).
- stub: type-driven synth(clang 있을 때) / weak void-stub(타입 몰라도 컴파일 통과).
- 템플릿: 3슬롯. buildRunner의 `{{USER_CODE}}` 치환부(6곳) + harness 대칭.
- 빌드설정: compile_commands.json 파싱(있으면) / 워크스페이스 -I 휴리스틱.

---

## Self-Review
- Placeholder scan: none — 모든 항목이 1차 출처 또는 repo 라인 근거.
- Internal consistency: 일관 — degradation 사다리/2분할/3슬롯이 전략문서와 동일. (A) 샘플앱을 dali-ui 경계로 한정해 Tizen sysroot 함정을 의도적으로 out-of-scope.
- Scope check: within range — 4 마일스톤 분량(샘플앱 / 3슬롯 / SliceBuilder Rung2 / 실빌드검증). Rung1(clangd)은 best-effort, 핵심은 Rung2.
- Ambiguity: 해소됨 — "zero-config"는 "zero-annotation + 환경별 degrade"로 정의(전략문서 §0). 검증 타깃 Rung은 환경상 Rung2가 현실적 기대.
