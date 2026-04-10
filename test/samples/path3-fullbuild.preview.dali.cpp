// 🔨 Full harness build test (~1100ms)
// Same chain code as path1, but to test full build path:
//   1. Kill the preview_server process, OR
//   2. Delete /tmp/dali_preview/preview_server binary
//   3. Then open this file and run preview
// Expected log: previewServer: null, buildAndRun (full harness): ~1100ms

return FlexLayout::New()
    .Direction(FlexDirection::COLUMN)
    .AlignItems(FlexAlign::CENTER)
    .JustifyContent(FlexJustify::CENTER)
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
            .SetViewMargin(Extents(0, 0, 16, 0)),
    });
