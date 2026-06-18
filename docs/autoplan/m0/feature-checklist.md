# M0 feature checklist (FROZEN)

> 동결됨. 이 마일스톤 진행 중 피처 추가/변경 금지. 새 피처 발견 시 docs/autoplan/m0/oos-queue.md 에 기록.

- [ ] F0.1 — 서버-path 골든 러너 (`test:e2e:server`, RENDER_JSON→SBBuildNode→PNG→골든 비교) — WU-M0.1
- [ ] F0.2 — green 베이스라인 서버 골든 (이미 올바른 샘플) — WU-M0.1
- [ ] F0.3 — cornerRadius characterization 샘플 (현재 각짐 골든, M1 red→green 씨앗) — WU-M0.2
- [ ] F0.4 — 스파이크: config override 멱등성(warm 서버) — WU-M0.3
- [ ] F0.5 — 스파이크: focus-ring 가용성(SetAlwaysShowFocus) — WU-M0.3

**Demonstration**: `npm run test:e2e:server` 가 깨끗한 `.preview.dali.cpp` 를 서버 scene-builder 경로로 렌더해 골든 비교 통과(기존 harness 골든과 별개 엔진).
