# M0 exec-validation

| WU | Feature | Tier | Command | Result |
|---|---|---|---|---|
| WU-M0.1 | F0.1 서버-path 러너 + F0.2 베이스라인 | Tier 1 | `npm run compile`(Gate A) + `UPDATE_GOLDENS=1 npm run test:e2e:server` 후 `npm run test:e2e:server` | **PASS** — compile exit 0; 서버 로컬 컴파일+spawn 성공("Server ready"), baseline-flex가 `SBBuildNode` via RENDER_JSON로 렌더(400x400 PNG), 골든 비교 PASS, exit 0. 출력에 `Render: native resident server (SBBuildNode via RENDER_JSON)` 명시 = harness 아님 확인. |
| WU-M0.2 | F0.3 cornerRadius characterization | Tier 1 + ✋ | `UPDATE_GOLDENS=1 npm run test:e2e:server` → corner-radius.png | **PASS** — corner-radius 샘플 렌더, 골든 생성. ✋ 육안 확인: teal 박스가 **각진(square) 모서리** = 서버가 SetCornerRadius 무시 중(silent-wrong) 확정. M1 red→green 기준점. |
| WU-M0.3 | F0.4 + F0.5 스파이크 | Tier 3 | `test -f spike-findings.md && grep ...` | **PASS** — spike-findings.md에 fontScale(SetScale vs SetScalingFactor)·focus(SetAlwaysShowFocus yes-with-change) 결론 기록. |

**Downgrade 이력**: 없음. 모든 WU가 계획 tier로 통과.

**마일스톤 회귀**: `npm test`(unit) = **559 passing, 0 failing**. 새 러너/스크립트가 기존 스위트 영향 없음.

**Silent-failure 자가점검(external-review 관점, inline)**:
- 러너가 진짜 서버 경로인가? ✓ — `previewServer.renderJson`(RENDER_JSON)을 호출, harness/standaloneBuildRunner 안 씀. 출력 라벨로도 확인.
- 골든이 vacuous(빈 이미지)인가? ✗ — baseline-flex(다크+흰텍스트)·corner-radius(teal 각진 박스) 실제 내용 육안 확인.
- corner-radius가 정말 버그를 드러내나? ✓ — 각진 모서리 명확(SetCornerRadius(64) 무시됨).

**Verdict: M0 PASS.** 서버-path 검증 게이트 확립 — M1 진행 가능.

## ADR drift(arch-review 관점, inline)
- ADR-002(server-path harness)를 그대로 구현: PreviewServer local 모드 + RENDER_JSON + imageComparator 재사용, 별도 골든 디렉터리(`test/golden/server-screenshots/`). drift 없음.
- 신규 invariant 위반 없음. 새 ADR 불요.
