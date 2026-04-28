return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetPadding(Extents(30, 30, 30, 30))
    .SetBackgroundColor(UiColor(0x1a1a2e))
    .Children({
        Label::New("Test")
            .SetFontSize(28)
            .SetTextColor(UiColor(0xFF0000)),
        View::New()
            .SetBackgroundColor(UiColor(0x4a90d9))
            .SetRequestedWidth(400.0f)
            .SetRequestedHeight(250.0f),
        Label::New("25 C")
            .SetFontSize(100)
            .SetTextColor(UiColor(0xE0E0E0)),
    });
