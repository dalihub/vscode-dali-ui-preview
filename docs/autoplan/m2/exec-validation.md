# M2 exec-validation

| WU | Features | Tier | Result |
|---|---|---|---|
| M2.1 | F2.3 `// @preview-state: focus=` 파싱 | 2/3 | **PASS** — codeExtractor.previewState.test 통과(focus=card→'card', "Card1"→'Card1', 미등재키→undefined, 빈값 무시, progress=0.4 선언). |
| M2.2 | F2.1 `// @dali-preview` 파싱/추출 | 2/3 | **PASS** — daliPreview.test 통과(@dali-preview→body 추출 mode=single-marker; @dali-preview-begin→Mode3 region 오인 안 함; 단일라인 본문 추출버그 수정). sliceBuilder findPreviewFunction 확장. |
| M2.3 | F2.2 진입점 빌드 배선 + zero-arg 골든 | 3+1 | **PASS** — zero-arg-entry.png 렌더("Zero-Arg Entry" 육안 확인). 고정 심볼 CreatePreviewUI로 호출. |
| M2.4 | F2.4 focus 해석 + 템플릿 install | 3 | **PASS** — SetAlwaysShowFocus(true)+{{POST_BUILD_FOCUS}}; focus=card2→NAME 주입+FindChildByName, Nth 폴백. 생성 C++가 실제 dali-ui prefix로 컴파일+링크. |
| M2.5 | F2.5 focus 렌더 골든 | **1** | **PASS** — focus-grid.png: **포커스 링이 card2(가운데)에 정확히**, card1/3엔 없음(육안). 변수명 bind 정확. |
| pass4 | 라이브 배선 | 2/3 | **PASS** — orchestrator.focus.test: focus→harness 경로+focusId 전달, 비-focus→parser(non-vacuous). |

**전체**: `npm run test:e2e` = **22 passed, 0 failed**(기존 20 무회귀 + focus-grid·zero-arg 신규, 결정적). `npm test` = **581 passing, 0 failing**. `npm run compile` exit 0.

**Silent-failure 자가점검**:
- focus 골든이 focus를 증명하나? — ✓ 링이 **card2에만**(card1/3 아님). 변수명 mis-resolution이면 다른 카드에 떠 골든 diff. test-theatre 아님(육안 확인).
- 기존 20 골든 무회귀? — ✓ SetAlwaysShowFocus(true)는 focus 없으면 표시할 indicator 없어 무영향(UPDATE 없이 20 PASS 확인).
- 라이브 배선이 vacuous? — ✗: orchestrator.focus.test의 control(focus 없음→parser path) vs focus(→harness)로 디렉티브가 원인임을 증명.

**한계/✋**:
- ✋ **라이브 확장 end-to-end**(VS Code에서 디렉티브 입력→웹뷰 링)는 자동화 불가 → 골든이 렌더 메커니즘을, unit이 orchestrator plumbing을 증명(고신뢰). 실제 클릭-스루는 사용자 1회 확인 권장.
- **plugin(dlopen T2) focus**는 서버 hook(`__ApplyPreviewFocus`) 호출 미배선 → focus는 **harness 경로로 라우팅**(검증된 경로). 정직: plugin focus는 best-effort.

## ADR drift (inline)
- ADR-001(focus/progress만), ADR-004({{POST_BUILD_FOCUS}} install site, SetAlwaysShowFocus before Apply), ADR-006(변수명 bind+Nth 폴백) 전부 구현대로. drift 없음.

**Verdict: M2 PASS** (external-review 대기).
