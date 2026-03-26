return FlexLayout::New()
    .Direction(FlexDirection::COLUMN)
    .AlignItems(FlexAlign::STRETCH)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetViewPadding(Extents(24, 24, 32, 24))
    .SetBackgroundColor(UiColor(0x121212))
    .Children({

        // ── Header ──
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::FLEX_END)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(0, 0, 0, 16))
            .Children({
                Label::New("Gallery")
                    .SetFontSize(36)
                    .SetTextColor(UiColor(0xFFFFFF)),
                Label::New("24 Photos")
                    .SetFontSize(14)
                    .SetTextColor(UiColor(0x888888)),
            }),

        // ── Divider ──
        View::New()
            .SetBackgroundColor(UiColor(0x2A2A2A))
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(1.0f)
            .SetViewMargin(Extents(0, 0, 0, 16)),

        // ── Photo Grid 3x3 ──
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .Wrap(FlexWrap::WRAP)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                // Row 1
                View::New().SetBackgroundColor(UiColor(0x6C63FF)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0xFF6584)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0x43E97B)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                // Row 2
                View::New().SetBackgroundColor(UiColor(0xF7971E)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0x38F9D7)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0xA18CD1)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                // Row 3
                View::New().SetBackgroundColor(UiColor(0xFDA085)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0x667EEA)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0xF093FB)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetViewMargin(Extents(0, 0, 0, 8)),
            }),

        // ── Spacer ──
        View::New().SetRequestedHeight(20.0f),

        // ── Category Pills ──
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::CENTER)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                View::New()
                    .SetBackgroundColor(UiColor(0x6C63FF))
                    .SetViewPadding(Extents(28, 28, 10, 10))
                    .SetViewMargin(Extents(0, 8, 0, 0))
                    .Children({ Label::New("All").SetFontSize(14).SetTextColor(UiColor(0xFFFFFF)) }),
                View::New()
                    .SetBackgroundColor(UiColor(0x2A2A2A))
                    .SetViewPadding(Extents(28, 28, 10, 10))
                    .SetViewMargin(Extents(0, 8, 0, 0))
                    .Children({ Label::New("Favorites").SetFontSize(14).SetTextColor(UiColor(0xAAAAAA)) }),
                View::New()
                    .SetBackgroundColor(UiColor(0x2A2A2A))
                    .SetViewPadding(Extents(28, 28, 10, 10))
                    .Children({ Label::New("Recent").SetFontSize(14).SetTextColor(UiColor(0xAAAAAA)) }),
            }),
    });
