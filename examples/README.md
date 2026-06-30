# DALi Preview — Samples

A guided tour of **what the live preview can do** and **how to trigger each
thing**. Work through the folders in order, or jump to whatever you need.

**This folder is a self-contained copy** — edit anything freely; nothing here
touches your own projects.

## How to preview anything here

1. Open any `.cpp` / `.preview.dali.cpp` file in a folder below.
2. **Save it (`Ctrl+S`)** — the preview panel opens and renders automatically.
   (Or **right-click → DALi Preview**, or click a `▶ Preview` CodeLens.)
3. Watch the **status bar** (bottom-right): it shows which render path ran —
   `⚡ Parser`, `⚡ Server`, or `🔨 Compile` (see [07](07-render-paths/README.md)).

> Everything here runs on the default **docker** runtime — make sure DALi
> Preview is in docker mode and the runtime image is downloaded. The config,
> focus, and multi-file examples use the compile path; docker handles them all.

## What you can preview

| # | Folder | What it shows | How you trigger it |
|---|---|---|---|
| 01 | [your-first-preview](01-your-first-preview/README.md) | The simplest mode — a whole file is the UI | a `*.preview.dali.cpp` file + save |
| 02 | [preview-existing-code](02-preview-existing-code/README.md) | Preview a function inside a normal `.cpp` | `// @preview` marker, or the `▶ Preview` CodeLens |
| 03 | [config-and-theme](03-config-and-theme/README.md) | One UI under many configs — size, dark theme, font scale, RTL | `// @preview-config:` lines + `// @preview-preset:` |
| 04 | [focus-and-state](04-focus-and-state/README.md) | TV/D-pad focus ring + a **live animation scrubber** (or a frozen frame) | `// @preview-state: focus=<view>` / `progress=<0..1>`, or an `Animation` + `.Play()` |
| 05 | [real-app-multifile](05-real-app-multifile/README.md) | A real multi-file screen — member `Build()` + cross-file helpers, nothing rewritten | `// @preview` on a member, or `// @dali-preview` factory |
| 06 | [images](06-images/README.md) | Load a local image with `ImageView` — auto-staged into the runtime | `ImageView::New("assets/…")` + save |
| 07 | [render-paths](07-render-paths/README.md) | Same UI, three pipelines — compare their speed | automatic (parser / dlopen / full build) |

## Beyond the files — always-on features

These aren't separate examples — they work while *any* preview is open, so try them
as you go through the tour:

- **Click-to-Code / Code-to-Preview** — click an element in the preview to jump to its
  source line; move your cursor in the editor to highlight the matching element.
- **Inline error mapping** — a compile error shows as a red squiggle on *your* exact
  source line, not in a build log (try it in [01](01-your-first-preview/README.md)).
- **Widget Inspector** — a collapsible scene tree with per-node property inspection
  (the tree icon on the preview panel).
- **Resizable canvas** — switch resolution with presets, type an exact W×H, or drag the
  panel edge; the layout reflows.
- **Theme toggle** — **`DALi: Toggle Theme`** flips dark/light, or set a custom
  background colour.
- **Runtime version switch** — **`DALi: Select Runtime Version`** flips between installed
  and remote runtime images (downloaded ones switch instantly, even offline), so you can
  compare a layout across DALi releases.

## Directives cheat-sheet

Put these in comments at the top of a preview file, or above a function:

| Directive | What it does |
|---|---|
| `// @preview` | Mark the function below as the preview target (works in any `.cpp`/`.h`) |
| `// @dali-preview` | Mark a zero-arg factory function as the preview target |
| `// @preview-config: name="…", width=, height=, theme=, fontScale=, locale=, font=, animation=` | Render the UI under this configuration (repeat for more variants) |
| `// @preview-preset: <name>` | Expand a named bundle of configs — `light-dark`, `locales`, `font-sizes`, `screen-sizes` |
| `// @preview-state: focus=<view>` | Draw the focus ring on the view with that **variable name** |
| `// @preview-state: progress=<0..1>` | Scrub an animation to that fraction and render one frame |
| an `Animation` + `.Play()` in your code | Adds a live playback **scrubber** under the preview |

(A `*.preview.dali.cpp` file needs no marker — its whole body is the UI.)

> Tip: open this folder in its own window via **`DALi: Open Samples`** so it
> never mixes with your real workspace.
