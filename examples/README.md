# DALi Preview — Examples

A guided tour of **what the live preview can do** and **how to trigger each
thing**. Work through the folders in order, or jump to whatever you need.

**This folder is a self-contained copy** — edit anything freely; nothing here
touches your own projects.

## How to preview anything here

1. Open any `.cpp` / `.preview.dali.cpp` file in a folder below.
2. **Save it (`Ctrl+S`)** — the preview panel opens and renders automatically.
   (Or **right-click → DALi Preview**, or click a `▶ Preview` CodeLens.)
3. Watch the **status bar** (bottom-right): it shows which render path ran —
   `⚡ Parser`, `⚡ Server`, or `🔨 Compile` (see [06](06-render-paths/README.md)).

> Everything here runs on the default **docker** runtime — make sure DALi
> Preview is in docker mode and the runtime image is downloaded. The config,
> focus, and multi-file examples use the compile path; docker handles them all.

## What you can preview

| # | Folder | What it shows | How you trigger it |
|---|---|---|---|
| 01 | [your-first-preview](01-your-first-preview/README.md) | The simplest mode — a whole file is the UI | a `*.preview.dali.cpp` file + save |
| 02 | [preview-existing-code](02-preview-existing-code/README.md) | Preview a function inside a normal `.cpp` | `// @preview` marker, or the `▶ Preview` CodeLens |
| 03 | [config-and-theme](03-config-and-theme/README.md) | One UI under many configs — size, dark theme, font scale, RTL | `// @preview-config:` lines + `// @preview-preset:` |
| 04 | [focus-and-state](04-focus-and-state/README.md) | TV/D-pad focus ring + a frozen animation frame | `// @preview-state: focus=<view>` / `progress=<0..1>` |
| 05 | [real-app-multifile](05-real-app-multifile/README.md) | A real multi-file screen — member `Build()` + cross-file helpers, nothing rewritten | `// @preview` on a member, or `// @dali-preview` factory |
| 06 | [render-paths](06-render-paths/README.md) | Same UI, three pipelines — compare their speed | automatic (parser / dlopen / full build) |

## Directives cheat-sheet

Put these in comments at the top of a preview file, or above a function:

| Directive | What it does |
|---|---|
| `// @preview` | Mark the function below as the preview target (works in any `.cpp`/`.h`) |
| `// @dali-preview` | Mark a zero-arg factory function as the preview target |
| `// @preview-config: name="…", width=, height=, theme=, fontScale=, locale=` | Render the UI under this configuration (repeat for more variants) |
| `// @preview-preset: <name>` | Expand a named bundle of configs — `light-dark`, `locales`, `font-sizes`, `screen-sizes` |
| `// @preview-state: focus=<view>` | Draw the focus ring on the view with that **variable name** |
| `// @preview-state: progress=<0..1>` | Scrub an animation to that fraction and render the frame |

(A `*.preview.dali.cpp` file needs no marker — its whole body is the UI.)

## Switching DALi versions

Use **`DALi: Select Runtime Version`** (Command Palette) to flip between
installed and remote runtime images — already-downloaded versions switch
instantly, even offline, so you can compare how a layout renders across DALi
releases.

> Tip: open this folder in its own window via **`DALi: Open Examples`** so it
> never mixes with your real workspace.
