# DALi UI Preview for VS Code

[English](README.md) | [한국어](README.ko.md)

**Live UI preview for Tizen DALi C++ applications, bringing the same preview experience as SwiftUI, Jetpack Compose, and Flutter to the DALi ecosystem.**

### v0.1 Demo

[vscode-dali-ui-preview_v0.1.webm](https://github.com/user-attachments/assets/72877561-c999-4040-acae-05cf9fb2b16c)

---

## Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Live preview** | **Done** | Preview renders automatically as you type (debounce 300ms) |
| **dlopen hot-reload** | **Done** | Resident server reloads only the changed `.so` -- no full recompilation |
| **Click-to-Code** | **Done** | Click any element in the preview to jump to its source line |
| **Resizable canvas** | **Done** | Change resolution via presets, manual input, or drag-resize |
| **Error mapping** | **Done** | g++ errors mapped to your code line numbers with in-editor diagnostics |
| **Auto-detect DALi** | **Done** | Finds DALi installation from environment variables or setenv files |
| **Multi-preview** | Phase 2 | View multiple resolutions/themes side by side |
| **Dark/Light mode** | Phase 2 | Toggle dark/light theme for preview |
| **Custom fonts** | Phase 3 | Upload TTF/OTF fonts and apply to preview |
| **Locale switching** | Phase 3 | Preview with different language/locale settings |
| **Widget Inspector** | Phase 3 | Component tree view with property inspection |
| **Code-to-Preview** | Phase 3 | Click code to highlight the corresponding element in preview |
| **Screenshot testing** | Phase 3 | Golden image comparison for visual regression testing |
| **Interactive mode** | Phase 4 | Click, scroll, and interact with the preview via VNC |
| **Animation preview** | Phase 4 | Preview animations with playback controls |
| **Device preview** | Phase 4 | Deploy and preview on real Tizen devices via SDB |

## How Other Frameworks Compare

| | DALi Preview | SwiftUI | Compose | Flutter | Qt QML |
|---|:---:|:---:|:---:|:---:|:---:|
| Live preview | O | O | O | O | O |
| Refresh speed | ~0.5s (dlopen) | <0.5s | <1s | ~0.2s | <0.5s |
| Multi-preview | Phase 2 | O | O | Exp. | Partial |
| Dark/Light toggle | Phase 2 | O | O | O | O |
| Custom fonts | Phase 3 | O | O | O | O |
| Interactive | Phase 4 | O | O | O | O |
| Widget Inspector | Phase 3 | O | O | O | O |
| Animation tools | Phase 4 | O | O | Partial | O |
| Device preview | Phase 4 | O | O | O | O |

## Known Limitations

- **C++ compilation overhead** -- Even with dlopen, complex code changes require ~0.5s (vs ~0.2s in JIT-based frameworks). Simple chaining code can reach ~200ms with the C++ parser (Phase 4).
- **Comment-based markers** -- C++ has no `@Preview` annotation, so preview regions are marked with `// @dali-preview-begin/end` comments. No IDE-level autocomplete or type-checking for markers.
- **Limited bidirectional editing** -- Changing values (colors, sizes, text) from an Inspector is feasible via regex substitution, but structural code modifications (adding/removing methods) require C++ syntax tree manipulation which is significantly harder than in Swift/Kotlin/Dart.
- **Linux only** -- Requires Xvfb for headless rendering. Windows/Mac support would require a DALi WebAssembly port.

## Prerequisites

| Requirement | Install | Notes |
|---|---|---|
| **Ubuntu 22.04+** | -- | Other Linux distros may work |
| **DALi build environment (including dali-ui)** | Required | `dali-env/opt` with dali-core, dali-adaptor, **dali-ui** (dali-ui-foundation, dali-ui-components) |
| **g++, Xvfb, ccache** | Auto-installed | The extension detects missing tools and installs them on first run |

## Installation

### Option 1 -- One-line script (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/dalihub/vscode-dali-ui-preview/main/install.sh | bash
```

### Option 2 -- Download from GitHub Releases

1. Go to the [Releases](https://github.com/dalihub/vscode-dali-ui-preview/releases) page.
2. Download the latest `.vsix` file.
3. Install:
   ```bash
   code --install-extension dali-preview-*.vsix
   ```

### Option 3 -- Build from source

```bash
git clone https://github.com/dalihub/vscode-dali-ui-preview.git
cd dali-preview
npm install
npm run compile
npx vsce package
code --install-extension dali-preview-*.vsix
```

## Quick Start

1. Create a file named `hello.preview.dali.cpp`:
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
2. The preview panel opens automatically and updates as you type.

## Usage

### Dedicated preview files

Create a file ending in `.preview.dali.cpp`. The entire file content is treated as the body of a `View CreatePreviewUI()` function.

### Inline markers in existing .cpp files

Add `@dali-preview-begin` and `@dali-preview-end` comments around any UI code:

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

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `daliPreview.daliPrefix` | `string` | `""` | Path to DALi install prefix. Auto-detected if empty. |
| `daliPreview.previewWidth` | `number` | `1024` | Preview canvas width in pixels |
| `daliPreview.previewHeight` | `number` | `600` | Preview canvas height in pixels |
| `daliPreview.livePreview` | `boolean` | `true` | Enable live preview (auto-update as you type) |
| `daliPreview.livePreviewDebounce` | `number` | `300` | Debounce interval in ms (100–5000) |

## License

Apache License 2.0
