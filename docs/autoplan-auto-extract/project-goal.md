# Project goal

## 한 줄 요약
실전 dali-ui 상용화 앱 프로젝트를 하나 만들고, 자동 의존성 추출(zero-annotation)로 그 앱 코드를 실제로 preview할 수 있는지 — 어느 Rung까지 되는지 — 빌드·렌더로 검증한다.

## 두 갈래 목표
- **(A) 실전 앱 생성**: `samples/` 하위에 dali-ui 미니 상용앱. 이전 리서치의 실전 코드패턴을 의도적으로 적용 — 헬퍼/팩토리 함수(P1/P14), 클래스 멤버 함수 UI 조립(P5), MVVM 모델 주입(P6), 테마 상수(P4), 프로젝트 헤더 분리 #include(P11), for 루프 데이터 바인딩(P2). 즉 **현재 추출기로는 컴파일조차 안 되는** 코드 형태.
- **(B) 자동추출 preview 최소구현 + 검증**: `Docs/auto_extract_strategy_0610.md` §8 착수순서를 따라 3슬롯 템플릿(회귀 0) → Rung2 휴리스틱(같은 파일 헬퍼/타입/상수 인라인 + weak void-stub) → 가능하면 Rung1(clangd 빌려쓰기). (A) 앱이 어디까지 preview되는지 실제 빌드·렌더로 확인.

## 추정 영역
- 도메인: VS Code Extension (TypeScript) + C++ DALi 렌더 하니스. 코드 슬라이싱/의존성 추출/격리 컴파일.
- 핵심 제약: 기존 익스텐션에 **기능 추가**(새 프로젝트 아님). docker 컨테이너 격리 컴파일. 서버(C++) 변경은 이미지 재빌드 필요.

## 사용자가 명시한 out-of-scope / 제약
- 비가역·외부발행 금지: 이미지 push, 릴리즈, 커밋 **push** 금지. 로컬 브랜치 작업만(`autodev/auto-extract-preview`), main 보호.
- 무회귀 필수(CLAUDE.md MANDATORY): `npm run compile` 0에러 + 기존 테스트(현 baseline 579개) 무회귀. 신규 기능은 테스트 동반.
- 사용자 부재: 아무것도 묻지 말 것. 막히면 ✋ 큐에 적고 진행 가능한 다음으로.

## 검증 함정 (반드시 반영 — 코드로 확정된 것)
- `RTLD_NOW` (preview_server.cpp:999): 미정의 심볼은 dlopen 즉사 → 모든 외부 심볼은 **stub 본문** 필수(선언만 불가).
- `docker exec` 마운트 부재 (dockerRuntime.ts:516): 워크스페이스 헤더 마운트 불가 → **정의를 globals 슬롯에 인라인** 우회.
- `#line` ↔ errorParser 파일명 게이트 (errorParser.ts:46/58): `filePath.includes('preview_plugin')` 게이트라 #line으로 파일명 바꾸면 본문 에러 드롭 → 동적 출처집합으로 재설계.
- 현재 24개 샘플 전부 자기완결 single-fn → slice 경로 **미실증** → 비자기완결 테스트 픽스처 선행 필요.
