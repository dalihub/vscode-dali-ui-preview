return StackLayout::New(StackOrientation::VERTICAL)
    .Spacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x1a1a2e))
    .SetViewPadding(Extents(32, 32, 24, 16))
    .Children({

        // ── Header ──
        Label::New("Settings")
            .SetFontSize(36)
            .SetTextColor(UiColor(0xFFFFFF))
            .SetRequestedHeight(48.0f),

        // ── Divider ──
        View::New()
            .SetBackgroundColor(UiColor(0x6c63ff))
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(2.0f)
            .SetViewMargin(Extents(0, 0, 8, 16)),

        // ── Display Section ──
        Label::New("Display")
            .SetFontSize(14)
            .SetTextColor(UiColor(0x6c63ff))
            .SetRequestedHeight(22.0f),

        // Brightness row
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(44.0f)
            .SetBackgroundColor(UiColor(0x22223a))
            .SetViewPadding(Extents(16, 16, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0xf9a825)).SetRequestedWidth(24.0f).SetRequestedHeight(24.0f),
                    Label::New("Brightness").SetFontSize(18).SetTextColor(UiColor(0xe0e0e0)).SetViewMargin(Extents(12, 0, 0, 0)),
                }),
                View::New().SetBackgroundColor(UiColor(0x4caf50)).SetRequestedWidth(48.0f).SetRequestedHeight(22.0f),
            }),

        View::New().SetBackgroundColor(UiColor(0x2a2a48)).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(1.0f),

        // Dark Mode row
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(44.0f)
            .SetBackgroundColor(UiColor(0x22223a))
            .SetViewPadding(Extents(16, 16, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0x7c4dff)).SetRequestedWidth(24.0f).SetRequestedHeight(24.0f),
                    Label::New("Dark Mode").SetFontSize(18).SetTextColor(UiColor(0xe0e0e0)).SetViewMargin(Extents(12, 0, 0, 0)),
                }),
                View::New().SetBackgroundColor(UiColor(0x4caf50)).SetRequestedWidth(48.0f).SetRequestedHeight(22.0f),
            }),

        // ── Spacer ──
        View::New().SetRequestedHeight(12.0f),

        // ── Sound Section ──
        Label::New("Sound")
            .SetFontSize(14)
            .SetTextColor(UiColor(0x6c63ff))
            .SetRequestedHeight(22.0f),

        // Volume row
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(44.0f)
            .SetBackgroundColor(UiColor(0x1e2038))
            .SetViewPadding(Extents(16, 16, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0xef5350)).SetRequestedWidth(24.0f).SetRequestedHeight(24.0f),
                    Label::New("Volume").SetFontSize(18).SetTextColor(UiColor(0xe0e0e0)).SetViewMargin(Extents(12, 0, 0, 0)),
                }),
                View::New().SetBackgroundColor(UiColor(0x4caf50)).SetRequestedWidth(48.0f).SetRequestedHeight(22.0f),
            }),

        View::New().SetBackgroundColor(UiColor(0x2a2a48)).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(1.0f),

        // Vibration row
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(44.0f)
            .SetBackgroundColor(UiColor(0x1e2038))
            .SetViewPadding(Extents(16, 16, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0xff7043)).SetRequestedWidth(24.0f).SetRequestedHeight(24.0f),
                    Label::New("Vibration").SetFontSize(18).SetTextColor(UiColor(0xe0e0e0)).SetViewMargin(Extents(12, 0, 0, 0)),
                }),
                View::New().SetBackgroundColor(UiColor(0x555568)).SetRequestedWidth(48.0f).SetRequestedHeight(22.0f),
            }),

        // ── Spacer ──
        View::New().SetRequestedHeight(12.0f),

        // ── Network Section ──
        Label::New("Network")
            .SetFontSize(14)
            .SetTextColor(UiColor(0x6c63ff))
            .SetRequestedHeight(22.0f),

        // Wi-Fi row
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(44.0f)
            .SetBackgroundColor(UiColor(0x1c1e36))
            .SetViewPadding(Extents(16, 16, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0x42a5f5)).SetRequestedWidth(24.0f).SetRequestedHeight(24.0f),
                    Label::New("Wi-Fi").SetFontSize(18).SetTextColor(UiColor(0xe0e0e0)).SetViewMargin(Extents(12, 0, 0, 0)),
                }),
                View::New().SetBackgroundColor(UiColor(0x4caf50)).SetRequestedWidth(48.0f).SetRequestedHeight(22.0f),
            }),

        View::New().SetBackgroundColor(UiColor(0x2a2a48)).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(1.0f),

        // Bluetooth row
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(44.0f)
            .SetBackgroundColor(UiColor(0x1c1e36))
            .SetViewPadding(Extents(16, 16, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0x1565c0)).SetRequestedWidth(24.0f).SetRequestedHeight(24.0f),
                    Label::New("Bluetooth").SetFontSize(18).SetTextColor(UiColor(0xe0e0e0)).SetViewMargin(Extents(12, 0, 0, 0)),
                }),
                View::New().SetBackgroundColor(UiColor(0x555568)).SetRequestedWidth(48.0f).SetRequestedHeight(22.0f),
            }),

        View::New().SetBackgroundColor(UiColor(0x2a2a48)).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(1.0f),

        // Airplane Mode row
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(44.0f)
            .SetBackgroundColor(UiColor(0x1c1e36))
            .SetViewPadding(Extents(16, 16, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0x66bb6a)).SetRequestedWidth(24.0f).SetRequestedHeight(24.0f),
                    Label::New("Airplane Mode").SetFontSize(18).SetTextColor(UiColor(0xe0e0e0)).SetViewMargin(Extents(12, 0, 0, 0)),
                }),
                View::New().SetBackgroundColor(UiColor(0x555568)).SetRequestedWidth(48.0f).SetRequestedHeight(22.0f),
            }),

        // ── Footer ──
        View::New().SetRequestedHeight(16.0f),
        Label::New("Version 2.4.1")
            .SetFontSize(12)
            .SetTextColor(UiColor(0x555568))
            .SetRequestedHeight(20.0f),
    });
