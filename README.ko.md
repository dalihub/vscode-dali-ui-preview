# DALi UI Preview for VS Code

[English](README.md) | [한국어](README.ko.md)

> **Tizen DALi C++ UI를 VS Code 안에서 실시간으로 — 저장하면 바로 보입니다.**
> 기기도, 에뮬레이터도, 크로스 컴파일도 필요 없습니다. SwiftUI · Jetpack Compose ·
> Flutter에서 익숙한 즉시 프리뷰 경험을 DALi 환경에 그대로 가져왔습니다.

![데모](https://github.com/user-attachments/assets/72877561-c999-4040-acae-05cf9fb2b16c)

`.preview.dali.cpp` 파일에 DALi UI 코드를 작성하면(또는 일반 `.cpp` 안의 영역을 마커로
지정하면), 실제 DALi 런타임으로 한 프레임을 렌더링해 사이드 패널에 보여줍니다. 첫 렌더링
이후 텍스트 수정은 **~100 ms** 만에 반영됩니다.

---

## 기능

**프리뷰 루프**

- ⚡ **실시간 프리뷰** — 타이핑 중과 저장 시 자동 갱신. 첫 렌더링은 몇 초, 이후 수정은
  인-프로세스 빠른 경로로 ~100 ms 만에 반영.
- 🎯 **Click-to-Code & Code-to-Preview** — 프리뷰의 요소를 클릭하면 해당 소스 줄로 이동하고,
  에디터에서 커서를 옮기면 프리뷰의 해당 요소가 하이라이트됩니다.
- 🐞 **에러 줄 매핑** — 컴파일 에러를 빌드 로그가 아니라 *내 소스 줄*에 물결선으로 표시.
- 📐 **해상도 조절** — 프리셋 선택, 정확한 W×H 입력, 패널 가장자리 드래그 — 레이아웃이 재배치됩니다.
- 🌳 **위젯 Inspector** — 접을 수 있는 씬 트리에서 요소별 속성을 확인.
- 🖼️ **멀티 프리뷰** — 한 파일에서 여러 크기 / 테마 / 로케일을 나란히 렌더링.
- 🌗 **테마 전환** — 다크/라이트 전환, 또는 배경색 직접 지정.

**한 걸음 더**

- 🕹️ **인터랙티브 모드 (VNC)** — 패널 안에서 실제 앱을 클릭·스크롤·입력하며 조작.
- 📱 **실기기 프리뷰** — SDB로 실제 Tizen 기기에 빌드해 렌더링.
- 🎞️ **애니메이션 프리뷰** *(실험적)* — 애니메이션 영역을 GIF로 캡처하고 재생 컨트롤 제공.

**번거로움 없는 런타임**

- 🐳 **Docker 런타임 (기본값)** — 내 PC에 DALi를 빌드할 필요 없음. 런타임은 미리 빌드된
  이미지로 제공되어 확장이 자동으로 받아옵니다(~290 MB, 최초 1회).
- 🛠️ **네이티브 런타임** — 이미 `/opt/dali`에 DALi가 있다면 그 경로를 지정해 호스트 GPU로 렌더링.
- 🧭 **가이드 설치** — 내장 walkthrough(단계별 안내)로 설치부터 첫 프리뷰까지 약 5분.
- 🔄 **런타임 업데이트** — 새 DALi 런타임 이미지가 올라오면 알림을 받고, 버전 선택기에서 전환.

## 요구 사항

| | |
|---|---|
| **OS** | Linux (x86_64). Ubuntu 22.04+ 권장. *Windows / macOS 미지원.* |
| **VS Code** | 1.85.0 이상 |
| **런타임** | **Docker** *(권장 — 별도 설치 불필요)*, **또는** 네이티브 DALi 빌드 (dali-core, dali-adaptor, dali-ui) |

둘 중 **하나만** 있으면 됩니다. 잘 모르겠으면 Docker를 고르세요 — 그대로 동작합니다.

## 빠른 시작

1. **확장을 설치**합니다 (아래 [설치](#설치) 참고).
2. 아무 `.cpp` 파일이나 엽니다. **Get started with DALi Preview** walkthrough가 자동으로
   열립니다 — 6단계를 따라가면 Docker를 설정(또는 네이티브 DALi 경로 지정)하고 런타임
   이미지를 받습니다. **DALi Preview: Run Setup Walkthrough** 로 언제든 다시 열 수 있습니다.
3. 명령 팔레트(`Ctrl+Shift+P`)에서 **DALi Preview: Open Sample File** 을 실행하면
   `hello-dali.preview.dali.cpp` 가 워크스페이스에 생성되고 옆에 프리뷰 패널이 열립니다.
4. 라벨을 바꾸고, 색을 바꾸고, **저장**하세요 — 프리뷰가 갱신됩니다.

이게 전부입니다: **작성 → 저장 → 확인**.

## 설치

### 방법 1 — 원라인 설치 스크립트 *(권장)*

```bash
curl -fsSL https://raw.githubusercontent.com/dalihub/vscode-dali-ui-preview/main/install.sh | bash
```

GitHub Releases에서 최신 `.vsix` 를 받아 VS Code에 설치합니다.

### 방법 2 — GitHub Releases에서 직접

1. [Releases](https://github.com/dalihub/vscode-dali-ui-preview/releases) 페이지를 엽니다.
2. 최신 `dali-preview-*.vsix` 를 받습니다.
3. 설치:
   ```bash
   code --install-extension dali-preview-*.vsix
   ```

### 방법 3 — 소스에서 빌드

```bash
git clone https://github.com/dalihub/vscode-dali-ui-preview.git
cd vscode-dali-ui-preview
npm install
npm run compile
npx vsce package
code --install-extension dali-preview-*.vsix
```

## 런타임 설정하기

설치 walkthrough가 자동으로 구성해 주지만, 각 방식이 무엇을 하는지 정리하면 다음과 같습니다.

### Docker 런타임 *(권장)*

DALi 런타임이 미리 빌드된 컨테이너 이미지로 제공되므로, DALi를 직접 빌드하지 않습니다.

1. **Docker 설치** — walkthrough가 명령을 미리 채워 줍니다(`sudo` 비밀번호 1회 입력).
   Ubuntu/Debian에서는 `setfacl` 로 실행 중인 VS Code 세션에 즉시 소켓 접근 권한을 부여하므로
   **재부팅이나 재시작이 필요 없습니다.**
2. **런타임 이미지 받기** — 첫 프리뷰 전에 자동으로, 또는 **DALi Preview: Download Runtime
   Image** 로 직접 받습니다. 이후 캐시되므로 기다리는 건 첫 프리뷰 한 번뿐입니다.

나중에 디스크를 비우려면 **DALi Preview: Clean Runtime Images**, Docker는 그대로 두고 처음부터
다시 시작하려면 **DALi Preview: Reset Extension** 을 사용하세요.

### 네이티브 런타임 *(고급)*

이미 호스트에 DALi를 빌드해 두었다면 **DALi Preview: Use Native DALi Runtime** 으로 전환하고,
설치 prefix(= `lib/libdali2-core.so` 가 들어 있는 폴더)를 지정합니다. 흔한 경로:
`/opt/dali`, `~/dali-env/opt`. 확장이 이를 `daliPreview.daliPrefix` 에 저장하고 검증한 뒤,
누락된 도구(`g++`, `Xvfb`, `ccache`)를 `apt install` 하도록 제안합니다. 네이티브 렌더링은 호스트
GPU를 사용해 큰 캔버스에서 약간 더 빠릅니다.

## 프리뷰 작성하기

### 프리뷰 파일

**`.preview.dali.cpp`** 로 끝나는 파일은 프리뷰 함수의 본문으로 취급됩니다 — 뷰를 `return` 하면 됩니다:

```cpp
return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::CENTER)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x1e1e2e))
    .Children({
        Label::New("Hello, DALi!")
            .SetFontSize(48)
            .SetTextColor(UiColor(0xFFFFFF)),
    });
```

### 기존 파일 안의 마커

일반 `.cpp`/`.h` 파일 안의 영역을 프리뷰하려면 마커 주석으로 감쌉니다:

```cpp
void MyApp::CreateUI() {
    // @dali-preview-begin
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .Children({
            Label::New("Profile").SetFontSize(24),
        });
    // @dali-preview-end
}
```

커서를 DALi 뷰를 반환하는 함수 안에 두고 **DALi Preview: Preview Function** 을 실행하거나,
함수 위에 나타나는 **▶ Preview** CodeLens를 클릭해도 됩니다.

### 프리뷰 지시자 & 멀티 프리뷰

`// @preview-config:` 줄로 렌더링 방식을 제어합니다. **두 개 이상** 작성하면 나란히 렌더링됩니다:

```cpp
// @preview-config: name="Phone"  width=360  height=640  theme=dark
// @preview-config: name="Tablet" width=720  height=1280 theme=light locale=ko_KR
return MyScreen();
```

| 키 | 값 | 용도 |
|---|---|---|
| `name` | 텍스트 *(필수)* | 프리뷰 위에 표시할 라벨 |
| `width` / `height` | px | 이 프리뷰의 캔버스 크기 |
| `theme` | `light` \| `dark` | 배경 / 테마 |
| `locale` | 예: `ko_KR` | 렌더링 시 `LANG` 설정 |
| `font` | 파일명 | `daliPreview.fontDirectories` 의 폰트 사용 |
| `animation` | `true` \| `false` | 애니메이션 GIF 캡처 (실험적) |
| `duration` / `fps` | ms / 프레임 | 애니메이션 길이와 프레임 레이트 |

## 명령

명령 팔레트(`Ctrl+Shift+P`)에서 **DALi** 를 입력하세요.

| 명령 | 설명 |
|---|---|
| **Open Preview** | 활성 파일의 프리뷰 패널 열기 |
| **Preview Function** | 커서 위치의 함수 프리뷰 |
| **Open Sample File** | 시작용 `hello-dali.preview.dali.cpp` 생성 |
| **Run Setup Walkthrough** | 가이드 설치 다시 열기 |
| **Toggle Theme** | 프리뷰 다크/라이트 전환 |
| **Toggle Interactive Mode (VNC)** | 패널 안에서 실제 앱 조작 |
| **Select Target Device** / **Device Preview** | SDB 기기 선택 후 그 기기에서 렌더링 |
| **Select Runtime Version** | DALi 런타임 이미지 태그 선택 |
| **Check for Runtime Image Update** | 레지스트리와 이미지 비교 |
| **Clean Runtime Images** | 캐시된 런타임 이미지 삭제로 디스크 정리 |
| **Reset Extension** | 컨테이너 · 이미지 · 캐시 제거 후 초기화 |
| **Open Settings** | 확장 설정으로 이동 |

## 설정

| 설정 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `daliPreview.runtimeMode` | `docker` \| `native` | `docker` | 프리뷰 빌드 위치. docker는 호스트 DALi 설치 불필요. |
| `daliPreview.daliPrefix` | string | `""` | 네이티브 모드 전용 — DALi 설치 prefix 경로. 비우면 자동 감지. |
| `daliPreview.dockerImage` | string | `ghcr.io/lwc0917/dali-preview-runtime` | docker 모드에서 사용할 런타임 이미지. |
| `daliPreview.daliVersionTag` | string | `latest` | 런타임 이미지 태그(DALi 버전). `latest` 는 롤링 태그를 따름. |
| `daliPreview.runtimeUpdatePolicy` | `off` \| `notify` \| `auto` | `notify` | 새 런타임 이미지 처리 방식(하루 1회 확인). |
| `daliPreview.previewWidth` | number | `1024` | 기본 캔버스 너비 (px). |
| `daliPreview.previewHeight` | number | `600` | 기본 캔버스 높이 (px). |
| `daliPreview.livePreview` | boolean | `true` | 타이핑 중 자동 재렌더링. |
| `daliPreview.livePreviewDebounce` | number | `0` | 키 입력과 재렌더링 사이 debounce(ms). `0` = 매 키 입력. |
| `daliPreview.fontDirectories` | string[] | `[]` | 커스텀 TTF/OTF 폰트 디렉터리(네이티브 모드). |
| `daliPreview.vncPort` / `daliPreview.websocketPort` | number | `5900` / `6080` | 인터랙티브(VNC) 모드 시작 포트. |
| `daliPreview.sdbPath` | string | `""` | `sdb` 경로. 비우면 `PATH` 의 `sdb` 사용. |
| `daliPreview.tizenSysroot` | string | `""` | ARM 기기 크로스 컴파일용 Tizen sysroot. |
| `daliPreview.targetDevice` | string | `""` | 기본 SDB 기기 시리얼 (*Select Target Device* 가 설정). |
| `daliPreview.logLevel` | `error`…`trace` | `info` | **DALi Preview** 출력 채널 로그 상세도. |

## 문제 해결

- **프리뷰가 자동으로 안 열림** — `Ctrl+S` 를 한 번 눌러 첫 렌더링을 트리거하거나
  **DALi Preview: Open Preview** 를 실행하세요.
- **첫 Docker 프리뷰가 느림** — ~290 MB 런타임 이미지를 받는 중입니다. 최초 1회뿐이며 이후
  프리뷰는 즉시 시작됩니다. **Download Runtime Image** 로 미리 받아둘 수 있습니다.
- **"permission denied … docker.sock"** — **DALi Preview: Verify Docker Access** →
  *Fix for this session* 을 실행하세요. (`setfacl` 가 실행 중인 세션에 권한을 다시 부여.)
- **네이티브 모드 "DALi not found"** — `daliPreview.daliPrefix` 가 `lib/libdali2-core.so` 가
  있는 폴더를 가리키는지, `lib/pkgconfig/dali2-*.pc` 가 존재하는지 확인하세요.
- **로그 위치** — **DALi Preview** 출력 채널. `daliPreview.logLevel` 을 `debug`(구조화 JSON은
  `trace`)로 올리고 `[Perf]` 줄에서 어떤 렌더링 경로가 동작했는지 확인하세요.

## 참고 & 한계

- **Linux 전용.** 헤드리스 렌더링에 Xvfb를 사용합니다. Windows/macOS는 DALi WebAssembly 포팅이 선행되어야 합니다.
- **커스텀 폰트와 애니메이션 프리뷰는 네이티브 런타임 기능입니다.** Docker 모드에서는 현재
  건너뜁니다. 애니메이션 내보내기는 `ffmpeg` 도 필요합니다.
- 프리뷰는 앱 전체가 아니라 **추출된 영역**(여러분이 `return` 한 본문)을 렌더링합니다.

## 변경 이력

[CHANGELOG.md](CHANGELOG.md) 참고.

## 라이선스

Apache License 2.0
