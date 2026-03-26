return StackLayout::New(StackOrientation::VERTICAL)
    .Spacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0a0a14))
    .Children({

        // ===== TOP BAR =====
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(40.0f)
            .SetViewPadding(Extents(40, 40, 0, 0))
            .SetBackgroundColor(UiColor(0x0f0f1a))
            .Children({
                Label::New("12:30").SetFontSize(18).SetTextColor(UiColor(0xCCCCCC)),
                Label::New("Samsung TV").SetFontSize(14).SetTextColor(UiColor(0x888899)),
                Label::New("Settings").SetFontSize(14).SetTextColor(UiColor(0x666677)),
            }),

        // ===== HERO BANNER =====
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .JustifyContent(FlexJustify::FLEX_END)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(180.0f)
            .SetViewMargin(Extents(40, 40, 12, 0))
            .SetViewPadding(Extents(24, 24, 0, 16))
            .SetBackgroundColor(UiColor(0x1a2744))
            .Children({
                Label::New("Nature Documentary").SetFontSize(24).SetTextColor(UiColor(0xFFFFFF)),
                Label::New("Explore the wonders of the natural world").SetFontSize(12).SetTextColor(UiColor(0x8888AA)),
            }),

        // Progress bar
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(24.0f)
            .SetViewMargin(Extents(40, 40, 0, 0))
            .SetBackgroundColor(UiColor(0x141428))
            .SetViewPadding(Extents(24, 24, 0, 0))
            .Children({
                View::New().SetBackgroundColor(UiColor(0x4a90d9)).SetRequestedWidth(80.0f).SetRequestedHeight(3.0f),
                View::New().SetBackgroundColor(UiColor(0x333344)).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.0f),
            }),

        // ===== CONTINUE WATCHING =====
        Label::New("Continue Watching")
            .SetFontSize(16)
            .SetTextColor(UiColor(0xDDDDEE))
            .SetRequestedHeight(28.0f)
            .SetViewMargin(Extents(40, 0, 12, 0)),

        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::FLEX_START)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(110.0f)
            .SetViewPadding(Extents(40, 40, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).SetViewMargin(Extents(0, 10, 0, 0)).Children({
                    View::New().SetBackgroundColor(UiColor(0x2a3f5f)).SetRequestedWidth(160.0f).SetRequestedHeight(86.0f),
                    Label::New("Ocean Blue").SetFontSize(11).SetTextColor(UiColor(0xAABBCC)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).SetViewMargin(Extents(0, 10, 0, 0)).Children({
                    View::New().SetBackgroundColor(UiColor(0x3f5f2a)).SetRequestedWidth(160.0f).SetRequestedHeight(86.0f),
                    Label::New("Mountain Trek").SetFontSize(11).SetTextColor(UiColor(0xAABBCC)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).SetViewMargin(Extents(0, 10, 0, 0)).Children({
                    View::New().SetBackgroundColor(UiColor(0x5f2a3f)).SetRequestedWidth(160.0f).SetRequestedHeight(86.0f),
                    Label::New("City Lights").SetFontSize(11).SetTextColor(UiColor(0xAABBCC)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).Children({
                    View::New().SetBackgroundColor(UiColor(0x4f3f1a)).SetRequestedWidth(160.0f).SetRequestedHeight(86.0f),
                    Label::New("Sunset Valley").SetFontSize(11).SetTextColor(UiColor(0xAABBCC)),
                }),
            }),

        // ===== RECOMMENDED =====
        Label::New("Recommended")
            .SetFontSize(16)
            .SetTextColor(UiColor(0xDDDDEE))
            .SetRequestedHeight(28.0f)
            .SetViewMargin(Extents(40, 0, 8, 0)),

        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::FLEX_START)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(80.0f)
            .SetViewPadding(Extents(40, 40, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).SetViewMargin(Extents(0, 16, 0, 0)).Children({
                    View::New().SetBackgroundColor(UiColor(0xE50914)).SetRequestedWidth(52.0f).SetRequestedHeight(52.0f),
                    Label::New("Netflix").SetFontSize(10).SetTextColor(UiColor(0x9999AA)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).SetViewMargin(Extents(0, 16, 0, 0)).Children({
                    View::New().SetBackgroundColor(UiColor(0xFF0000)).SetRequestedWidth(52.0f).SetRequestedHeight(52.0f),
                    Label::New("YouTube").SetFontSize(10).SetTextColor(UiColor(0x9999AA)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).SetViewMargin(Extents(0, 16, 0, 0)).Children({
                    View::New().SetBackgroundColor(UiColor(0x00A8E1)).SetRequestedWidth(52.0f).SetRequestedHeight(52.0f),
                    Label::New("Prime").SetFontSize(10).SetTextColor(UiColor(0x9999AA)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0x113CCF)).SetRequestedWidth(52.0f).SetRequestedHeight(52.0f),
                    Label::New("Disney+").SetFontSize(10).SetTextColor(UiColor(0x9999AA)),
                }),
            }),
    });
