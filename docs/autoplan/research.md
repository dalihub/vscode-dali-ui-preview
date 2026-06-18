# Research — dali-ui preview gap-closing (vetted feature list)

> P-1 적응: 도메인 리서치는 이미 두 문서(Docs/tv_app_preview_strategy_0617.md, Docs/preview_support_by_type_0617.md)로 완료됨. 대신 사용자 요청대로 **독립 두 렌즈(엔지니어링 실현가능성 / Compose 대비 사용성)로 14개 후보 기능을 triage** 하고 오케스트레이터가 종합. 원본 triage: 본 세션 두 서브에이전트(feasibility=opus, usability=opus).

## 한 줄 요약
14개 후보 중 **GO 9개 + DEFER(정직 축소) 3개 + CUT 2개**. 게이트 통과 원칙: *"앱(데이터·번역·런타임 상태)을 타입 없는 주석에 다시 기술하게 만드는 기능은 Compose보다 나쁘므로 만들지 않는다."*

## 캠페인을 좌우하는 3가지 사실 (반드시 내재화)
1. **렌더 엔진 2개, e2e는 하나만 검증.** `npm run test:e2e`(goldenTestRunner)는 **harness 템플릿(preview_harness.cpp.template, 실제 DALi 전체 컴파일)**로 렌더 — `docker/preview_server.cpp`의 scene-builder(`SBBuildNode`)는 **전혀 안 거침**. → **서버 충실도(1~5)는 기존 golden으로 증명 불가.** 서버 path 전용 렌더 검증을 새로 만들어야 함(= M0).
2. **서버 .cpp 변경은 docker 이미지 baked-in**(Dockerfile.runtime:156-163). 검증은 (a) **local backend**(native prefix `/home/woochan/tizen/generativeUI/dali-env/opt`에서 preview_server 즉시 재빌드) 또는 (b) 이미지 재빌드+push. → 서버 마일스톤은 **local backend Tier1**로 검증.
3. **orchestrator가 이미 실전 코드를 서버 버그 경로에서 빼냄.** `previewOrchestrator.ts:692`가 heuristic 슬라이스(theme::ACCENT/멤버/헬퍼)·`.Play()`를 **dlopen(T2 전체 컴파일)**로 보냄 — T2는 서버 충실도 갭이 없음. → 서버 충실도(1~5) 수정은 **깨끗한 단일식 T1 path(.preview.dali.cpp 데모/첫인상)에만** 영향. 가치 실재(첫인상·신뢰)하나 문서가 시사하는 것보다 **좁음**.

## Vetted 결정 매트릭스 (feasibility ⊕ usability)

| # | 후보 | 실현가능성(노력) | 사용성 vs Compose | 결정 | 배치 |
|---|---|---|---|---|---|
| 1 | 서버 `SetCornerRadius` | FEASIBLE (S) | BETTER (dev 0노력) | **GO** | M1 |
| 2 | 서버 메서드형 `SetText`/`SetResourceUrl` | FEASIBLE (S) | BETTER | **GO** | M1 |
| — | ~~메서드형 `SetOrientation`~~ | View에 API 없음(StackLayout 생성자뿐) | — | **CUT** (해당 없음) | — |
| 3a | 서버 `Color::RED` 테이블 + `.WithAlpha` | FEASIBLE (S) | BETTER | **GO** | M1 |
| 3b | 서버 `UiColor("token")` 해석 | #10 의존 | (토큰앱만) | **GO** | M3 |
| 4 | 서버 `SetMarkupEnabled` | FEASIBLE (S) | BETTER | **GO** | M1 |
| 5a | 서버 `SetOpacity`/`SetVisibility`/`Borderline` | FEASIBLE (S) | BETTER | **GO** | M1 |
| 5b | 서버 Grid/Scroll/InputField 매핑·gradient visual | M~L (저빈도) | BETTER | **DEFER** (샘플이 요구할 때만) | — |
| 6 | Focus 시뮬 `// @preview-state focus=<id>` | FEASIBLE (M) | ON-PAR~BETTER (1줄) | **GO** | M2 |
| 7 | cross-file/멤버 문맥수집 견고화 (B·C·K) | FEASIBLE-HARD (L) | **MUCH-BETTER (유일한 구조적 승리)** | **GO** | M4 |
| 8 | `// @dali-preview` 인자없는 진입점 | FEASIBLE (S~M) | ON-PAR (1줄, 곱셈기) | **GO** | M2 |
| 9a | 멤버 샘플데이터 합성 튜닝(레일친화) | shipped/S | auto BETTER | **GO** | M2 |
| 9b | `// @dali-preview-fixture vm={JSON}` | HARD (C++ JSON deser) | **WORSE (타입없는 병행 스키마)** | **CUT** (대신 C++ `SampleVM()`) | — |
| 10 | `theme=dark` 실제 reskin (`UiColorManager::SetColorOverride`) | FEASIBLE (M) | ON-PAR (1줄) | **GO** (정직: 진짜 reskin일 때만) | M3 |
| 11 | `fontScale` 실배선 (`SetScalingFactor`/`UiScaleManager`) | FEASIBLE (S~M) | ON-PAR (1줄) | **GO** | M3 |
| 12 | `locale` | override FEASIBLE / 카탈로그 HARD | WORSE (카탈로그 세팅세금) | **DEFER → RTL flip + "untranslated" 배지** (번역 위조 금지) | M3 |
| 13 | async 포스터 placeholder (`SetBrokenImageUrl`) | FEASIBLE (S) | ON-PAR (dev 0) | **GO** | M5 |
| 14 | 상태 디렉티브 (playing/progress/scroll…) | HARD | **WORSE (상태를 주석에 재기술 = sprawl)** | **DEFER → focus(=#6) + progress 1개만; 일반 문법 금지** | M2/M5 |
| +A | 갤러리/multipreview preset (변형 동시 표시) | MEDIUM | HIGH (config 절반은 이게 있어야 가치) | **GO** | M3 |
| +B | 컴파일 에러 원본 라인 매핑(`#line`) | — | HIGH (#7을 *usable*하게) | **GO** | M4 |
| +C | provenance 배지(sample-data / image-on-device / bg-only) | LOW | 신뢰 backbone(silent-fix 보증) | **GO** | M5 |

## CUT/DEFER 사유 (게이트 적용 — 사용자 "사용성 나쁘면 만들지 말 것")
- **CUT 9b (JSON-in-comment 픽스처)**: 타입 없는 병행 데이터 언어를 손으로 유지 → 컴파일러 체크·IDE 완성·리팩터 안전 전무, 구조체와 desync. Compose는 *실제 타입*을 재사용하므로 우월. 대안 = C++ `SampleVM()`(타입 체크됨) + 이미 동작하는 auto-synth.
- **CUT 메서드형 SetOrientation**: `View::SetOrientation` API 부재(StackLayout 생성자 인자뿐). 해당 없음.
- **DEFER 12 (locale)**: 번역을 위조하지 않음. `locale=ar` → **RTL 레이아웃 미러링(카탈로그 불필요, i18n 레이아웃 버그 #1 잡음) + 미번역 `IDS_` 키에 배지**. 카탈로그 있으면 해석, 없어도 정직하게 유용.
- **DEFER 14 (상태 문법)**: focus(#6)+progress(0.42 스크러버 재사용) 2개로 cap. 일반 `playing/scroll/selected/...` key=value 문법 금지(앱 상태를 주석에 재기술). 나머지는 typed `SampleVM()` 기본값으로.

## 해소된 설계 결정 (오케스트레이터, OQ 응답)
- **서버 충실도 검증 계약**: M0에서 **서버 path 렌더 e2e**(깨끗한 `.preview.dali.cpp`를 T1 파서→서버 RENDER_JSON으로 렌더해 PNG 캡처, local backend) 구축. 이게 M1의 게이트. → autodev "M0=infra" 와 일치.
- **UiConfig::Apply() 멱등성 OQ**: config 기능은 **런타임 호출 가능한 override 우선**(`SetColorOverride`/`SetLocalizedStringOverride`/`UiScaleManager::SetScale` — warm 서버에서도 동작). `SetScalingFactor`가 one-shot이면 harness 경로로 fallback. M0 spike에서 확인.
- **Focus 하이라이트 액터**: preview 바이너리에 `UiConfig::SetAlwaysShowFocus` 켜져 있는지 M0/M2에서 확인(안 켜져 있으면 링 안 보임).
- **focus id→View 해석**: 사용자가 이미 쓴 핸들/변수명에 bind(`FindChildByName` 또는 인라인 태그) + "Nth focusable" fallback. 존재하지 않는 id를 만들게 강요 금지(usability).
- **#7 검증**: 멀티파일 e2e fixture+runner를 M4에서 신설(현재 cross-file은 수동 docker 컴파일로만 증명됨 — `samples/flow-wallet/`).
- **theme 토큰 vs hex 현실**: 공식 샘플 다수가 hex `UiColor(0x...)`(테마 무반응). theme=dark는 토큰앱만 도움 → 구현하되 fontScale/locale보다 우선순위 낮춤, 과투자 금지.
- **갤러리 범위**: 현재 multi-config가 이미 config당 1프레임 렌더 → "변형 동시 표시 + preset 디렉티브" 수준으로 M3에 포함(거대 신규 webview 금지).

## Candidate stack / API (architect 입력)
- TS 측: cppParser.ts(파서), codeExtractor.ts(디렉티브 파싱: 신규 `// @dali-preview`, `// @preview-state`, `// @preview-config` 확장), sliceBuilder.ts(샘플데이터·cross-file), previewOrchestrator.ts(tier 라우팅·resolveProjectIncludes), previewConfig.ts.
- C++ 측: docker/preview_server.cpp(`SBApplyCommonProps`/`SBBuildNodeRaw`/`SBParseUiColor` — 서버 충실도), server/preview_plugin.cpp.template·preview_harness.cpp.template(빌드-전 install: theme/locale/fontScale, focus, placeholder).
- dali-ui API(검증됨): `View::SetCornerRadius`(view.h:867), `Label::SetText`(label.h:200)/`SetMarkupEnabled`(:414), `ImageView::SetResourceUrl`(image-view.h:176), `UiColorManager::SetColorOverride`(ui-color-manager.h:254, **순수 fn-ptr, 캡처 불가**), `UiLocalizationManager::SetLocalizedStringOverride`(:346), `UiConfig::SetScalingFactor`(:177)/`SetBrokenImageUrl`(:335)/`SetAlwaysShowFocus`(:372), `UiScaleManager::SetScale`(:124), `FocusManager::SetCurrentFocusView`(focus-manager.h:90).
- 검증 인프라: `npm test`(unit Gate A), `npm run compile`(tsc), `npm run test:e2e`(golden harness Tier1), `npm run test:golden:update`, local backend(서버 path).

## 제안 마일스톤 형태 (planner가 확정)
- **M0 인프라**: 서버 path 렌더 검증 e2e(local backend) + OQ spike(UiConfig 멱등성·focus 하이라이트) + 멀티파일 e2e 스캐폴드 씨앗.
- **M1 서버 렌더 충실도**: 1, 2, 3a, 4, 5a (silent-wrong 제거, 첫인상/데모 path).
- **M2 진입점 + 포커스**: 8, 6, 9a (harness-verifiable 고가치).
- **M3 config 빌드-전 install**: 11, 10, 3b, 12(정직: RTL+배지), +A 갤러리/preset.
- **M4 cross-file/멤버 견고화**: 7, +B 에러 라인 매핑 (멀티파일 e2e 신설).
- **M5 정직 폴리시**: 13, +C 배지, 9a 추가 튜닝, 14의 progress.

---

## Self-Review
- Placeholder scan: none (모든 후보에 결정 부여). 미해결은 OPEN_QUESTIONS로 승격.
- Internal consistency: feasibility(노력/검증)와 usability(go/no-go)가 14항목 모두 일치 방향. 충돌 없음 — CUT/DEFER는 두 렌즈가 같은 결론(9b·12·14).
- Scope check: 마일스톤 6개(M0~M5)는 autodev 가이드(4~8) 내. 각 M이 shippable demonstration 가짐.
- Ambiguity: 서버 충실도 "가치 좁음"(사실3) vs usability "최상위 신뢰"가 긴장 → 결정: 여전히 P0이되 M0 검증 인프라 없이는 진행 불가로 명시. OPEN_QUESTIONS 참조.

OPEN_QUESTIONS:
1. UiConfig::Apply() warm-server 멱등성 — M0 spike로 확정(override 경로로 대부분 우회 가능).
2. 서버 충실도(1~5)의 "좁은 가치"를 받아들이고 M1을 진행할지, 아니면 M1을 축소하고 cross-file(M4)을 앞당길지 — 권고: M0→M1 유지(첫인상/신뢰 + M0 인프라가 어차피 필요). 사용자 우선순위가 "실전 코드"면 M4를 M2 다음으로 당길 수 있음.
