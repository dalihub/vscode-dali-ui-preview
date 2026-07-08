# dali-ui Code-Sync Automation — Final Report

> **한 줄 요약:** dali-ui 릴리즈에 맞춰 vscode 확장 + CLI 코드와 docker 런타임을 자동 동기화하는 **프로덕션 에이전트**를 설계·구현·검증 완료했다. 확장/CLI에는 "조용히 깨지던" 렌더 결함(이미지·클릭투코드·포커스)을 **결정론적으로 잡는 게이트**를 심고, 3벌로 흩어져 있던 C++ 익스포터를 **1벌로 통합**했으며, 그 위에 **detect→후보이미지→게이트→(AI수정)→발행→PR** 파이프라인을 얹었다. **기존 사용자는 깨지지 않는다 — 실증됨**(확장 PNG 바이트동일, CLI 바이트동일, 렌더 스위트 그린, 옛 이미지 재현으로 스큐 51/51 감지). 모든 것은 **로컬 브랜치**에만 있고 **아무것도 push/발행하지 않았다**. 켜는 스위치는 당신 몫이며, 순서·전제조건을 아래 체크리스트에 정리했다.

---

## 1. 무엇을 만들었나 (마일스톤)

| 마일스톤 | 내용 | 위치 | 검증 |
|---|---|---|---|
| **M1** 확장 렌더 게이트 | positive-semantic 체크(이미지=checkRegionColor, 클릭투코드=checkExpectedRects, 포커스=checkFocusIndicator), 공유 skew 시그니처, Graduation Registry | ext `design/dali-ui-code-sync` | 855→**863** unit + **26/0** docker골든 + **9/0** native서버 + opus 리뷰 |
| **M2** CLI 게이트 | skew 감지기(vendored) + 온스크린 bounds 체크 | CLI `m2/cli-render-gate-hardening` | **242** unit + CLI docker e2e PASS |
| **M3a** 코드젠 단일소스 | `src/harnessCodegen.ts` 추출(standaloneBuildRunner drift 제거) | ext | 26/0 바이트동일 |
| **M3b** 공유 C++ 익스포터 | `server/preview_export.h` (baked+fresh 공유, 스테이징) | ext | 26/0 + 9/0 |
| **M3c** ABI 게이트 + 핸드셰이크 | 플러그인 ABI 버전 거부(옛 플러그인은 관대) + 모드인식 핸드셰이크 | ext | unit + 9/0 |
| **에이전트** | run→detect→build후보→**gate**→(fix)→publish→PR, on uifw-agent-hub(claude opus) | agent `sync/gate-before-publish` (14 commits) | 아래 §3 |

브랜치 3개(전부 **로컬·unpushed**): 확장 `design/dali-ui-code-sync`, CLI `m2/cli-render-gate-hardening`, 에이전트 `sync/gate-before-publish` (repo `lwc0917/dali-preview-runtime-release`). 설계·플랜·이 리포트는 확장 repo `docs/superpowers/`.

## 2. 기존 사용자가 안 깨진다 — 근거 (당신의 최우선 요구)

- **확장 프리뷰 렌더 = 바이트동일.** M3 리팩터는 동작보존(코드를 옮기고 include로 바꿨을 뿐) → docker 골든 26/0, native 서버 9/0 모두 통과, 컴파일 스윕 50/51(1=weather-forecast GPU캐시 플레이크, 스큐 아님).
- **CLI = 바이트동일.** `out/cli.js` 그대로(rebase로 v0.10.5 + 실행비트 100755 보존), 240→242 unit, e2e 실렌더 PASS.
- **하위호환 안전장치 2개** (릴리즈 순서 사고 방지): (A) ABI 게이트는 **옛 플러그인(심볼 없음)을 거부 않고 경고+진행** → 새 이미지가 옛 확장을 안 깨뜨림. (B) 런타임 버전 핸드셰이크는 **비차단·세션당 1회·docker전용**(local no-op) 안내일 뿐.
- **런타임 이미지는 additive** + prune이 **핀된 `dali_*` 태그를 절대 삭제 안 함**(C1 수정) → 특정 태그에 핀한 사용자 404 없음.
- **AI 수정은 절대 사용자 릴리즈를 자동으로 내지 않는다** (auto-merge ≠ auto-release; `.vsix`/CLI-main push 경로가 코드 어디에도 없음, 검증됨).

## 3. 에이전트 동작 (당신이 요청한 루프)

`run.sh`가 hub 인터벌(예 매일)에 flock 직렬화로 실행:
1. **감지** (2축: dali-ui 최신 태그 × 확장 `docker/` sha). 이미 발행된 키면 **no-op exit 0**. (여러 태그 쌓이면 최신만.)
2. **후보 이미지 빌드** (로컬, unpushed).
3. **게이트** (후보 이미지 대상, fail-closed 다축):
   - docker 컴파일 스윕 + **native 스윕**(프리픽스 있으면; 없으면 SKIP, 손상이면 INCONCLUSIVE) + **CLI 실렌더**
   - **M1 의미검사 = 차단**(이미지-안뜸/클릭투코드/포커스/off-screen) · 픽셀-diff = 자문
   - 플레이크 1회 재시도(비스큐만) · **INCONCLUSIVE도 enforce에서 차단**
4. **분기**: green+무변경 → 런타임 이미지만 발행 / RED(스큐) → **AI 수정**(claude -p, 가드레일) → 재게이트
5. **발행**: 이미지 4태그(immutable+pin+moving+latest, additive) + prune(핀 보호)
6. **PR**: 코드 수정은 졸업 레지스트리 기준 PR/auto-merge(사람 릴리즈는 별도)
7. **ledger** (성공 시에만 → 다음 no-op)

**보수적 기본값** (전부 OFF): `GATE_ENFORCE=0`(shadow=관찰만), `AI_FIX_ENABLE=0`, `MERGE_ENABLE=0`. 즉 지금 그대로 hub에 올려도 **이미지 발행 외에는 아무것도 자동으로 하지 않는다**(그리고 이미지도 스윕+스모크 통과분만).

**AI 수정 안전장치**: 편집 화이트리스트 + 벗어나면 hard revert, ≤3회 단조감소 + 사이클중단, **토큰이 LLM에 안 들어감**(+ Bash 툴 제거로 on-disk 크레덴셜 접근 차단, C4), 환각 심볼 grep-게이트(S2), **2회 독립검증 + 씬트리 의미diff**(S3).

## 4. 빡센 최종 검증 결과

- **전체 스위트(최종 상태, 양 repo) GREEN**: ext 863 unit / 26·0 골든 / 9·0 서버 / 50·1(플레이크); CLI 242 unit / e2e PASS.
- **역사적 파손 재현**: 현재 코드 vs **옛 `dali_2.5.26` 이미지** → 0/51, **51개 전부 dali-ui 스큐로 감지**(`CalculateScreenExtents` 없음 = 좌표이관 파손). 감지기가 실제 stale-runtime을 end-to-end로 잡음.
- **적대적 전체 리뷰(opus)**: 핵심 결론 = 기존 사용자 렌더/exit/메타데이터 무변경. 발견된 결함 **전부 수정**:
  - C1 prune이 핀 태그 삭제 가능 → `^dali_` 무조건 보호 (수정·dry-run 검증)
  - C2 CLI 브랜치가 main보다 뒤짐(실행비트/버전 되돌림 위험) → **main에 rebase** (v0.10.5·100755 복원, 242 green)
  - C3 AI가 git commit으로 가드 우회 가능 → base 고정 + `git diff base` 평가 + reset --hard
  - C4 AI의 Bash가 크레덴셜/curl 도달 → **allowedTools에서 Bash 제거** + 런너 격리 요구 문서화
  - I1 부분발행 미감지 → **4태그 전부** 확인해야 no-op
  - I3 헤더 패키징 누락 위험 → `preview_export.h` 동봉 assertion 테스트
  - skew regex가 `Dali::Ui::`만 → **`Dali(::\w+)+` 모든 Dali 타입**으로 확장(ext+CLI+errorParser 일치)

## 5. ⚠️ 활성화 체크리스트 (당신이 켜는 순서 — 안전 필수)

에이전트는 **지금 shadow로 hub에 올려도 안전**하지만(관찰+이미지발행만), enforce/자동수정/자동머지를 켜려면 순서대로:

**A. 지금 안전하게 할 수 있는 것**
- [ ] 확장 M1~M3c를 **에이전트가 빌드하는 upstream repo에 병합**(`EXT_REPO`, 기본 `dalihub/vscode-dali-ui-preview`). ← 이게 돼야 에이전트가 통합본을 빌드하고, M3d(sed 반창고 제거)가 안전해짐. (지금은 로컬 브랜치라 upstream엔 없음.)
- [ ] CLI `m2/...` 브랜치도 마찬가지로 반영.
- [ ] 에이전트 `sync/gate-before-publish`를 `lwc0917/dali-preview-runtime-release`에 병합 → hub에 **shadow(`GATE_ENFORCE=0`)로 등록**. 이미지 발행만, 코드 자동변경 없음.

**B. `GATE_ENFORCE=1`(게이트가 실제로 발행을 막게) 전에**
- [ ] hub 런너에 **native dali-ui prefix를 태그별로 프로비저닝**(`GATE_NATIVE_PREFIX`). 없으면 native축이 INCONCLUSIVE로 모든 발행을 막음(fail-closed). — 문서: `automation/ACTIVATION.md`
- [ ] I1(4태그 no-op)·플레이크 재시도가 실제 런너 환경에서 도는지 1주기 관찰.

**C. `AI_FIX_ENABLE=1` 전에 (보안 필수)**
- [ ] 런너를 **egress 차단**(외부 네트워크 없음) + **on-disk 크레덴셜 없음**(`gh` 미인증, git credential helper 없음). 스크립트의 토큰격리·Bash제거는 필요조건이지 충분조건 아님.
- [ ] `claude` CLI(opus) 설치 + 인증.
- [ ] fine-grained **PAT**(2 repo, contents+PR) 를 런너 시크릿으로.

**D. `MERGE_ENABLE=1` / 자동 사용자 릴리즈 전에**
- [ ] shadow에서 **실제 dali-ui 스큐 ≥1건을 잡아낸 기록** 확보(6개 역사 픽스처 + 실사건). 그 전엔 사용자 릴리즈(.vsix/CLI main)는 **사람이** 낸다.
- [ ] 확장 릴리즈는 `.vscodeignore`/unzip 체크(46MB CLI 번들 방지). CLI 릴리즈는 main에서(현재 tip 아님 — rebase됨).
- [ ] **릴리즈 순서**(핵심): 코드 수정 병합 → 두 클라이언트 릴리즈를 **먼저** 내며 기본 런타임 태그 상향 → **그다음** 이미지 `latest`/`dali_XYZ` 이동. (사용자가 코드+이미지를 원자적으로 전환 → 새이미지+옛클라이언트 조합 없음.)

## 6. 남은 것 / 정직한 한계

- **M3d(build_publish.sh의 Window sed 제거)**: upstream에 M3가 반영되기 전엔 **하면 안 됨**(sed가 upstream 옛 API를 여전히 때움). 병합 후 안전.
- **AI 수정 루프(M5) end-to-end**: 실제 스큐 + claude CLI로 라이브 검증 필요(현재 self-test 15/15 + S2 부분 라이브). ⚠️ `claude`가 이 환경 PATH에 있어 `AI_FIX_ENABLE=1` 직접 실행 금지 — self-test로만.
- **prune 무한누적**: 핀 보호 때문에 `dali_*` 태그가 무한 축적(의도적, 공개 repo라 저렴하나 용량 관찰).
- **native 커버리지**: docker전용 런너면 class-b(네이티브) 스큐를 놓침 → prefix 프로비저닝으로 해소(문서화).

## 7. 진행 기록
전 과정(마일스톤별 구현자→리뷰어 루프, 검증 로그)은 `.superpowers/sdd/progress.md`(gitignored) + 각 `*-report.md`에. 설계 blueprint는 `automation/AGENT_DESIGN.md`(에이전트 repo에 동봉).
