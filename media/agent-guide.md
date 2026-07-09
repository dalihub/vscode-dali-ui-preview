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

### Colors, padding, and components defined in OTHER files

Real UI keeps colors, spacing, and reusable widgets in shared files. The preview **can pull
those in — but only when they are in a specific form.** Get this right, or the value silently
renders as a placeholder.

**✅ What gets pulled in — and how:**

- A shared **color / padding / size constant** must be a **`namespace` member** or a
  **`const` / `constexpr`** in a header, and the preview file must **`#include` that header by
  relative path**:
  ```cpp
  // theme/tokens.h
  namespace theme { const uint32_t ACCENT = 0xff3366; const int PAD = 24; }
  ```
  ```cpp
  // in your preview file
  #include "../theme/tokens.h"
  root.SetBackgroundColor(UiColor(theme::ACCENT));                 // the REAL color
  root.SetPadding(Extents(theme::PAD, theme::PAD, theme::PAD, theme::PAD));
  ```
- A **reusable component** must be a **free function that returns a `View`** in a header (or
  its same-name `.cpp`), then `#include`d:
  ```cpp
  // widgets/cards.h
  View MakeStatCard(const char* title, const char* value);
  ```
  ```cpp
  #include "widgets/cards.h"
  root.AddChildren({ MakeStatCard("Spent", "$2,148") });
  ```
- Includes are followed **transitively** (header → header) within the project (the folder that
  contains `.git` / `package.json`). A member-function screen (`Class::Build()`) works too —
  a referenced model gets **sample data** synthesised.

**❌ What is NOT pulled in → renders as a grey/blank placeholder, with no compile error:**

- **`#define` macros.** `#define ACCENT 0xff3366` is **not** collected — change it to a
  `constexpr` / namespace constant.
- Constants built with a **multi-line initializer**.
- Anything the preview file does **not** `#include` **by relative path** — a `<system>`
  include or a header found only via a build-system `-I` flag is **not** followed.
- Symbols defined outside the project folder.

**How to notice it failed:** a color that comes out **grey (`0x888888`)**, a component area
that is **blank/empty**, or text that reads `"Merchant"` / `"Sample"` means the symbol was not
resolved. **Render with the CLI and read the tree/PNG** — a placeholder is the tool saying "I
couldn't find that symbol." Fix by (1) making it a namespace/const constant or a
`View`-returning free function, and (2) adding the relative `#include`.

### When a screen can't be previewed as-is — do this, and tell the human

A preview is **one static frame**. Some things cannot render faithfully. Recognize them,
produce the closest previewable slice, and **tell the human what you approximated** — never
present a placeholder-filled render as if it were the real thing.

- **Runtime / async data** (network, DB, streaming, `GetUser()` …): it won't populate. **Inject
  sample data** — build the view with example values (or a sample model) and say "showing
  sample data."
- **Screen/controller classes with constructor dependencies** (services, view-models): pass a
  **sample instance**. If it needs a live service, wrap only the view-building part in a small
  preview factory instead of constructing the whole controller.
- **Manager-resolved themes / locale / app singletons**: those are set up by the running app,
  not the preview. Use literal values, or `// @preview-config` for theme/locale, and note it.
- **Focus / animation / scroll / selection / "playing" states**: a static frame is one moment.
  Use directives — `// @preview-state: focus=<var>` draws a focus ring; `progress=<0..1>`
  opens an animation frame.
- **A whole app screen** assembled across many files/handlers: extract just the
  **view-building slice** into a `.preview.dali.cpp` (or a marked region), and tell the human
  which parts are sampled or omitted.

### Compose widgets, images, and render configs

- There's no special Button/TextField — **compose** cards, fields, and buttons from
  `FlexLayout` / `View` panels (`SetCornerRadius`, `SetBackgroundColor`, `SetPadding`,
  `SetRequestedWidth/Height`) with `Label` children.
- **Images:** `ImageView::New("assets/foo.jpg")` with a path **relative to the preview file**.
  An unresolvable or remote (`http(s)://`) URL renders a **gray placeholder** at the image's
  size — a gray box means the path didn't resolve.
- **Render configs:** `// @preview-config: name="Phone" width=360 height=640 theme=dark`
  controls the render; `// @preview-state: focus=<var>` shows a keyboard-focus ring;
  `progress=<0..1>` opens an animation frame.

### Working alongside the human

The human gets the extension's **live panel for free** as you edit — useful when you're pairing
and they can steer. But that panel is *theirs*, not a substitute for your own check: when you
need to know whether your UI is correct, **the CLI is your source of truth.**
