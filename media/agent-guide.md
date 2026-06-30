## Writing DALi UI that this project can preview

This project uses **DALi UI** (Tizen's C++ UI toolkit). Two tools render it:

- the **DALi Preview VS Code extension** shows a live preview **to the human** in a side panel;
- the **`dali-ui-preview-cli`** renders headlessly to a **PNG + a JSON scene tree** — the one
  **you (the AI agent) can actually read**.

> ⚠️ **You cannot see the extension's preview panel** — it is a webview only the human sees.
> So you must **verify your DALi UI with the CLI**, not by assuming the panel looks right.

### Verify every change with the CLI (your eyes)

Whenever you write or edit DALi UI, render it and look:

```bash
npx -y github:dalihub/dali-ui-preview-cli <your.preview.dali.cpp> --image .dali/out.png
```

- **stdout** is the JSON scene tree — every node's id / type / role / on-screen bounds /
  source line / properties. Parse it.
- **`.dali/out.png`** is the screenshot — **Read it** to see the layout.
- **exit codes:** `0` ok · `10` compile error in *your* code (stderr carries
  `{"phase":"compile","message":...,"sourceLine":N}` — fix that line) · `11` render error ·
  `12` Docker unavailable.

Loop: **write → run the CLI → read the PNG + tree → fix → repeat** until it's right. The CLI
uses the **same runtime and conventions** as this extension, so what it renders is what the
human's panel shows. (Requires Docker; the runtime image auto-pulls on first render. If Docker
isn't installed, ask the human — it needs `sudo`.)

### Make a file previewable — pick ONE

1. **A `*.preview.dali.cpp` file.** The *whole file* is the body of a preview function:
   build your view and `return` the root.
   ```cpp
   FlexLayout root = FlexLayout::New();
   root.SetDirection(FlexDirection::COLUMN);
   root.SetBackgroundColor(UiColor(0x1e1e2e));

   Label title = Label::New("Hello, DALi!");
   title.SetFontSize(48);
   title.SetTextColor(UiColor(0xFFFFFF));

   root.AddChildren({ title });
   return root;
   ```
2. **Markers in a regular `.cpp`/`.h`** — wrap the region to preview:
   ```cpp
   // @dali-preview-begin
   /* build root ... */
   return root;
   // @dali-preview-end
   ```
3. **A zero-arg factory** — put `// @dali-preview` on the line above a function that returns a
   view (helpers it calls are pulled in automatically):
   ```cpp
   // @dali-preview
   View MakeHome() { return HomeScreen(SampleVM()).Build(); }
   ```

### Write code that compiles (current dali-ui API)

dali-ui is **non-fluent**: setters return `void`, so do **not** chain. Declare a named local,
call setters as separate statements, add children with `AddChildren({ ... })`, then `return`
the root. The old `New().SetX().Children({...})` fluent style will **not** compile.

Types that are easy to guess wrong: padding/margins are **`Dali::Extents(left, right, top,
bottom)`** (there is no `UiPadding`); colours are `UiColor(0xRRGGBB)`; sizes use `MATCH_PARENT`
or a float. **Don't guess enum/method names from memory** — if unsure, just run the CLI: a
`10` compile error names the exact symbol and line, which is faster than reading SDK headers.

### Compose widgets, images, and render configs

- There's no special Button/TextField — **compose** cards, fields, and buttons from
  `FlexLayout` / `View` panels (`SetCornerRadius`, `SetBackgroundColor`, `SetPadding`,
  `SetRequestedWidth/Height`) with `Label` children.
- **Images:** `ImageView::New("assets/foo.jpg")` with a path **relative to the preview file**.
- **Render configs:** `// @preview-config: name="Phone" width=360 height=640 theme=dark`
  controls the render; `// @preview-state: focus=<var>` shows a keyboard-focus ring;
  `progress=<0..1>` opens an animation frame.

### Working alongside the human

The human gets the extension's **live panel for free** as you edit — useful when you're pairing
and they can steer. But that panel is *theirs*, not a substitute for your own check: when you
need to know whether your UI is correct, **the CLI is your source of truth.**
