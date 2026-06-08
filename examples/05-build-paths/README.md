# 05 · Build paths — parser / dlopen / full build

DALi Preview renders through three pipelines, picked automatically from your
code. These three files render *similar* UI through *different* paths so you can
feel the speed difference. **Watch the status bar** (bottom-right) as you save
each one.

| File | Path | How it's chosen | Status bar | Typical |
|---|---|---|---|---|
| [`1-parser.preview.dali.cpp`](1-parser.preview.dali.cpp) | **Parser** | Pure fluent chain — parsed directly, no C++ compile | `⚡ Parser` | ~80 ms |
| [`2-dlopen.preview.dali.cpp`](2-dlopen.preview.dali.cpp) | **dlopen** | Uses `auto`/`for`/`if` → parser falls back, compiles a `.so` and hot-loads it | `⚡ Server` | ~400 ms |
| [`3-fullbuild.preview.dali.cpp`](3-fullbuild.preview.dali.cpp) | **Full build** | The whole g++ harness is compiled and run | `🔨 Compile` | ~1100 ms |

## Try it

1. Open each file and save (`Ctrl+S`); compare the status-bar path and the
   "Updated in …s" time.
2. The **full build** path is normally only used as a fallback. To force it for
   `3-fullbuild`, set **`daliPreview.disablePreviewServer: true`** (workspace
   setting) and reload — the file's own comments walk you through it. Flip it
   back to `false` afterward to restore the fast paths.

This is the best way to understand *why* most edits preview in well under a
second: the parser and dlopen paths skip the full compile entirely.
