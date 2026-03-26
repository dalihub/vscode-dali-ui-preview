return FlexLayout::New()
    .Direction(FlexDirection::COLUMN)
    .AlignItems(FlexAlign::CENTER)
    .JustifyContent(FlexJustify::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x1e1e2e))
    .Children({
        Label::New("Hello DALi!")
            .SetFontSize(48)
            .SetTextColor(UiColor(0xFFFFFF)),
    });
