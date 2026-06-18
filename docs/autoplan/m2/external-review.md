# M2 External Review — independent (diff + run, no self-report trust)

> 한 줄 요약: M2는 **PASS**. focus 골든은 test-theatre가 아니다 — 직접 `focus=card2 → card1` 뮤테이션 후 `npm run test:e2e`(docker, 소스에서 harness 재컴파일)를 돌려 focus-grid가 **1.04% diff로 FAIL**(zero-arg는 그대로 PASS)함을 확인했고, diff 이미지는 링이 가운데(card2)에서 왼쪽(card1)으로 **이동**한 픽셀만 빨갛게 칠해져 골든이 focus 타깃을 진짜로 판별함을 증명한다. 정규식 미러(codeExtractor ↔ goldenTestRunner)는 **byte-identical**, 라우팅 가드는 단일-프리뷰 경로에서 parser/dlopen 양쪽을 정확히 우회. 단 하나 실질 갭: **focus + 2개 이상 `@preview-config`(multi-config)** 조합 시 focusId가 plumb되지 않아 링이 조용히 사라짐(M2가 단일 config만 테스트하므로 shipping 경로엔 무해, 그러나 미문서화 silent-drop).

---
## Verdict: PASS

근거: 5개 검증 축 전부 통과. focus 골든의 판별력은 뮤테이션으로 실증, 정규식 미러 drift 없음, 라우팅 가드 정확, plugin-path 한계는 코드와 일치(정직), scope creep 없음. 발견된 갭 1건(focus+multi-config)은 M2 데모/테스트 경로 밖이라 PASS를 막지 않으나 "could be stronger"로 명시.

빌드/테스트 직접 실행 결과:
- `npm run compile` → exit 0.
- `npm test`(unit) → **581 passing, 0 failing**.
- `npm run test:e2e`(docker, M2 두 샘플) baseline → focus-grid PASS, zero-arg-entry PASS.
- `npm run test:click-to-code` → PASS (Path A __L tag=2, Path B __L tag=2).

---
## Findings (file:line, 사용자 영향)

### F-1 (가장 중요, CONCERN-수준 갭) — focus + multi-config는 링을 조용히 떨군다
`src/previewOrchestrator.ts:902-907` — `extraction.configs.length > 1`이면 `runMultiPreview`로 분기. 그 안의 빌드 호출 `compilePlugin`(:1012)·`buildAndRun`(:1045)은 **focusId를 인자로 받지 않는다**(단일-프리뷰 경로의 `buildAndRun(..., extraction.state?.focus)` :229/232 와 대조). 즉 사용자가 `// @preview-state: focus=card2`와 `// @preview-config:` 2줄 이상을 한 파일에 같이 쓰면, multi-config 경로가 타고 **focus 링이 경고 없이 사라진다**. `hasFocus` 가드(:702-703,727)는 `runMultiPreview` *내부*엔 없다(가드는 `runBuildStrategies`에만 존재).
- 사용자 영향: "focus 줬는데 multi-config라 안 보임"을 알 길이 없음(provenance 배지는 M5). 다만 M2 spec은 focus와 config를 별 마일스톤으로 분리했고 골든/유닛은 **단일 config**만 — 그래서 *shipping된 데모 경로*는 정확. 좁은 미문서화 edge.

### F-2 (정직성 ✓) — plugin(dlopen) focus는 미배선, focus는 harness로 라우팅 — 코드와 일치
exec-validation의 주장(plugin focus best-effort, harness 경로로 검증)이 코드와 정확히 일치한다:
- `src/previewOrchestrator.ts:727` — `!hasFocus && ... dlopenStrategy` → focus면 dlopen 건너뜀.
- `src/buildRunner.ts:287-289` — plugin 컴파일 시 `{{POST_BUILD_FOCUS}}`를 `''`로 치환(=`__ApplyPreviewFocus` no-op). 즉 plugin 경로로 새면 링이 안 뜨지만, **애초에 focus는 그 경로로 안 샌다**(F-3). 그래서 "조용히 떨구는" 케이스가 아니라 의도적으로 harness로 보냄. 정직.
- `server/preview_plugin.cpp.template` — `__ApplyPreviewFocus(Dali::Actor root)` 훅 슬롯만 추가(대칭성), 호출은 미배선. 주석이 이 한계를 명시.

### F-3 (라우팅 가드 ✓) — 단일-프리뷰 경로에서 parser·dlopen 양쪽 정확히 우회
`src/previewOrchestrator.ts:703`(parser)·`:727`(dlopen) 둘 다 `!hasFocus &&` 선행 → focus면 둘 다 skip → `:762 if(!usedServerMode)` harness fallback 도달 → `HarnessStrategy.execute`(:764) → `buildAndRun(..., extraction.state?.focus)`(:229,232). focusId가 harness까지 도달함을 단위 테스트가 **non-vacuous**하게 잠근다(`orchestrator.focus.test.ts:94-109` focus→harness+arg[8]='card2', `:111-123` control: focus 없으면 parser path, buildAndRun 0회). 비-focus 라우팅은 기존 조건에 `!hasFocus &&`만 붙어 `hasFocus=false`일 때 **이전과 동일하게 평가**(불변).

### F-4 (정규식 미러 ✓) — codeExtractor ↔ goldenTestRunner byte-identical
`@preview-state`/focus/var-decl 파싱이 두 곳에 중복 존재하나 drift 없음:
- `PREVIEW_STATE_RE` `/^\/\/\s*@preview-state:\s*(.+)$/` — codeExtractor.ts:40 ≡ goldenTestRunner.ts:35.
- `STATE_FOCUS_RE` `/(?:^|,)\s*focus\s*=\s*(?:"([^"]*)"|([A-Za-z_]\w*))/` — codeExtractor.ts:41 ≡ goldenTestRunner.ts:36.
- `VAR_DECL_RE`, `DALI_PREVIEW_MARKER` — 양쪽 동일.
- `buildPostBuildFocus`/`injectFocusName`/`findStatementEnd` 는 buildRunner.ts(static) ↔ standaloneBuildRunner.ts(module fn)에 중복 — 함수 본문 **로직 동일**(유일 차이: `BuildRunner.findStatementEnd` vs `findStatementEnd` 호출 한정자). drift 없음.
- 의미: 골든이 라이브 확장과 동일한 파싱을 검증한다(미러가 어긋나면 골든이 딴 걸 테스트하는 위험인데, 그 위험 없음).

### F-5 (NAME-injection 안전성) — injectFocusName 엣지 직접 실측
재현 스크립트로 9개 엣지 확인:
- 다중라인/중첩 decl: `findStatementEnd`가 문자열 `"a;b"` 안의 `;`와 `.Children({...})` 중괄호 안 `;`를 **건너뛰고** 진짜 종결 `;` 뒤에 삽입 — 정확(`src/buildRunner.ts:225-242`).
- prefix 충돌: `focus=card`인데 `card2`가 먼저 선언 → `\b...card\s*=` 가 `card2`를 안 잡고 `card`만 태그 — 정확.
- 재대입(타입 없는 `card2 = ...`)·미일치 → **변경 없음**(Nth 폴백). numeric/quoted focus → 변경 없음(FindChildByName/폴백에 위임).
- (b) 멤버/람다 캡처처럼 decl 못 찾으면 unchanged → harness `{{POST_BUILD_FOCUS}}`의 `__FindFirstFocusable` DFS 폴백이 첫 focusable라도 잡아 빈손 방지(`server/preview_harness.cpp.template:249-270`).

### F-6 (click-to-code NAME 충돌 — 알려진 좁은 손실) — OPEN_QUESTION #1 그대로
라이브 harness+focus 경로에서 코드는 **먼저** `instrumentCode`로 `View card2 = __tag(View::New()..., "__L12")` (click-to-code NAME=`__L12`)가 되고, **그 다음** `injectFocusName`이 그 statement 뒤에 `card2.SetProperty(NAME,"card2")`를 붙인다(orchestrator가 `instrumented`를 strategy code로 넘김 → buildAndRun→renderHarness→injectFocusName). DALi NAME은 단일 속성이라 **나중 쓰기(card2)가 __L12를 덮어써** focus된 그 1개 노드의 click-to-code 라인매핑이 소실된다. 재현으로 확인.
- 사용자 영향: **미미**. focus 노드 1개만 영향, 나머지 노드는 click-to-code 유지. spec의 OPEN_QUESTION #1/ADR-006이 이 트레이드오프를 명시적으로 수용(focus 데모 1노드 한정). 골든 경로는 instrumentCode를 안 거치므로 충돌 없음. `test:click-to-code`는 focus와 결합한 케이스가 없어 이 회귀를 포착하진 못하지만(그래서 "could be stronger" 후보), focus-less click-to-code는 PASS.

### F-7 (scope creep ✗ 없음) — 변경 파일 전부 M2 표면 내
변경 22파일 = autoplan 문서 3 + codeExtractor/sliceBuilder/previewConfig/previewOrchestrator/buildRunner + 두 템플릿 + 두 e2e 러너 + red-box 골든 픽스처 + harnessGeneration.test(placeholder 해소) + 신규 샘플/유닛. `red-box.harness.cpp`(:250-270,343-350)는 harness 템플릿과 **동일 미러**(focus helper+SetAlwaysShowFocus) — 유지보수지 creep 아님. extension.ts/previewManager/errorParser/statusBar/xvfb 등 미변경.

---
## Mutation check result (RUN — 실행함)

| 단계 | 명령 | 결과 |
|---|---|---|
| baseline | `DALI_PREFIX=… npm run test:e2e` (focus-grid + zero-arg만 격리) | focus-grid **PASS**, zero-arg-entry **PASS** |
| mutate | `// @preview-state: focus=card2` → `focus=card1` (디렉티브 한 줄만) | — |
| re-run | 동일 e2e (docker가 소스 template+sample을 새로 읽어 `g++ /work/harness.cpp` 재컴파일) | focus-grid **FAIL — 1.04% pixels differ (1601/153600)**, zero-arg-entry **PASS** |
| restore | `git checkout -- test/samples/focus-grid.preview.dali.cpp` | byte-identical 복원 확인(`git diff --quiet` clean, 디렉티브=card2) |

- **diff %: 1.04%** (임계값 `diffPercent < 0.01` = 1% 바로 위 → FAIL 성립).
- diff 이미지(`test/e2e/diff/focus-grid.diff.png`) 육안: 빨갛게 칠해진 픽셀이 **card1(왼쪽)·card2(가운데) 카드의 테두리 링뿐** — 링이 가운데→왼쪽으로 이동한 자리만 다름. 카드 채움/배경은 무변. mutated actual(`actual/focus-grid.png`)은 링 코너가 **왼쪽 파란 카드(card1)**에 붙음.
- 판정: 골든은 focus 타깃을 **진짜로 판별한다**. 엉뚱한 카드로 해석되거나 링이 없으면 즉시 FAIL → **test-theatre 아님**. NAME-injection(`card1`→FindChildByName)이 실제로 다른 노드를 가리켰음을 PNG가 증명.
- 주의: docker 경로가 template을 매 실행 새로 읽고 컨테이너 안에서 harness를 재컴파일하므로(server/*.cpp가 이미지에 baked여도 harness.cpp는 런타임 컴파일) 샘플 변경이 즉시 반영됨 — 뮤테이션 유효성 전제 충족.

---
## Could-be-stronger (PASS여도 권고 3)

1. **focus + multi-config silent-drop 차단(F-1)**: `runMultiPreview`가 focus를 만나면 (a) focusId를 `buildAndRun`/`compilePlugin`에 plumb하거나, 최소한 (b) "multi-config에선 focus 미지원" 로그/배지로 정직 신호를 내라. 지금은 무경고 소실. 더 강하게는 focus+multi-config 조합 유닛 테스트 1개로 회귀 고정.
2. **click-to-code × focus 결합 회귀 가드(F-6)**: `test:click-to-code`에 `focus=<var>`가 걸린 케이스를 1개 추가해, focus 노드의 __L 손실 범위가 "그 1노드"로 한정됨을 명시적으로 잠가라(지금은 충돌이 테스트 밖이라 미래 변경이 더 넓게 깨도 안 잡힘).
3. **focus mis-resolution(Nth 폴백) 골든 1장**: 현재 골든은 "정타(card2)"만 증명. `focus=nope`(미존재)가 **첫 focusable**로 떨어져 빈손이 아님을 별도 골든/스냅샷으로 잠그면 폴백 경로의 판별력까지 회귀 고정됨(지금 폴백은 유닛에서 코드경로만, 픽셀 증명 없음).

---
OPEN_QUESTIONS: focus + 2개 이상 `@preview-config` 동시 사용을 (a) 의도적으로 미지원(문서화+경고)으로 둘지 (b) M5에서 multi-config 각 변형에도 focus를 plumb할지 — F-1 갭의 처리 방향만 확인 필요. 그 외 none.
