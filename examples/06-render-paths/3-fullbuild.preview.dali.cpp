// Full harness build (~1100ms)
// Same chain as 1-parser; this file exists to measure the slow path.
// Status bar: 🔨 Compile
//
// The full build is normally only a fallback. To force it:
//   1. Open VS Code Settings (Ctrl+,)
//   2. Search for "daliPreview.disablePreviewServer"
//   3. Set it to true (workspace recommended)
//   4. Reload Window (Ctrl+Shift+P -> "Developer: Reload Window")
//   5. Open this file and save / re-trigger preview
//
// Expected output channel log (DALi Preview):
//   [PreviewServer] Skipped (daliPreview.disablePreviewServer is true) ...
//   [Perf]    previewServer: null
//   Preview updated in ~1.1s [compile]
//
// To restore the fast paths: flip disablePreviewServer back to false and reload.

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
