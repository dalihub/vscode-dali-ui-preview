return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::STRETCH)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetPadding(Extents(24, 24, 32, 24))
    .SetBackgroundColor(UiColor(0x121212))
    .Children({

        // ── Header ──
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::FLEX_END)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(0, 0, 0, 16))
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
            .SetMargin(Extents(0, 0, 0, 16)),

        // ── Photo Grid 3x3 ──
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetWrap(FlexWrap::WRAP)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                // Row 1
                View::New().SetBackgroundColor(UiColor(0x6C63FF)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0xFF6584)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0x43E97B)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                // Row 2
                View::New().SetBackgroundColor(UiColor(0xF7971E)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0x38F9D7)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0xA18CD1)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                // Row 3
                View::New().SetBackgroundColor(UiColor(0xFDA085)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0x667EEA)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
                View::New().SetBackgroundColor(UiColor(0xF093FB)).SetRequestedWidth(150.0f).SetRequestedHeight(150.0f).SetMargin(Extents(0, 0, 0, 8)),
            }),

        // ── Spacer ──
        View::New().SetRequestedHeight(20.0f),

        // ── Category Pills ──
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::CENTER)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                View::New()
                    .SetBackgroundColor(UiColor(0x6C63FF))
                    .SetPadding(Extents(28, 28, 10, 10))
                    .SetMargin(Extents(0, 8, 0, 0))
                    .Children({ Label::New("All").SetFontSize(14).SetTextColor(UiColor(0xFFFFFF)) }),
                View::New()
                    .SetBackgroundColor(UiColor(0x2A2A2A))
                    .SetPadding(Extents(28, 28, 10, 10))
                    .SetMargin(Extents(0, 8, 0, 0))
                    .Children({ Label::New("Favorites").SetFontSize(14).SetTextColor(UiColor(0xAAAAAA)) }),
                View::New()
                    .SetBackgroundColor(UiColor(0x2A2A2A))
                    .SetPadding(Extents(28, 28, 10, 10))
                    .Children({ Label::New("Recent").SetFontSize(14).SetTextColor(UiColor(0xAAAAAA)) }),
            }),
    });
