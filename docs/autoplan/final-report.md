# Project completion — zero-annotation 자동추출 preview 검증

## Milestone summary
| M | Title | Verdict | Cycles | 커밋 | Notes |
|---|---|---|---|---|---|
| M0 | 실전 앱 `flow-wallet` + 픽스처 + red baseline | PASS | 1 | 2b4cea0 | Gate B가 `.c_str()`·lambda Connect 버그 포착 |
| M1 | 3슬롯 템플릿 (byte-identical) | PASS (DRIFT-MINOR) | 1 | e628e45 | `{{USER_CODE}}` 유지(ADR-001 drift), #line→M2 |
| M2 | SliceBuilder Rung2 + weak stub | PASS | 1 | 8e0204b | external-review가 지역변수 누출 포착·수정 |
| M3 | 실빌드·렌더 검증 + 매트릭스 + 리포트 | PASS | 1 | 4f395e3 | **실제 PNG 렌더 2장**, cross-file 경계 실측 |
| M4 | orchestrator 통합 (compile-probe→Rung3 fallback) | PASS | 1 | cfdb9da | 실제 preview 흐름 연결; single-fn byte-identical(회귀0) |

loop budget 충분. 동일 테스트 3연속 실패 없음. external-review가 M2·M4에서 실제 버그 2건 포착(지역변수 누출 / path2-dlopen flip).

## 핵심 성과 (사용자 질문에 대한 답)
**"실전 dali-ui 앱 코드를 어노테이션 없이 어느 정도 preview할 수 있나?"**
- ✅ **같은 파일 의존성**: Rung2 자동추출 → 컴파일 → **실제 PNG 렌더까지** (helper "Home/Wallet/Settings", member auto-stub "Sample"). 어노테이션 0개.
- ❌ **실전 앱 cross-file 의존성**: Rung2로는 14에러 → **Rung1(clangd)이 필요한 경계를 docker 실측으로 확정.**
- 결과 리포트: `Docs/auto_extract_validation_0610.md` (매트릭스 + PNG 2장 + 정직한 한계 + 다음 단계).

## Accumulated ✋ queue
- 없음 (자율 검증 완료). 단 아래 "다음 단계"는 사용자 결정 필요.

## Final ADR state
- ADR-001 (3슬롯): active — 단 `{{USER_CODE}}` 유지(DRIFT-MINOR, arch-review 기록)
- ADR-002 (SliceBuilder 배치): active — 단 orchestrator wiring은 미적용(다음 단계)
- ADR-003 (Rung2=정규식): active, 검증됨
- ADR-004 (weak bodied stub): active — RTLD_NOW 충족 실증(member 렌더)
- ADR-005 (errorParser 동적 출처): 미적용 (orchestrator 통합과 함께)
- ADR-006 (dali-ui 경계): active — flow-wallet 경계 안, 이미지 무변경 컴파일

## Test outcomes
- Gate A: 588/588 unit pass (579 baseline + 9 new). compile 0 errors.
- Gate B (실행 기반): 픽스처 3종 docker 컴파일 PASS, helper+member PNG 렌더 PASS, 실전앱 컴파일 FAIL(예상·기록됨).
- Inv-1(byte-identical)·Inv-2(bodied stub)·Inv-4(무회귀)·Inv-5(서버/이미지 무변경) 전부 UPHELD.

## Recommended next steps (사용자 결정 필요)
1. ✅ **orchestrator 통합 — 완료(M4)**: `runPreview`에 SliceBuilder 연결, compile-probe→Rung3 fallback, single-fn byte-identical(회귀0). 비자기완결(같은 파일 헬퍼/멤버/상수) 코드가 이제 VS Code 실제 흐름에서 slice→compile→preview. ⚠️실제 VS Code에서의 최종 시각 확인은 사용자 몫(✋).
2. **T3/multi-config/device 경로 slice** (M4 gap): 현재 slice는 dlopen(T2, warm-server 주경로)만. server 죽은 T3 fallback·multi-config·device 경로는 미적용(회귀 아님, 현행 동작). 확장 시 harness/buildAndRun도 slice 받게.
3. **Rung1 (clangd cross-file)**: 실전 앱(다른 파일 의존성)을 풀려면 핵심. 본 검증이 Rung2 경계를 확정했으니 Rung1이 메울 갭이 명확.
4. **시각 정직성 배지**: auto-stub 화면에 "샘플 데이터(자동)" 오버레이. + errorParser #line/동적출처(ADR-005).

## 산출물 위치
- 코드: `src/sliceBuilder.ts` (+ 5 단위테스트), `server/preview_*.template`(3슬롯), `src/buildRunner.ts`
- 샘플 앱: `samples/flow-wallet/` (커밋됨)
- 픽스처: `test/fixtures/slice/`
- 리포트·PNG: `Docs/auto_extract_validation_0610.md`, `Docs/auto_extract_{navbar,member}_preview.png` (Docs/는 gitignore=로컬)
- autodev 계획: `docs/autoplan/` (research/plan/architecture/adr/m0-m3)
- 브랜치: `autodev/auto-extract-preview` (main 보호, push 안 함)
