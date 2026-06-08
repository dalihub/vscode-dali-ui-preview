# 01 · Preview file mode

Any file whose name ends in **`.preview.dali.cpp`** is treated as pure preview
code — the entire file body is the UI to render. No markers, no `main()`.

## Try it

1. Open [`hello.preview.dali.cpp`](hello.preview.dali.cpp).
2. Save (`Ctrl+S`). The preview panel renders the label.
3. Change `"Hello DALi!"` or the colors and save again — it re-renders live.

This is the simplest mode and the best starting point for a new screen.
