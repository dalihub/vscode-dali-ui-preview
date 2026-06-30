## Previewing DALi UI with the DALi Preview VS Code extension

This project uses **DALi UI** (Tizen's C++ UI toolkit), and the **DALi Preview** VS Code
extension renders it live in a side panel — write code, save, and a human sees it render.
To produce code the extension can preview, follow these rules.

### 1. Make a file previewable — pick ONE

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
3. **A zero-arg factory** — put `// @dali-preview` on the line above a function that
   returns a view (helpers it calls are pulled in automatically):
   ```cpp
   // @dali-preview
   View MakeHome() { return HomeScreen(SampleVM()).Build(); }
   ```

### 2. Write code that compiles (current dali-ui API)

dali-ui is **non-fluent**: setters return `void`, so do **not** chain. Declare a named
local, call setters as separate statements, add children with `AddChildren({ ... })`, then
`return` the root. The old `New().SetX().Children({...})` fluent style will **not** compile.

Types that are easy to guess wrong: padding/margins are **`Dali::Extents(left, right, top,
bottom)`** (there is no `UiPadding`); colours are `UiColor(0xRRGGBB)`; sizes use
`MATCH_PARENT` or a float. **Don't guess enum/method names from memory** — if unsure, just
save: the extension maps the g++ compile error back to your exact source line as a squiggle,
which is faster to fix than reading SDK headers.

### 3. Compose widgets, images, and render configs

- There's no special Button/TextField — **compose** cards, fields, and buttons from
  `FlexLayout` / `View` panels (`SetCornerRadius`, `SetBackgroundColor`, `SetPadding`,
  `SetRequestedWidth/Height`) with `Label` children.
- **Images:** `ImageView::New("assets/foo.jpg")` with a path **relative to the preview
  file** — the extension stages the asset into the runtime for you.
- **Render configs:** `// @preview-config: name="Phone" width=360 height=640 theme=dark`
  controls the render; two or more configs render side by side. `// @preview-state:
  focus=<var>` shows a keyboard-focus ring; `progress=<0..1>` opens an animation frame.

### 4. Verifying the result

The extension renders into a **webview panel for the human** — an AI agent **cannot read
that panel**. So:

- **Pairing with a person:** just write previewable code and let them watch it update on save.
- **Verifying the render yourself (headless):** read a PNG **and** a JSON scene tree with the
  companion CLI (same runtime + conventions), then look at the image and parse the tree:
  ```bash
  npx -y github:dalihub/dali-ui-preview-cli your.preview.dali.cpp --image out.png
  ```
  `stdout` is the JSON tree (every node's id / type / on-screen bounds / source line);
  `out.png` is the screenshot. A `10` exit code means a compile error in your code (stderr
  names the line). This closes the write → render → check loop without a human in it.
