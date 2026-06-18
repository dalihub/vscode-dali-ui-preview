# Project goal

## 한 줄 요약
dali-ui VS Code 라이브 프리뷰가 "Compose 대비 부족하지만 구현 가능하고 사용성 좋은" C++ UI 코드 형태들을 실제로(가짜/스텁 아님) 프리뷰 가능하게 만든다. 리서치(13형태 A~M)의 ⚠️/❌를 ✅로 바꿀 때까지.

## 근거 문서 (source of truth)
- `Docs/tv_app_preview_strategy_0617.md` — 전략·dali-ui SDK 분석·Compose 대조, 의존성 사다리 L0~L3, 13형태.
- `Docs/preview_support_by_type_0617.md` — 13형태별 코드예제·현재 동작·막는 것·지원 방법·실효성(★).
- `docs/autoplan-auto-extract/` — 직전 프로젝트(SliceBuilder/auto-extract, M0~M5 완료) 기록. 이미 구현된 토대.

## 추정 영역
- 도메인: VS Code 확장(TypeScript) + C++ 네이티브 렌더 서버(DALi/dali-ui)
- 핵심 제약: 실제 렌더 검증 필요(가짜 금지) · 서버(C++) 변경은 docker 이미지 baked-in → native/local backend로 검증 · 사용성이 Compose 대비 너무 나쁘면 구현 금지

## 방법 (형태마다 반복)
① 프리뷰가 안 되는/틀리는 상황을 재현하는 샘플(test/samples/ 또는 samples/) → ② 실패하는 e2e 테스트 먼저 → ③ 구현(cppParser/codeExtractor/sliceBuilder/previewOrchestrator/previewConfig/server) → ④ 실제 렌더로 검증(test:e2e golden / 네이티브 DALi prefix) → ⑤ 통과 시 커밋 + 매트릭스 ✅ 갱신.

## 게이트 (전문 서브에이전트에 위임해 판단)
각 후보 기능: "꼭 필요한가 / 구현 가능한가 / 사용자가 쉽게 쓸 수 있는가(사용성 ≥ Compose 수준인가)". 사용성이 Compose 대비 너무 나쁘면 **구현하지 말고 사유 기록**. 불필요한 기능 금지.

## 우선순위 (리서치 실효성 순)
- P0 ★★★ 서버 렌더 충실도: SetCornerRadius · 메서드형 SetText/SetResourceUrl/SetOrientation · named UiColor 검정버그 · SetMarkupEnabled (이미 T1로 들어온 코드를 정확히)
- P0 ★★★ 포커스 시뮬레이션: `// @preview-state focus=` 로 선택 항목 포커스 1장 (TV 핵심, 현재 전무)
- P0 ★★★ cross-file/멤버 문맥수집 견고화 (형태 B·C·K)
- P1 ★★☆ theme/config 빌드-전 싱글톤 install: fontScale·locale 실배선(현재 stub) · G(ii) 토큰테마 · `// @dali-preview` 진입점 · 픽스처 컨벤션
- ★☆☆ L(비동기 포스터)·M(상태): 정직한 placeholder/상태 디렉티브 수준만, 과투자 금지

## 사용자가 명시한 out-of-scope
- TV 사업부가 만들 특화 위젯 *자체*를 기본 제공하는 것(앱이 그 위젯을 쓰는 코드는 in-scope)
- 사용성이 Compose 대비 현저히 나쁜 기능(억지 mock 강요, 복잡한 수동 설정 요구 등)
