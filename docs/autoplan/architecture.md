# Architecture — dali-ui preview gap-closing

> 한 줄 요약: 이 캠페인(M0~M5)은 **새 컴포넌트를 만들지 않는다.** 기존 4개 결합 지점만 확장한다 —
> ① `codeExtractor.ts`의 디렉티브 문법(ADR-001), ② `docker/preview_server.cpp`의 setter-dispatch(ADR-003),
> ③ 템플릿(`preview_harness/plugin.cpp.template`)의 "트리 빌드 직전" install site(ADR-004), ④ `sliceBuilder.ts`/
> orchestrator의 cross-file 수집(ADR-005). 검증 게이트는 **새 server-path 골든 러너**(ADR-002) — 기존 harness
> 골든은 server scene-builder를 전혀 안 거치기 때문. 가짜/스텁 금지: 모든 디렉티브는 실제 dali-ui API로
> 내려간다(헤더 시그니처 인용). 측정값은 metadata-JSON 채널(ADR-007)로 webview에 흐른다.

이 문서와 7개 ADR은 **append-only**다. 모든 코드 주장은 직접 읽은 `파일:라인`을 인용한다(프롬프트 힌트 아님).

---

## Stack / extension points (existing code the campaign touches)

| Layer | File(s) | What changes (어느 ADR / 마일스톤) |
|---|---|---|
| Directive parsing (host TS) | `src/codeExtractor.ts` (`PREVIEW_CONFIG_RE` :19, `SINGLE_PREVIEW_MARKER` :17, `MARKER_BEGIN/END` :15-16, `parsePreviewConfigLine` :40, `extractPreviewCode` :115) | **ADR-001**: `@dali-preview`(zero-arg 진입점, M2), `@preview-state: focus=/progress=`(M2/M5), `@preview-config:` 확장(M3), `@preview-preset:`(M3). `PreviewConfig` 인터페이스(`src/previewConfig.ts`)에 필드 추가. |
| Server scene-builder (C++, baked-in) | `docker/preview_server.cpp` (`SBApplyCommonProps` :491, `SBBuildNodeRaw` :563, `SBParseUiColor` :438, `SBParseFloat` :430, `SBParseDimension` :484, `SBParseExtents` :455) | **ADR-003**: `SetCornerRadius`/`SetOpacity`/`SetVisibility`/Borderline을 `SBApplyCommonProps`에, 메서드형 `SetText`/`SetResourceUrl`/`SetMarkupEnabled`를 per-type 분기에, named-color 테이블+`.WithAlpha`를 `SBParseUiColor`에 (M1). `UiColor("token")`은 ADR-004 override 설치 후(M3). |
| Build-time install site (templates) | `server/preview_harness.cpp.template` (`{{FONT_SETUP}}` :259 in `OnInit`, `CreatePreviewUI()` :32/:263, `UiConfig::New().Apply()` :318), `server/preview_plugin.cpp.template` (`{{USER_GLOBALS}}` :62, `CreatePreview` :64) | **ADR-004**: theme/locale/fontScale/focus/placeholder를 **트리 빌드 직전** install. 새 placeholder `{{UI_CONFIG_SETUP}}`/`{{PRE_BUILD_INSTALL}}`/`{{POST_BUILD_FOCUS}}`. TS→build 값 plumbing은 `buildRunner.renderHarness` :141. |
| Build runner / plumbing (host TS) | `src/buildRunner.ts` (`renderHarness` :141, `compilePlugin` :192, `buildAndRun` :238, `instrumentAnimations` :176) | **ADR-004**: directive 값을 새 placeholder로 치환. **ADR-001**: 새 config 필드를 reload/renderJson 인자로 전달(`previewServer.ts` reload :148). |
| Cross-file resolution (host TS) | `src/sliceBuilder.ts` (`buildSlice` :396, `collectSameFileDefs` :183, `parseMemberFields` :302, `synthSampleInit` :358, `includes=''` :485), `src/previewOrchestrator.ts` (`resolveProjectIncludes` :289 BFS MAX_HOPS=4 :296) | **ADR-005**: include/define 주입(`-I/-D`) + `#line` 매핑. `src/errorParser.ts`(동적 sourcePaths) 연동. |
| Focus resolution (templates + TS) | `server/*.template` install site, `Actor::FindChildByName` (dali core actor.h:899), `__tag` (template :24/:17 sets `Actor::Property::NAME`) | **ADR-006**: `focus=<id>` → `FindChildByName` on user-tagged/variable name + Nth-focusable fallback. M2. |
| Server-path render verification (test) | NEW `test/e2e/serverGoldenRunner.ts` (alongside `goldenTestRunner.ts` :18 which uses harness), `src/previewServer.ts` (`renderJson` :219, RENDER_JSON IPC), `LocalBackend` (`src/backends/localBackend.ts` :43), `cppParser.parseChainExpression` :457 | **ADR-002**: 깨끗한 `.preview.dali.cpp` → T1 파서 → `SBBuildNode` 경로(local backend) → PNG → 골든 비교. `npm run test:e2e:server`. M0. |
| Metadata → webview channel | `src/previewManager.ts` (`updateImage` :63 → `postMessage({command:'updateImage', metadata})` :70-74), `media/preview.html` (`renderMetadataOverlay` :1629, reads `metadata.root` :1566) | **ADR-007**: provenance 배지를 `ExportSceneMetadata`가 top-level `provenance[]` 필드로 emit → webview가 `metadata.root` 옆에서 읽음. M5. |

검증 인프라(불변): `npm test`(unit Gate A), `npm run compile`(tsc), `npm run test:e2e`(harness golden, 기존), **`npm run test:e2e:server`(server golden, 신규 M0)**, `npm run test:golden:update`.

---

## Module boundaries

세 개의 독립 축. 한 축의 변경이 다른 축을 깨지 않는 것이 핵심 불변식이다.

```
                       ┌──────────────────────────────────────────────┐
   user .cpp           │  HOST (TypeScript, 이미지 변경 0)             │
   + directives  ───►  │  codeExtractor → cppParser/sliceBuilder       │
                       │      → previewOrchestrator (tier routing)     │
                       │      → buildRunner (template fill)            │
                       └───────┬───────────────────────┬──────────────┘
                               │ RENDER_JSON (scene)    │ RELOAD (.so) / buildAndRun (bin)
                               ▼                        ▼
          ┌──────────────────────────────┐  ┌──────────────────────────────────┐
          │ AXIS-S  Server scene-builder │  │ AXIS-C  Compiled paths            │
          │ docker/preview_server.cpp    │  │ plugin.cpp.template (dlopen)      │
          │ SBBuildNode/SBApplyCommonProps│  │ harness.cpp.template (one-shot)   │
          │ → clean single-fn T1 ONLY    │  │ → heuristic slice / .Play / focus │
          │ (ADR-003, M1)                │  │ (ADR-004 install, ADR-006 focus)  │
          └───────────────┬──────────────┘  └───────────────┬───────────────────┘
                          └────────────┬───────────────────┘
                                       ▼
                          metadata-JSON (root tree + provenance[])
                                       ▼
                          previewManager → webview (ADR-007)
```

- **AXIS-S (server scene-builder)**: T1 파서가 만든 scene JSON을 `SBBuildNode`가 view 트리로 짓는다. baked-in
  C++ → 검증은 local backend 재빌드(ADR-002). **오직 깨끗한 단일식 T1 path만 도달**(`previewOrchestrator.ts:692`
  `slice.rung==='single-fn' && !hasAnimation`). M1의 setter 추가가 여기. fact 3: 가치는 "데모/첫인상" path로 좁다.
- **AXIS-C (compiled paths)**: heuristic 슬라이스(`theme::ACCENT`/멤버/헬퍼)·`.Play()`·focus·config install은
  전부 dlopen(plugin.cpp.template) 또는 one-shot(harness.cpp.template)로 컴파일된다 — full DALi라 충실도 갭 없음.
  M2(진입점/focus)·M3(config install)·M4(cross-file)·M5(placeholder)가 여기. install은 **트리 빌드 직전**(ADR-004).
- **HOST (TS)**: 디렉티브 파싱·슬라이스·라우팅·템플릿 치환. 이미지 변경 0. M0 러너·M2 파싱·M4 슬라이스가 여기.

**경계 규칙**: 디렉티브는 AXIS를 강제하지 않는다 — orchestrator의 기존 routing(`runBuildStrategies` :657)이 정한다.
M3 config는 AXIS-C에서만 install(컴파일 path); AXIS-S T1은 config 무관(스타일 토큰을 모름) — 단 `UiColor("token")`
해석(F3.3)은 예외로 ADR-004 override가 설치된 warm 서버에서 동작.

---

## Data flow (directive → extract → slice → build/install → render → metadata → webview)

1. **directive**: `codeExtractor.extractPreviewCode` (:115)가 파일을 읽고 `@preview-config`/`@preview-state`/
   `@dali-preview`/`@preview-preset` 줄을 파싱해 `ExtractionResult`(`code`, `configs[]`, 신규 `state`, `params`)로 분리(ADR-001).
2. **extract**: 마커 모드면 함수 본문 추출 + 선두 변수선언→`return` 재작성(:202). `@dali-preview` zero-arg는
   팩토리 본문을 추출(ADR-001/M2).
3. **slice**: `previewOrchestrator.prepareSlice` (:494) → `resolveProjectIncludes`(BFS, :289) → `buildSlice`(:396).
   Rung 결정: 자기완결=single-fn, 미해결 심볼=heuristic(globals 슬롯에 정의 인라인 + weak stub). cross-file 견고화=ADR-005/M4.
4. **route**: `runBuildStrategies` (:657) — single-fn & no-anim & 서버 up → **AXIS-S(parser→RENDER_JSON)**;
   그 외 → **AXIS-C(dlopen → harness fallback)**.
5. **build/install**:
   - AXIS-S: `cppParser.parseChainExpression`(:457) → `previewServer.renderJson`(:219) → `SBBuildNode`(:552). setter=ADR-003.
   - AXIS-C: `buildRunner`가 템플릿 치환(`renderHarness` :141). **트리 빌드 직전** install site(`{{FONT_SETUP}}` :259 위치)에서
     `UiConfig::SetScalingFactor`/`SetColorOverride`/`SetLocalizedStringOverride`/`SetBrokenImageUrl` 호출, **빌드 직후**
     `FocusManager::SetCurrentFocusView` 호출(ADR-004/ADR-006).
6. **render**: Capture → PNG. metadata는 `ExportSceneMetadata`(harness :205 / server :206)가 트리 walk로 생성.
7. **metadata→webview**: `previewManager.updateImage`(:63)가 `{command:'updateImage', metadata}` postMessage(:70).
   webview `renderMetadataOverlay`(:1629)가 `metadata.root` 소비. provenance 배지=top-level `metadata.provenance[]`(ADR-007/M5).

---

## Key invariants

- **Inv-1 (server golden gates M1)**: 어떤 server scene-builder setter 추가도 `npm run test:e2e:server`의
  베이스라인 골든(F0.2: hex색/Flex/Stack/생성자 Label)을 깨면 안 된다 — *위반 시 M1 전체가 silent-regression*.
  기존 `npm run test:e2e`(harness)는 `SBBuildNode`를 안 거치므로 이 보증을 줄 수 없다(`goldenTestRunner.ts:18`이 harness 템플릿 사용 — fact 1).
- **Inv-2 (single-marker-per-file)**: 갤러리(M3 `@preview-preset:`)가 존재하기 전까지 한 파일에 진입점 마커
  (`@dali-preview` / 첫 `@preview` / 첫 `@dali-preview-begin`)는 **하나만** 유효하다. 첫 유효 마커가 이긴다
  (현 동작: `extractPreviewCode`가 첫 마커에서 return). *위반 시 어느 함수가 프리뷰되는지 모호 — research/usability가
  지적한 혼란*. M3 multi-config/preset만 한 파일 다중 변형을 허용한다.
- **Inv-3 (directive coexistence, no new keys)**: `@preview-state`는 **focus와 progress 두 키만** 판다.
  일반 `key=value`(playing/scroll/selected…)는 CUT — 추가 시 *앱 상태를 주석에 재기술하는 sprawl*(research §CUT 14).
  새 `@preview-*` prefix는 ADR-001에 등재된 4종(`-config`/`-state`/`-preset` + zero-arg `@dali-preview`)만.
- **Inv-4 (frozen-config respects Apply ordering)**: `UiConfig::SetScalingFactor`/`SetBrokenImageUrl`/
  `SetAlwaysShowFocus`/`SetTextLayoutDirectionMode`는 **`Apply()` 전에만** 호출 가능(frozen-after-Apply: ui-config.h:57,
  :174, :335, :549; `Apply()` 한 번만 :166). 따라서 컴파일 path의 install은 `UiConfig::New()....Apply()` 체인 안 또는
  그 직전이어야 한다 — *위반 시 debug assert/런타임 실패*(M3/M5). 대조적으로 `UiColorManager::SetColorOverride`(:254)/
  `UiScaleManager::SetScale`(:124)/`SetLocalizedStringOverride`(:346)/`FocusManager::SetCurrentFocusView`(:90)는
  runtime-callable(warm-server-safe) — 가능하면 이 경로 우선(ADR-004).
- **Inv-5 (no captures in override palettes)**: `ColorOverrideFunc`/`LocalizedStringOverrideFunc`는 **plain
  `bool(*)(...)` 함수 포인터**(ui-color-manager.h:52, ui-localization-manager.h:67) — std::function/캡처 불가.
  팔레트는 static free function + static 테이블이어야 한다 — *위반 시 컴파일 실패*(M3).
- **Inv-6 (byte-identical empty slots)**: 새 템플릿 placeholder의 빈 값(`''`) 치환은 단순
  `String.replace(/\{\{SLOT\}\}/g,'')`로 개행을 더하거나 빼지 않는다(기존 규칙, auto-extract ADR-001). *위반 시
  모든 기존 harness/server 골든이 한 줄 시프트로 깨짐*. 새 슬롯은 기존 빈 줄 자리에 놓는다.
- **Inv-7 (fixed entry symbols)**: dlopen 진입점은 `CreatePreview`(server resolves: preview_server.cpp:1011),
  harness 진입점은 `CreatePreviewUI`(harness :32/:263). M2 zero-arg 진입점은 **이 고정 심볼로 래핑**되어야 한다
  (새 심볼 추가 금지) — *위반 시 dlsym 실패*.

---

## ADR index

- ADR-001 — Directive grammar contract (가장 중요; M2/M3/M5 모두 부착) → adr/ADR-001-directive-grammar-contract.md
- ADR-002 — Server-path render verification harness (M0/F0.1; M1의 게이트) → adr/ADR-002-server-path-render-harness.md
- ADR-003 — Server scene-builder extension pattern (M1) → adr/ADR-003-server-scene-builder-extension.md
- ADR-004 — Build-time singleton install site (M2/M3/M5) → adr/ADR-004-build-time-install-site.md
- ADR-005 — Cross-file resolution + error-line mapping (M4) → adr/ADR-005-cross-file-and-error-mapping.md
- ADR-006 — Focus target resolution (M2) → adr/ADR-006-focus-target-resolution.md
- ADR-007 — Provenance badge channel (M5) → adr/ADR-007-provenance-badge-channel.md

---

## Self-Review

- **Placeholder scan**: TODO/TBD/??? 없음. 7개 ADR 모두 Status=Accepted, 구체 결정 부여. 미해결은 OPEN_QUESTIONS로 승격.
  스파이크(M0 F0.4/F0.5)에 의존하는 디테일(fontScale 정확한 API, focus-ring 활성화 여부)은 ADR-004에서 "이미
  헤더로 frozen/runtime 구분 확정 → 스파이크는 *재확인*용"으로 명시(가정 아님, 헤더 인용).
- **Internal consistency**: ADR-001(문법)↔ADR-004(install)↔ADR-006(focus)이 `@preview-state focus=`에서 일치 —
  ADR-001이 파싱, ADR-006이 id→handle, ADR-004가 호출 site. ADR-002(server 러너)↔ADR-003(server setter)이
  M0→M1 게이트로 일치(Inv-1). ADR-005(cross-file)는 auto-extract ADR-006(include-inlining)을 **명시적으로
  계승하되 확장**(헤더 마운트 옵션 추가) — 충돌 아님, 상위호환. Inv-4/Inv-5가 ADR-004와 일치(frozen vs runtime, no-capture).
- **Scope check**: plan.md의 6 마일스톤·32 WU가 필요로 하는 결합 지점만 결정. CUT 3종(9b JSON-fixture/메서드형
  SetOrientation/일반 state 문법)은 어떤 ADR에도 등장 안 함(ADR-001이 Inv-3로 명시 배제). DEFER 2종(locale=RTL+배지/
  state=focus+progress)은 정직 버전만(ADR-001 + ADR-004 F3.4). 새 컴포넌트 0 — 전부 기존 파일 확장.
- **Ambiguity**: (a) M1 "좁은 가치"는 AXIS-S가 single-fn T1 path만 받는다는 routing 인용(:692)으로 정직화 —
  ADR-002/ADR-003에 박음. (b) M3↔M4 순서는 plan.md가 스왑 여지를 명시 → 두 ADR 모두 "M2에만 의존, 상호 비의존"
  으로 작성해 순서 무관하게 성립. (c) ADR-005의 cross-file 전략(BFS 유지 vs compile_commands vs clangd)은
  하나를 선택(BFS 유지 + `-I/-D` 주입)하되 대안을 Alternatives에 기록.

OPEN_QUESTIONS:
1. `UiConfig::SetScalingFactor`가 fontScale에 충분한지 vs `UiScaleManager::SetScale`(runtime)이 텍스트까지 스케일하는지 —
   ADR-004는 "warm 서버는 `UiScaleManager::SetScale`, 그래도 텍스트가 안 커지면 harness path의 `UiConfig::SetScalingFactor`
   fallback"으로 양쪽 다 배선하라 결정. M0 F0.4 스파이크가 어느 쪽이 실제로 텍스트를 키우는지 *확인*(택일 아님 — 둘 다 코드에 둠).
2. `SetAlwaysShowFocus`(frozen)가 켜져 있어야 focus 링이 보이는지(M0 F0.5) — ADR-006은 harness/plugin install site에서
   `UiConfig::SetAlwaysShowFocus(true)`를 무조건 켜도록 결정(focus 디렉티브 유무와 무관하게 안전). 스파이크는 링 가시성 *확인*용.
