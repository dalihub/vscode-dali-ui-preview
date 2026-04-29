# Open a sample and try it

Once your runtime is set up (Docker installed, or Native prefix
pointed), this is where you confirm everything works.

Click **"Open Sample"** below. The extension drops a small
`hello-dali.preview.dali.cpp` into this workspace and opens it. The
preview panel should appear on the right within a few seconds (in
Docker mode the first preview also pulls the image — ~2 minutes on a
100 Mbps connection — subsequent previews start instantly).

If the preview doesn't auto-open, hit `Ctrl+S` once to trigger the
first render.

## Things to try

1. **Edit the text.** Change `"Hello, DALi!"` to anything — the
   preview updates as you save.
2. **Resize the preview panel.** Drag the divider; the layout reflows.
3. **Add a third Label.** Inside the `.Children({ ... })` block, add:
   ```cpp
   Label::New("My new line")
       .SetFontSize(24)
       .SetTextColor(UiColor(0x66ccff)),
   ```
4. **Change the background.** Replace `0x1e1e2e` in
   `SetBackgroundColor(UiColor(0x1e1e2e))` with another hex colour.

## Where to from here

- Output channel ("DALi Preview") shows render timings — look for
  `[Perf]` lines to see which path (parser / dlopen / harness) is
  firing for each render.
- Run **"Clean Runtime Images"** any time you need to free disk space.
- Run **"Reset Extension"** if something breaks and you want to start
  over without uninstalling Docker.

You're set up. Happy previewing!
