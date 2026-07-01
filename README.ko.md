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

## 목차

**시작하기** · [기능](#기능) · [요구 사항](#요구-사항) · [빠른 시작](#빠른-시작) · [설치](#설치) · [런타임 설정하기](#런타임-설정하기)

**프리뷰 작성** · [프리뷰 작성하기](#프리뷰-작성하기) · [지시자 & 멀티 프리뷰](#프리뷰-지시자--멀티-프리뷰) · [AI 코딩 에이전트](#ai-코딩-에이전트와-함께-쓰기)

**레퍼런스** · [명령](#명령) · [설정](#설정) · [문제 해결](#문제-해결) · [이슈 신고하기](#이슈-신고하기) · [참고 & 한계](#참고--한계) · [개발](#개발)

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

**실전 코드**

- 📂 **멀티파일 앱 코드를 그대로 프리뷰** — 다른 `.cpp` 파일에 정의된 헬퍼/팩토리를
  호출하고 주입된 view-model을 읽는 멤버 함수 화면(`Screen::Build()`)이 **재작성 없이**
  프리뷰됩니다: 슬라이서가 cross-file 의존성을 모아 모델용 샘플 데이터를 합성합니다.
  cross-file 컴파일 에러는 *내 실제 파일·라인*(예: `widgets/cards.cpp:38`)으로 매핑됩니다.
- 🕹️ **포커스 프리뷰 (TV / D-pad)** — `// @preview-state: focus=<view>` 는 이미 작성한
  변수로 참조해 한 항목을 키보드 포커스 상태(하이라이트 링)로 렌더합니다.
  `progress=<0..1>` 은 애니메이션을 원하는 프레임에서 엽니다.
- 🎨 **theme / locale / font 가 실제로 적용** — `theme=dark` 는 토큰 색을 다시 입히고,
  `fontScale=1.5` 는 텍스트를 확대하며, `locale=ar` 은 레이아웃을 우→좌로 미러링합니다
  (레이아웃만 — 가짜 번역은 하지 않음).
- 🪧 **정직한 provenance 배지** — 프리뷰가 근사치일 때(샘플 데이터, placeholder 이미지,
  미해결 테마 토큰) 작은 배지가 무엇이 근사인지 정확히 알려 주어, "조용한 보정"이 내 버그처럼
  보이지 않게 합니다.

**번거로움 없는 런타임**

- 🐳 **Docker 런타임 (기본값)** — 내 PC에 DALi를 빌드할 필요 없음. 런타임은 미리 빌드된
  이미지로 제공되어 확장이 자동으로 받아옵니다(~290 MB, 최초 1회).
- 🛠️ **로컬 런타임 (프레임워크 개발자용)** — DALi 자체를 수정한다면 내 빌드를 지정 → 매 렌더마다 새 `.so` 자동 반영.
- 🧭 **가이드 설치** — 확장을 설치하면 곧바로 Docker 설치**와** 런타임 이미지 다운로드를
  안내하고 첫 프리뷰까지 데려갑니다 — 시작하는 데 프리뷰 파일이 필요 없습니다.
- 🔄 **런타임 업데이트** — 새 DALi 런타임 이미지가 올라오면 알림을 받고, 버전 선택기에서 전환.

## 요구 사항

| 요구 사항 | 내용 |
|---|---|
| **OS** | Linux (x86_64). Ubuntu 22.04+ 권장. *Windows / macOS 미지원.* |
| **VS Code** | 1.85.0 이상 |
| **런타임** | **Docker** *(권장 — 별도 설치 불필요)*, **또는** 로컬 DALi 빌드 (dali-core, dali-adaptor, dali-ui) |

둘 중 **하나만** 있으면 됩니다. 잘 모르겠으면 Docker를 고르세요 — 그대로 동작합니다.

## 빠른 시작

> ⚠️ **Docker 모드(기본값)는 두 가지 일회성 단계가 필요합니다: ① Docker 설치, ② 런타임
> 이미지(~290 MB) 다운로드.** 직접 할 필요는 없습니다 — 확장을 설치하면 곧바로 DALi
> Preview가 **물어보고 두 단계를 대신 수행**합니다(승인만 하면 됩니다). 두 단계가 모두
> 끝나기 전에는 프리뷰가 렌더링되지 않습니다. DALi를 직접 빌드한다면 아래
> **⭐ 로컬 DALi 런타임** 섹션을 참고하세요.

1. **확장을 설치**합니다 (아래 [설치](#설치) 참고).
2. **안내가 뜨면 런타임을 설정합니다.** 설치 직후 **Set up DALi Preview** 대화상자가
   뜹니다(프리뷰 파일이 없어도 됩니다). **Set Up Now** 를 누르면:
   - **① Docker가 설치됩니다** — `sudo` 비밀번호를 1회 입력하세요. Ubuntu/Debian에서는
     `setfacl` 로 실행 중인 VS Code 세션에 즉시 소켓 접근 권한을 부여하므로 **재부팅·재시작이
     필요 없습니다.**
   - **② 런타임 이미지가 자동으로 다운로드됩니다**(~290 MB). Docker가 준비되는 즉시 받기
     시작하고, 이후 캐시됩니다.

   *대화상자를 닫았다면?* 다음에 `.preview.dali.cpp` 파일을 열 때 다시 뜨거나, 명령
   팔레트(`Ctrl+Shift+P`)에서 **DALi Preview: Run Setup Walkthrough** 로 다시 열 수 있습니다.
3. 명령 팔레트(`Ctrl+Shift+P`)에서 **DALi Preview: Open Samples** 를 실행하면, 선택한
   폴더에 가이드 샘플 투어가 복사되고 새 창에서 열리며 `README.md` 가 자동으로 표시됩니다.
   `01-your-first-preview/hello.preview.dali.cpp` 부터 열면 옆에 프리뷰 패널이 열립니다.
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

런타임은 두 가지 — **하나만** 고르면 됩니다. 설정에서 가장 중요한 선택입니다:

| 당신은… | 사용 | 무엇인가 |
|---|---|---|
| 👤 **앱 개발자** — DALi *로* UI를 만드는 대부분의 경우 | 🐳 **Docker** *(기본값)* | **미리 빌드된 런타임 컨테이너**를 받습니다 — 내 머신에 DALi 빌드 불필요. 한 번만: Docker 설치 + 이미지(~290 MB) 다운로드(둘 다 안내됨). |
| 🛠️ **DALi 프레임워크(uifw) 개발자** — DALi 자체를 수정 | ⭐ **Local** | **직접 빌드한 DALi**로 렌더 → 방금 빌드한 `.so` 가 프리뷰에 바로 반영. 호스트에 `g++`/`Xvfb`/`pkg-config` + DALi prefix 필요. |

**잘 모르겠다면 Docker — 그냥 됩니다.** 각 런타임 단계별 안내는 아래에 있습니다.

### Docker 런타임 *(앱 개발자 권장)*

DALi 런타임이 미리 빌드된 컨테이너 이미지로 제공되므로, DALi를 직접 빌드하지 않습니다.
**두 가지 일회성 단계가 필수**이며, 확장이 설치 직후(그리고 설정이 끝나기 전 프리뷰 파일을
열 때마다) 두 단계를 모두 안내합니다:

| | 단계 | 방법 |
|---|---|---|
| **①** | **Docker 설치** | 설정 안내의 **Set Up Now** 클릭(또는 **DALi Preview: Install Docker via Terminal** 실행). `sudo` 비밀번호 1회 입력. Ubuntu/Debian에서는 `setfacl` 로 실행 중인 VS Code 세션에 즉시 소켓 접근 권한을 부여하므로 **재부팅·재시작 불필요.** |
| **②** | **런타임 이미지(~290 MB) 다운로드** | Docker가 준비되면 **자동으로** 시작 — 또는 **DALi Preview: Download Runtime Image** 로 직접 받기. 최초 1회 받은 뒤 캐시되므로 기다리는 건 이때뿐입니다. |

> **두 단계가 모두 끝나야 프리뷰가 렌더링됩니다.** 그 전에는 docker 설정 안내 팝업이 뜨거나,
> 프리뷰 패널에 *"Docker is not available"* 인라인 메시지로 남은 단계를 알려 줍니다.

런타임 상태는 언제든 확인·복구할 수 있습니다:

- **DALi Preview: Verify Docker Access** — Docker 접근 가능 여부 확인, "permission denied"
  세션을 재부팅 없이 복구.
- **DALi Preview: Clean Runtime Images** — 디스크 비우기.
- **DALi Preview: Reset Extension** — 컨테이너·이미지·캐시를 제거하고 처음부터 다시 시작
  (코드·설정·Docker 설치는 그대로).

### ⭐ 로컬 DALi 런타임 — DALi 프레임워크(uifw) 개발자용

> **📌 중요.** **DALi 자체를 수정**하면서 *내 빌드*를 프리뷰로 확인하고 싶을 때 씁니다.
> 앱 개발자는 위의 Docker를 쓰세요. 로컬 모드에선 매 프리뷰를 호스트에서
> (`g++` + `pkg-config`) 내 DALi 설치에 대해 컴파일하고 Xvfb로 렌더링합니다 — **매번 새
> 프로세스**라서, 방금 다시 빌드한 `libdali2-*.so` 가 **다음 렌더에 자동 반영**됩니다
> (이미지 재빌드도, 재시작도 없음).

**로컬 DALi 폴더 지정 방법**

1. 명령 팔레트(`Ctrl+Shift+P`) → **DALi Preview: Use Local DALi Runtime**.
2. **폴더 선택 다이얼로그**가 뜹니다(자동 탐지된 경로가 있으면 거기로 미리 열림).
   **DALi 설치 prefix** — `lib/libdali2-core.so` 와 `lib/pkgconfig/dali2-ui-foundation.pc`
   가 들어 있는 폴더(보통 `…/dali-env/opt`)를 고르세요. `dali-env/opt` 를 포함하는
   **상위 폴더**를 골라도 알아서 해석합니다.
3. 경로가 **`daliPreview.daliPrefix`** 에 저장되고 `runtimeMode` 가 `local` 로 바뀐 뒤
   창이 새로고침됩니다. 이제 `.preview.dali.cpp` 를 저장하면 내 DALi로 렌더링됩니다.

DALi를 다시 빌드했나요? **다시 저장**(또는 새로고침)만 하면 새 `.so` 가 자동 반영됩니다.

**자동 탐지 순서** (대개 폴더를 직접 안 골라도 됨):

1. `daliPreview.daliPrefix` 설정(명시적 지정);
2. **`DESKTOP_PREFIX`** 환경변수 — dali-env 의 `setenv` 가 export 하는 바로 그 값이라,
   `source setenv` 후 VS Code 를 실행하면 잡힙니다;
3. 워크스페이스 폴더의 **`setenv`** 파일(`DESKTOP_PREFIX=…`);
4. **공용/시스템 설치** — `pkg-config` 에 등록된 위치, 그다음 `/opt/dali` 같은 공통 경로.

홈/프로젝트 디렉터리는 **일부러 스캔하지 않습니다** — 공용 도구라 특정 개인의 프로젝트
빌드를 자동 선택하지 않게요. 호스트 전제조건: `g++`, `Xvfb`, `pkg-config`(없으면 무엇이
빠졌는지 알려 줍니다). Docker로 (되)전환하려면 **DALi Preview: Select Runtime Version** 으로
컨테이너 버전을 고르세요.

> 속도: 로컬 모드는 **네이티브 상주 프리뷰 서버**(번들된 `preview_server.cpp` 를 내 prefix로
> 컴파일)를 띄워서, 프리뷰 코드 편집 시 dlopen/parser 빠른 경로 + **애니메이션 스크럽**까지
> Docker와 동일하게 동작합니다 — 매번 풀 빌드하지 않습니다. DALi를 다시 빌드(`make install`)하면
> `…/lib/libdali2-*.so` 워처가 서버를 자동 재시작(또는 **DALi Preview: Restart DALi Runtime**)
> 해서 새 빌드를 로드합니다.

## 프리뷰 작성하기

### 프리뷰 파일

**`.preview.dali.cpp`** 로 끝나는 파일은 프리뷰 함수의 본문으로 취급됩니다 — 뷰를 만들어 `return` 하면 됩니다. dali-ui 의 setter 는 `void` 를 반환하므로(플루언트 체이닝 API 가 제거됨) 각 속성을 개별 문장으로 설정하고 자식은 `AddChildren` 으로 추가합니다:

```cpp
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x1e1e2e));

Label title = Label::New("Hello, DALi!");
title.SetFontSize(48);
title.SetTextColor(UiColor(0xFFFFFF));

root.AddChildren({ title });
return root;
```

### 이미지

`ImageView`(및 `SetResourceUrl`)는 **로컬 이미지 파일**을 불러올 수 있습니다.
**프리뷰 파일 기준 상대경로**를 주면 확장이 에셋을 런타임에 자동으로 staging합니다 —
Docker 모드에선 파일을 컨테이너로 복사하므로 직접 마운트할 필요가 없습니다:

```cpp
// 프리뷰 파일:  ui/home.preview.dali.cpp
// 디스크 에셋:   ui/assets/banner.jpg
ImageView hero = ImageView::New("assets/banner.jpg");
hero.SetRequestedWidth(MATCH_PARENT);
hero.SetRequestedHeight(420.0f);
```

디스크에 존재하는 절대경로도 동작합니다. 원격 URL(`https://…`)이나 해결할 수 없는
경로는 회색 broken-image placeholder로 대체되어 레이아웃 박스는 유지됩니다.

### 기존 파일 안의 마커

일반 `.cpp`/`.h` 파일 안의 영역을 프리뷰하려면 마커 주석으로 감쌉니다:

```cpp
void MyApp::CreateUI() {
    // @dali-preview-begin
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::COLUMN);

    Label profile = Label::New("Profile");
    profile.SetFontSize(24);

    root.AddChildren({ profile });
    return root;
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
| `theme` | `light` \| `dark` | 배경 **+ 토큰 색 reskin** (`UiColor::PRIMARY`, `UiColor("…")`) |
| `fontScale` | `0.5`–`2.0` | `_spx` 단위 텍스트 스케일 (큰 글꼴 오버플로 조기 발견) |
| `locale` | 예: `ar`, `ko_KR` | RTL 로케일이면 레이아웃 좌우 미러; `LANG` 설정 |
| `font` | 파일명 | `daliPreview.fontDirectories` 의 폰트 사용 |
| `animation` | `true` \| `false` | 애니메이션 재생 컨트롤 표시 — `.Play()` 로 움직이는 영역을 스크럽 |
| `duration` | ms | 스크러버용 애니메이션 길이 |

**프리셋** — `// @preview-preset: light-dark` (또는 `locales`, `font-sizes`,
`screen-sizes`)는 여러 config 변형으로 확장되어 갤러리에 나란히 표시됩니다.

#### 기타 디렉티브

```cpp
// @dali-preview                      // 다음 인자 없는 팩토리를 프리뷰 진입점으로 표시
View MakeHomePreview() { return HomeScreen(SampleVM()).Build(); }

// @preview-state: focus=card2        // card2 를 포커스된 상태(하이라이트 링)로 렌더
// @preview-state: progress=0.4       // 애니메이션을 40% 프레임에서 열기
```

- **`// @dali-preview`** — Compose 의 매개변수 없는 `@Preview` 와 같은 개념: 인자 없는
  팩토리를 표시하면 반환값을 렌더(슬라이서가 헬퍼를 끌어옴) → view-model 이 필요한
  화면도 프리뷰 가능.
- **`// @preview-state: focus=<view>`** — 한 항목을 포커스 상태로(`<view>`=코드의 변수명).
  `progress=<0..1>` 는 애니메이션 프레임 선택. (`focus` 와 `progress` 는 한 렌더에서 배타.)

## AI 코딩 에이전트와 함께 쓰기

VS Code의 AI 에이전트(GitHub Copilot, Cursor, Claude 등)가 DALi UI를 대신 작성할 수 있습니다.
하지만 이 확장의 프리뷰 패널은 **사람만 볼 수 있는 webview** — 에이전트는 못 읽습니다. 그래서
에이전트는 **companion [`dali-ui-preview-cli`](https://github.com/dalihub/dali-ui-preview-cli)로
자기 작업을 검증**해야 합니다. CLI는 같은 화면을 헤드리스로 **PNG + JSON 씬 트리(에이전트가 읽을
수 있는 형태)** 로 렌더하므로, 작성 → 렌더 → 읽기 → 수정 루프를 돌 수 있습니다.

**DALi Preview: Add AI Agent Guide** (`Ctrl+Shift+P`)로 이를 설정하세요. 워크스페이스 루트에
**`AGENTS.md`**(Copilot/Cursor/Claude가 공통으로 읽는 크로스툴 지침 파일)를 작성/갱신하며, 바로
그 내용을 가르칩니다: **CLI로 검증**, 프리뷰 가능 파일 규약(`*.preview.dali.cpp`, `@dali-preview`
마커), **비-fluent dali-ui API**, 헷갈리기 쉬운 타입. DALi 블록만 관리하므로 기존 `AGENTS.md`
내용은 보존됩니다.

한편 **사람**은 에이전트가 편집하는 동안 라이브 패널을 그대로 받습니다 — 페어링하며 방향을 잡을 때 유용합니다.

## 명령

명령 팔레트(`Ctrl+Shift+P`)에서 **DALi** 를 입력하세요.

| 명령 | 설명 |
|---|---|
| **Open Preview** | 활성 파일의 프리뷰 패널 열기 |
| **Preview Function** | 커서 위치의 함수 프리뷰 |
| **Use Local DALi Runtime** | **로컬 모드 — DALi prefix 폴더 선택(프레임워크 개발자용)** |
| **Select Runtime Version** | **Docker 모드 — 컨테이너/DALi 버전 선택(로컬에서 실행 시 Docker로 전환)** |
| **Open Samples** | 가이드 샘플 투어를 폴더에 복사해 열기(여기서 시작) |
| **Run Setup Walkthrough** | 가이드 설치 다시 열기 |
| **Install Docker via Terminal** | **① Docker 설치** (`sudo` 비밀번호 1회, 재부팅 없음) |
| **Download Runtime Image** | **② DALi 런타임 이미지 받기** (~290 MB) |
| **Verify Docker Access** | Docker 접근 확인; "permission denied" 세션 복구 |
| **Toggle Theme** | 프리뷰 다크/라이트 전환 |
| **Check for Runtime Image Update** | 레지스트리와 이미지 비교 |
| **Clean Runtime Images** | 캐시된 런타임 이미지 삭제로 디스크 정리 |
| **Reset Extension** | 컨테이너 · 이미지 · 캐시 제거 후 초기화 |
| **Open Settings** | 확장 설정으로 이동 |
| **Add AI Agent Guide** | AI 에이전트가 프리뷰 가능한 DALi 코드를 쓰도록 `AGENTS.md` 작성/갱신 |
| **Report Issue** | 환경 정보가 채워진 GitHub 버그 리포트 열기 |

## 설정

| 설정 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `daliPreview.runtimeMode` | `docker` \| `local` | `docker` | 프리뷰 빌드 위치. `docker`는 호스트 DALi 설치 불필요; `local`은 호스트 DALi로 컴파일(프레임워크 개발자). |
| `daliPreview.daliPrefix` | string | `""` | **로컬 모드** — DALi 설치 prefix 경로. 비우면 자동 감지(`DESKTOP_PREFIX` / 워크스페이스 `setenv` / 시스템 설치). 보통 **Use Local DALi Runtime** 이 대신 설정. |
| `daliPreview.dockerImage` | string | `ghcr.io/lwc0917/dali-preview-runtime` | docker 모드에서 사용할 런타임 이미지. |
| `daliPreview.daliVersionTag` | string | `latest` | 런타임 이미지 태그(DALi 버전). `latest` 는 롤링 태그를 따름. |
| `daliPreview.runtimeUpdatePolicy` | `off` \| `notify` \| `auto` | `notify` | 새 런타임 이미지 처리 방식(하루 1회 확인, docker 모드). |
| `daliPreview.previewWidth` | number | `1920` | 기본 캔버스 너비 (px). |
| `daliPreview.previewHeight` | number | `1080` | 기본 캔버스 높이 (px). |
| `daliPreview.background` | `dark` \| `light` \| `checker` | `dark` | 렌더된 프리뷰 뒤 배경 스타일. |
| `daliPreview.livePreview` | boolean | `true` | 타이핑 중 자동 재렌더링. |
| `daliPreview.livePreviewDebounce` | number | `0` | 키 입력과 재렌더링 사이 debounce(ms). `0` = 매 키 입력. |
| `daliPreview.fontDirectories` | string[] | `[]` | 커스텀 TTF/OTF 폰트 디렉터리(로컬 모드에서 적용). |
| `daliPreview.logLevel` | `error`…`trace` | `info` | **DALi Preview** 출력 채널 로그 상세도. |

## 문제 해결

- **설정 안내가 안 떴거나, 닫아버렸음** — Docker 모드는 Docker 설치**와** 런타임 이미지
  다운로드가 **모두** 끝나야 렌더링됩니다. `.preview.dali.cpp` 파일을 열면(예: **DALi
  Preview: Open Samples**) 안내가 다시 뜨고, **DALi Preview: Run Setup Walkthrough** 로도
  열 수 있습니다. 수동으로 하려면 **DALi Preview: Install Docker via Terminal** 후
  **DALi Preview: Download Runtime Image** 를 실행하세요.
- **프리뷰가 자동으로 안 열림** — `Ctrl+S` 를 한 번 눌러 첫 렌더링을 트리거하거나
  **DALi Preview: Open Preview** 를 실행하세요.
- **첫 Docker 프리뷰가 느림** — ~290 MB 런타임 이미지를 받는 중입니다. 최초 1회뿐이며 이후
  프리뷰는 즉시 시작됩니다. **Download Runtime Image** 로 미리 받아둘 수 있습니다.
- **"permission denied … docker.sock"** — **DALi Preview: Verify Docker Access** →
  *Fix for this session* 을 실행하세요. (`setfacl` 가 실행 중인 세션에 권한을 다시 부여.)
- **로컬 모드 "DALi not found"** — `daliPreview.daliPrefix` 가 `lib/libdali2-core.so` 와
  `lib/pkgconfig/dali2-ui-foundation.pc` 가 있는 폴더를 가리키는지 확인하세요
  (**DALi Preview: Use Local DALi Runtime** 으로 다시 지정 가능).
- **로그 위치** — **DALi Preview** 출력 채널. `daliPreview.logLevel` 을 `debug`(구조화 JSON은
  `trace`)로 올리고 `[Perf]` 줄에서 어떤 렌더링 경로가 동작했는지 확인하세요.

## 이슈 신고하기

버그를 만났나요? **DALi Preview: Report Issue** (`Ctrl+Shift+P`)를 실행하면 짧은 템플릿과
**환경 정보**(확장/VS Code/OS 버전, 런타임 모드, 런타임 이미지)가 **자동으로 채워진** GitHub
이슈가 열립니다 — 증상만 적고 제출하면 됩니다. VS Code 확장 페이지의 기본 **Report Issue**
(톱니 메뉴)나 [이슈 트래커](https://github.com/dalihub/vscode-dali-ui-preview/issues)에서 직접
신고할 수도 있습니다. 신고 전에 `daliPreview.logLevel` 을 `debug` 로 두고 재현한 뒤 **DALi
Preview** 출력 채널의 관련 줄을 붙여 넣으면 도움이 됩니다.

## 참고 & 한계

- **Linux 전용.** 헤드리스 렌더링에 Xvfb를 사용합니다. Windows/macOS는 DALi WebAssembly 포팅이 선행되어야 합니다.
- **로컬 런타임도 상주 네이티브 서버로 빠른 경로 + 애니메이션 스크럽**을 Docker와 동일하게
  제공합니다. DALi 재빌드 후엔 lib 워처(또는 **Restart DALi Runtime**)가 서버를 재시작해 새
  빌드를 로드합니다. 아주 큰 캔버스는 호스트 Xvfb 화면 크기에 제한됩니다. 커스텀 폰트는 로컬
  모드에서 적용되며, Docker 모드에서는 현재 건너뜁니다.
- 프리뷰는 앱 전체가 아니라 **추출된 영역**(여러분이 `return` 한 본문)을 렌더링합니다.

## 개발

```bash
npm install
npm run compile      # TypeScript → out/
npm run test:unit    # 유닛 테스트
npm run test:e2e     # 골든 스크린샷 테스트 (Docker 런타임으로 렌더)
```

### Push 전 검사 (pre-push)

골든 스크린샷 테스트는 **로컬 Docker DALi 런타임**으로 렌더합니다. github-hosted CI는
복잡한 DALi 씬을 안정적으로 못 그리므로(GPU 없음, 소프트웨어 GL), 클라우드 대신
**런타임이 구성된 머신에서 push 시점에** 검증합니다. clone마다 한 번 활성화:

```bash
npm run hooks:install   # core.hooksPath = .githooks 설정
```

`git push`마다 compile → 유닛 → 골든 스위트를 돌리고 실패 시 push를 중단합니다.
`git push --no-verify`로 전체를, `SKIP_E2E=1 git push`로 (느린) 렌더만 건너뛸 수
있습니다. 같은 스위트를 클라우드에서 수동 실행하려면 **Golden Screenshot Tests**
워크플로(Actions → Run workflow)를 쓰세요. 유닛 테스트는 매 push마다 클라우드 CI에서 돕니다.

## 변경 이력

[CHANGELOG.md](CHANGELOG.md) 참고.

## 라이선스

Apache License 2.0
