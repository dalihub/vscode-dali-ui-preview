// ⚡ Parser path test (~80ms)
// Pure fluent chain — TypeScript parses directly, NO C++ compile.
// Expected log: parse: 0ms (success), renderJson: ~80ms

return FlexLayout::New()
    .Direction(FlexDirection::COLUMN)
    .AlignItems(FlexAlign::STRETCH)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetViewPadding(Extents(20, 20, 24, 20))
    .SetBackgroundColor(UiColor(0x1B1B2F))
    .Children({
        Label::New("Parser Path")
            .SetFontSize(28)
            .SetTextColor(UiColor(0x00FF88)),
        View::New()
            .SetBackgroundColor(UiColor(0x333355))
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(2.0f)
            .SetViewMargin(Extents(0, 0, 12, 12)),
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                View::New().SetBackgroundColor(UiColor(0x6C63FF)).SetRequestedWidth(100.0f).SetRequestedHeight(80.0f),
                View::New().SetBackgroundColor(UiColor(0xFF6584)).SetRequestedWidth(100.0f).SetRequestedHeight(80.0f),
                View::New().SetBackgroundColor(UiColor(0x43E97B)).SetRequestedWidth(100.0f).SetRequestedHeight(80.0f),
            }),
        Label::New("No C++ compile needed")
            .SetFontSize(12)
            .SetTextColor(UiColor(0x888888))
            .SetViewMargin(Extents(0, 0, 16, 0)),
    });
