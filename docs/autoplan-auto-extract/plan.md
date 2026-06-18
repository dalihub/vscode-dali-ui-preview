# Plan — 실전 dali-ui 앱의 zero-annotation 자동추출 preview

> `Docs/auto_extract_strategy_0610.md §8 착수순서`(리스크 역순)를 마일스톤으로 펼침. Rung1(clangd)은 환경 의존이라 best-effort, **검증 핵심 타깃은 Rung2(같은 파일 휴리스틱)**.

## Milestone overview
| M | Title | Demonstration (user-visible proof) | Depends on |
|---|---|---|---|
| M0 | 실전 앱 샘플 + 비자기완결 테스트 픽스처 + red baseline | `samples/flow-wallet/` 미니 상용앱 존재 + 현재 추출기로는 컴파일 실패함이 테스트로 고정(red) | — |
| M1 | 3슬롯 템플릿 (회귀 0) | 빈 슬롯=기존 출력 byte-identical + 579 테스트 통과 + 신규 슬롯 단위테스트 green | M0 |
| M2 | SliceBuilder Rung2 휴리스틱 | (A) 앱 한 화면이 SliceBuilder로 자기완결 .cpp가 되고, M0의 red 픽스처가 green | M0, M1 |
| M3 | 실빌드 검증 + Rung 매트릭스 | (A) 앱을 docker로 실제 .so 빌드+`preview_server` 렌더 → PNG 생성(`>>>OK`) + Rung 도달 매트릭스 리포트 | M2 |

dependency cycles: no (선형 M0→M1→M2→M3)

## Milestone details

### M0 — 실전 앱 샘플 + 비자기완결 테스트 픽스처 + red baseline
**Demonstration**: `samples/flow-wallet/` 가 실제 상용앱처럼 여러 파일·패턴으로 구성되고, 그 화면 코드를 현재 추출기에 넣으면 "undeclared identifier"로 T2 컴파일 실패함이 단위테스트로 **고정(red baseline)**.
**Out of scope**: dali-toolkit/Tizen capi 의존(런타임 이미지 경계 밖 — sysroot 함정 회피). 앱은 **dali-ui 경계 안**으로만.
**Features**:
- F0.1: `samples/flow-wallet/` 미니 상용앱 — 의도적 패턴 적용: 테마 상수 헤더(P4, `theme/tokens.h`), 헬퍼/팩토리 함수(P1/P14, `widgets/cards.h/.cpp` 의 `MakeStatCard` 등), 클래스 멤버 함수 UI 조립(P5, `screens/WalletScreen` 의 멤버 `Build()`), MVVM 모델 주입(P6, `WalletViewModel`), for 루프 데이터 바인딩(P2), 프로젝트 헤더 분리 #include(P11). 한 화면이 이 6패턴을 자연스럽게 포함.
- F0.2: 비자기완결 테스트 픽스처 — `test/fixtures/slice/` 에 slice 경로 검증용 최소 케이스 3종: (a) 헬퍼 호출만, (b) 멤버 필드 참조만, (c) 테마 상수만. 각각 "정의는 같은 파일/헤더에 있고 진입함수만 떼면 미정의".
- F0.3: red baseline 테스트 — F0.2 케이스를 현재 `extractPreviewCode`+`cppParser`/`compilePlugin` 경로에 넣으면 (파서 null + plugin 컴파일 시 미정의)임을 단위테스트로 명시. M2 후 green 전환을 측정할 기준선.

### M1 — 3슬롯 템플릿 (회귀 0)
**Demonstration**: 자기완결 코드(기존 24샘플)는 두 신규 슬롯이 빈 문자열 → 생성 .cpp가 기존과 **byte-identical**(테스트로 검증), 기존 579 테스트 무회귀.
**Out of scope**: SliceBuilder 로직(M2). 여기선 템플릿 슬롯 + 치환 배관 + 에러매핑만.
**Features**:
- F1.1: `server/preview_plugin.cpp.template` + `preview_harness.cpp.template` 을 `{{USER_INCLUDES}}`/`{{USER_GLOBALS}}`/`{{USER_BODY}}` 3슬롯으로. 빈 슬롯 시 개행/공백이 기존과 정확히 일치하도록 레이아웃 설계.
- F1.2: `src/buildRunner.ts` 의 `{{USER_CODE}}` 치환부(6곳) + `dockerRuntime` 을 3슬롯 시그니처로. 단일 코드 문자열 입력 시 globals/includes="" 로 byte-identical 보존(하위호환).
- F1.3: `#line {{BODY_START_LINE}} "{{USER_SOURCE_PATH}}"` 본문 슬롯 직전 삽입 + `src/errorParser.ts` 파일명 게이트를 정적 `includes('preview_plugin')` → **동적 출처집합**(SliceBuilder가 주는 원본 경로들)으로 재설계. globals 영역 에러는 헬퍼 원본, 본문은 entry 원본을 가리키게.

### M2 — SliceBuilder Rung2 휴리스틱
**Demonstration**: (A) 앱의 `WalletScreen::Build()` 와 F0.2 픽스처를 SliceBuilder에 넣으면 자기완결 .cpp(globals=수집정의+stub) 가 생성되고, M0 red 픽스처가 green(파싱/컴파일 통과)으로 전환됨.
**Out of scope**: Rung1 clangd 연동(best-effort, 시간 남으면 M3 이후). 정밀 타입 합성(여기선 weak void-stub로 컴파일 통과 우선).
**Features**:
- F2.1: `src/sliceBuilder.ts` — 같은 파일/동반 헤더에서 진입함수가 참조하는 헬퍼함수·타입·상수 정의를 정규식+cppParser 토크나이저로 수집, 위상정렬(정의 before 사용)로 globals emit, `#include` hoist.
- F2.2: weak void-stub 합성 — 수집 후에도 미정의로 남는 식별자(멤버 필드 `this->mX`, 외부 모델, 외부 자유함수)에 `__attribute__((weak))` **본문 있는** stub 생성(RTLD_NOW 충족). vector→N=3 더미, string→"Sample" 등 최소 type 휴리스틱.
- F2.3: `src/previewOrchestrator.ts` 통합 — `extractPreviewCode` 후 SliceBuilder 진입. 미해결 심볼 있으면 Rung2 slice, 자기완결이면 Rung3(현행). slice 산출을 T2 `compilePlugin`(3슬롯)에 투입.

### M3 — 실빌드 검증 + Rung 매트릭스
**Demonstration**: (A) 앱을 docker 런타임으로 실제 빌드(`g++ → .so`) + `preview_server` dlopen 렌더 → `>>>OK:<png>` + PNG 파일 생성. 각 패턴(P1/P2/P4/P5/P6/P11)이 어느 Rung까지 되는지 실측 매트릭스.
**Out of scope**: 렌더 정확도(서버 scene-builder 갭 — code_preview_strategy Phase 0 별개). 여기선 "컴파일+dlopen+PNG생성"까지가 preview 성공 기준.
**Features**:
- F3.1: (A) 앱 화면을 SliceBuilder→3슬롯→docker compilePlugin→server render 전체 파이프라인으로 실제 빌드·렌더, PNG 생성 확인.
- F3.2: Rung 도달 매트릭스 — 6패턴 × {파싱/슬라이스/컴파일/렌더} 실측 표. 어디서 막히는지 정직 기록.
- F3.3: 결과 리포트 `Docs/auto_extract_validation_0610.md` — 무엇이 되고 안 되는지, 다음 단계(Rung1 clangd, 서버 갭) 권고.

---

## Self-Review
- Placeholder scan: none — 각 피처에 파일경로+검증대상 명시.
- Internal consistency: 일관 — M0 red→M2 green 전환이 측정가능한 demonstration. 3슬롯(M1)→SliceBuilder(M2)→실빌드(M3) 의존 선형. 전략문서 §8 순서와 동일.
- Scope check: within range — 4 마일스톤 × 3 피처. M0가 infra(샘플+픽스처+baseline)로 autodev 규칙 충족. Rung1 clangd는 의도적으로 best-effort 후순위(환경 의존).
- Ambiguity: 해소 — "preview 성공" = 컴파일+dlopen+PNG생성(렌더 정확도 아님, M3 out-of-scope 명시). 앱을 dali-ui 경계로 한정해 Tizen sysroot 함정 제거.
