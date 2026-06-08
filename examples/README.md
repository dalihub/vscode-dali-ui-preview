# DALi Preview — Examples

A guided tour of every way to trigger a live preview. **This folder is a
self-contained copy** — edit freely; nothing here touches your own projects.

## How to use

1. Make sure DALi Preview is in **docker** runtime mode (the default) and the
   runtime image is downloaded.
2. Open any `.cpp` / `.preview.dali.cpp` file below and **save it (`Ctrl+S`)** —
   the preview panel opens and renders automatically.
3. Watch the **status bar** (bottom-right): it shows which render path was used
   (`⚡ Parser`, `⚡ Server`, `🔨 Compile`).

## The five preview modes

| Folder | Mode | Trigger |
|---|---|---|
| [01-preview-file](01-preview-file/) | **Preview file** | A file named `*.preview.dali.cpp` — the whole file is preview code |
| [02-marker-comment](02-marker-comment/) | **`// @preview` marker** | A `// @preview` comment above a function in a normal `.cpp`/`.h` |
| [03-codelens](03-codelens/) | **CodeLens** | A `▶ Preview` lens above each view-returning function — click it |
| [04-multi-config](04-multi-config/) | **`// @preview-config`** | Multiple resolutions/themes from config comments |
| [05-build-paths](05-build-paths/) | **parser / dlopen / full build** | Same UI, three render pipelines — compare their speed |

## Switching DALi versions

Use **`DALi: Select Runtime Version`** (Command Palette) to flip between
installed and remote runtime images — already-downloaded versions switch
instantly, even offline, so you can compare how a layout renders across DALi
releases.

> Tip: open this folder in its own window via **`DALi: Open Examples`** so it
> never mixes with your real workspace.
