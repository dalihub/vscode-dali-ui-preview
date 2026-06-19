# 01 · Your first preview

The simplest way in. Any file whose name ends in **`.preview.dali.cpp`** is
treated as pure preview code — the whole file body *is* the UI to render. No
markers, no `main()`, no boilerplate. This is your starter file.

## What this shows

- **Preview-file mode**: the entire file is the view expression.
- Save → it renders. Edit → it re-renders live.

## Try it

1. Open [`hello.preview.dali.cpp`](hello.preview.dali.cpp).
2. Save (`Ctrl+S`). The preview panel opens and renders the label.
3. Change `"Hello DALi!"` or the colours (`0x1e1e2e`, `0xFFFFFF`) and save
   again — the panel re-renders instantly.

**Why it matters:** the fastest possible loop — write a `return …;` expression,
hit save, see pixels. The best starting point for any new screen.

→ Next: [02 · Preview existing code](../02-preview-existing-code/README.md)
