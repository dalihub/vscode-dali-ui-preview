# 04 · Focus and state

Preview *runtime* state that you'd normally only see on a real device — the
TV/D-pad **focus ring**, and a paused point in an **animation** — captured as a
static frame.

## What this shows

- **`// @preview-state: focus=<view>`** — draws the focus indicator on a chosen
  view. `<view>` is the **variable name** from your code (here `card2`, the
  middle card). The build name-tags each view by its variable name and asks DALi
  to focus that one.
- **`// @preview-state: progress=<0..1>`** — for code that builds an animation,
  scrubs it to that fraction (0 = start, 1 = end) and renders the frozen frame.

[`focus-grid.preview.dali.cpp`](focus-grid.preview.dali.cpp) has three focusable
cards; `focus=card2` puts the ring on the middle one.

## Try it

1. Open [`focus-grid.preview.dali.cpp`](focus-grid.preview.dali.cpp) and save
   (`Ctrl+S`). The ring lands on the middle (orange) card.
2. Change `focus=card2` to `focus=card1` or `focus=card3` and save — the ring
   follows.
3. Swap the directive for `// @preview-state: progress=0.5` to preview an
   animation's halfway frame (when the code builds one).

**Why it matters:** focus is the heart of TV/remote UX. The ring is injected at
runtime, so it normally can't be seen in a static render — this shows it
statically so you can verify focus order and styling without a device.

> In a multi-config preview the focus ring is skipped (a `focus-multiconfig`
> badge tells you so); use a single config to see it.

→ Next: [05 · Real app, multi-file](../05-real-app-multifile/README.md)
