# 02 · `// @preview` marker

Inside an ordinary `.cpp` / `.h` file, put **`// @preview`** on the line above a
function that returns a DALi view. The extension extracts that function's body
and previews it — the rest of the file is ignored. No closing marker is needed;
the function's closing brace ends the region.

## Try it

1. Open [`snippet.cpp`](snippet.cpp) — note the `// @preview` line.
2. Save (`Ctrl+S`). The marked function renders.
3. Move `// @preview` above a different function and save to preview that one.

> The older block style `// @dali-preview-begin` … `// @dali-preview-end` also
> still works if you prefer an explicit end marker.
