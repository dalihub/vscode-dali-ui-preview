# 06 · Images

Show a real image with **`ImageView`** — and let the extension handle the file for you.

## What this shows

- `ImageView::New("assets/banner.jpg")` loads a local image into the scene.
- The path is **relative to this preview file**; the extension **stages the asset
  into the runtime** automatically (in docker it's copied into the container), so
  there's nothing to mount by hand.

## Try it

1. Open [`banner.preview.dali.cpp`](banner.preview.dali.cpp) and save (`Ctrl+S`) —
   the banner image renders inside the card.
2. Point the path at a file that doesn't exist (e.g. `"assets/nope.jpg"`) and save:
   the box stays, filled with a **gray broken-image placeholder** instead of failing.
3. Drop your own image into [`assets/`](assets/) and point `ImageView::New(...)` at it.

**The three rules:**

- ✅ a path **relative to the preview file** (e.g. `assets/banner.jpg`) → staged + rendered;
- ✅ an absolute path that exists on disk also works;
- ⚠️ a remote URL (`https://…`) or an unresolvable path → gray placeholder (layout preserved).

**Why it matters:** real screens have pictures. You reference them the natural way — a
relative path — and the extension does the staging, in docker or local mode alike.

→ Next: [07 · Render paths](../07-render-paths/README.md)
