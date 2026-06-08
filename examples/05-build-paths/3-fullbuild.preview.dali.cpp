// Full harness build test (~1100ms)
// Same chain code as path1; this file exists to measure the slow path.
//
// To force the full g++ harness build:
//   1. Open VS Code Settings (Ctrl+,)
//   2. Search for "daliPreview.disablePreviewServer"
//   3. Set it to true (workspace or user settings — workspace recommended)
//   4. Reload Window (Ctrl+Shift+P -> "Developer: Reload Window")
//   5. Open this file and save / re-trigger preview
//
// Expected output channel log (DALi Preview):
//   [PreviewServer] Skipped (daliPreview.disablePreviewServer is true) ...
//   [Perf]    previewServer: null
//   Preview updated in ~1.1s [compile]
//
// To restore fast paths: flip disablePreviewServer back to false and reload.
//
// Why prior instructions ("kill preview_server process" / "delete binary")
// no longer worked: the extension auto-spawns the server on activate and
// auto-rebuilds the binary if missing, so reload-window undoes both within
// hundreds of milliseconds. The setting above is the durable switch.

return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::CENTER)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x1B1B2F))
    .Children({
        Label::New("Full Build Path")
            .SetFontSize(28)
            .SetTextColor(UiColor(0xFF4444)),
        Label::New("g++ full harness compile")
            .SetFontSize(14)
            .SetTextColor(UiColor(0x888888))
            .SetMargin(Extents(0, 0, 16, 0)),
    });
