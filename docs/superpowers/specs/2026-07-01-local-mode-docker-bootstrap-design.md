# Local-mode Docker bootstrap via "Select Runtime Version" — Design

## 한 줄 요약 (TL;DR)

| 항목 | 내용 |
|---|---|
| **무엇** | `local` 런타임 모드에서 도커가 없을 때 **"Select Runtime Version"** 명령이 막다른 경고로 끝나지 않고, **버전 선택 → Docker 설치 → 이미지 다운로드 → docker 모드 전환**까지 부트스트랩하도록 확장 |
| **왜** | 지금은 local 모드 + 도커 미설치 시 *"Cannot list runtime versions — docker is not accessible"* 만 뜨고 사용자가 스스로 도커를 깔 방법을 안내받지 못함 |
| **핵심 흐름** | (사용자 선택) **버전 먼저 고르고** → 설치 → 그 버전 pull → 전환 (원격 레지스트리 목록은 도커 없이도 조회 가능) |
| **성공 시에만** | `runtimeMode=docker` + `daliVersionTag=<선택>` 저장 후 창 리로드. 취소/실패 시 local 모드 그대로 |
| **테스트** | 순수 결정 함수(단위) + **주입형 오케스트레이션 통합 테스트**(전체 흐름을 fake로 구동). 실제 `apt install docker`를 돌리는 머신-레벨 e2e는 자동화 불가 — 그 경계는 명시 |

---

## 1. 문제 / 동기

`daliPreview.runtimeMode`는 VS Code **User(전역) 설정**에 저장되어 확장 재설치로도 초기화되지 않는다. `local`로 고정된 사용자가 도커를 지우면:

- 프리뷰는 호스트 네이티브 DALi prefix로 계속 렌더되므로 **아무 문제도 드러나지 않고**,
- 도커 온보딩 전체가 [`extension.ts`의 `if (!isLocalRuntime)` 게이트](../../../src/extension.ts) 뒤에 있어 **도커 설치 안내가 전혀 나타나지 않는다.**

사용자가 docker 런타임으로 옮기려 할 때 자연스러운 진입점은 이미 문서화된 local→docker 전환 명령인 **"Select Runtime Version"**(`dali.selectRuntimeVersion`)이다. 그러나 이 명령은 도커가 없으면 버전 목록을 못 읽어 경고만 띄우고 종료한다. 이 막다른 길을 부트스트랩 흐름으로 대체한다.

## 2. 범위 (In / Out)

**In scope**
- `dali.selectRuntimeVersion` 명령의 **local 모드 + 도커 사용 불가** 경우만.
- "사용 불가"의 모든 하위 상태: `docker-not-installed`, `docker-daemon-not-running`, `permission-denied`.

**Out of scope (YAGNI)**
- local 모드 자동(팝업) 온보딩 — 이 기능은 **명령을 눌렀을 때만** 반응한다. 평소 local 개발 흐름을 방해하지 않기 위함.
- docker 모드 사용자의 동작 — 무변경.
- local 모드인데 **도커가 정상**인 경우 — 기존 동작(로컬+원격 목록 → 선택 → docker 전환 + 리로드) 유지.
- 백엔드 라이브 스위칭(리로드 없이 local↔docker) — 기존 패턴대로 **리로드**로 처리.

## 3. 동작 흐름

백엔드(Local/Docker)는 **활성화 시점**에 `runtimeMode`로 결정되어 여러 클로저에 캡처되므로, 모드 전환에는 창 리로드가 필요하다(기존 local→docker 전환과 동일).

```
[Select Runtime Version 클릭 · local 모드]
        │
   checkDockerAccess()
        ├─ ok ──────────────► 기존 selectRuntimeVersionCommand
        │                     (로컬+원격 목록 → 선택 → docker 전환 + 리로드)   ← 무변경
        │
        └─ not-ok ──► ① listRemoteTags() 로 원격 버전 목록 조회 (HTTPS · 도커 불필요)
                         │   └─ 실패/빈 목록(오프라인) → "현재/기본 태그로 설치 진행?" 확인 (fallback)
                         ▼
                      ② 버전 QuickPick (전부 "will download ~290 MB")
                         │   └─ 취소 → 종료 (설정 변경 없음)
                         ▼
                      ③ 확인 모달: "Docker를 설치하고 <버전>을 받은 뒤 Docker 런타임으로
                         전환합니다. 비밀번호는 한 번만 입력하면 자동 진행됩니다."
                         │   └─ 거절 → 종료 (설정 변경 없음)
                         ▼
                      ④ accessState 별 설치/복구 (기존 로직 재사용)
                         · docker-not-installed        → installDockerCommand (터미널; setfacl로 세션 즉시 접근)
                         · daemon-not-running/permission → showDockerSetupGuidance (데몬 기동 / setfacl)
                         ▼
                      ⑤ DockerAccessPoller 로 도커 도달 대기 (진행 알림 · 취소 가능)
                         ├─ onOk:
                         │     · ensureRuntimeImage(<선택 태그>)  ← 세션 내 pull (setfacl 덕분에 리로드 전 가능)
                         │     │     └─ pull 실패 → 경고 · local 유지 (모드 전환 안 함)
                         │     · runtimeMode=docker + daliVersionTag=<선택> 저장   ← 성공 시에만
                         │     · reloadWindow() → docker 모드 활성화 · 이미지 준비 완료 → 즉시 preview
                         └─ onGiveUp / 취소:
                               · 경고 · local 유지 (설정 변경 없음)
```

### 핵심 결정 (확정)

1. **not-ok 상태 전부 처리** — 미설치뿐 아니라 데몬 꺼짐/권한 거부도 같은 진입점에서 복구까지. 반쪽만 처리하면 또 다른 막다른 길이 생긴다.
2. **버전 먼저 선택** (사용자 결정) — 원격 레지스트리 목록은 도커 없이 HTTPS로 조회되므로 설치 전에 고를 수 있다.
3. **설정 변경은 성공 시에만** — 도중 취소/실패면 local 모드를 그대로 유지해 "docker 모드인데 docker 없음" 상태로 사용자를 방치하지 않는다.
4. **오프라인 fallback** — 원격 목록을 못 받으면 현재/기본 태그(`daliVersionTag`)로 설치를 진행할지 확인. (완전 오프라인이면 pull도 실패하므로 결국 경고 종료.)

## 4. 아키텍처

기존 코드의 두 패턴을 그대로 따른다: **부수효과 없는 분류자**(`classifyOnboarding`, `decidePreviewDockerGate`)와 **의존성 주입형 오케스트레이션**(`maybeRunFirstRunDockerSetup`).

### 신규 모듈 `src/localDockerBootstrap.ts`

```
// 순수 분류자 — 단위 테스트 용이
export function decideLocalVersionAction(args: { accessState: string }):
    'list-and-switch'   // access ok → 기존 selectRuntimeVersionCommand 에 위임
  | 'setup-then-switch' // access not-ok → 아래 부트스트랩 오케스트레이션

export type BootstrapOutcome =
    'switched' | 'no-versions' | 'cancelled-pick' | 'declined'
  | 'setup-gaveup' | 'pull-failed';

export interface LocalDockerBootstrapDeps {
    accessState: string;                              // 최초 probe 결과 (설치 vs 권한 분기)
    currentTag: string;
    listRemoteVersions: () => Promise<string[]>;      // listRemoteTags 래핑 (실패 시 [] 반환)
    pickVersion: (tags: string[], current: string) => Promise<string | undefined>;
    confirmSetup: (version: string) => Promise<boolean>;
    confirmOfflineFallback: (tag: string) => Promise<boolean>; // 원격 목록 없을 때
    beginInstall: (accessState: string) => Promise<void>;      // installDockerCommand | showDockerSetupGuidance
    waitForDockerReady: () => Promise<'ok' | 'gaveup'>;        // DockerAccessPoller 래핑
    pullImage: (tag: string) => Promise<boolean>;             // ensureRuntimeImage 래핑
    persistDockerMode: (tag: string) => Promise<void>;        // runtimeMode=docker + daliVersionTag=tag
    reload: () => Promise<void>;                              // workbench.action.reloadWindow
    warn: (msg: string) => Promise<void>;
    log?: (msg: string) => void;
}

export async function runLocalDockerBootstrap(deps: LocalDockerBootstrapDeps): Promise<BootstrapOutcome>
```

`runLocalDockerBootstrap`이 §3 ⑤까지의 순서(목록→선택→확인→설치→대기→pull→저장→리로드)와 각 분기(취소/거절/실패)를 순수하게 담당한다. **vscode를 import하지 않는다** → 전 구간 테스트 가능.

### 픽커 헬퍼 추출 `buildVersionQuickPickItems(...)`

현재 버전 아이템 생성 로직은 `selectRuntimeVersionCommand` 안에 묶여 있다. 아이템 매핑(정렬/`current`/`downloaded`/`will download`/버전 detail)을 순수 헬퍼로 추출해 기존 경로와 신규 원격-전용 픽커가 공유한다. (최소 추출 — 동작 변경 없음.)

### 배선 (extension.ts)

`dali.selectRuntimeVersion` 핸들러의 local 분기([현재 위치](../../../src/extension.ts))를 다음으로 교체:

```
if (isLocalRuntime) {
    const access = await checkDockerAccess();
    if (decideLocalVersionAction({ accessState: access.state }) === 'list-and-switch') {
        // 기존 경로: 도커 정상 → selectRuntimeVersionCommand → 선택 시 docker 전환 + 리로드
    } else {
        await runLocalDockerBootstrap({ /* 실제 vscode/docker IO 주입 */ });
    }
    return;
}
```

### 재사용 모듈

`listRemoteTags`(registryClient), `installDockerCommand`(installDocker), `showDockerSetupGuidance`(dockerAccessCheck), `DockerAccessPoller`(dockerAccessPoller), `ensureRuntimeImage`(pullImageCommand), `ConfigurationService.update`.

> 참고: 기존 `startDockerSetupWatch`의 onOk는 **기본 태그** ensureRuntimeImage + local `initPreviewServer` + 알림이라 이 흐름과 목적이 다르다(우리는 **선택 태그** pull + 모드 전환 + 리로드). 따라서 그 함수를 그대로 쓰지 않고 `DockerAccessPoller` **클래스**를 직접 감싼다.

## 5. 테스트 전략

**"세팅 흐름을 테스트로 검증"이 이 기능의 명시적 요구사항.** 세 계층으로 검증한다. 규약은 기존 `test/unit/dockerOnboarding.test.ts`와 동일: `chai` + `sinon`, 주입 deps stub, 호출 순서/횟수/결과 상태 단언.

### (a) 순수 결정 함수 — `decideLocalVersionAction`
- `accessState = ok` → `'list-and-switch'`
- `docker-not-installed` / `docker-daemon-not-running` / `permission-denied` → `'setup-then-switch'`

### (b) 오케스트레이션 통합 테스트 — `runLocalDockerBootstrap` (이 기능의 "e2e급" 검증)
전체 흐름을 fake deps로 구동하고 **부작용 시퀀스**를 단언:

| 시나리오 | 기대 |
|---|---|
| 정상: 목록→선택→확인→설치→poller ok→pull 성공 | `persistDockerMode(선택태그)` 1회 → `reload()` 1회, 순서 보장. outcome `switched` |
| 픽커 취소 | `beginInstall`/`persistDockerMode`/`reload` 미호출. outcome `cancelled-pick` |
| 확인 모달 거절 | 설치·설정 변경 없음. outcome `declined` |
| poller onGiveUp | `pullImage`/`persistDockerMode`/`reload` 미호출, `warn` 호출. outcome `setup-gaveup` |
| pull 실패 | `persistDockerMode`/`reload` 미호출(모드 전환 안 함), `warn` 호출. outcome `pull-failed` |
| 원격 목록 빈값 + fallback 수락 | `currentTag`로 설치 진행. |
| 원격 목록 빈값 + fallback 거절 | 종료, 설정 변경 없음. outcome `no-versions` |
| `permission-denied` 진입 | `beginInstall`이 설치가 아닌 **guidance** 경로로 라우팅됨(주입 스텁으로 확인) |

### (c) 픽커 헬퍼 — `buildVersionQuickPickItems`
- `current` 태그가 맨 앞, downloaded, will-download 순 정렬.
- 라벨/description(`current · downloaded` / `will download (~290 MB)`)과 롤링 태그의 `detail = DALi <version>` 매핑.

### e2e 가능성 (정직한 경계)
- 리포의 `test:e2e*`는 **DALi 씬 골든 렌더**(docker/xvfb)로, 명령/온보딩 오케스트레이션과는 무관하다 → 이 기능엔 부적합.
- **실제 `apt install docker` + 리로드를 수행하는 머신-레벨 e2e는 자동화 불가**(sudo, 호스트 상태 변경, 되돌리기 위험). 대신 (b)의 주입형 통합 테스트가 전체 의사결정·순서·롤백을 실행 경로 그대로 커버한다 — 이것이 안전하게 자동화 가능한 최대치.
- 실물 검증은 수동 스모크로 문서화: 도커 삭제 → 명령 실행 → 설치→pull→전환 확인.

## 6. 엣지 케이스

- **오프라인**(원격 목록 실패/빈값) → fallback 확인(현재/기본 태그로 진행). 완전 오프라인이면 pull 실패로 이어져 경고 종료.
- **pull 실패** → 모드 전환 안 함, local 유지, 경고.
- **poller 타임아웃**(onGiveUp) → 기존 문구 재사용, local 유지.
- **사용자가 이미 선택 태그를 로컬에 보유**(설치는 됐지만 권한만 문제였던 경우) → ensureRuntimeImage가 즉시 통과(pull 없음) 후 전환.
- **리로드 후** docker 모드 활성화가 다시 ensureRuntimeImage를 호출해도 이미지가 있으므로 즉시 통과(중복 다운로드 없음).

## 7. 건드리는 파일

| 파일 | 변경 |
|---|---|
| `src/localDockerBootstrap.ts` | **신규** — `decideLocalVersionAction`, `runLocalDockerBootstrap`, 타입 |
| `src/checkUpdateCommand.ts` | `buildVersionQuickPickItems` 추출(픽커 아이템 생성 분리), `selectRuntimeVersionCommand`가 이를 사용 |
| `src/extension.ts` | `dali.selectRuntimeVersion` local 분기 배선 |
| `test/unit/localDockerBootstrap.test.ts` | **신규** — (a)+(b) |
| `test/unit/checkUpdateCommand.test.ts` (또는 신규) | (c) 픽커 헬퍼 |
| `CHANGELOG.md` | 항목 추가 |

## 8. 성공 기준

1. `npm run compile` 0 에러.
2. 신규/기존 단위 테스트 전부 통과(§5 (a)(b)(c) 포함).
3. local 모드 + 도커 없음에서 명령 실행 시 §3 흐름대로 동작(수동 스모크로 확인).
4. 도커 정상 local, docker 모드 사용자 동작 무변경(회귀 없음).
