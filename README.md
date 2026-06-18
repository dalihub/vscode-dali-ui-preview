# DALi UI Preview for VS Code

[English](README.md) | [한국어](README.ko.md)

> **See your Tizen DALi C++ UI render live inside VS Code — just save and look.**
> No device, no emulator, no cross-compile. The same instant-preview workflow you get
> from SwiftUI, Jetpack Compose, and Flutter, brought to the DALi ecosystem.

![Demo](https://github.com/user-attachments/assets/72877561-c999-4040-acae-05cf9fb2b16c)

You write DALi UI code in a `.preview.dali.cpp` file (or mark a region in any `.cpp`).
The extension renders one frame against a real DALi runtime and shows it in a side
panel. After the first render, text edits update in **~100 ms**.

---

## Features

**The preview loop**

- ⚡ **Live preview** — re-renders as you type and on save. The first render takes a
  couple of seconds; subsequent edits land in ~100 ms via a fast in-process path.
- 🎯 **Click-to-Code & Code-to-Preview** — click any element in the preview to jump to
  its source line; move your cursor in the editor to highlight the matching element.
- 🐞 **Inline error mapping** — compiler errors are mapped back to *your* source lines
  and shown as squiggles, not buried in a build log.
- 📐 **Resizable canvas** — switch resolution with presets, type an exact W×H, or drag
  the panel edge; the layout reflows.
- 🌳 **Widget Inspector** — a collapsible scene tree with per-element property inspection.
- 🖼️ **Multi-preview** — render several sizes / themes / locales side by side from one file.
- 🌗 **Theme toggle** — flip between dark and light, or set a custom background colour.

**Going further**

- 🕹️ **Interactive mode (VNC)** — drive the live app in the panel: click, scroll, type.
- 📱 **Device preview** — build and render on a real Tizen device over SDB.
- 🎞️ **Animation preview** *(experimental)* — capture an animated region as a GIF with
  playback controls.

**Zero-hassle runtime**

- 🐳 **Docker runtime (default)** — no DALi build on your machine. The runtime ships as a
  pre-built image that the extension pulls for you (~290 MB, once).
- 🛠️ **Native runtime** — already have DALi at `/opt/dali`? Point the extension at it and
  render on your host GPU.
- 🧭 **Guided setup** — right after you install the extension it prompts you to install
  Docker **and** download the runtime image, then takes you to your first preview — no
  preview file needed to get started.
- 🔄 **Runtime updates** — get notified when a newer DALi runtime image is published, and
  switch versions from a picker.

## Requirements

| | |
|---|---|
| **OS** | Linux (x86_64). Ubuntu 22.04+ recommended. *Windows / macOS are not supported.* |
| **VS Code** | 1.85.0 or newer |
| **Runtime** | **Docker** *(recommended — nothing else to install)*, **or** a native DALi build (dali-core, dali-adaptor, dali-ui) |

You only need **one** of the two runtimes. If you're not sure, pick Docker — it just works.

## Quick start

> ⚠️ **Docker mode (the default) requires two one-time steps: ① install Docker, and
> ② download the runtime image (~290 MB).** You don't do these by hand — right after you
> install the extension, DALi Preview **prompts you and performs both for you** once you
> approve. Until both are done, previews can't render. Already have a native DALi build?
> See [Native runtime](#native-runtime-advanced).

1. **Install the extension** (see [Installation](#installation) below).
2. **Set up the runtime when prompted.** Right after install, a **Set up DALi Preview**
   dialog appears (no preview file needed). Click **Set Up Now**:
   - **① Docker is installed** — enter your `sudo` password once. On Ubuntu/Debian the
     running VS Code session gets socket access immediately via `setfacl`, so **no reboot
     or reload**.
   - **② The runtime image downloads automatically** (~290 MB) as soon as Docker is ready,
     and is cached after that.

   *Dismissed the dialog?* It returns the next time you open a `.preview.dali.cpp` file, or
   run **DALi Preview: Run Setup Walkthrough** from the Command Palette (`Ctrl+Shift+P`).
3. Run **DALi Preview: Open Sample File** (`Ctrl+Shift+P`). A `hello-dali.preview.dali.cpp`
   is dropped into your workspace and the preview panel opens beside it.
4. Edit a label, change a colour, **save** — the preview updates.

That's the whole loop: **write → save → see**.

## Installation

### Option 1 — One-line installer *(recommended)*

```bash
curl -fsSL https://raw.githubusercontent.com/dalihub/vscode-dali-ui-preview/main/install.sh | bash
```

Downloads the latest `.vsix` from GitHub Releases and installs it into VS Code.
It resolves the release through `github.com` directly — no GitHub API token required, and
no rate-limit `403` errors behind a shared corporate proxy or VPN.

### Option 2 — From GitHub Releases

1. Open the [Releases](https://github.com/dalihub/vscode-dali-ui-preview/releases) page.
2. Download the latest `dali-preview-*.vsix`.
3. Install it:
   ```bash
   code --install-extension dali-preview-*.vsix
   ```

### Option 3 — Build from source

```bash
git clone https://github.com/dalihub/vscode-dali-ui-preview.git
cd vscode-dali-ui-preview
npm install
npm run compile
npx vsce package
code --install-extension dali-preview-*.vsix
```

## Setting up your runtime

The first-run prompt sets up Docker for you (and the walkthrough guides native setup), but
here's what each option does — and exactly what you need in place.

### Docker runtime *(recommended)*

The DALi runtime is a pre-built container image — you don't build DALi yourself.
**Two one-time steps are required**, and the extension prompts you for both right after
install (and again whenever you open a preview file before setup is finished):

| | Step | How |
|---|---|---|
| **①** | **Install Docker** | Click **Set Up Now** on the setup prompt (or run **DALi Preview: Install Docker via Terminal**). Enter your `sudo` password once; on Ubuntu/Debian the running VS Code session gets socket access immediately via `setfacl`, so **no reboot or reload**. |
| **②** | **Download the runtime image (~290 MB)** | Starts **automatically** once Docker is ready — or run **DALi Preview: Download Runtime Image** on demand. Cached after the first download, so this is the only wait. |

> **Both steps must finish before any preview can render.** Until then you'll see the
> docker-setup prompt, or an inline *"Docker is not available"* message in the preview
> panel telling you what's left to do.

Check or fix the runtime anytime:

- **DALi Preview: Verify Docker Access** — confirm Docker is reachable, and fix a
  "permission denied" session without a reboot.
- **DALi Preview: Clean Runtime Images** — free disk.
- **DALi Preview: Reset Extension** — remove containers, images, and caches and start
  fresh (your code, settings, and Docker install are untouched).

### Native runtime *(advanced)*

If you already have DALi built on your host, switch with **DALi Preview: Use Native DALi
Runtime** and point the picker at your install prefix — the folder containing
`lib/libdali2-core.so`. Common prefixes: `/opt/dali`, `~/dali-env/opt`. The extension
saves it to `daliPreview.daliPrefix`, validates it, and offers to `apt install` any missing
tools (`g++`, `Xvfb`, `ccache`). Native rendering uses your host GPU and is a touch faster
on large canvases.

## Writing previews

### Preview files

Any file ending in **`.preview.dali.cpp`** is treated as the body of a preview function —
just `return` your view:

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

### Markers in an existing file

To preview a region inside a regular `.cpp`/`.h` file, wrap it in marker comments:

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

You can also run **DALi Preview: Preview Function** with your cursor inside any function
that returns a DALi view, or click the **▶ Preview** CodeLens that appears above it.

### Preview directives & multi-preview

Add a `// @preview-config:` line to control how a preview is rendered. Provide **two or
more** to render them side by side:

```cpp
// @preview-config: name="Phone"  width=360  height=640  theme=dark
// @preview-config: name="Tablet" width=720  height=1280 theme=light locale=ko_KR
return MyScreen();
```

| Key | Values | Purpose |
|---|---|---|
| `name` | text *(required)* | Label shown above the preview |
| `width` / `height` | px | Canvas size for this preview |
| `theme` | `light` \| `dark` | Background / theme |
| `locale` | e.g. `ko_KR` | Sets `LANG` for the render |
| `font` | filename | Use a font from `daliPreview.fontDirectories` |
| `animation` | `true` \| `false` | Capture an animated GIF (experimental) |
| `duration` / `fps` | ms / frames | Animation length and frame rate |

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and type **DALi**.

| Command | What it does |
|---|---|
| **Open Preview** | Open the preview panel for the active file |
| **Preview Function** | Preview the function under the cursor |
| **Open Sample File** | Drop a starter `hello-dali.preview.dali.cpp` into the workspace |
| **Run Setup Walkthrough** | Reopen the guided setup |
| **Install Docker via Terminal** | **① Install Docker** (one `sudo` password, no reboot) |
| **Download Runtime Image** | **② Pull the DALi runtime image** (~290 MB) |
| **Verify Docker Access** | Confirm Docker is reachable; fix a "permission denied" session |
| **Toggle Theme** | Switch the preview between dark and light |
| **Toggle Interactive Mode (VNC)** | Drive the live app in the panel |
| **Select Target Device** / **Device Preview** | Pick an SDB device and render on it |
| **Select Runtime Version** | Choose a DALi runtime image tag |
| **Check for Runtime Image Update** | Compare your image against the registry |
| **Clean Runtime Images** | Remove cached runtime images to free disk |
| **Reset Extension** | Remove containers, images, and caches and start fresh |
| **Open Settings** | Jump to the extension's settings |

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `daliPreview.runtimeMode` | `docker` \| `native` | `docker` | Where preview builds run. Docker needs no host DALi install. |
| `daliPreview.daliPrefix` | string | `""` | Native mode only — path to your DALi install prefix. Auto-detected if empty. |
| `daliPreview.dockerImage` | string | `ghcr.io/lwc0917/dali-preview-runtime` | Runtime image used in Docker mode. |
| `daliPreview.daliVersionTag` | string | `latest` | Runtime image tag (DALi version). `latest` follows the rolling tag. |
| `daliPreview.runtimeUpdatePolicy` | `off` \| `notify` \| `auto` | `notify` | How to handle a newer runtime image (checked once/day). |
| `daliPreview.previewWidth` | number | `1024` | Default canvas width (px). |
| `daliPreview.previewHeight` | number | `600` | Default canvas height (px). |
| `daliPreview.livePreview` | boolean | `true` | Re-render automatically as you type. |
| `daliPreview.livePreviewDebounce` | number | `0` | Debounce (ms) between keystroke and re-render. `0` = every keystroke. |
| `daliPreview.fontDirectories` | string[] | `[]` | Directories of custom TTF/OTF fonts (native mode). |
| `daliPreview.vncPort` / `daliPreview.websocketPort` | number | `5900` / `6080` | Starting ports for interactive (VNC) mode. |
| `daliPreview.sdbPath` | string | `""` | Path to `sdb`. Empty = use `sdb` from `PATH`. |
| `daliPreview.tizenSysroot` | string | `""` | Tizen sysroot for ARM device cross-compilation. |
| `daliPreview.targetDevice` | string | `""` | Default SDB device serial (set by *Select Target Device*). |
| `daliPreview.logLevel` | `error`…`trace` | `info` | Verbosity of the **DALi Preview** output channel. |

## Troubleshooting

- **One-line installer fails with `HTTP 403` / "API rate limit exceeded"** — older copies of
  `install.sh` queried the GitHub REST API, which is capped at **60 requests/hour per IP** and
  is quickly exhausted when many people share one corporate proxy/NAT IP. Re-run the one-line
  installer above — the current script resolves the latest release through `github.com`
  directly (no API), so it isn't affected by that limit and needs no token.
- **The setup prompt didn't appear, or I dismissed it** — Docker mode can't render until
  Docker is installed **and** the runtime image is downloaded. Bring the prompt back by
  opening any `.preview.dali.cpp` file (e.g. via **DALi Preview: Open Sample File**), or run
  **DALi Preview: Run Setup Walkthrough**. To do the steps manually: **DALi Preview: Install
  Docker via Terminal**, then **DALi Preview: Download Runtime Image**.
- **Preview doesn't open automatically** — press `Ctrl+S` once to trigger the first render,
  or run **DALi Preview: Open Preview**.
- **First Docker preview is slow** — it's pulling the ~290 MB runtime image. This happens
  once; later previews start instantly. Pre-pull with **Download Runtime Image**.
- **"permission denied … docker.sock"** — run **DALi Preview: Verify Docker Access** →
  *Fix for this session*. (`setfacl` re-grants the running session access.)
- **Native mode: "DALi not found"** — confirm `daliPreview.daliPrefix` points at the folder
  containing `lib/libdali2-core.so`, and that `lib/pkgconfig/dali2-*.pc` exist.
- **Where are the logs?** — the **DALi Preview** output channel. Set `daliPreview.logLevel`
  to `debug` (or `trace` for structured JSON) and look for `[Perf]` lines to see which render
  path fired.

## Notes & limitations

- **Linux only.** Headless rendering uses Xvfb; Windows/macOS would need a DALi WebAssembly port.
- **Custom fonts and animation preview are native-runtime features.** In Docker mode they
  are currently skipped; animation export also requires `ffmpeg`.
- Previews render the **extracted region** — the body you `return`, not your whole application.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Apache License 2.0
