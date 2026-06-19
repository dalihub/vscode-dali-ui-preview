# 06 · Render paths (advanced)

Same UI, three render pipelines. DALi Preview picks one automatically from your
code, trading fidelity for speed. **Watch the status bar** (bottom-right) as you
save each file — it tells you which path ran.

| File | Path | Chosen when | Status bar | Typical |
|---|---|---|---|---|
| [`1-parser.preview.dali.cpp`](1-parser.preview.dali.cpp) | **Parser** | Pure fluent chain — parsed directly, no C++ compile | `⚡ Parser` | ~80 ms |
| [`2-dlopen.preview.dali.cpp`](2-dlopen.preview.dali.cpp) | **dlopen** | Uses `auto`/`for`/`if` → parser falls back, compiles a `.so` and hot-loads it | `⚡ Server` | ~400 ms |
| [`3-fullbuild.preview.dali.cpp`](3-fullbuild.preview.dali.cpp) | **Full build** | The whole g++ harness is compiled and run (fallback) | `🔨 Compile` | ~1100 ms |

## Try it

1. Open each file and save (`Ctrl+S`); compare the status-bar path and the
   "Updated in …s" time.
2. The full build is normally only a fallback. To force it for `3-fullbuild`,
   set **`daliPreview.disablePreviewServer: true`** (workspace setting) and
   reload — the file's own comments walk you through it. Flip it back to `false`
   afterward to restore the fast paths.

**Why it matters:** this is *why* most edits preview in well under a second — the
parser and dlopen paths skip the full compile entirely. You don't choose the
path; you just see which one your code took.

→ Back to the [index](../README.md)
