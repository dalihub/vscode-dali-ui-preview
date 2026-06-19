# 02 · Preview existing code

You don't need a dedicated file. Inside an ordinary `.cpp` / `.h`, point the
previewer at one function — the rest of the file is ignored.

## What this shows

Two ways to preview a function in place:

- **`// @preview` marker** — put it on the line above a function that returns a
  DALi view. The extension extracts that function's body and previews it. No
  closing marker needed; the function's closing brace ends the region.
- **`▶ Preview` CodeLens** — a clickable lens appears above *every*
  view-returning function. Click it to preview that one, no marker required —
  handy when a file has several builders and you want to flip between them.

## Try it

1. Open [`snippet.cpp`](snippet.cpp) — note the `// @preview` above `CreateUI`.
2. Save (`Ctrl+S`). The marked function renders.
3. Click the `▶ Preview` lens above `AnotherView` — it renders instead, no save
   needed. Or move `// @preview` above it and save.

**Why it matters:** preview real code where it already lives — no need to copy a
snippet into a separate `.preview.dali.cpp`.

> The older block style `// @dali-preview-begin` … `// @dali-preview-end` still
> works too if you prefer an explicit end marker.

→ Next: [03 · Config and theme](../03-config-and-theme/README.md)
