# M2 spec — 인자없는 진입점 + 포커스 시뮬레이션

> 한 줄 요약: `// @dali-preview`(인자없는 팩토리 `View MakeXxxPreview()`를 프리뷰 진입점으로 표시 — Compose의 매개변수 없는 `@Preview` 래퍼 등가물)와 `// @preview-state: focus=<id>`(한 항목을 **포커스된 상태**로 렌더 — TV 핵심, 포커스 링은 런타임이 주입하는 actor라 정적 렌더엔 없음)를 추가한다. 둘 다 **harness/dlopen(full DALi) 경로**에서만 동작(M1 서버 충실도와 독립). 검증은 기존 `npm run test:e2e`(goldenTestRunner)를 확장 — **새 러너 신설 안 함**. focus 해석은 **사용자가 이미 쓴 변수명 bind + Nth-focusable 폴백**(ADR-006), 골든이 의도한 항목에 링이 떴는지 증명한다.

| WU | 한 줄 | Tier | ✋ |
|---|---|---|---|
| WU-M2.1 | `// @preview-state: focus=` 파싱 (codeExtractor) | 3 | no |
| WU-M2.2 | `// @dali-preview` 인자없는 진입점 파싱 + 추출 (codeExtractor/sliceBuilder) | 3 | no |
| WU-M2.3 | 진입점 → 고정 심볼 빌드 배선 (CreatePreviewUI / CreatePreview) | 3(+1 골든) | yes |
| WU-M2.4 | focus 타깃 해석 (변수명 추가-태그 + Nth 폴백) + 템플릿 install | 3 | no |
| WU-M2.5 | focus 렌더 골든 1장 (링이 의도 항목에) — goldenTestRunner 확장 | **1** | **yes** |

---

## 1. Goal / Out of scope

**Goal**: (1) `// @dali-preview`가 붙은 인자없는 팩토리(`View MakeXxxPreview()`)를 `npm run test:e2e`(harness 골든)가 찾아 렌더하고, (2) `// @preview-state: focus=<id>`가 지정 항목에 포커스 링/룩을 입힌 **한 장**을 렌더한다(현재는 전무). 둘 다 AXIS-C(harness/dlopen, full DALi)에서 검증되어 M1 서버 충실도와 독립.

**Out of scope (이 마일스톤에서 명시적으로 안 함)**:
- **일반 `@preview-state` key=value 문법 = CUT** (Inv-3). `focus`와 `progress` 두 키만 ADR-001 문법에 등재되고, 이 마일스톤은 그중 **focus만** 구현. `playing/scroll/selected=` 등 임의 키는 파싱조차 하지 않는다.
- **`progress=` 디렉티브 = M5** (F5.4 — 같은 `parsePreviewStateLine`에 키 1개 추가). M2의 `PreviewState` 타입은 `progress?`를 **선언만** 하고 적용은 안 함(M5 확장 지점).
- **config 적용(theme/locale/fontScale install) = M3** (ADR-004의 `{{UI_CONFIG_SETUP}}`/`{{PRE_BUILD_INSTALL}}`/`{{PALETTE_DEFS}}` 배선). 단 M2가 **focus 링 가시성을 위해 `SetAlwaysShowFocus(true)`만** 템플릿에 추가(focus 디렉티브 유무와 무관하게 무조건 켬 — ADR-006 결정).
- **cross-file/멤버 합성 견고화 = M4**. M2의 `@dali-preview` 팩토리는 기존 슬라이스 머신(`sliceBuilder.buildSlice`)을 **그대로 재사용**한다 — same-file(Rung2/heuristic) 의존만 끌어오고, cross-file(Rung1) 견고화는 안 함.
- **provenance 배지("focus 근사") = M5** (ADR-007). M2는 Nth-폴백이 의도와 달라도 배지를 안 띄운다(정직 신호는 M5).
- **server scene-builder(AXIS-S) focus**: RENDER_JSON엔 focus 의미가 없으므로 focus 디렉티브가 있으면 orchestrator가 컴파일 path로 라우팅(ADR-006). server.cpp는 M2 대상 아님.

---

## 2. Work units

근거 파일은 모두 직접 읽어 `파일:라인`으로 인용. 새 컴포넌트 0 — 전부 기존 파일 확장(architecture.md "결합 지점만 확장").

### WU-M2.1 — `// @preview-state: focus=` 파싱 (F2.3)

- **Files (touch)**:
  - `src/codeExtractor.ts` — 신규 `parsePreviewStateLine(line): PreviewState | null` 추가(기존 `parsePreviewConfigLine` :40 옆). `ExtractionResult`(:5-13)에 `state?: PreviewState` 필드 추가. 세 추출 모드(preview-file :120-142, single-marker :144-217, marker :220-273)의 라인 루프에서 config 라인 수집과 **동일 패턴**으로 state 라인을 수집(코드에서 제외 + `result.state`에 실음). `parsePreviewConfigLine`이 config 라인을 골라내듯, state 라인도 골라낸다.
  - `src/previewConfig.ts` — 신규 `export interface PreviewState { focus?: string; progress?: number }` 추가(현재 `PreviewConfig`/`MultiPreviewResult`만 존재). `progress`는 **선언만**(M5 적용).
  - NEW `test/unit/codeExtractor.preview-state.test.ts` — 파서 단위 테스트(아래 acceptance를 케이스로).
- **문법 (ADR-001 EBNF 준수)**: `state-body := state-kv ("," state-kv)*`, `state-kv := "focus" "=" focus-id | "progress" "=" float`, `focus-id := identifier | string-literal`. 정규식은 **focus/progress 두 키만** 매치(그 외 토큰은 잡지 않음 — Inv-3). 값 검증(ADR-001 §4): focus 빈 문자열/공백 포함이면 무시(IPC 주입 방지 — `previewServer.ts:158`의 `/[\s\n]/` 거부와 일관), progress는 파싱은 float 허용(클램프는 렌더 시 — M5).
- **사용자 관점 acceptance**: `.preview.dali.cpp`나 마커 파일 상단에 `// @preview-state: focus=card` 한 줄을 달면 추출 결과의 `state.focus === "card"`가 되고, 그 줄은 컴파일될 코드에서 제외된다. `focus="Card1"`(문자열)도 `state.focus === "Card1"`. `// @preview-state: playing=true`처럼 미등재 키만 있으면 `state`가 비거나 `focus`가 `undefined`(아무 키도 안 잡힘). 두 줄 이상이면 마지막 유효 줄이 이김(config 다중 수집과 달리 state는 단일 — 첫 줄/마지막 줄 정책은 테스트에 고정).
- **Tier 3** (순수 TS 파서 — UI 없음, §E CLI 휴리스틱 = "그 외 → Tier 3"; 단 unit 프레임워크가 있으므로 실질 Tier 2 수준의 단위 검증).
- **Assertion**:
  ```bash
  npm run compile && npm test
  ```
  → `tsc` 0 에러 + mocha 전체 PASS(신규 `codeExtractor.preview-state.test.js` 포함). 신규 테스트는 위 acceptance를 케이스로: `focus=card`→`"card"`, `focus="Card1"`→`"Card1"`, `playing=true`→`focus undefined`, 빈 `focus=`→무시.
- **✋**: no (순수 파서, 시각 산출물 없음).
- **Pre-conditions**: none.

### WU-M2.2 — `// @dali-preview` 인자없는 진입점 파싱 + 추출 (F2.1)

- **Files (touch)**:
  - `src/codeExtractor.ts` — `extractPreviewCode`의 **Mode 2 분기**(:144-217, 현재 `SINGLE_PREVIEW_MARKER === '// @preview'`만 봄)에 `// @dali-preview` **정확-일치**(`trim() === '// @dali-preview'`)를 같은 루프에서 인식. ADR-001 §3: `@dali-preview-begin`과 충돌 방지를 위해 **줄 끝 정확 일치**여야 함(`@dali-preview-begin`은 접미사가 있어 매칭 안 됨). 추출 로직은 `@preview`와 **공유**(함수 본문 추출 + 선두 변수선언→`return` 재작성 :202-209). 결과 `mode: 'single-marker'` **재사용**(새 mode 값 추가 안 함 — 빌드 라우팅 불변, Inv-7 영향 0). `isPreviewable`(:282-295)도 `@dali-preview` 정확-일치를 포함하도록 확장.
  - `src/sliceBuilder.ts` — `findPreviewFunction`(:112-133)의 마커 정규식이 현재 `/\/\/\s*@preview\b/`(:115)라 `// @dali-preview`를 **못 잡는다**(실측: `@preview\b` 검색이 `@dali-preview` 문자열에서 idx −1 반환). `@dali-preview`도 진입점 마커로 인식하도록 정규식을 `/\/\/\s*@(?:dali-)?preview\b/` 류로 확장(또는 `@dali-preview` 정확-일치를 OR로 추가) — 그래야 slice가 마커 **다음** 팩토리 함수를 진입점으로 고른다. (단 `@dali-preview-begin`을 진입점으로 오인하지 않도록 `\b` 뒤에 `-begin/-end`가 아님을 보장 — `@dali-preview\b` 다음이 `-`면 region 마커.)
  - NEW `test/samples/zero-arg-entry.cpp` — `// @dali-preview`가 붙은 인자없는 팩토리 1개(예: `View MakeHomePreview() { View card = View::New().SetBackgroundColor(...).SetCornerRadius(...); return card; }`). 4줄 팩토리.
  - NEW `test/unit/codeExtractor.dali-preview.test.ts` — `@dali-preview` 추출 단위 테스트.
- **사용자 관점 acceptance**: `// @dali-preview` 다음 줄의 인자없는 `View MakeXxxPreview()` 본문이 추출되고(`mode === 'single-marker'`), `View card = ...; return card;`가 `return ...`로 정규화되거나 마지막 `return`이 보존된다. `// @dali-preview-begin`만 있는 파일에서는 zero-arg 진입점으로 오인되지 않고 기존 region 추출(Mode 3)로 떨어진다. `@dali-preview`와 `@preview`가 한 파일에 둘 다 있으면 첫 유효 마커가 이김(Inv-2, one-marker-per-file).
- **Tier 3** (순수 TS — 추출/슬라이스 로직, UI 없음. 실질 단위 검증).
- **Assertion**:
  ```bash
  npm run compile && npm test
  ```
  → `tsc` 0 에러 + mocha 전체 PASS(신규 `codeExtractor.dali-preview.test.js`). 케이스: `@dali-preview`+팩토리→본문 추출·`mode='single-marker'`; `@dali-preview-begin`만→Mode 3(region)로 폴백, zero-arg로 오인 안 함; `findPreviewFunction(src)`가 `@dali-preview` 마커 다음 함수를 진입점으로 반환.
- **✋**: no (추출 정확성은 단위 테스트로; 실제 렌더는 WU-M2.3 골든).
- **Pre-conditions**: none(WU-M2.1과 독립이나 같은 파일 `codeExtractor.ts`를 만지므로 순차 권장).

### WU-M2.3 — 진입점 → 고정 심볼 빌드 배선 (F2.2)

- **Files (touch)**:
  - 배선 자체는 **이미 성립**: `extractPreviewCode`가 `@dali-preview` 팩토리 본문을 `code`로 내고 `mode:'single-marker'`(WU-M2.2)면, 기존 빌드 경로가 그 `code`를 harness의 `CreatePreviewUI`(`preview_harness.cpp.template:32` — `{{USER_CODE}}` :34) 또는 plugin의 `CreatePreview`(`preview_plugin.cpp.template:64` — `{{USER_CODE}}` :66) 고정 심볼 본문으로 채운다(Inv-7: 고정 심볼 래핑, 새 심볼 추가 금지). 즉 팩토리 **본문**이 곧 진입점 함수 본문이 된다.
  - 검증 자산만 신규: NEW `test/samples/zero-arg-entry.preview.dali.cpp` — `@dali-preview` 팩토리를 **harness가 렌더 가능한 형태**로(goldenTestRunner는 `.preview.dali.cpp`를 전체-코드로 다룸 — `extractCode` :100-108). 이 샘플은 `View MakeHomePreview() {{...}} ` 대신, **팩토리 본문을 `// @dali-preview` 진입점으로** 두되 goldenTestRunner가 읽을 수 있게 함(아래 ⚠️ 참조 — WU-M2.5가 goldenTestRunner의 추출을 codeExtractor와 정합화).
  - NEW 골든 `test/golden/screenshots/zero-arg-entry.png`.
  - ⚠️ **plumbing 주의**: goldenTestRunner의 자체 `extractCode`(:100-108)는 `.preview.dali.cpp`를 **전체 파일**로, `.cpp`는 **marker(`@dali-preview-begin`)**로만 추출하고 `@dali-preview`(zero-arg)·`@preview`(single)는 **모른다**(vscode 모듈 의존 회피로 codeExtractor를 import 안 함 — :89-98 `sanitizeEmoji`가 같은 이유로 인라인됨). 따라서 `@dali-preview`를 골든에서 렌더하려면 goldenTestRunner의 `extractCode`에 zero-arg/single 마커 추출을 **인라인 추가**(codeExtractor 로직 미러). 이 plumbing은 WU-M2.5에서 focus 추출과 **함께** 한다(같은 함수). M2.3은 그 전 단계로 "팩토리 본문이 `CreatePreviewUI`로 흘러 렌더된다"를 단위+골든으로 증명.
- **사용자 관점 acceptance**: `@dali-preview`로 표시한 인자없는 팩토리(예: `HomeScreen(SampleHomeVM()).Build()`를 감싼 4줄 팩토리, 단 M2 샘플은 same-file 자기완결로 — cross-file은 M4)가 실제로 인스턴스화·렌더되어 골든 1장이 생긴다. dlsym/심볼 에러 없이 고정 진입점으로 호출된다.
- **Tier 3** (빌드 배선 — smoke) **+ Tier 1 골든**(렌더 증명). plan.md mandate: "`@dali-preview` entry는 unit-test(Tier 3) AND golden-test(Tier 1)".
- **Assertion**:
  ```bash
  npm run compile && npm test            # 배선/추출 단위 (Tier 3 smoke)
  npm run test:e2e                       # zero-arg-entry 골든 렌더 (Tier 1)
  ```
  → `npm test` PASS + `npm run test:e2e` exit 0 且 stdout에 `zero-arg-entry` + `PASS`. 최초 골든은 `UPDATE_GOLDENS=1 npm run test:golden:update`로 생성 후 재실행 PASS.
- **✋**: yes — 사람이 `test/golden/screenshots/zero-arg-entry.png`를 1회 열어 팩토리가 의도대로 렌더됐는지(빈 화면/크래시 아님) 확인. (이미지 파일 육안 — Read로 PNG 첨부 후 §G 옵션③ 판정 가능.)
- **Pre-conditions**: WU-M2.2(추출). goldenTestRunner 추출 인라인은 WU-M2.5와 공유 → **M2.5 선행 또는 동시**가 깔끔(아래 의존 순서 참조).

### WU-M2.4 — focus 타깃 해석 (변수명 bind + Nth 폴백) + 템플릿 install site (F2.4)

> **핵심 설계 결정 (ADR-006) — focus=<id> → View 핸들 해석**: 가장 단순하면서 **사용자가 이미 쓴 것에 bind**(id 발명 강요 금지)하는 방식을 채택한다. 3단계 폴백:
>
> 1. **인라인 이름(문자열 focus)**: `focus="Card1"`이고 코드 어떤 노드에 그 NAME이 붙어 있으면 `root.FindChildByName("Card1")`(actor.h:899 — 실측 `Actor FindChildByName(Dali::StringView)`).
> 2. **변수명 bind(식별자 focus) — 채택한 1순위 usable 경로**: `focus=card`(따옴표 없는 식별자)면, **빌드 시 그 변수 선언/대입을 찾아 NAME 속성으로 추가 태그**한다. `codeExtractor.instrumentCode`(:430-500)가 이미 모든 Actor-derived `Type::New(...)`를 `__tag(..., "__L<line>")`로 감싸 NAME을 세팅하므로(click-to-code용 `__L<line>`), focus 식별자에 대해서는 **그 변수가 받는 `::New(...)` 식을 `__tag(<expr>, "<var>")`로 한 번 더(또는 NAME을 변수명으로) 태그**해 `FindChildByName("<var>")`로 잡히게 한다. → 사용자는 **이미 쓴 `View card = ...`의 `card`**를 그대로 `focus=card`에 넣으면 됨(새 id 0 — usability 충족).
> 3. **Nth focusable 폴백**: 1·2 실패 또는 `focus=2`(숫자)면, 빌드된 트리를 DFS로 walk해 N번째 focusable View를 잡거나 `FocusManager::MoveFocus`(focus-manager.h:124 — 실측)를 N회. 존재하지 않는 이름이어도 "첫 focusable"이라도 보여줘 빈손 방지.
>
> **왜 이게 가장 단순+usable**: (2)는 기존 `instrumentCode`의 태그 주입 패턴을 그대로 재사용 — 새 인프라 0, 사용자는 변수명만 쓰면 됨. (1)은 사용자가 직접 SetProperty(NAME) 했거나 (2)의 산물을 `FindChildByName`로 찾는 동일 메커니즘. (3)은 안전망. **mis-resolution이 골든에 보이도록**(WU-M2.5): 샘플엔 3개 카드를 두고 `focus=card2`로 가운데 카드를 지정 → 링이 가운데에 떠야 PASS(엉뚱한 카드면 골든 diff로 즉시 드러남).

- **Files (touch)**:
  - `server/preview_harness.cpp.template` — (a) `main`의 `UiConfig::New().Apply();`(:318) → `UiConfig::New().SetAlwaysShowFocus(true).Apply();`(`SetAlwaysShowFocus(bool)` 반환 `UiConfig&` 체이너블, ui-config.h:372 실측; frozen이라 Apply 전 — Inv-4 준수). M0 F0.5 결론대로(spike-findings.md:24-32 — 현재 `UiConfig::New().Apply()`만이라 정적 렌더에 링 없음). (b) `OnInit`의 `window.Add(root);`(:264) **직후**에 새 placeholder `{{POST_BUILD_FOCUS}}` 추가(ADR-004 표: harness `window.Add(root)` 직후). 비어 있으면 `''`로 치환(Inv-6: 빈 줄 자리, 개행 불변).
  - `server/preview_plugin.cpp.template` — focus는 plugin(warm dlopen) 경로에선 서버가 트리에 적용(ADR-006 §server-path는 N/A지만 dlopen focus는 server가 반환 트리에 `SetCurrentFocusView`). M2 골든 검증은 **harness 경로**(WU-M2.5)로 하므로 plugin 측 focus install은 **harness와 동형**의 `{{POST_BUILD_FOCUS}}` 슬롯만 추가(실제 호출 주입은 buildRunner). `SetAlwaysShowFocus`는 plugin이 Apply 전 install 불가(warm) → plugin focus 링은 server의 UiConfig가 켜져 있어야 하나 **M2는 harness로 데모**하므로 plugin focus-ring은 M2 범위에서 best-effort(골든은 harness).
  - `src/codeExtractor.ts` — `instrumentCode`(:430)에 focus 식별자용 추가-태그 경로. `state.focus`가 식별자면 해당 변수의 `::New(...)` 식 NAME을 변수명으로 세팅(또는 보조 태그). 변수 선언 탐지 엣지(멤버/람다 캡처)는 못 잡으면 Nth 폴백으로 떨어짐(ADR-006 Bad 절).
  - `src/buildRunner.ts` — `renderHarness`(:141)/`compilePlugin`(:192)에 `{{POST_BUILD_FOCUS}}` 치환 추가. `state.focus`가 있으면 `FocusManager::Get().SetCurrentFocusView(<resolved>);` 코드 생성(해석 순서: `root.FindChildByName("<id>")` 시도 → null이면 Nth-focusable DFS 헬퍼). `state` 값은 `ExtractionResult.state`(WU-M2.1)에서 plumb.
  - NEW `test/unit/codeExtractor.focusTag.test.ts` — focus 식별자→추가-태그 주입 단위 테스트(주입된 문자열에 `FindChildByName`/태그가 올바른 변수명을 담는지).
- **사용자 관점 acceptance**: 사용자가 `View card2 = ...`로 쓴 변수를 `focus=card2`에 넣으면, 빌드 산출물의 focus install이 `card2` 노드를 가리킨다(`FindChildByName("card2")` 또는 등가). 존재하지 않는 `focus=nope`면 Nth(첫 focusable) 폴백으로 빈손이 아니다. `SetAlwaysShowFocus(true)`가 harness `main`에 무조건 들어가 링이 그려질 준비가 된다(focus 디렉티브 없어도 무해).
- **Tier 3** (해석/주입 로직 — 단위. 실제 링 가시성은 WU-M2.5 골든). **mandate**: 모든 WU ≥ Tier-3 smoke 충족.
- **Assertion**:
  ```bash
  npm run compile && npm test
  ```
  → `tsc` 0 에러(템플릿은 텍스트라 컴파일 영향 없음, 단 buildRunner 치환 코드가 타입체크됨) + mocha 전체 PASS(신규 `codeExtractor.focusTag.test.js`). 케이스: `focus=card2`→주입 문자열에 `card2` NAME 태그; `focus=nope`→Nth 폴백 코드 경로; `SetAlwaysShowFocus(true)`가 렌더된 harness 텍스트에 포함(buildRunner 출력 스냅샷 또는 `renderHarness` 결과에 `SetAlwaysShowFocus` substring).
- **✋**: no (해석/주입은 단위; 시각 증명은 WU-M2.5).
- **Pre-conditions**: WU-M2.1(state 파싱). 템플릿 변경은 기존 harness 골든을 깰 수 있으니(Inv-6) `{{POST_BUILD_FOCUS}}`를 빈 줄 자리에 두고 `''` 치환으로 기존 20개 골든 byte-동일 유지 — **WU-M2.4 직후 `npm run test:e2e`로 기존 골든 무회귀 확인**(아래 mandate-smoke).

### WU-M2.5 — focus 렌더 골든 1장 (링이 의도 항목에) — goldenTestRunner 확장 (F2.5)

- **Files (touch)**:
  - `test/e2e/goldenTestRunner.ts` — (a) `extractCode`(:100-108)에 `@dali-preview`(zero-arg) + `@preview`(single) 마커 추출을 **인라인 추가**(codeExtractor의 Mode 2 로직 미러 — vscode 모듈 의존 회피로 인라인, `sanitizeEmoji` :89-98과 동일 이유). (b) 신규 `parseFocusDirective(filePath)` 인라인 — `// @preview-state: focus=<id>`를 읽어 focus id 반환(WU-M2.1 정규식 미러). (c) `runSample`(:122-197)이 focus id를 빌드로 전달.
  - `test/e2e/standaloneBuildRunner.ts` — `StandaloneBuildOptions`(:9-22)에 `focusId?: string` 추가. `buildAndCapture`(:111-120)와 `buildAndCaptureDocker`(:155-164)의 템플릿 치환에서 현재 `{{FONT_SETUP}}`을 `''`로 채우는 자리(:120, :164) 옆에 **`{{POST_BUILD_FOCUS}}` 치환**을 추가 — `focusId`가 있으면 `FocusManager::Get().SetCurrentFocusView(CreatePreviewUI().FindChildByName("<focusId>"))` 형태가 아니라(트리는 이미 `root`로 잡힘) `window.Add(root)` 직후 슬롯에 `{ Actor __f = root.FindChildByName("<focusId>"); if(__f){ View __fv = View::DownCast(__f); if(__fv) FocusManager::Get().SetCurrentFocusView(__fv);} }` (못 찾으면 Nth-focusable DFS 폴백 헬퍼). `SetAlwaysShowFocus(true)`는 WU-M2.4가 템플릿 `main`에 박았으므로 여기선 focus 타깃만.
    > ⚠️ **plumbing 핵심**: goldenTestRunner는 codeExtractor를 import 못 하므로(vscode 의존) focus 파싱·추출을 **인라인 미러**해야 한다(이미 `sanitizeEmoji`가 같은 이유로 인라인됨 — 선례 존재). 그래서 WU-M2.1의 정규식과 goldenTestRunner의 인라인 정규식이 **drift하지 않도록** 동일 패턴을 쓰고, 단위 테스트(WU-M2.1)가 정규식을, 골든(이 WU)이 end-to-end를 각각 잠근다.
  - NEW `test/samples/focus-grid.preview.dali.cpp` — focus 데모용. **3개 카드를 가로로** 둔 그리드(예: `View card1/card2/card3`, 각각 다른 배경색), 상단에 `// @preview-state: focus=card2`. 링이 **가운데(card2)** 에 떠야 의도대로(엉뚱한 카드면 골든 diff로 드러남 — mis-resolution 가시화).
  - NEW 골든 `test/golden/screenshots/focus-grid.png` — card2에 포커스 링/룩.
- **사용자 관점 acceptance**: `npm run test:e2e`를 돌리면 `focus-grid` 샘플이 렌더되어 **가운데 카드(card2)에 시각적 포커스 표시(링/하이라이트)** 가 보이고 골든과 일치(PASS). focus 디렉티브가 없는 기존 20개 샘플은 링 없이 그대로(무회귀). 존재하지 않는 focus id로 바꾸면 첫 카드라도 포커스되어 빈손이 아니다(Nth 폴백 — 별도 확인용, 골든은 card2).
- **Tier 1** (골든 — 링이 의도 항목에 떴는지 픽셀 비교. **mandate: focus-render WU는 Tier 1**). §G 옵션①(golden) 1순위 + 의심 시 옵션③(Claude vision)로 "링이 card2에 있나" cross-check.
- **Assertion**:
  ```bash
  npm run compile && npm run test:e2e
  ```
  → exit 0 且 stdout에 `focus-grid` + `PASS`. 최초 골든:
  ```bash
  npm run compile && UPDATE_GOLDENS=1 npm run test:golden:update   # focus-grid.png 생성 (육안 확인 후 채택)
  npm run test:e2e                                                 # 재실행 PASS (자기 골든과 일치)
  ```
  + 기존 20개 샘플 전부 여전히 PASS(무회귀). 60s/샘플 내(docker 렌더).
- **✋**: **yes** — 사람이 `test/golden/screenshots/focus-grid.png`를 열어 **포커스 링이 card2(가운데)에 정확히** 있는지 1회 육안(Read로 PNG 첨부 → §G 옵션③ EQUIVALENT/MINOR_DIFF 판정). mis-resolution(엉뚱한 카드/링 없음)이면 baseline 채택 거부 → FAIL.
- **Pre-conditions**: WU-M2.4(템플릿 `{{POST_BUILD_FOCUS}}`+`SetAlwaysShowFocus`, focus 해석 코드). goldenTestRunner의 zero-arg 추출 인라인은 WU-M2.3과 **공유** — 이 WU에서 함께 land(M2.3 골든도 이 인라인을 씀).

---

## 3. Dependency order

```
WU-M2.1 (state 파싱)
   ├─► WU-M2.4 (focus 해석/install: state.focus 소비)
   └─► (goldenTestRunner focus 파싱 인라인은 M2.5)
WU-M2.2 (@dali-preview 파싱/추출)
   └─► WU-M2.3 (진입점 빌드 배선 + zero-arg 골든)
WU-M2.4 + WU-M2.3(의 goldenTestRunner 추출 인라인) ─► WU-M2.5 (focus 골든)
```

**선형 권장 순서**: **M2.1 → M2.2 → M2.4 → M2.3 → M2.5**.
- M2.1·M2.2는 둘 다 `codeExtractor.ts`를 만지므로 순차(파싱 먼저).
- M2.4(focus install/해석)는 M2.1(state)에 의존, M2.3·M2.5보다 먼저 — 템플릿 `{{POST_BUILD_FOCUS}}`/`SetAlwaysShowFocus`를 박고 **기존 골든 무회귀**를 즉시 확인(Inv-6).
- M2.3(zero-arg 골든)과 M2.5(focus 골든)는 **goldenTestRunner의 추출 인라인을 공유** → M2.3에서 zero-arg 추출 인라인을 추가하고, M2.5에서 focus 파싱+install 인라인을 추가(같은 `extractCode`/`runSample` 확장). 둘 다 골든이라 마지막에 묶어 land하면 e2e 1회로 양쪽 검증.
- **각 WU 직후 mandate-smoke**: 모든 WU는 최소 `npm run compile && npm test`(Tier 3)를 통과해야 다음으로. 템플릿을 만진 M2.4 직후엔 추가로 `npm run test:e2e`로 기존 20 골든 무회귀(`{{POST_BUILD_FOCUS}}`='' byte-동일) 확인.

---

## Self-Review

- **Placeholder scan**: TODO/TBD/??? 없음. 5개 WU 모두 제목 + files(인용) + 사용자 관점 acceptance + Tier + **그대로 실행 가능한 assertion 명령**(`npm run compile && npm test` / `npm run test:e2e` / `UPDATE_GOLDENS=1 ...`) + ✋ 여부 부여. 미해결은 OPEN_QUESTIONS로 승격. 인용한 라인은 모두 직접 읽어 확인(codeExtractor.ts:5/40/115/144/202/282/430, sliceBuilder.ts:112/115, preview_harness.cpp.template:32/34/259/264/318, preview_plugin.cpp.template:64/66, goldenTestRunner.ts:89/100/122, standaloneBuildRunner.ts:9/120/164, ui-config.h:372 실측, focus-manager.h:90/124 실측, actor.h:899 실측).
- **Internal consistency**: ADR-001(focus 파싱=M2.1, `@dali-preview` 파싱=M2.2)·ADR-006(focus 해석 3단계=M2.4)·ADR-004(install site `{{POST_BUILD_FOCUS}}`+`SetAlwaysShowFocus`=M2.4/M2.5)가 일치. M0 F0.5 결론(spike-findings.md: `UiConfig::New().Apply()`→`.SetAlwaysShowFocus(true).Apply()`, post-build `SetCurrentFocusView`)이 M2.4/M2.5에 그대로 반영. Inv-2(one-marker-per-file)=M2.2 acceptance, Inv-3(focus/progress만)=M2.1 문법, Inv-6(빈 슬롯 byte-동일)=M2.4/M2.5 치환, Inv-7(고정 심볼)=M2.3. F2.1↔M2.2, F2.2↔M2.3, F2.3↔M2.1, F2.4↔M2.4, F2.5↔M2.5 1:1.
- **Scope check**: 5 WU. CUT(일반 state 문법)·M3(config)·M4(cross-file)·M5(progress/배지)는 어떤 WU 구현에도 안 들어감(Out of scope에 명시, M2.4의 `progress?`는 타입 선언만). 각 WU가 단일 impl 패스 단위(디렉티브 1개/추출 1경로/해석+install/골든 1장). focus-render(M2.5)가 shippable demonstration(`npm run test:e2e` 링 골든). **새 러너 신설 0** — goldenTestRunner 확장(mandate 준수).
- **Ambiguity**: (a) goldenTestRunner가 codeExtractor를 import 못 하는 제약(vscode 의존) → focus/zero-arg 파싱을 **인라인 미러**(선례: `sanitizeEmoji`)하고, 정규식 drift를 WU-M2.1 단위 테스트(정규식)+M2.5 골든(e2e)으로 이중 잠금 — M2.5 files 주의에 명시. (b) focus 해석은 ADR-006의 3단계 중 **변수명 bind(2)** 를 1순위 usable로 채택(id 발명 0), Nth(3)는 폴백 — M2.4 박스에 근거+왜-단순 명시. (c) plugin 경로 focus-ring은 warm 서버라 `SetAlwaysShowFocus` 불가 → M2는 **harness 경로로 골든 데모**(M2.5)하고 plugin focus는 best-effort로 정직화(M2.4 files). (d) mis-resolution 가시화: focus-grid 3카드+`focus=card2`로 엉뚱한 해석이 골든 diff로 드러나게 설계.

OPEN_QUESTIONS:
1. focus 식별자 **추가-태그 주입 위치** — `instrumentCode`가 `View card = __tag(View::New()..., "__L7")` 형태로 이미 click-to-code NAME(`__L7`)을 세팅하는데, focus용 변수명 NAME을 (i) `__L7`을 변수명으로 **덮어쓸지** vs (ii) **보조 속성/이중 태그**로 둘지 — 덮어쓰면 그 노드의 click-to-code 라인 매핑이 깨질 수 있음(click_to_code_e2e.py 회귀 위험), 이중 태그면 `FindChildByName`가 둘 중 무엇을 반환할지 정의 필요. ADR-006은 "click-to-code NAME 보존(별 속성 또는 우선순위)"로 방향만 제시 → impl 단계에서 (ii) 우선 시도하되 `FindChildByName` 단일-NAME 제약이면 focus 노드만 변수명 NAME으로 두고 그 노드의 `__L` 매핑 손실은 허용(focus 데모 1노드 한정, click-to-code 전체엔 영향 미미)인지 사용자 확인 1회 필요. (M2.4 구현 시 click-to-code 무회귀 = `npm run test:click-to-code`로 게이트.)
