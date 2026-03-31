# DALi UI Preview for VS Code

[English](README.md) | [한국어](README.ko.md)

**SwiftUI, Jetpack Compose, Flutter 수준의 라이브 프리뷰 경험을 DALi C++ 환경에서 제공합니다.** dali-ui의 C++ 체이닝 API 코드를 VS Code 안에서 실시간으로 프리뷰합니다.

### v0.1 데모

[vscode-dali-ui-preview_v0.1.webm](https://github.com/user-attachments/assets/72877561-c999-4040-acae-05cf9fb2b16c)

---

## 주요 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| **실시간 프리뷰** | **완료** | 타이핑 중 자동으로 프리뷰 갱신 (debounce 300ms) |
| **dlopen 핫리로드** | **완료** | 상주 서버가 변경된 .so만 리로드 -- 전체 재컴파일 불필요 |
| **Click-to-Code** | **완료** | 프리뷰에서 UI 요소 클릭 시 해당 소스코드 라인으로 이동 |
| **해상도 조절** | **완료** | 프리셋/직접 입력/드래그 리사이즈 |
| **에러 줄 매핑** | **완료** | g++ 에러를 사용자 코드 줄 번호에 맞춰 에디터에 표시 |
| **DALi 자동 감지** | **완료** | 환경변수/setenv 파일에서 DALi 경로 자동 탐색 |
| **멀티 프리뷰** | Phase 2 | 여러 해상도/테마를 동시에 나란히 표시 |
| **다크/라이트 모드** | Phase 2 | 다크/라이트 테마 전환 프리뷰 |
| **커스텀 폰트** | Phase 3 | TTF/OTF 폰트 파일 업로드 및 프리뷰 적용 |
| **로케일 전환** | Phase 3 | 다른 언어/로케일 설정으로 프리뷰 |
| **위젯 Inspector** | Phase 3 | 컴포넌트 트리 뷰 + 속성 검사 |
| **Code-to-Preview** | Phase 3 | 코드 클릭 시 프리뷰에서 해당 요소 하이라이트 |
| **스크린샷 테스트** | Phase 3 | 골든 이미지 비교 기반 시각 회귀 테스트 |
| **인터랙티브 모드** | Phase 4 | VNC를 통한 클릭/스크롤/입력 인터랙션 |
| **애니메이션 프리뷰** | Phase 4 | 애니메이션 재생 컨트롤 |
| **실기기 프리뷰** | Phase 4 | SDB를 통해 Tizen 실기기에서 프리뷰 |

## 타 프레임워크 비교

| | DALi Preview | SwiftUI | Compose | Flutter | Qt QML |
|---|:---:|:---:|:---:|:---:|:---:|
| 실시간 프리뷰 | O | O | O | O | O |
| 갱신 속도 | ~0.5초 (dlopen) | <0.5초 | <1초 | ~0.2초 | <0.5초 |
| 멀티 프리뷰 | Phase 2 | O | O | 실험적 | 부분 |
| 다크/라이트 전환 | Phase 2 | O | O | O | O |
| 커스텀 폰트 | Phase 3 | O | O | O | O |
| 인터랙티브 | Phase 4 | O | O | O | O |
| 위젯 Inspector | Phase 3 | O | O | O | O |
| 애니메이션 도구 | Phase 4 | O | O | 부분 | O |
| 실기기 프리뷰 | Phase 4 | O | O | O | O |

## 알려진 한계

- **C++ 컴파일 오버헤드** -- dlopen 방식으로도 복잡한 코드 변경 시 ~0.5초 소요 (JIT 기반 프레임워크는 ~0.2초). 단순 체이닝 코드는 C++ 파서(Phase 4)로 ~200ms 달성 가능.
- **주석 기반 마커** -- C++에는 `@Preview` 어노테이션이 없어 `// @dali-preview-begin/end` 주석으로 프리뷰 영역을 지정. IDE 수준의 자동완성이나 타입 검사 지원 불가.
- **제한적 양방향 편집** -- Inspector에서 값(색상, 크기, 텍스트) 변경은 정규식 치환으로 가능하지만, 메서드 추가/제거 같은 구조적 코드 편집은 C++ 구문 트리 수정이 필요해 Swift/Kotlin/Dart 대비 어려움.
- **Linux 전용** -- 헤드리스 렌더링에 Xvfb가 필요. Windows/Mac 지원은 DALi WebAssembly 포팅이 선행되어야 함.

## 사전 요구사항

| 항목 | 설치 방법 | 비고 |
|------|----------|------|
| **Ubuntu 22.04+** | -- | 다른 Linux 배포판도 가능할 수 있음 |
| **DALi 빌드 환경 (dali-ui 포함)** | 필수 | `dali-env/opt` (dali-core, dali-adaptor, **dali-ui** (dali-ui-foundation, dali-ui-components)) |
| **g++, Xvfb, ccache** | 자동 설치 | Extension 첫 실행 시 누락된 도구를 감지하고 자동 설치 |

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
2. 프리뷰 패널이 자동으로 열리고, 타이핑하는 대로 결과가 갱신됩니다.

## 사용법

### 전용 프리뷰 파일

`.preview.dali.cpp`로 끝나는 파일을 만들면 됩니다. 파일 전체 내용이 `View CreatePreviewUI()` 함수의 본문으로 사용됩니다.

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
| `daliPreview.daliPrefix` | `string` | `""` | DALi 설치 경로. 비워두면 자동 감지 |
| `daliPreview.previewWidth` | `number` | `1024` | 프리뷰 너비 (px) |
| `daliPreview.previewHeight` | `number` | `600` | 프리뷰 높이 (px) |
| `daliPreview.livePreview` | `boolean` | `true` | 실시간 프리뷰 활성화 (타이핑 중 자동 갱신) |
| `daliPreview.livePreviewDebounce` | `number` | `300` | debounce 간격 ms (100–5000) |

## 라이선스

Apache License 2.0
