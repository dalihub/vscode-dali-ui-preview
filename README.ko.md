# DALi UI Preview for VS Code

[English](README.md) | [한국어](README.ko.md)

**DALi UI 코드를 작성하고 Ctrl+S만 누르면 바로 옆에서 렌더링 결과를 확인하세요.** dali-ui의 C++ 체이닝 API 코드를 컴파일하고 렌더링하여 VS Code 안에서 프리뷰를 보여주는 Extension입니다.

<!-- TODO: 스크린샷 / 데모 GIF 추가 -->
<!-- ![DALi Preview 데모](images/demo.gif) -->

---

## 주요 기능

- **실시간 프리뷰 패널** -- Ctrl+S를 누르면 DALi 씬이 VS Code 옆 패널에 렌더링됩니다
- **전용 프리뷰 파일** -- `.preview.dali.cpp` 파일로 독립적인 UI 실험이 가능합니다
- **인라인 마커** -- 기존 `.cpp` 파일에 `@dali-preview-begin/end` 마커를 넣으면 해당 블록만 프리뷰합니다
- **해상도 조절** -- 프리셋 선택, 직접 입력, 드래그 리사이즈로 프리뷰 크기를 변경합니다
- **화면에 창 안 뜸** -- Xvfb 가상 디스플레이에서 렌더링하므로 DALi 윈도우가 보이지 않습니다
- **빠른 재빌드** -- ccache 적용 시 두 번째 빌드부터 1초 이내
- **에러 표시** -- g++ 에러를 사용자 코드 줄 번호에 맞춰 에디터에 빨간 밑줄로 표시합니다
- **DALi 자동 감지** -- 환경변수, setenv 파일에서 DALi 경로를 자동으로 찾습니다

## 사전 요구사항

| 항목 | 설치 방법 | 비고 |
|------|----------|------|
| **Ubuntu 22.04+** | -- | 다른 Linux 배포판도 가능할 수 있음 |
| **DALi 빌드 환경** | 필수 | `dali-env/opt` (dali-core, dali-adaptor, dali-ui) |
| **g++, Xvfb, ccache** | 자동 설치 | Extension 첫 실행 시 누락된 도구를 감지하고 자동 설치합니다 |

## DALi 환경

Extension은 환경변수 (`DESKTOP_PREFIX`) 또는 `setenv` 파일에서 `dali-env/opt`를 자동으로 찾습니다.

DALi Ubuntu 백엔드 빌드 환경이 필요합니다. 향후 릴리즈에서 원커맨드 자동 설치를 제공할 예정입니다.

## 설치

### 방법 1: 원클릭 스크립트 (권장)

```bash
curl -fsSL https://raw.githubusercontent.com/dalihub/vscode-dali-ui-preview/main/install.sh | bash
```

### 방법 2: GitHub Releases에서 다운로드

1. [Releases](https://github.com/dalihub/vscode-dali-ui-preview/releases) 페이지에서 최신 `.vsix` 파일 다운로드
2. 설치:
   ```bash
   code --install-extension dali-preview-*.vsix
   ```

### 방법 3: 소스에서 빌드

```bash
git clone https://github.com/dalihub/vscode-dali-ui-preview.git
cd dali-preview
npm install
npm run compile
npx vsce package
code --install-extension dali-preview-*.vsix
```

## 빠른 시작

1. `hello.preview.dali.cpp` 파일을 만드세요:
   ```cpp
   return FlexLayout::New()
       .Direction(FlexDirection::COLUMN)
       .AlignItems(FlexAlign::CENTER)
       .SetRequestedWidth(MATCH_PARENT)
       .SetRequestedHeight(MATCH_PARENT)
       .SetBackgroundColor(UiColor(0x1a1a2e))
       .Children({
           Label::New("Hello DALi!")
               .SetFontSize(32)
               .SetTextColor(UiColor(0xFFFFFF)),
       });
   ```
2. **Ctrl+S**를 누르세요 -- 오른쪽에 프리뷰 패널이 자동으로 열리며 렌더링 결과가 표시됩니다.

## 사용법

### 전용 프리뷰 파일

`.preview.dali.cpp`로 끝나는 파일을 만들면 됩니다. 파일 전체 내용이 `View CreatePreviewUI()` 함수의 본문으로 사용됩니다.

```cpp
// weather-card.preview.dali.cpp
return FlexLayout::New()
    .Direction(FlexDirection::COLUMN)
    .Children({
        Label::New("Seoul Weather").SetFontSize(28),
        View::New().SetBackgroundColor(UiColor(0x4a90d9)).SetRequestedHeight(120.0f),
        Label::New("25 C").SetFontSize(48),
    });
```

### 기존 .cpp 파일에서 마커 사용

`@dali-preview-begin`과 `@dali-preview-end` 주석으로 프리뷰할 코드 블록을 감쌉니다:

```cpp
void MyApp::CreateUI() {
    // @dali-preview-begin
    View card = FlexLayout::New()
        .Direction(FlexDirection::COLUMN)
        .Children({
            Label::New("Profile").SetFontSize(24),
        });
    // @dali-preview-end

    window.Add(card);
}
```

## 설정

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `daliPreview.daliPrefix` | `string` | `""` | DALi 설치 경로 (`lib/`, `include/` 포함). 비워두면 자동 감지 |
| `daliPreview.previewWidth` | `number` | `1024` | 프리뷰 너비 (px) |
| `daliPreview.previewHeight` | `number` | `600` | 프리뷰 높이 (px) |

## AI-Driven Development

이 프로젝트는 AI-Driven Development Process로 개발됩니다. GitHub Issue로 등록된 기능 요청과 버그 리포트를 Claude AI가 자동으로 분석, 구현, 테스트, 릴리즈합니다.

**개발 프로세스:**
1. GitHub Issue 등록 (기능 요청 또는 버그 리포트)
2. Claude가 코드베이스를 분석하고 구현 계획을 코멘트
3. `@claude implement`로 승인
4. Claude가 구현 후 **테스트 릴리즈** (pre-release `.vsix`) 생성
5. 개발자가 테스트 릴리즈를 설치하고 확인
6. 승인하면 **정식 릴리즈**로 반영

## 테스트

모든 변경은 릴리즈 전에 자동 테스트를 통과해야 합니다:

- **단위 테스트** -- 코드 추출, 에러 파싱, 하네스 생성 검증
- **빌드 파이프라인 테스트** -- 하네스 템플릿 치환 및 컴파일 명령 검증
- **통합 테스트** -- Extension 활성화, 명령, Webview 메시지 흐름 검증
- **E2E 테스트** -- 실제 DALi 렌더링 + Golden 이미지 비교

테스트를 통과하지 않은 코드는 릴리즈되지 않습니다.

## 로드맵

- 실시간 프리뷰 (타이핑 중 자동 갱신)
- Component Tree 뷰어 및 Property Editor
- DALi 환경 원커맨드 자동 설치
- VS Code Marketplace 게시

## 라이선스

Apache License 2.0
