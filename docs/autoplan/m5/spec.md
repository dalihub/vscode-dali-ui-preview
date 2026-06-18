# M5 spec — 정직 폴리시 (placeholder · provenance 배지 · progress)

> 한 줄 요약: M5는 "도구가 가짜로 채운/근사한 것"을 사용자에게 **보이게** 만드는 마일스톤이다. 핵심 backbone은 **provenance 배지**(F5.3) — ADR-007의 `metadata.provenance[]` 채널(M2/M3/M4가 이미 채움)을 webview 칩으로 렌더한다. 나머지는 (F5.1) 깨진/미도착 이미지를 **치수 유지 회색 placeholder**로(harness `{{UI_CONFIG_SETUP}}`의 `SetBrokenImageUrl`), (F5.2) 옵션 URL→번들 치환, (F5.4) `progress=<0..1>` 한 장 렌더(0.42 서버 스크러버 `RENDER_AT`/`__SetPreviewProgress` 재사용), (carry-over) multi-config×focus 경고를 provenance 배지로 승격. **새 코드는 쓰지 않고 spec만** 작성. 검증 현실: placeholder는 Tier-1 골든(harness 경로에서 결정적), 배지는 message-contract 단위테스트 + ✋ 시각 사인오프, progress는 Tier-3 스모크, carry-over는 단위테스트.

| WU | 제목 | Tier | 검증 |
|---|---|---|---|
| M5.1 | broken-image placeholder (harness `SetBrokenImageUrl`) | **T1 golden** + T3 | `npm run test:e2e` (신규 placeholder 샘플 픽셀 골든) |
| M5.2 | `// @preview-asset:` URL→번들 치환 (옵션) | T3 + ✋ | `npm run test:unit` (치환 파서/매핑) |
| M5.3 | **provenance 배지 (webview)** — honesty backbone | T3 + **message-contract 단위** + ✋ | `npm run test:unit` (updateImage가 provenance 전달) + ✋ 배지 렌더 |
| M5.4 | `// @preview-state: progress=<f>` 한 장 (스크러버 재사용) | T3 smoke | `npm run test:unit` (파싱+적용 라우팅) + ✋ 프레임 |
| M5.5 | carry-over: multi-config×focus → focus-approx 배지 (+ click-to-code×focus 가드) | T3 + 단위 | `npm run test:unit` (warn→provenance 변환) |

순서: **M5.3(배지) → {M5.1, M5.5} → M5.4 → M5.2**. 근거는 §3.

---

## 1. Goal + Out of scope

### Goal
M5는 **silent-fix를 가시화**한다. 앞선 마일스톤들이 "조용히" 채우거나 근사한 지점(샘플데이터 합성, 미번역 키, bg-only 테마, weak stub, 이미지 미도착)을 사용자가 프리뷰 위에서 **본다**. 구체적으로:

1. **F5.1 placeholder**: 미도착/미해결 `ImageView` URL이 빈 박스가 아니라 **치수 유지 회색 placeholder**로 렌더 → 레이아웃이 유지된다. `UiConfig::SetBrokenImageUrl`(frozen setter)로 구현, M3가 추가한 harness `{{UI_CONFIG_SETUP}}` 슬롯(`server/preview_harness.cpp.template:357`)에 끼운다(spike-findings.md:16 "M5/F5.1: 템플릿 UiConfig 셋업에서 Apply 전 1회 설정").
2. **F5.2 URL→번들 치환 (옵션)**: `// @preview-asset: <urlPattern> -> <bundledPath>` 가 있으면 원격 URL을 워크스페이스 로컬 이미지로 치환(없으면 F5.1 placeholder). 한 개 provenance(`image-substitute`)를 남긴다.
3. **F5.3 provenance 배지 (webview, honesty backbone)**: `metadata.provenance[]`(ADR-007, 닫힌 enum 6종: sample-data/image-substitute/bg-only-theme/focus-approx/untranslated/stub)를 webview 프리뷰 위 칩으로 렌더. 채널·머지·타입은 **이미 존재**(M3가 `ProvenanceEntry`/`mergeProvenance`/`buildUntranslatedProvenance` 구현, `previewConfig.ts:46`, `previewOrchestrator.ts:329/352`) — M5는 **webview 소비부만** 추가.
4. **F5.4 progress 한 장**: `// @preview-state: progress=<0..1>`(M2가 이미 파싱, `PreviewState.progress` 선언만 — `previewConfig.ts:24`)를 받아 0.42 애니 스크러버(`scrubAnimation`→`server.renderAt`→`RENDER_AT`→`__SetPreviewProgress`)로 그 진행 상태 **한 장**을 렌더.
5. **carry-over**: multi-config + focus 조합에서 현재의 warn-log(`previewOrchestrator.ts:1012-1016`)를 **focus-approx provenance 배지**로 승격(ADR-007 theme 일치). + minor click-to-code×focus 가드(oos-queue.md:4).

**완료 정의(Demonstration, plan.md:71)**: (1) 비동기 포스터가 치수 유지 placeholder로 렌더, (2) 무음 보정(샘플데이터/포커스/이미지 치환/bg-only/미번역/stub)이 일어난 프레임에 provenance 배지가 보임, (3) `progress=0.4` 한 개가 40% 상태 한 장을 렌더.

### Out of scope (CUT — 본 M5에서 명시적으로 안 함)
- **진짜 비동기 fetch**: 정적 한계 인정(plot.md:72). placeholder/번들 치환까지만 — 실제 네트워크 다운로드는 안 한다.
- **일반 상태 문법 확장**: `playing/scroll/selected=` 류는 CUT(plan.md:72/41). focus(M2 완료) + **progress 하나만** 추가. 새 디렉티브 grammar 확장 없음.
- **새 webview 프레임워크/패널**: ADR-007 §"Alternatives"가 거대 신규 webview를 기각. 기존 `media/preview.html`을 **확장**(배지 칩 컨테이너 1개 추가). 기존 배지 CSS(`.flex-explorer-badge` :760 / `.animation-badge` :970) 재사용.
- **노드별(per-node) provenance 속성**(`node.provenance`): ADR-007 §Alternatives가 미래 확장으로 남김. M5는 top-level 프레임 단위 배열만.
- **provenance 새 kind 추가**: enum은 6종으로 cap(ADR-007 §1). 새 kind = ADR 개정 필요 → M5 범위 밖.
- **server.cpp의 provenance emit**: host-merge가 주 경로(server 무변경, 이미지 재빌드 0). 런타임-only 마커(`>>>PROV:`)는 M5에서 **focus-approx 한 종에 한해** carry-over(M5.5)에서 host-side로 처리, server emit은 도입 안 함.

---

## 2. Work units

> 공통: 모든 WU는 최소 Tier-3(스모크: 컴파일 통과 + 무언가 렌더/메시지 발신). 각 WU의 "EXACT assertion command"는 그대로 복붙 실행 가능. ✋ = 사람 사인오프 필요(자동 검증으로 닫히지 않는 시각/런타임 항목).

---

### WU-M5.1 — broken-image placeholder (harness `SetBrokenImageUrl`)
**파일(기존)**:
- `server/preview_harness.cpp.template` (`{{UI_CONFIG_SETUP}}` 슬롯, :357 `UiConfig::New(){{UI_CONFIG_SETUP}}.SetAlwaysShowFocus(true).Apply();`)
- `src/buildRunner.ts` (`buildUiConfigSetup` :176 — 슬롯 문자열 빌더; 여기 broken-image URL을 체인에 추가)
- `test/e2e/standaloneBuildRunner.ts` (`buildUiConfigSetup` :95 — 위의 미러; 골든 러너가 같은 슬롯을 채움)
- `test/samples/broken-image.preview.dali.cpp` **(신규 샘플)** — 미해결 URL을 쓴 `ImageView` + 명시 200×200 (M1의 `server-path/imageview-method-url`을 harness 경로로 옮긴 결정적 버전)
- `test/golden/screenshots/broken-image.png` **(신규 골든)** — `UPDATE_GOLDENS=1`로 시드
- `docker/Dockerfile`(또는 런타임 이미지 빌드 스크립트) — placeholder 비트맵 1개를 고정 경로(예: `/usr/share/dali-preview/broken.png`)로 bake. **(주의: 서버/이미지 변경 → 런타임 이미지 재빌드 필요, MEMORY의 baked-in 규칙)**

**user-perspective acceptance**: 포스터 URL이 비어있던(빈 박스) 자리에 이제 **레이아웃을 유지하는 회색 placeholder 박스**(200×200)가 보인다. M1에서는 같은 케이스가 비결정적(broken-image 픽셀이 환경마다 달라 `@render-only`)이었지만, `SetBrokenImageUrl`로 **고정 비트맵**을 지정하므로 이제 **결정적 픽셀 골든**으로 박을 수 있다.

**tier**: **Tier-1 (golden)** + Tier-3(스모크: 슬롯이 비어도 byte-identical 회귀 없음).

**검증 현실 노트 (중요)**:
- F5.1은 frozen `UiConfig` setter → **harness 경로(`test:e2e`, `goldenTestRunner.ts`)에만** 적용 가능. 서버-path(`test:e2e:server`, `serverGoldenRunner.ts` → `RENDER_JSON`)는 resident 서버가 이미 `UiConfig::Apply()`를 끝낸 상태(spike-findings.md:7)라 broken-image를 못 끼운다. → 그래서 **새 결정적 샘플은 harness 경로용 `test/samples/broken-image.preview.dali.cpp`** 로 두고 `test:e2e` 골든으로 잡는다. M1의 `server-path/imageview-method-url`은 `@render-only`로 **그대로 둔다**(서버 경로엔 placeholder 미적용 — 정직).
- "결정적이 됐는지"는 **2회 연속 골든 통과**로 확인(`UPDATE_GOLDENS=1` 시드 후 무옵션 2회). 만약 placeholder가 여전히 async-flaky면 폴백: 샘플에 `// @render-only` 부여하고 Tier-3(렌더만)로 강등 + OPEN_QUESTIONS에 기록. **기본 가정은 "결정적"** (고정 로컬 비트맵은 네트워크 없음 → 재현 가능).

**EXACT assertion command**:
```bash
# 시드(최초 1회, 사람이 결과 비트맵 ✋ 확인 후): 신규 샘플의 골든 생성
UPDATE_GOLDENS=1 xvfb-run -a node out/test/e2e/goldenTestRunner.js 2>&1 | grep -E "broken-image.*(UPDATED|PASS)"
# 결정성 검증: 옵션 없이 2회 연속 통과해야 결정적
npm run compile && xvfb-run -a node out/test/e2e/goldenTestRunner.js 2>&1 | grep -E "broken-image .* PASS" \
  && xvfb-run -a node out/test/e2e/goldenTestRunner.js 2>&1 | grep -E "broken-image .* PASS"
# 회귀 가드: broken-image 미사용 샘플은 슬롯 추가로 픽셀이 변하면 안 됨(전체 e2e green)
npm run test:e2e
```
**✋**: 시드 단계에서 사람이 `test/golden/screenshots/broken-image.png`를 열어 "치수 유지 회색 placeholder가 200×200 자리에 보이는지" 1회 사인오프(골든은 사람이 한 번 봐야 신뢰 가능). 이후엔 자동.

**구현 메모(스펙 한정, 코드 아님)**: `buildUiConfigSetup`이 fontScale만 받던 것을 broken-image URL도 받도록 시그니처를 확장하고, 슬롯 체인에 `.SetBrokenImageUrl("<baked-path>")`를 **항상**(또는 설정 가능 기본값) 추가. URL은 빌드 인자가 아니라 **상수**(런타임 이미지에 bake된 고정 경로)라 byte-identical 영향은 "체인에 한 메서드 추가" 1회뿐 — 기존 골든은 broken-image를 안 쓰므로 픽셀 불변(그래서 위 회귀 가드).

---

### WU-M5.2 — `// @preview-asset:` URL→번들 이미지 치환 (옵션)
**파일(기존)**:
- `src/codeExtractor.ts` (디렉티브 파서 — `@preview-config`/`@preview-state`/`@preview-preset`와 같은 위치에 `@preview-asset:` 줄 파싱; `ExtractionResult`에 `assetMap` 추가)
- `src/previewConfig.ts` (파싱 결과 타입 — `AssetSubstitution { urlPattern: string; bundledPath: string }` 추가; 옵션)
- `src/previewOrchestrator.ts` (`prepareSlice`/빌드 직전에 코드 내 매칭 URL을 로컬 경로로 치환 + `image-substitute` provenance 1개 push → `applySuccessfulBuild`의 `provenance` 인자로)
- `test/unit/codeExtractor.previewAsset.test.ts` **(신규 단위)** — 디렉티브 파싱 + 매핑
- `test/samples/asset-substitute.preview.dali.cpp` **(신규 샘플, 스모크용)** — `@preview-asset:` + 원격 URL + `test/samples/assets/`의 실존 이미지로 치환

**user-perspective acceptance**: `// @preview-asset: https://cdn.example.com/poster.jpg -> assets/album_art.jpg` 를 달면, 그 원격 URL을 쓴 `ImageView`가 placeholder 대신 **실제 그림**(번들 이미지)으로 렌더되고, 프리뷰에 `image-substitute` 배지가 뜬다("URL → assets/album_art.jpg"). 디렉티브가 없으면 F5.1 placeholder로 폴백(동작 변화 없음).

**tier**: Tier-3 (스모크: 샘플이 치환된 이미지로 렌더) + 단위(파싱/매핑).

**검증 현실 노트**: 치환 로직(파싱 + 문자열 매핑 + provenance push)은 **순수 TS → 단위 테스트로 닫힘**. 실제 "그림이 보이는지"는 ✋ — 다만 옵션 기능이라 우선순위 최하(§3에서 마지막). 보안: `bundledPath`는 워크스페이스 루트 containment(`resolveProjectIncludes`의 가드 :404 재사용 정신) — 임의 절대경로/`../` 탈출 거부.

**EXACT assertion command**:
```bash
npm run compile && npx mocha out/test/unit/codeExtractor.previewAsset.test.js --require out/test/helpers/setup.js --timeout 10000
# 스모크: 샘플이 치환되어 렌더(픽셀 골든 아님 — 번들 이미지라 환경 의존 가능)
xvfb-run -a node out/test/e2e/goldenTestRunner.js 2>&1 | grep -E "asset-substitute .* (PASS|RENDER)"
```
**✋**: 치환 이미지가 실제로 프리뷰에 그려지고 `image-substitute` 배지가 함께 뜨는지 라이브 프리뷰 1회 사인오프(샘플을 열고 프리뷰 패널 확인).

**옵션성 명시**: 본 WU는 plan.md F5.2가 "(옵션)"으로 표기. 우선순위가 낮으므로(§3 last) 시간 압박 시 **OPEN_QUESTIONS로 defer 가능** — F5.1 placeholder만으로도 "치수 유지" 정직성은 충족.

---

### WU-M5.3 — provenance 배지 (webview) — **honesty backbone**
**파일(기존)**:
- `media/preview.html`:
  - **CSS**: 기존 `.flex-explorer-badge`(:760)/`.animation-badge`(:970) 패턴을 따른 `.provenance-chip` + kind별 색 클래스 추가(닫힌 enum 6종 → 라벨/색 매핑).
  - **DOM**: `#previewArea`(:1090)/`#previewContainer`(:1092) 상단(또는 모서리)에 `#provenanceBar` 칩 컨테이너 1개 추가.
  - **단일 핸들러**: `case 'updateImage'`(:2159)에서 `msg.metadata.provenance`를 읽어 칩 렌더(없거나 빈 배열 → 컨테이너 비움 = 배지 없음). `renderMetadataOverlay`(:1629) 호출 지점 근처에 `renderProvenance(msg.metadata)` 추가.
  - **멀티 그리드**: `case 'updateMultiImage'`(:2249)의 per-item 루프(:2263)에서 `imgInfo.metadata.provenance`를 그 아이템 헤더 아래 칩으로 렌더(config별 다른 배지 — dark 변형만 bg-only-theme 등, ADR-007 §3).
- `src/previewManager.ts` — **변경 없음 확인용 참조**: `updateImage`(:63)가 이미 `metadata`를 그대로 postMessage(:70-77), `updateMultiImage`(:80)가 이미 `item.metadata`(:112-116)에 provenance 포함된 JSON을 실음. **즉 host→webview 채널은 변경 0** (ADR-007 §"채널 재사용"). M5는 webview 소비만.
- `test/unit/previewManager.test.ts` — message-contract 단위테스트 추가(아래).

**user-perspective acceptance**: 도구가 무언가 채웠을 때(예: 멤버 VM 샘플데이터 합성, locale인데 카탈로그 없어 `IDS_` 그대로, theme=dark가 hex앱이라 bg만, weak stub, URL placeholder/치환) 프리뷰 위에 **작은 칩**("sample-data", "untranslated: IDS_TITLE", "bg-only theme" 등)이 뜬다. 아무것도 근사 안 된 정상 프리뷰엔 **배지가 0개**(시각 노이즈 없음, ADR-007 §Consequences "정상은 배지 0"). 멀티프리뷰에선 변형별로 다른 배지가 떠(dark만 bg-only) 정직성이 더 드러난다.

**tier**: Tier-3(스모크: webview가 provenance 있는 metadata로 깨지지 않고 렌더) + **message-contract 단위테스트(필수)** + **✋ 시각 사인오프(필수)**.

**검증 현실 노트 (중요)**: 배지는 webview UI라 **픽셀 골든 금지**(패널은 골든화하지 않음 — plan/지시 일치). 대신 **두 갈래**로 검증:
1. **message-contract 단위테스트** (`previewManager.test.ts`의 `postedMessages` 스파이 재사용 — :11 `makeManagerWithSpy`): `updateImage(png, t, metadataWithProvenance)` 호출 시 postMessage된 `updateImage` 메시지의 `metadata.provenance`가 **원본 배열 그대로** 실려 webview로 가는지 단언. (host가 provenance를 떨어뜨리지 않음을 보장 — 채널 무결성). 멀티도 동일(`updateMultiImage` → `images[i].metadata.provenance`). 이는 ADR-007 §2의 "webview가 metadata.provenance를 읽는다"의 **전제(데이터가 도달함)**를 잠근다.
2. **✋ 시각 사인오프**: 실제로 칩이 렌더되는지는 사람이 본다 — provenance가 실제로 발생하는 샘플(예: `multi-config-locale`의 ar 변형 = untranslated, 또는 `theme-dark-tokens` hex 변형 = bg-only-theme, 또는 flow-banking 멤버합성 = sample-data)을 열어 배지가 보이는지 1회 확인.

**EXACT assertion command**:
```bash
npm run compile && npx mocha out/test/unit/previewManager.test.js --require out/test/helpers/setup.js --timeout 10000 2>&1 | grep -E "provenance|passing"
# 채널이 안 깨졌는지 전체 단위 green (mergeProvenance/buildUntranslated 기존 테스트 포함)
npm run test:unit
```
**✋**: provenance가 실제 발생하는 샘플(아래 중 하나)을 열고 프리뷰 패널에서 칩이 보이는지 사인오프 —
- `test/samples/multi-config-locale.preview.dali.cpp`(ar 변형 → `untranslated` 칩, 단 IDS_ 키가 코드에 있어야 함 — 없으면 샘플에 `SetTranslatableText("IDS_…")` 추가가 이 WU의 부수작업),
- 또는 `samples/flow-banking/`(멤버합성 → `sample-data` 칩).
정상 프리뷰(`hello-label`)에선 배지 0개인지도 같이 확인.

**구현 메모(스펙 한정)**: kind→라벨/색 매핑 테이블은 webview 안에 상수로(닫힌 enum이라 안전, ADR-007 §1 "webview가 kind→배지 라벨/색을 매핑"). 6종: sample-data(회색), image-substitute(파랑), bg-only-theme(노랑), focus-approx(보라), untranslated(주황), stub(빨강) — 색은 가독성(어두운 배경 webview에 대비) 우선, ✋에서 확정.

---

### WU-M5.4 — `// @preview-state: progress=<f>` 한 장 (0.42 스크러버 재사용)
**파일(기존)**:
- `src/codeExtractor.ts` — `@preview-state`의 `progress=<f>` 파싱은 **이미 완료**(실측 확인): `STATE_PROGRESS_RE`(:47)가 있고 `state.progress`에 float로 실린다(:173; 주석 :149 "range-clamping happens at render time — M5"). 즉 M5.4는 **파싱이 아니라 APPLY만** 한다. 단, `goldenTestRunner.ts`의 미러(:36 `STATE_FOCUS_RE`만 있음)에는 progress 미러가 **없으므로** progress 미러를 추가해야 한다(harness 골든 러너가 progress를 모름 — 다만 progress는 server-mode 전용이라 golden 러너 적용은 제한적, 아래 검증 노트 참조).
- `src/previewOrchestrator.ts`:
  - `runBuildStrategies`(:764)/`runPreview`(:930): progress가 있으면 **서버/dlopen 경로를 강제**(스크러버는 dlopen 플러그인 `__SetPreviewProgress`로만 동작 — `preview_plugin.cpp.template:51`; 서버 `RENDER_AT`는 resident 플러그인 재사용 `preview_server.cpp:901`). focus와 달리 progress는 harness가 아니라 **server-mode**가 필요(반대 라우팅).
  - `applySuccessfulBuild`(:613) 직후: server-mode이고 애니가 등록됐으면(`result.animationCount>0`) `scrubAnimation(progress, activeEpoch_)`(:671)를 **1회** 호출해 그 progress 프레임을 렌더(스크러버 인프라 그대로 재사용 — `server.renderAt` :701).
- `test/unit/previewOrchestrator.progress.test.ts` **(신규 단위)** — progress 라우팅(progress 있으면 server-mode 강제 + 적용) characterization.
- `test/samples/animation/progress-frame.preview.dali.cpp` **(신규 샘플)** — `animation-scrub.preview.dali.cpp`(:1)에 `// @preview-state: progress=0.4` 한 줄 추가한 변형.

**user-perspective acceptance**: 애니메이션이 있는 프리뷰에 `// @preview-state: progress=0.4`를 달면, 인터랙티브 스크러버를 안 움직여도 **처음부터 40% 진행 상태 한 장**이 렌더된다(예: pulse FAB이 40% 시점 크기로). progress 없으면 동작 변화 없음(스크러버는 0에서 시작).

**tier**: Tier-3 (스모크: progress 샘플이 server-mode로 렌더 + 단위로 라우팅 검증).

**검증 현실 노트**: progress 프레임은 **server/dlopen 경로 전용**(스크러버가 거기만 있음) → e2e 골든 러너(`goldenTestRunner` = harness)로는 못 잡는다. 그리고 server-path 골든(`serverGoldenRunner` = `RENDER_JSON`)은 스크러버(`RENDER_AT`)와 다른 명령이라 progress를 안 탄다. → 따라서 **픽셀 골든 대신**: (a) **단위테스트로 라우팅**(progress→server-mode 강제 + scrubAnimation 1회 호출) characterization, (b) **✋ 스모크**: 라이브 프리뷰에서 progress=0.4 샘플이 40% 프레임으로 뜨는지 1회 확인. (서버 스크러버 e2e는 이미 별도로 검증됨 — anim-scrub 기능의 기존 e2e, MEMORY `project_anim_scrub_feature`.)

**EXACT assertion command**:
```bash
# 파싱 확인: progress가 extraction.state.progress에 실리는지 (codeExtractor 단위)
npm run compile && npx mocha out/test/unit/codeExtractor.previewState.test.js --require out/test/helpers/setup.js --timeout 10000 2>&1 | grep -E "progress|passing"
# 라우팅: progress 있으면 server-mode 강제 + scrubAnimation 1회 (orchestrator 단위)
npx mocha out/test/unit/previewOrchestrator.progress.test.js --require out/test/helpers/setup.js --timeout 10000
```
**✋**: `test/samples/animation/progress-frame.preview.dali.cpp`(progress=0.4)를 resident 서버가 떠 있는 상태에서 열고, 스크러버를 안 건드려도 첫 프레임이 40% 진행 상태인지 사인오프.

**구현 메모(스펙 한정)**: focus(harness 강제, :804)와 **반대로** progress는 dlopen/server 강제. 둘 다 있으면? → focus가 harness, progress가 server라 **상충** → M5에서는 "focus와 progress 동시 지정 시 progress 무시 + warn"(또는 그 역) 한 줄 정책 결정 필요 → OPEN_QUESTIONS. 대부분 샘플은 둘 중 하나만 쓰므로 실무 영향 적음.

---

### WU-M5.5 — carry-over: multi-config × focus → `focus-approx` 배지 (+ click-to-code×focus 가드)
**파일(기존)**:
- `src/previewOrchestrator.ts`:
  - `runPreview`의 multi-config 분기(:1007-1021): 현재 `extraction.state?.focus`면 **warn-log만**(:1012-1016). 이를 **provenance 배지로 승격** — `runMultiPreview`에 focusId를 넘겨, 각 variant의 metadata에 `focus-approx` provenance(detail: "focus not applied in multi-config")를 `mergeProvenance`로 머지(:352 재사용). webview 칩은 M5.3가 렌더.
  - `runMultiPreview`(:1085): per-item 결과의 metadata 읽기 지점(현재 `previewManager.updateMultiImage(results)` :1201 직전)에서 focus가 있었으면 각 `results[i]`의 metadata에 focus-approx 머지. (multi는 metadata를 `previewManager`가 파일에서 읽으므로 — `previewManager.ts:112-116` — 머지 위치는 host가 metadata를 들고 있는 시점이어야 함 → 구현 시 `runMultiPreview`가 metadata를 읽어 머지 후 넘기는 형태로 소폭 조정 필요. 스펙은 "focus-approx가 multi variant metadata에 실린다"까지 고정).
- `test/unit/orchestrator.focus.test.ts` (기존) 또는 `test/unit/previewOrchestrator.provenance.test.ts`(기존, :1) — multi-config+focus 시 focus-approx provenance가 생성되는지 단위 추가.
- (minor) click-to-code×focus 가드: focus NAME-injection(focus= 변수명 주입)이 `__L<line>` 클릭태그와 충돌 안 하는지 회귀 단위(oos-queue.md:4). `orchestrator.focus.test.ts`에 케이스 추가 — focus 이름이 `__L`로 시작하면 안 되거나, NAME-injection이 click-to-code 태그를 덮지 않는지.

**user-perspective acceptance**: multi-config 파일(예: light-dark 프리셋)에 `// @preview-state: focus=card`를 달면, 지금까지는 outputChannel 경고(사용자가 패널 안 봄)만 떴지만, 이제 **각 변형 프리뷰 위에 `focus-approx` 배지**("focus not applied in multi-config")가 떠 silent-drop이 보인다. (단일-config에선 focus가 정상 적용되므로 배지 없음.)

**tier**: Tier-3 + 단위(warn→provenance 변환 + click-to-code 가드).

**검증 현실 노트**: warn→provenance 변환은 **순수 host 로직 → 단위로 닫힘**. 칩 렌더 자체는 M5.3의 ✋에 포함(별도 ✋ 불필요 — 같은 채널·같은 UI). click-to-code 가드도 단위(NAME-injection vs 태그 문자열).

**EXACT assertion command**:
```bash
npm run compile && npx mocha out/test/unit/previewOrchestrator.provenance.test.js out/test/unit/orchestrator.focus.test.js --require out/test/helpers/setup.js --timeout 10000
# 전체 단위 green (carry-over가 기존 focus/multi 동작을 깨지 않음)
npm run test:unit
```
(✋ 없음 — 배지 시각 확인은 M5.3 ✋가 커버; 이 WU는 "데이터가 focus-approx로 생성됨"까지만 책임.)

---

## 3. Dependency order

```
        M5.3  (provenance 배지 webview — backbone; 다른 WU의 배지가 보일 표면)
       /    \
   M5.1      M5.5
 (placeholder) (multi×focus → focus-approx 배지 + click-to-code 가드)
      \
      M5.4 (progress 한 장 — 스크러버 재사용)
       |
      M5.2 (URL→번들 치환 — 옵션, 최하 우선순위)
```

**순서: M5.3 → {M5.1, M5.5} → M5.4 → M5.2.**

근거:
1. **M5.3(배지) 최우선** — honesty backbone이고 **표면(surface)**이다. M5.1의 placeholder, M5.2의 image-substitute, M5.5의 focus-approx, (M3가 이미 만든) untranslated/bg-only/sample-data/stub provenance가 **보이려면 webview 소비부가 먼저 있어야** 한다. 배지가 없으면 다른 WU들의 provenance는 metadata에만 있고 사용자가 못 본다. M5.3은 의존이 0(채널·머지·타입 모두 M3 완료) → 즉시 착수 가능.
2. **M5.1, M5.5는 M5.3 뒤, 상호 독립** — 둘 다 새 provenance kind를 발생시키거나(M5.1: image-placeholder는 사실 F5.1 자체는 배지 없이도 "치수 유지"가 가치; image-substitute 배지는 M5.2 소관) / focus-approx(M5.5)를 만든다. M5.1은 harness 슬롯/골든(독립 인프라), M5.5는 host 로직(독립). 서로 안 건드림 → 병렬 가능.
   - 미세 노트: M5.1의 핵심(placeholder 골든)은 배지와 무관하게 성립(치수 유지 자체가 가치) → 엄밀히는 M5.3 없이도 가능. 하지만 "image 관련 provenance를 보여주는" 정직성 일관성을 위해 M5.3 뒤에 배치(병렬 OK라 비용 0).
3. **M5.4(progress)는 그 다음** — 스크러버(0.42) 재사용이라 인프라는 있지만, server-mode 라우팅 변경(focus와 반대 방향)이 orchestrator를 건드려 M5.5(같은 orchestrator)와 충돌 여지 → M5.5 뒤에 두어 병합 단순화. 배지와 무관(progress는 근사가 아니라 "요청한 상태"라 provenance 없음).
4. **M5.2(URL→번들 치환)는 최하** — plan.md가 "(옵션)"으로 명시. F5.1 placeholder만으로 "치수 유지" 정직성 충족 → 시간 압박 시 defer 가능. image-substitute 배지를 띄우므로 M5.3 의존.

**병렬화**: M5.3 완료 후 M5.1 ∥ M5.5 동시 진행 가능. M5.4·M5.2는 순차(둘 다 orchestrator/단일 표면 변경이라 충돌 최소화 위해 직렬).

---

## Self-Review

- **Placeholder scan**: TODO/TBD/??? 없음. 모든 WU에 제목 + 사용자 관점 acceptance 1줄 + tier + EXACT 명령 + (필요시) ✋ 부여. 미해결 긴장은 OPEN_QUESTIONS로 승격(임의 가정 금지).
- **Grounding (file:line 실측)**: `SetBrokenImageUrl`=frozen→`{{UI_CONFIG_SETUP}}`(spike-findings.md:16, harness :357, buildRunner `buildUiConfigSetup` :176/standalone :95). provenance 채널·타입·머지 **이미 존재**(`previewConfig.ts:46` ProvenanceEntry, `previewOrchestrator.ts:329` buildUntranslated/:352 mergeProvenance, `previewManager.updateImage` :63/`updateMultiImage` :80가 metadata 그대로 전달). webview 소비 지점(`media/preview.html` updateImage :2159 / updateMultiImage :2249 / 배지 CSS :760·:970 / renderMetadataOverlay :1629). 스크러버=server/dlopen 전용(`preview_plugin.cpp.template:51` `__SetPreviewProgress`, `preview_server.cpp:901` RENDER_AT, orchestrator `scrubAnimation` :671 → `server.renderAt`). progress 선언만(`previewConfig.ts:24`). multi×focus warn(`previewOrchestrator.ts:1012-1016`). carry-over 출처(oos-queue.md:3-4). 단위테스트 인프라 실재(`previewManager.test.ts` `makeManagerWithSpy`/`postedMessages`, `previewOrchestrator.provenance.test.ts`). 명령은 `package.json` 실측(test:unit=mocha, test:e2e=goldenTestRunner, test:e2e:server=serverGoldenRunner).
- **검증 현실 일치(지시 mandate)**: 모든 WU ≥ Tier-3 ✓. placeholder=Tier-1 골든(M5.1, 단 "결정적"인지 2회통과로 확인 + flaky 시 @render-only 폴백 명시) ✓. 배지=message-contract 단위(postedMessages 스파이) + ✋(M5.3), **패널 픽셀 골든 안 함** ✓. progress=스모크(server 전용이라 골든 불가 → 단위 라우팅 + ✋) ✓. carry-over=단위(warn→provenance) ✓.
- **기존 인프라 재사용(mandate)**: M3 `{{UI_CONFIG_SETUP}}` 슬롯(M5.1) / 0.42 스크러버 `RENDER_AT`·`__SetPreviewProgress`·`scrubAnimation`(M5.4) / ADR-007 provenance 채널·`mergeProvenance`(M5.3·M5.5) / 기존 webview 배지 CSS·updateImage 핸들러(M5.3). 새 IPC·새 패널·새 프레임워크 0 ✓.
- **Out of scope 일치**: CUT 3개(진짜 async fetch / 일반 상태문법 / 새 webview)가 §1 Out of scope에 명시, 어떤 WU에도 등장 안 함 ✓. progress+focus만 상태 grammar(F5.4) ✓.
- **남은 긴장 2곳 명시**: (a) M5.1 placeholder의 "결정성"은 가정(고정 로컬 비트맵→재현 가능)이나 미확정 → 2회통과 게이트 + flaky 폴백. (b) focus×progress 동시 지정 시 라우팅 상충(harness vs server) → OPEN_QUESTIONS.

OPEN_QUESTIONS: (1) **focus + progress 동시 지정**: focus는 harness 경로 강제(:804), progress는 server/dlopen 경로 필요(스크러버 위치) — 상충. M5에서 "동시 지정 시 한쪽 무시 + warn"의 우선순위(focus 우선? progress 우선?)를 결정해야 함. 기본 제안: progress 우선(런타임 상태 요청이 더 구체적) + focus는 focus-approx provenance로 강등 — 단 사용자 확인 필요. (2) **F5.1 placeholder 결정성**: `SetBrokenImageUrl`로 지정한 고정 로컬 비트맵이 환경(폰트/렌더러)과 무관하게 픽셀-결정적인지는 시드+2회통과로 실측해야 확정 — 만약 async 타이밍으로 여전히 flaky하면 Tier-1 골든→Tier-3 @render-only로 강등(샘플은 유지, 가치는 "치수 유지 렌더"로). (3) **F5.2(URL→번들 치환) 포함 여부**: plan.md가 "(옵션)"으로 명시 — 본 M5에 넣을지(M5.2) vs F5.1만으로 충분하다고 보고 defer할지 사용자 우선순위 확인. (4) **broken-image 비트맵 bake**: placeholder 비트맵을 런타임 docker 이미지에 굽는 작업은 이미지 재빌드를 유발(MEMORY baked-in 규칙) — M5 안에서 이미지 재빌드+푸시를 할지, 아니면 비트맵 경로만 정하고 릴리즈와 분리할지 결정 필요.
