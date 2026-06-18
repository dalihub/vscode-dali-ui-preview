# Project completion — dali-ui preview gap-closing

> 작성: 2026-06-18 (autodev Mode 1 자율 사이클) · 대상: DALi Preview 메인테이너
> 한 줄 요약: **리서치(13형태 A~M)에서 "구현 가능 + 사용성 좋음"으로 선별된 갭을 6개 마일스톤(M0~M5)으로 전부 구현·검증 완료.** 핵심 성과 — 실전 멀티파일 앱(flow-wallet)이 **재작성 없이** 프리뷰되고, TV 포커스 링·theme/config가 실제로 동작하며, 서버 silent-wrong이 제거됨. 모든 기능을 **실제 렌더 PNG로 육안 검증**(+ mutation test)했다.

## 마일스톤 요약

| M | 제목 | 검증 | Verdict | 커밋 |
|---|---|---|---|---|
| M0 | 서버-path 렌더 검증 인프라 | 새 `test:e2e:server`가 `SBBuildNode`를 local backend로 실렌더 검증(기존 harness 골든과 별개 엔진) | PASS | 4 |
| M1 | 서버 렌더 충실도 | CornerRadius·메서드형 SetText/SetResourceUrl·named색(+WithAlpha)·markup·opacity/visibility/borderline — 6피처 실렌더 육안 + **mutation**(SetCornerRadius 제거→골든 FAIL) | PASS (ext-review) | 3 |
| M2 | 진입점 + 포커스 | `// @dali-preview` 팩토리 렌더 + `focus=card2`→**가운데 카드 포커스 링**(이전 전무) + 라이브 배선 · **mutation**(card2→card1 골든 flip 1.04%) | PASS (ext-review) | 4 |
| M3 | config 빌드-전 install | theme=dark 토큰 reskin(harness+서버) · fontScale 실스케일 · locale=ar RTL 미러 · preset 확장 · 갤러리 — 전부 실렌더 | PASS | 4 |
| M4 | cross-file/멤버 + 에러 매핑 | **flow-wallet `WalletScreen::Build()` 재작성 0으로 렌더**(멤버·cross-.cpp 팩토리·멀티파일) + `#line` 에러가 원본 `cards.cpp:38`로 · **mutation** | PASS | 3 |
| M5 | 정직 폴리시 | provenance 배지(webview) · SetBrokenImageUrl 회색 placeholder(실렌더) · progress 디렉티브 · async 샘플 @render-only 정직화 | PASS | 2 |

**총 25 커밋**(planning 7 + M0~M5 20). 작업 브랜치 `autodev/auto-extract-preview`, 로컬 커밋만(push 안 함).

## 리서치 매트릭스(13형태) 커버리지 변화

| 형태 | 이전 | 이후 | 무엇으로 |
|---|---|---|---|
| A 자유함수 · G(i) 토큰상수 · I(정적) 포커스그래프 | ✅ | ✅ | (유지) |
| **I 포커스 상태** | ⚠️ 링 없음 | ✅ **포커스 링** | M2 focus 시뮬 |
| **B 헬퍼/팩토리(cross-file)** | ⚠️ | ✅ | M4 (probe로 이미 동작 확인 + e2e lock) |
| **C 멤버 스크린객체** | ⚠️ | ✅ | M4 flow-wallet 렌더 |
| **D MVVM · E 데이터레일** | ⚠️ | ✅ | M4 멤버-VM 자동합성(3 샘플행) |
| **K 멀티파일** | ⚠️ | ✅ | M4 멀티파일 e2e |
| **G(ii) 매니저 테마** | ⚠️ 검정 | ✅ reskin | M3 SetColorOverride(harness+서버) |
| **fontScale/locale** | ❌ stub | ✅ 실배선 | M3 (fontScale 실스케일, locale RTL) |
| 서버 충실도(CornerRadius 등) | ⚠️ silent-wrong | ✅ | M1 |
| **L 비동기 포스터** | ⚠️ 빈박스 | ✅(정직) placeholder + 배지 | M5 |
| **M 상태** | ❌ | ◐ focus + progress 1프레임 | M2/M5 |
| H 로컬라이즈 | ❌ 키노출 | ◐ RTL + 미번역 provenance | M3/M5 (번역위조는 정직하게 안 함) |

## 테스트 결과

- **Gate A (정적/단위)**: `npm test` = **654 passing, 0 failing**(시작 559 → +95). `npm run compile` exit 0.
- **Gate B (실행 골든)**:
  - `npm run test:e2e:server` (M0 신설) — 7 픽셀 골든 + 1 render-only, 서버 `SBBuildNode` 경로 실렌더.
  - `npm run test:e2e` (harness) — 23 픽셀 골든 + render-only(async 이미지).
  - `npm run test:e2e:multifile` (M4 신설) — flow-wallet 멤버함수 1 골든.
- **검증 강도**: 모든 가시 기능을 orchestrator가 **PNG로 육안 확인**. M1/M2/M4는 **mutation test**(일부러 깨서 골든/에러가 바뀌는지)로 test-theatre 아님을 입증. M1/M2는 독립 external-review subagent도 통과.

## ✋ 남은 시각 확인 (자동화 불가, 사람 1회 확인 권장)

- **라이브 확장 end-to-end**: VS Code에서 실제로 (a) `focus=` 디렉티브→웹뷰 포커스 링, (b) provenance 배지 칩, (c) progress 디렉티브, (d) 갤러리 변형 그리드. 렌더 메커니즘은 골든으로, plumbing은 unit으로 증명됨(고신뢰) — 실제 클릭-스루만 ✋.

## 보류/후속 (deferred)

- **M4.3 compile_commands.json `-I/-D` 주입**: stretch로 강등(flow-wallet은 인라인으로 이미 컴파일 → 실효는 매크로-헤비 헤더 미래케이스). API 안정화 값은 있음.
- **M5.2 `// @preview-asset:` URL→번들 치환**: optional defer(placeholder가 정직 케이스 커버). enum/배지 자리는 마련됨.
- **multi-config × focus 페르-변형 적용**: 현재 배지로 정직 표시(M5.5). 완전 적용은 후속.
- **서버(docker) 이미지 재빌드**: M1/M3의 `docker/preview_server.cpp` 변경은 local backend로 검증됨. **배포 시 `dali-preview-runtime` 이미지 재빌드 필요**(baked-in).
- **포커스 NAME 주입 vs click-to-code `__L` 태그**: 단일 노드 한정 트레이드오프(M2 OQ), `test:click-to-code`로 게이트됨.

## 권고 다음 단계 (human decision)

1. **이미지 재빌드 + 배포**: 서버 변경(M1 충실도, M3 토큰)을 런타임 이미지에 반영해 docker 사용자에게도 제공.
2. **라이브 ✋ 확인**: 위 4개 디렉티브를 실제 VS Code에서 1회 시각 확인.
3. **컨벤션 문서화**: `// @dali-preview` 인자없는 팩토리 + `// @preview-state` + `// @preview-config`/`-preset`를 dali-ui 공식 가이드/샘플로 배포(리서치 결론: 부담은 도구가 아니라 *코드 형태/컨벤션*).
4. **deferred 항목**(M4.3/M5.2)은 실수요 발생 시.
