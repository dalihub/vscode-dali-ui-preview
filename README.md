# DALi UI Preview for VS Code

[English](README.md) | [한국어](README.ko.md)

**See your Tizen DALi UI as you code.** This extension compiles and renders dali-ui C++ chaining API code on save, showing a live preview right inside VS Code.

### v0.1 Demo

![DALi Preview Demo](images/demo-v0.1.gif)

---

## Features

- **Live preview panel** -- renders your DALi scene inside a VS Code webview on every Ctrl+S
- **Dedicated preview files** -- create `.preview.dali.cpp` files for isolated UI experiments
- **Inline markers** -- add `@dali-preview-begin` / `@dali-preview-end` in any `.cpp` to preview a specific block
- **Resizable canvas** -- change preview resolution via presets, manual input, or drag-resize
- **Headless rendering** -- uses Xvfb so no DALi window appears on screen
- **Fast rebuilds** -- optional ccache integration for sub-second recompilation
- **Smart error display** -- g++ errors are mapped to your code line numbers with in-editor diagnostics
- **Auto-detect DALi** -- automatically finds your DALi installation from environment variables or setenv files

## Prerequisites

| Requirement | Install | Notes |
|---|---|---|
| **Ubuntu 22.04+** | -- | Other Linux distros may work |
| **DALi build environment (including dali-ui)** | Required | `dali-env/opt` with dali-core, dali-adaptor, **dali-ui** (dali-ui-foundation, dali-ui-components) |
| **g++, Xvfb, ccache** | Auto-installed | The extension detects missing tools and installs them on first run |

## DALi Environment

The extension auto-detects `dali-env/opt` from your environment variables (`DESKTOP_PREFIX`) or `setenv` files.

A DALi Ubuntu backend build environment **including dali-ui** is required. The standard DALi-only environment is not sufficient -- dali-ui (dali-ui-foundation, dali-ui-components) must also be built and installed. An automated one-command setup will be provided in a future release.

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
2. Press **Ctrl+S** -- the preview panel opens automatically with the rendered result.

## Usage

### Dedicated preview files

Create a file ending in `.preview.dali.cpp`. The entire file content is treated as the body of a `View CreatePreviewUI()` function.

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
| `daliPreview.daliPrefix` | `string` | `""` | Path to DALi install prefix (containing `lib/` and `include/`). Auto-detected if empty. |
| `daliPreview.previewWidth` | `number` | `1024` | Preview canvas width in pixels |
| `daliPreview.previewHeight` | `number` | `600` | Preview canvas height in pixels |

## AI-Driven Development

This project is developed using an AI-Driven Development Process. Feature requests and bug reports submitted as GitHub Issues are automatically analyzed, implemented, tested, and released by Claude AI.

**Development Process:**
1. Open a GitHub Issue (feature request or bug report)
2. Claude analyzes the codebase and comments an implementation plan
3. You approve with `@claude implement`
4. Claude implements and creates a **test release** (pre-release `.vsix`)
5. You install the test release and verify
6. If approved, the change is promoted to an **official release**

## Testing

All changes are automatically tested before release:

- **Unit tests** -- code extraction logic, error parsing, harness generation
- **Build pipeline tests** -- harness template substitution and compilation commands
- **Integration tests** -- extension activation, commands, webview messaging
- **E2E tests** -- actual DALi rendering with golden image comparison

No code is released without passing all tests.

## Roadmap

- Real-time preview (live as you type)
- Component Tree viewer and Property Editor
- Automated DALi environment one-command setup
- VS Code Marketplace publishing

## License

Apache License 2.0
