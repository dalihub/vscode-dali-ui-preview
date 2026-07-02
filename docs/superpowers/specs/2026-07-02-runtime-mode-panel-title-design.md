# 설계: 프리뷰 패널 제목에 런타임 모드 표시

## 한 줄 요약
프리뷰 웹뷰 패널 탭 제목을 `DALi Preview — Local` / `DALi Preview — Docker (dali_2.5.26)` 로 분기해, 지금 렌더링 중인 런타임(로컬 vs 도커)을 탭만 보고 즉시 구분할 수 있게 한다.

## 문제
로컬 런타임을 쓰다가 "Select Runtime Version"으로 도커 런타임을 선택한 뒤, 현재 프리뷰가 로컬로 렌더링되는지 도커로 렌더링되는지 구분할 방법이 없다.
- 상태 표시줄(`statusBar.ts`)은 렌더 **모드**(Parser/Server/Compile)만 표시하고 런타임은 표시하지 않는다.
- 웹뷰 패널 제목(`previewManager.ts`)은 항상 고정 문자열 `'DALi Preview'`.
- 유일한 확인 방법은 설정 `daliPreview.runtimeMode` 값을 직접 열어보는 것 — 직관적이지 않다.

## 해결
웹뷰 패널 탭 제목을 런타임 모드에 따라 분기한다.

| 모드 | 패널 탭 제목 |
|---|---|
| Local | `DALi Preview — Local` |
| Docker | `DALi Preview — Docker (<daliVersionTag>)` (예: `DALi Preview — Docker (dali_2.5.26)`) |

## 구현
- 순수 헬퍼 함수 `runtimePanelTitle(mode: 'docker' | 'local', versionTag: string): string` 추가 (vscode 비의존 → 단위 테스트 가능).
  - `local` → `DALi Preview — Local` (versionTag 무시)
  - `docker` → `DALi Preview — Docker (${versionTag})`
- `previewManager.ts`의 `show()`에서 `createWebviewPanel`의 고정 title `'DALi Preview'`를 헬퍼 결과로 교체.
  - `ConfigurationService.getInstance().runtimeMode` 와 `.daliVersionTag` 를 읽어 전달.
- 실시간 갱신 로직은 불필요: 모드 전환 명령(`localRuntimeCommand.ts`, `localDockerBootstrap.ts`, `checkUpdateCommand.ts`)은 모드 변경 후 **창을 리로드**하므로 패널이 재생성되고, `show()` 시점 config 읽기로 항상 최신 모드를 반영한다. (YAGNI)

## 테스트
- `runtimePanelTitle` 단위 테스트:
  - local 모드 → `DALi Preview — Local`
  - docker 모드 + 태그 → `DALi Preview — Docker (dali_2.5.26)`

## 범위 밖
- 상태 표시줄에도 런타임 표시하기 — 이번엔 패널 제목만.
- 모드 변경 시 리로드 없이 패널 제목을 실시간 갱신하기 — 현재 모든 전환 경로가 리로드하므로 불필요.
