# 03 · Config and theme

Render the **same** UI under several configurations at once — device sizes, dark
theme, larger fonts, RTL locale — and compare them side-by-side in the panel.

## What this shows

- **`// @preview-config:`** lines — one per variant, each overriding a few keys.
- **`// @preview-preset:`** — a one-word shorthand that expands to a set of
  ready-made variants.

[`showcase.preview.dali.cpp`](showcase.preview.dali.cpp) carries one builder and
several config lines, so the panel offers Light · Dark · Phone · Tablet · Large ·
RTL of the same tree.

## Config keys

| Key | Effect | Try it on |
|---|---|---|
| `width` / `height` | Device frame in pixels | `Phone` 720×1280 vs `Tablet` 1280×800 |
| `theme=dark` | Reskins **token** colours (`UiColor("Surface")`, `UiColor::PRIMARY`, `UiColor("OnSurface")`) to the dark palette. Hex colours like `0xFF8800` are *not* reskinned — that's the honest boundary | the two token boxes vs the orange hex box |
| `fontScale=1.5` | Scales text sized in **`_spx`** units 1.5×. Raw-pixel `.SetFontSize(36.0f)` does *not* scale | the `_spx` heading vs the `1` `2` `3` labels |
| `locale=ar` | Mirrors layout **direction** (RTL) — the row's `1·2·3` becomes `3·2·1`. Layout only; text is never translated | the labelled row |
| `name="…"` | The label shown for the variant in the panel | every line |

## Presets

A preset is a named bundle of configs. This file uses:

```cpp
// @preview-preset: light-dark   →  Light (theme=light) + Dark (theme=dark)
```

Other built-in presets: `locales` (EN + Arabic), `font-sizes` (1.0 + 1.5),
`screen-sizes` (Phone + Watch + Tablet). Presets *append* to any explicit
`@preview-config` lines, so you can mix them.

## Try it

1. Open [`showcase.preview.dali.cpp`](showcase.preview.dali.cpp) and save (`Ctrl+S`).
2. Switch between the variants in the panel — watch the token boxes reskin under
   **Dark**, the heading grow under **Large**, and the row mirror under **RTL**.
3. Add a line like `// @preview-config: name="Watch", width=360, height=360` and
   save to add another frame.

**Why it matters:** check responsive layout, theming, accessibility font sizes,
and RTL — all from one file, without rebuilding the app per case.

→ Next: [04 · Focus and state](../04-focus-and-state/README.md)
