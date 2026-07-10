# Windows / WSL2 호환성 평가 — DALi UI Preview (VS Code 확장)

> 작성 2026-07-10. **유지보수자 내부 실현가능성 평가.**
>
> **STATUS: Windows / WSL은 현재 공식 지원 플랫폼이 아닙니다.** 이 문서는 "지원한다"는 선언이나
> 사용법 가이드가 아니라, *향후 지원을 검토할 때* 참고할 내부 호환성 평가입니다. 그래서 사용자용
> `README`에는 WSL 관련 안내를 넣지 않습니다.

## 한 줄 요약

| 시나리오 | 판정 | 핵심 이유 |
|---|---|---|
| **Docker 모드 + VS Code Remote-WSL** (기본) | ✅ **동작** (환경만 맞으면) | 렌더가 컨테이너 안에서 완결(내부 Xvfb + Mesa `llvmpipe` 소프트웨어 렌더, 호스트 GPU/X 불필요) → 네이티브 리눅스 도커와 바이트 동일. 확장 Node 코드는 WSL 리눅스 서버에서 실행(`process.platform === 'linux'`) |
| **Local 모드** | ❌ **기본 WSL2에서 막힘** | WSLg가 `/tmp/.X11-unix`를 읽기전용 마운트 → 관리형 Xvfb 소켓 생성 실패. 게다가 DALi를 distro 안에서 소스빌드 필요(uifw 개발자 전용) |
| **네이티브 Windows (WSL 없이)** | ⚠️ **오작동 + 오해 메시지** | 확장에 OS 가드 없음. `package.json`의 `os:["linux"]`는 VS Code가 무시하는 죽은 필드 |

**평가 결론(미지원 전제):** *만약* Windows를 지원하기로 한다면 **"Docker Desktop + WSL2(Ubuntu) + VS Code Remote-WSL"**가 유일하고 올바른 경로이며, 렌더 파이프라인 자체엔 아키텍처적 장애물이 없습니다. 지원으로 전환하려면 렌더가 아니라 **Windows 사용자를 올바른 경로로 안내·가드하는 부분**(아래 코드 갭)을 먼저 채워야 합니다.

> ⚠️ **검증 한계:** 실제 Windows 11 + WSL2 호스트에서 렌더 PNG를 눈으로 찍어보진 못했습니다(검증환경 미비).
> 아래는 전부 **코드 + 공식문서(Microsoft/Docker/VS Code) 교차검증 + 반론검증**으로 낸 판단입니다.
> 컨테이너가 네이티브 리눅스와 동일하므로 성공 가능성은 매우 높지만, "동작함"이 아니라 "동작할 것"이 정확한 표현입니다.
> 실제 검증 절차는 이 문서 맨 아래 **직접 확인 체크리스트** 참고.

---

## 1. 왜 Docker 모드는 되는가 (아키텍처)

```
[ Windows 11 호스트 ]
  └ VS Code (webview = 렌더된 PNG 표시는 윈도우 쪽에서)
  └ WSL2 (Ubuntu) ──── ★ 확장의 Node 코드가 여기서 실행됨 (process.platform === 'linux')
        └ spawn('docker', ['run', '-v', '/tmp/dali_preview…:/work', …])  → Docker Desktop WSL 통합 데몬
              └ 컨테이너: 내부 Xvfb + g++ 컴파일 + Mesa llvmpipe 소프트 렌더 → /work/preview.png
```

- 확장은 `docker`를 **PATH의 맨이름**으로 호출(`src/dockerRuntime.ts` `spawn('docker', …)`), 바인드 마운트하는 호스트 경로는 **WSL 네이티브 `/tmp/dali_preview…`** (윈도우 드라이브 아님) → Docker가 권장하는 **빠른 경로**에 자연히 얹힘.
- 렌더는 `--privileged`/`--gpus`/호스트 X 소켓 없이 **컨테이너 안에서 완결**(`GALLIUM_DRIVER=llvmpipe`, `LP_NUM_THREADS=0`). 호스트에 GPU도 X 서버도 불필요 → **네이티브 리눅스 도커에서 되는 건 WSL2 도커에서도 그대로.** 이 프로젝트의 e2e 골든(네이티브 리눅스 도커)이 곧 WSL2에 대한 간접 증거.
- `package.json`에 `extensionKind` 미선언 → `main`(Node 진입점)이 있으므로 VS Code 기본 분류상 **workspace 확장 = WSL 서버에서 실행**. webview의 PNG는 `PreviewManager`가 `asWebviewUri(vscode.Uri.file(pngPath))`로 로드하고 `localResourceRoots`에 WSL측 tmp 디렉토리를 화이트리스트 → WSL측 파일이 호스트 webview로 정상 터널링(반론검증에서 실제 코드 확인).

---

## 2. 리스크 매트릭스

| # | 리스크 | 심각도 | 무엇이 문제인가 (코드 근거) | 해결 방향 |
|---|---|---|---|---|
| R1 | **.vsix를 Windows 로컬(UI) 측에 설치** | 높음 | workspace가 아닌 UI 확장 호스트에서 실행 → `process.platform='win32'`, `spawn('docker'/'g++')`·`which docker`(`dockerAccessCheck.ts:37`) 실패. Marketplace가 아닌 수동 .vsix라 실수 쉬움 | ① `package.json`에 `"extensionKind":["workspace"]` (한 줄) → 항상 WSL 측 설치 강제 ② 문서에 "Reopen in WSL **후** WSL 컨텍스트에서 설치" 명시 |
| R2 | **네이티브 Windows (WSL 없이)** | 높음 | 확장에 런타임 OS 가드 없음(`os.platform()`은 `reportIssueCommand.ts`에서 텔레메트리로만 읽음). `package.json`의 `os:["linux"]`(L28-30)는 **VS Code가 인식하지 않는 죽은 필드** → 설치 안 막힘. Preview 누르면 `which docker` 실패 → "Docker 미설치"라며 `curl get.docker.com \| sudo sh`(리눅스 전용, `installDocker.ts:53`) 권함 → 영원히 실패 + WSL 힌트 없음 | 활성화 시 `process.platform!=='linux'`면 CLI(`unsupportedPlatformMessage`)처럼 **"Reopen in WSL" 버튼** 알림 + docker/local 프로브 억제 |
| R3 | **사내망 첫 pull이 default `latest`** (WSL 전용 아님, WSL DNS로 악화) | 높음 | default 태그가 `latest`(`package.json:271`, `dockerRuntime.ts:12` `DEFAULT_IMAGE_TAG`). BART 프록시는 mutable 태그를 캐시에서 못 줌 → 첫 pull 실패 → 자가복구가 **ghcr.io로 태그목록 왕복**을 요구(`registryClient.ts`는 항상 ghcr.io 조회) = BART가 피하려던 바로 그 호스트. ghcr.io가 막힌 사내 WSL이면 첫 렌더에 이미지 0 | BART 탐지 시 첫 pull을 불변 태그로 자동 핀하거나 default를 불변으로 |
| R4 | **사내 VPN DNS가 WSL에 전파 안 됨** | 높음(구형) / 낮음(Win11 최신) | 기본 NAT 모드 + DNS 터널링 없음이면 `*.bart.sec.samsung.net`이 WSL에서 resolve 안 됨 → `registry.isBartProxyReachable()` false → **조용히 GHCR로 폴백**(더 나쁜 경로, 무알림) | `%USERPROFILE%\.wslconfig`에 `[wsl2] networkingMode=mirrored`, `dnsTunneling=true` + `wsl --shutdown`. Win11 22H2 + WSL≥2.2.1이면 기본 on |
| R5 | **Docker Desktop이면 프록시/CA 위치가 다름** | 중간 | 확장의 실패 안내(`describeFailure`의 `systemctl`/`http-proxy.conf` drop-in)는 docker-ce 전용. Docker Desktop은 GUI(Settings→Resources→Proxies)에서 설정. pull은 별도 유틸리티 VM에서 돌아 distro의 node 프로브와 네임스페이스가 달라 탐지 불일치 가능 | `docker info`로 Docker Desktop 감지해 안내 분기 |
| R6 | **Local 모드는 기본 WSL2에서 막힘** | 높음(단 비기본) | WSLg가 `/tmp/.X11-unix`를 읽기전용 마운트(Microsoft "by design") → `xvfbManager`의 Xvfb가 소켓 못 만들어 전 디스플레이(:99~) 실패 → `localBackend`가 렌더 거부하며 **"Xvfb 설치하세요"라는 엉뚱한 메시지**(이미 설치됨). 게다가 DALi prefix를 distro 안에 소스빌드해야 함 | WSL2 감지 → "docker 모드 쓰세요" 유도. `hostXvfbNeeded`가 docker 모드에서 false라 docker는 무관. "inherited DISPLAY 거부" 가드는 옳으므로 유지 |
| R7 | **설치 도우미가 systemd 가정** | 중간 | `installDocker.ts:58` `systemctl enable --now docker` + `:61` 소켓 `setfacl`. systemd 미활성 WSL distro면 `&&` 체인이 끊겨 데몬 안 뜸. Docker Desktop이면 전부 불필요 | WSL 감지 시 `sudo service docker start` / `/etc/wsl.conf`에 `[boot] systemd=true` 안내로 분기, Desktop이면 setfacl 스킵 |
| R8 | **WSL2 메모리·CPU 상한** | 낮음 | 기본 호스트 RAM ~50%를 Docker VM과 공유. 컨테이너 g++ 컴파일 + FHD `llvmpipe` 렌더가 저사양 노트북에서 OOM 가능. `.wslconfig`의 `processors=` 제한 시 렌더 느려짐 | `.wslconfig`에 넉넉한 `memory=`/`processors` 권장. 코드는 이미 `LP_NUM_THREADS=0`으로 전 코어 사용 |
| R9 | **프로젝트가 `/mnt/c`에 있으면** | 낮음 | 이미지 에셋 마운트(`buildRunner.stageImageAssets`, 프리뷰 파일 상대경로)가 9P 파일시스템 경계를 넘어 5~10배 느림. 핫 워크디렉토리 `/tmp`는 무관 | "프로젝트는 WSL 홈(`~/…`)에 두세요" 문서화, `/mnt/`로 시작하면 경고 |

---

## 3. 코드 갭 인벤토리 (수정하려면 여기)

| 위치 | 현재 | 문제 | 권장 |
|---|---|---|---|
| `package.json` (extensionKind) | 미선언 | R1 — UI 측 오설치 여지 | `"extensionKind":["workspace"]` 추가 |
| `package.json:28-30` `os:["linux"]` | 존재하나 VS Code가 무시 | R2 — 가드로 착각(거짓 안심) | 제거 + 런타임 가드로 대체 |
| `src/extension.ts` 활성화 | OS 가드 없음 | R2 | non-linux면 "Reopen in WSL" 알림 (CLI `unsupportedPlatformMessage` 미러) + 유닛테스트(`cliPlatform.test.ts` 유사) |
| `src/dockerAccessCheck.ts:37` | `which docker` | R2 — Windows엔 `which` 없음 → 거짓 음성 | non-linux 조기 차단(위 가드가 커버) |
| `src/installDocker.ts:53-61` | `curl…\|sudo sh` + `systemctl` + `setfacl` | R7 — systemd/-ce 가정 | WSL/Desktop 인지 분기 |
| `src/registry.ts` `isBartProxyReachable` | 2초 https 프로브, 실패 시 조용히 GHCR | R4 — WSL DNS 미전파 시 무알림 강등 | GHCR 실패 시 "BART 자동 스킵됨" 알림 + `.wslconfig` 힌트, 레지스트리 강제 설정 |
| `src/pullImageCommand.ts` `describeFailure` | systemd 안내 | R5 — Desktop엔 부적합 | Desktop/-ce 분기 |
| default `daliVersionTag='latest'` | mutable | R3 — 사내 첫 pull 위험 | BART일 때 불변 태그 자동 핀 |

> **참고 — per-tag 태그 회귀는 양쪽 다 처리·릴리스됨:** runtime-release가 4세그먼트 불변 태그(`dali_2.5.28.10837-<sha>`)로 전환하면서 `pickFallbackTag`/`isRollingTag`의 3세그먼트 정규식이 새 불변 태그를 못 잡던 문제는 **extension `v0.59.0`**과 **CLI `v0.11.2`**에서 각각 4세그먼트 허용 + 회귀 가드 테스트로 수정 완료(동일 접근). 이 회귀는 WSL과 무관하지만 R3/R4와 겹쳐 사내 WSL에서 증상이 더 잘 드러난다 — extension⇄CLI 병렬 수정이 필요했던 사례(*Three-component sync* 참고).

---

## 4. 권장 후속 작업 (우선순위)

| 우선 | 항목 | 규모 |
|---|---|---|
| ★★★ | `"extensionKind":["workspace"]` 선언 (R1) | 1줄 |
| ★★★ | 활성화 시 non-linux 플랫폼 가드 + "Reopen in WSL" 알림, docker/local 프로브 억제 (R2) + 유닛테스트 | ~30줄 |
| ★★ | 죽은 `os:["linux"]` 필드 제거 (R2 거짓 안심 제거) | 1줄 |
| ★★ | 사내망 default 태그 불변 자동 핀 (R3) | 소 |
| ★★ | docker 설치/접근 안내 Desktop vs -ce, WSL/systemd 인지 분기 (R5,R7) | 중 |
| ★ | (지원 결정 시) README(EN/KO) Windows(WSL2) 절 + `.wslconfig`(mirrored/dnsTunneling) + "프로젝트는 WSL 홈에" (R4,R9) — **현재 미지원 방침이라 README에는 넣지 않음** | 문서 |

---

## 5. 직접 확인 체크리스트 (WSL 환경 생기면)

1. Windows 11 22H2+ / WSL ≥ 2.2.1 (`wsl --version`) / Ubuntu.
2. Docker Desktop 설치 → Settings → Resources → **WSL Integration에서 해당 distro 켜기** → WSL 셸에서 `docker info` 확인.
3. (사내) `%USERPROFILE%\.wslconfig`: `[wsl2] networkingMode=mirrored` + `dnsTunneling=true` → `wsl --shutdown` → WSL 셸에서 `nslookup ghcr-docker-remote.bart.sec.samsung.net` resolve 확인.
4. VS Code + "WSL" 확장 → **Reopen Folder in WSL** → **WSL 컨텍스트에서** 이 .vsix 설치(Extensions 패널 "Install in WSL: <distro>").
5. 샘플 열고 Preview → 렌더 PNG + 출력 로그 `[Perf]` 타이밍·`dali-ui runtime: … (docker · … — GHCR/BART)` 줄 확인 → 스크린샷 저장.
6. click-to-code(오버레이 클릭 → 소스 이동)까지 확인(CI가 못 잡는 회귀 지점).

## 참고 자료
- Docker Desktop WSL2 backend: <https://docs.docker.com/desktop/features/wsl/>, best practices <https://docs.docker.com/desktop/features/wsl/best-practices/>
- VS Code Remote-WSL 아키텍처 / extensionKind: <https://code.visualstudio.com/docs/remote/wsl>, <https://code.visualstudio.com/api/advanced-topics/extension-host>
- WSL networking(mirrored) / DNS 터널링: <https://learn.microsoft.com/windows/wsl/networking>, `.wslconfig` <https://learn.microsoft.com/windows/wsl/wsl-config>
- WSLg `/tmp/.X11-unix` 읽기전용: <https://github.com/microsoft/wslg/issues> (알려진 by-design 동작)
