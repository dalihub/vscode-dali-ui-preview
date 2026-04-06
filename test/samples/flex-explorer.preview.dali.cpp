return FlexLayout::New()
    .Direction(FlexDirection::COLUMN)
    .AlignItems(FlexAlign::CENTER)
    .JustifyContent(FlexJustify::SPACE_BETWEEN)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        Label::New("Header")
            .SetFontSize(24.0f),
        View::New()
            .SetBackgroundColor(UiColor(0x007acc))
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(100.0f),
        Label::New("Footer")
            .SetFontSize(16.0f),
    });
