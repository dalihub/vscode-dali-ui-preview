# 01 · Your first preview

The simplest way in. Any file whose name ends in **`.preview.dali.cpp`** is
treated as pure preview code — the whole file body *is* the UI to render. No
markers, no `main()`, no boilerplate. This is your starter file.

## What this shows

- **Preview-file mode**: the entire file is the view expression.
- Save → it renders. Edit → it re-renders live.

> **The one rule that trips people up:** dali-ui is **non-fluent** — setters return
> `void`, so you can't chain (`New().SetX().SetY()`). Declare a named local, call each
> setter as its own statement, add children with **`AddChildren({ … })`**, then `return`
> the root. (The old fluent chaining API was removed.)

## Try it

1. Open [`hello.preview.dali.cpp`](hello.preview.dali.cpp).
2. Save (`Ctrl+S`). The preview panel opens and renders the label.
3. Change `"Hello DALi!"` or the colours (`0x1e1e2e`, `0xFFFFFF`) and save again —
   the panel re-renders instantly.
4. **See error mapping:** delete a semicolon (`;`) and save. The compile error maps
   back to *that* line as a red squiggle in your editor — not buried in a build log.
   Undo and save to recover.
5. **Stay oriented:** click an element in the preview to jump to its source line, and
   move your cursor in the code to highlight the matching element. The **Widget
   Inspector** (tree icon on the panel) shows every node and its properties.

**Why it matters:** the fastest possible loop — write a `return …;` expression, hit
save, see pixels. Errors land on the right line, and preview ↔ code stay linked.

→ Next: [02 · Preview existing code](../02-preview-existing-code/README.md)
