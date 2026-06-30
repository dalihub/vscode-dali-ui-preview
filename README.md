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

**Real-world code** *(new in 0.44)*

- 📂 **Preview real multi-file app code** — a member-function screen
  (`Screen::Build()`) that calls helpers/factories defined in *other* `.cpp` files
  and reads an injected view-model now previews **without rewriting**: the slicer
  collects the cross-file dependencies and synthesizes sample data for the model.
  Cross-file compile errors map back to *your* real file and line (e.g.
  `widgets/cards.cpp:38`).
- 🕹️ **Focus preview (TV / D-pad)** — `// @preview-state: focus=<view>` renders one
  item in its keyboard-focus state (the highlight ring), referenced by the variable
  you already wrote. `progress=<0..1>` opens an animation at a chosen frame.
- 🎨 **Theme / locale / font that actually apply** — `theme=dark` reskins token
  colours, `fontScale=1.5` scales text, `locale=ar` mirrors the layout
  right-to-left (layout only — never a fake translation).
- 🪧 **Honest provenance badges** — when a preview is approximated (sample data, a
  placeholder image, an unresolved theme token), a small badge says exactly what,
  so a "silent fix" never looks like your bug.

**Zero-hassle runtime**

- 🐳 **Docker runtime (default)** — no DALi build on your machine. The runtime ships as a
  pre-built image that the extension pulls for you (~290 MB, once).
- 🛠️ **Local runtime (for framework devs)** — modifying DALi itself? Point the extension at
  your own build; each preview compiles against it, so a fresh `.so` shows up on every render.
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
> approve. Until both are done, previews can't render. Building DALi yourself?
> See **⭐ Local DALi runtime** below.

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
3. Run **DALi Preview: Open Samples** (`Ctrl+Shift+P`). A guided tour is copied into a
   folder you pick and opens in a new window; its `README.md` opens automatically. Start at
   `01-your-first-preview/hello.preview.dali.cpp` — the preview panel opens beside it.
4. Edit a label, change a colour, **save** — the preview updates.

That's the whole loop: **write → save → see**.

## Installation

### Option 1 — One-line installer *(recommended)*

```bash
curl -fsSL https://raw.githubusercontent.com/dalihub/vscode-dali-ui-preview/main/install.sh | bash
```

Downloads the latest `.vsix` from GitHub Releases and installs it into VS Code.

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

There are two runtimes — pick **one**. This is the single most important choice for setup:

| You are… | Use | What it is |
|---|---|---|
| 👤 **App developer** — building a UI *with* DALi (most people) | 🐳 **Docker** *(default)* | Download a **pre-built runtime container** — no DALi on your machine. Two guided one-time steps: install Docker + pull the image (~290 MB). |
| 🛠️ **DALi framework (uifw) developer** — modifying DALi itself | ⭐ **Local** | Render against **your own DALi build**, so previews reflect your freshly-built `.so` files. Needs `g++`/`Xvfb`/`pkg-config` + a DALi prefix on the host. |

**Not sure? Pick Docker — it just works.** Step-by-step for each runtime is below.

### Docker runtime *(recommended for app developers)*

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

### ⭐ Local DALi runtime — for DALi framework (uifw) developers

> **📌 Important.** Use this when you **modify DALi itself** and want the preview to reflect
> *your* build. App developers should stay on Docker (above). In local mode each preview is
> compiled on your host (`g++` + `pkg-config`) against your DALi install and rendered under
> Xvfb — a fresh one-shot process every time, so a just-rebuilt `libdali2-*.so` shows up on
> the **next render with no image rebuild and no restart**.

**How to point the extension at your local DALi folder**

1. Open the Command Palette (`Ctrl+Shift+P`) → **DALi Preview: Use Local DALi Runtime**.
2. A **folder picker** opens, pre-seeded with an auto-detected prefix when one is found.
   Choose your **DALi install prefix** — the folder that contains
   `lib/libdali2-core.so` and `lib/pkgconfig/dali2-ui-foundation.pc` (typically
   `…/dali-env/opt`). You may also select a **parent folder** that contains `dali-env/opt`;
   it's resolved for you.
3. The path is saved to **`daliPreview.daliPrefix`**, `runtimeMode` is set to `local`, and
   the window reloads. Done — save a `.preview.dali.cpp` and it renders against your DALi.

Rebuilt DALi? Just **save again** (or hit refresh) — the new `.so` is picked up automatically.

**Auto-detection order** (so you often don't need to pick a folder at all):

1. the `daliPreview.daliPrefix` setting (your explicit choice);
2. the **`DESKTOP_PREFIX`** environment variable — exactly what a dali-env `setenv` exports,
   so `source setenv` then launch VS Code and it's found;
3. a **`setenv`** file in a workspace folder (`DESKTOP_PREFIX=…`);
4. a **shared/system install** — whatever `pkg-config` has registered, then common
   locations like `/opt/dali`.

It deliberately does **not** scan your home/project directories, so a shared tool never
auto-selects one person's project build. Prerequisites on the host: `g++`, `Xvfb`,
`pkg-config` (the extension tells you which is missing). To go (back) to Docker, run
**DALi Preview: Select Runtime Version** and pick a container version.

> Speed: local mode runs a **native resident preview server** (compiled from the bundled
> `preview_server.cpp` against your prefix), so editing preview code uses the fast
> dlopen/parser paths and **animation scrubbing** — same as Docker, not a full rebuild each
> time. After you rebuild DALi (`make install`), a watcher on `…/lib/libdali2-*.so` restarts
> the server automatically (or run **DALi Preview: Restart DALi Runtime**) so it loads your
> new build.

## Writing previews

### Preview files

Any file ending in **`.preview.dali.cpp`** is treated as the body of a preview function —
build your view and `return` it. dali-ui setters return `void` (the fluent
chaining API was removed), so set each property as its own statement and add
children with `AddChildren`:

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

### Images

`ImageView` (and `SetResourceUrl`) can load **local image files**. Give a path
**relative to the preview file** and the extension stages the asset into the
runtime for you — in Docker mode the file is copied into the container, so there
is nothing to mount by hand:

```cpp
// preview file:  ui/home.preview.dali.cpp
// asset on disk: ui/assets/banner.jpg
ImageView hero = ImageView::New("assets/banner.jpg");
hero.SetRequestedWidth(MATCH_PARENT);
hero.SetRequestedHeight(420.0f);
```

An absolute path that exists on disk works too. A remote URL (`https://…`) or a
path that can't be resolved falls back to a gray broken-image placeholder, so the
layout box is preserved either way.

### Markers in an existing file

To preview a region inside a regular `.cpp`/`.h` file, wrap it in marker comments:

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

Or mark a whole function instead of a region: put **`// @preview`** on the line above any
function that returns a view, and the extension previews what it returns:

```cpp
// @preview
View ProfileCard() { /* … */ return root; }
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
| `theme` | `light` \| `dark` | Background **and** token-colour reskin (`UiColor::PRIMARY`, `UiColor("…")`) |
| `fontScale` | `0.5`–`2.0` | Scales `_spx`-sized text (catch big-font overflow early) |
| `locale` | e.g. `ar`, `ko_KR` | Mirrors layout right-to-left for RTL locales; sets `LANG` |
| `font` | filename | Use a font from `daliPreview.fontDirectories` |
| `animation` | `true` \| `false` | Show animation playback controls — scrub through a region that animates (`.Play()`) |
| `duration` | ms | Animation length for the scrubber |

**Presets** — `// @preview-preset: light-dark` (also `locales`, `font-sizes`,
`screen-sizes`) expands to several config variants shown together in the gallery.

#### Other directives

```cpp
// @dali-preview                      // mark the next zero-arg factory as the preview entry
View MakeHomePreview() { return HomeScreen(SampleVM()).Build(); }

// @preview-state: focus=card2        // render card2 in its focused state (highlight ring)
// @preview-state: progress=0.4       // open an animation at the 40% frame
```

- **`// @dali-preview`** — the C++ analog of Compose's parameterless `@Preview`:
  mark a zero-argument factory and the extension renders what it returns (pulling in
  helpers via the slicer), so a screen that normally needs a view-model is previewable.
- **`// @preview-state: focus=<view>`** — show one item focused (the highlight ring);
  `<view>` is a variable name from your code. `progress=<0..1>` picks an animation
  frame. (`focus` and `progress` are mutually exclusive in a single render.)

## Using with an AI coding agent

An AI agent in VS Code (GitHub Copilot, Cursor, Claude, …) can write DALi UI for you. But the
extension's preview panel is a **webview only a human can see** — an agent can't read it. So an
agent should **verify its own work with the companion [`dali-ui-preview-cli`](https://github.com/dalihub/dali-ui-preview-cli)**,
which renders the same scene headlessly to a **PNG + a JSON scene tree it *can* read**, and
loops: write → render → read → fix.

Run **DALi Preview: Add AI Agent Guide** (`Ctrl+Shift+P`) to set this up. It writes — or
refreshes — an **`AGENTS.md`** in your workspace root (the cross-tool file Copilot/Cursor/Claude
read for project instructions) that teaches exactly that: **verify with the CLI**, the
previewable-file conventions (`*.preview.dali.cpp`, the `@dali-preview` markers), the
**non-fluent dali-ui API**, and the types that are easy to guess wrong. Only the DALi block is
managed — your own `AGENTS.md` content is preserved.

Meanwhile **you** get the live panel for free as the agent edits — handy when you're pairing and
want to steer.

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and type **DALi**.

| Command | What it does |
|---|---|
| **Open Preview** | Open the preview panel for the active file |
| **Preview Function** | Preview the function under the cursor |
| **Use Local DALi Runtime** | **Local mode — pick your DALi prefix folder (framework devs)** |
| **Select Runtime Version** | **Docker mode — pick a container/DALi version (switches into Docker from local)** |
| **Open Samples** | Copy the guided samples tour to a folder and open it (start here) |
| **Run Setup Walkthrough** | Reopen the guided setup |
| **Install Docker via Terminal** | **① Install Docker** (one `sudo` password, no reboot) |
| **Download Runtime Image** | **② Pull the DALi runtime image** (~290 MB) |
| **Verify Docker Access** | Confirm Docker is reachable; fix a "permission denied" session |
| **Toggle Theme** | Switch the preview between dark and light |
| **Check for Runtime Image Update** | Compare your image against the registry |
| **Clean Runtime Images** | Remove cached runtime images to free disk |
| **Reset Extension** | Remove containers, images, and caches and start fresh |
| **Open Settings** | Jump to the extension's settings |
| **Add AI Agent Guide** | Write/refresh an `AGENTS.md` so an AI agent writes previewable DALi code |
| **Report Issue** | Open a pre-filled GitHub bug report with your environment attached |

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `daliPreview.runtimeMode` | `docker` \| `local` | `docker` | Where preview builds run. `docker` needs no host DALi install; `local` compiles against a host DALi (framework devs). |
| `daliPreview.daliPrefix` | string | `""` | **Local mode** — path to your DALi install prefix. Empty = auto-detect (`DESKTOP_PREFIX` / workspace `setenv` / a system install). Usually set for you by **Use Local DALi Runtime**. |
| `daliPreview.dockerImage` | string | `ghcr.io/lwc0917/dali-preview-runtime` | Runtime image used in Docker mode. |
| `daliPreview.daliVersionTag` | string | `latest` | Runtime image tag (DALi version). `latest` follows the rolling tag. |
| `daliPreview.runtimeUpdatePolicy` | `off` \| `notify` \| `auto` | `notify` | How to handle a newer runtime image (checked once/day, Docker mode). |
| `daliPreview.previewWidth` | number | `1920` | Default canvas width (px). |
| `daliPreview.previewHeight` | number | `1080` | Default canvas height (px). |
| `daliPreview.background` | `dark` \| `light` \| `checker` | `dark` | Background style behind the rendered preview. |
| `daliPreview.livePreview` | boolean | `true` | Re-render automatically as you type. |
| `daliPreview.livePreviewDebounce` | number | `0` | Debounce (ms) between keystroke and re-render. `0` = every keystroke. |
| `daliPreview.fontDirectories` | string[] | `[]` | Directories of custom TTF/OTF fonts (honored in local mode). |
| `daliPreview.logLevel` | `error`…`trace` | `info` | Verbosity of the **DALi Preview** output channel. |

## Troubleshooting

- **The setup prompt didn't appear, or I dismissed it** — Docker mode can't render until
  Docker is installed **and** the runtime image is downloaded. Bring the prompt back by
  opening any `.preview.dali.cpp` file (e.g. via **DALi Preview: Open Samples**), or run
  **DALi Preview: Run Setup Walkthrough**. To do the steps manually: **DALi Preview: Install
  Docker via Terminal**, then **DALi Preview: Download Runtime Image**.
- **Preview doesn't open automatically** — press `Ctrl+S` once to trigger the first render,
  or run **DALi Preview: Open Preview**.
- **First Docker preview is slow** — it's pulling the ~290 MB runtime image. This happens
  once; later previews start instantly. Pre-pull with **Download Runtime Image**.
- **"permission denied … docker.sock"** — run **DALi Preview: Verify Docker Access** →
  *Fix for this session*. (`setfacl` re-grants the running session access.)
- **Local mode: "DALi not found"** — confirm `daliPreview.daliPrefix` points at the folder
  containing `lib/libdali2-core.so` and `lib/pkgconfig/dali2-ui-foundation.pc` (re-pick it with
  **DALi Preview: Use Local DALi Runtime**).
- **Where are the logs?** — the **DALi Preview** output channel. Set `daliPreview.logLevel`
  to `debug` (or `trace` for structured JSON) and look for `[Perf]` lines to see which render
  path fired.

## Reporting an issue

Hit a bug? Run **DALi Preview: Report Issue** (`Ctrl+Shift+P`) — it opens a GitHub issue
**pre-filled** with a short template *and* your environment (extension / VS Code / OS
versions, runtime mode, runtime image), so you just describe what happened and submit. You
can also use VS Code's native **Report Issue** entry on the extension's page (the gear menu),
or file directly at the [issue tracker](https://github.com/dalihub/vscode-dali-ui-preview/issues).
Before reporting, it helps to set `daliPreview.logLevel` to `debug`, reproduce, and paste the
relevant **DALi Preview** output-channel lines into the report.

## Notes & limitations

- **Linux only.** Headless rendering uses Xvfb; Windows/macOS would need a DALi WebAssembly port.
- **Local runtime: a resident native server gives the fast paths + animation scrubbing**,
  same as Docker. After rebuilding DALi, the lib watcher (or **Restart DALi Runtime**)
  respawns it so your new build is loaded; very large canvases are bounded by the host
  Xvfb screen. Custom fonts are honored in local mode; Docker mode currently skips them.
- Previews render the **extracted region** — the body you `return`, not your whole application.

## Development

```bash
npm install
npm run compile      # TypeScript → out/
npm run test:unit    # unit tests
npm run test:e2e     # golden screenshot tests (render via the Docker runtime)
```

### Pre-push checks

The golden screenshot tests render through the **local Docker DALi runtime**.
github-hosted CI can't render complex DALi scenes reliably (no GPU, software-only
GL), so the project verifies on push from a machine that has the runtime rather
than gating on the cloud. Enable the hook once per clone:

```bash
npm run hooks:install   # sets core.hooksPath = .githooks
```

It runs compile → unit tests → the golden suite before every `git push` and
aborts the push on failure. Skip a run with `git push --no-verify`, or skip just
the (slow) render with `SKIP_E2E=1 git push`. The same suite can be run in the
cloud on demand via the **Golden Screenshot Tests** workflow (Actions → Run
workflow). The release/unit CI runs the unit tests on every push.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Apache License 2.0
