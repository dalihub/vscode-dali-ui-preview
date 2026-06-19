# Explore the examples and try a preview

Once your runtime is set up (Docker installed, or Native prefix
pointed), this is where you confirm everything works.

Click **"Open Examples"** below. The extension copies a guided
**Examples** tour into a folder you pick (as `dali-examples/`) and
opens it in a new window. Its `README.md` opens automatically — read
that first; it walks you through each capability in order.

Then open any `*.preview.dali.cpp` file (start with
`01-your-first-preview/hello.preview.dali.cpp`) and hit `Ctrl+S`. The
preview panel appears on the right within a few seconds (in Docker
mode the first preview also pulls the image — ~2 minutes on a 100 Mbps
connection — subsequent previews start instantly).

## What the tour covers

1. **01 · Your first preview** — a whole `*.preview.dali.cpp` file.
   Save to render.
2. **02 · Preview existing code** — preview one function inside a
   regular `.cpp` via a `// @preview` marker + the CodeLens.
3. **03 · Config & theme** — `// @preview-config` for size, dark
   theme, font scale and RTL locale; `// @preview-preset` for variants.
4. **04 · Focus & state** — `// @preview-state: focus=` to render the
   D-pad highlight (TV apps).
5. **05 · Real multi-file app** — a member function that calls
   factories in other `.cpp` files, previewed without rewriting.
6. **06 · Render paths** — parser / dlopen / full-build, and when each
   one fires.

## Where to from here

- Output channel ("DALi Preview") shows render timings — look for
  `[Perf]` lines to see which path (parser / dlopen / harness) is
  firing for each render.
- Run **"Clean Runtime Images"** any time you need to free disk space.
- Run **"Reset Extension"** if something breaks and you want to start
  over without uninstalling Docker.

You're set up. Happy previewing!
