# 05 · Real app, multi-file

Real apps aren't one self-contained `return …;`. They're a `Build()` method on a
screen class that reads member state, loops over data, and calls helpers defined
in *other* files. This folder previews exactly that shape — **without rewriting
anything**.

## What this shows

A **TV home screen** split across files, like a real project — a top bar, a hero
banner, and a "Continue Watching" rail of cards, laid out for the 1920×1080 TV
canvas (the default preview profile):

| File | Role |
|---|---|
| [`home_screen.h`](home_screen.h) / [`home_screen.cpp`](home_screen.cpp) | `HomeScreen::Build()` — the **preview target** (member function, marked `// @preview`). Reads `mVm`, loops `mVm.items` into a rail, calls factories, uses tokens |
| [`cards.h`](cards.h) / [`cards.cpp`](cards.cpp) | `MakeCard` / `MakeSectionHeader` — **cross-file factories** (defined in a different file) |
| [`theme.h`](theme.h) | `constexpr` colour/size **tokens** (`theme::ACCENT`, …) |

When you preview `Build()`, the extension **slices** that one method:
auto-collects the cross-file helpers, resolves the theme tokens, and synthesises
**sample data** for the `HomeViewModel` member — so a method that depends on
runtime state still renders. The stubbed fields are named after themselves
(`featured` → "Featured", `title` → "Title"), so you can see which field is
which instead of a wall of "Sample".

Two valid entry shapes — pick whichever matches your code:

- **Member `Build()`** marked `// @preview` → [`home_screen.cpp`](home_screen.cpp)
- **Zero-arg factory** marked `// @dali-preview` → [`entry_factory.cpp`](entry_factory.cpp)

## Try it

1. Open [`home_screen.cpp`](home_screen.cpp) and save (`Ctrl+S`). The TV home
   renders — hero banner plus a rail of cards — even though the factories live in
   `cards.cpp` and the view-model data is stubbed.
2. Edit a token in [`theme.h`](theme.h) (e.g. `ACCENT`) or a factory in
   [`cards.cpp`](cards.cpp), then re-save `home_screen.cpp` — the change shows.
3. Open [`entry_factory.cpp`](entry_factory.cpp) and save to preview the
   zero-arg `// @dali-preview` shape instead.

**Why it matters:** this is the dominant real-app shape. You preview production
code where it lives — no copying snippets, no stubbing data by hand.

→ Next: [06 · Render paths](../06-render-paths/README.md)
