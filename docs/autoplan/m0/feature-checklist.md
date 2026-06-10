# M0 — feature checklist (FROZEN)

> plan.md M0 섹션 동결. 진행 중 추가/수정 금지. 새 발견은 oos-queue.md로.

- **F0.1** `samples/flow-wallet/` 실전 dali-ui 미니 상용앱 — 6패턴 의도 적용:
  - P4 테마상수: `theme/tokens.h` (constexpr 색·치수)
  - P1/P14 헬퍼/팩토리: `widgets/cards.h` 선언 + `widgets/cards.cpp` 정의 (`MakeStatCard`/`MakeSectionHeader`/`MakeTransactionRow`)
  - P5 클래스 멤버: `screens/wallet_screen.h/.cpp` (`WalletScreen::Build()`)
  - P6 MVVM: `model/wallet_vm.h` (`WalletViewModel`+`Transaction`), `Build()`가 `mVm` 참조
  - P2 for루프: `Build()`가 `mVm.recent` 순회해 행 생성
  - P11 헤더분리 #include: `Build()`가 `theme/tokens.h`·`widgets/cards.h` include
  - 진입점 `app_main.cpp` (Application — preview 대상 아님, 실제 앱임을 증명)
  - **dali-ui 경계 안만** (dali-toolkit/Tizen capi 금지 — Inv-3)
  - 헬퍼가 **다른 파일**(cards.cpp)에 있음 → 실전적이며 Rung1(clangd cross-file) 필요 케이스
- **F0.2** Rung2 검증 픽스처 `test/fixtures/slice/` — 헬퍼/멤버/상수가 **같은 파일**(Rung2로 수집 가능):
  - `helper_same_file.cpp` (헬퍼 정의가 같은 파일)
  - `member_field.cpp` (멤버 필드 → auto-stub 대상)
  - `theme_const.cpp` (네임스페이스 상수 같은 파일)
- **F0.3** red baseline 테스트 `test/unit/sliceBaseline.test.ts` — F0.2 3종이 현재 `parseChainExpression`으로 **null**(preview 불가)임을 고정. M2 후 green 전환의 측정 기준.

## Acceptance (Gate)
- Gate A: `npm run compile` 0에러, 기존 579 + 신규 무회귀
- Gate B (Tier 3): `node`로 fixtures가 현재 파서에 null임을 단언하는 테스트 통과
- Demonstration: 앱 파일 트리 존재 + red baseline 테스트 green(= "현재는 preview 불가"가 고정됨)

## Out of scope (→ later M)
- SliceBuilder 로직(M2) · 3슬롯 템플릿(M1) · 실제 docker 빌드(M3) · Rung1 clangd(best-effort, M3+)
