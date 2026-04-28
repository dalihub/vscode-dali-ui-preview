// @preview-config: name="Boarding Pass", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .SetSpacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0xeef0f5))
    .Children({

        // ========== STATUS BAR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(154.0f)
            .SetPadding(Extents(98, 98, 49, 0))
            .Children({
                Label::New("9:41").SetFontSize(49).SetTextColor(UiColor(0x1a1a2e)),
                Label::New("●●●  5G  ▮ 81%").SetFontSize(39).SetTextColor(UiColor(0x1a1a2e)),
            }),

        // ========== HEADER ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(224.0f)
            .SetPadding(Extents(98, 98, 28, 0))
            .Children({
                Label::New("←").SetFontSize(91).SetTextColor(UiColor(0x1a1a2e)),
                Label::New("Boarding Pass").SetFontSize(63).SetTextColor(UiColor(0x1a1a2e)),
                Label::New("⋯").SetFontSize(91).SetTextColor(UiColor(0x1a1a2e)),
            }),

        // ========== AIRLINE BADGE ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(119, 119, 14, 49))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New()
                        .SetDirection(FlexDirection::COLUMN)
                        .SetJustifyContent(FlexJustify::CENTER)
                        .SetAlignItems(FlexAlign::CENTER)
                        .SetRequestedWidth(140.0f)
                        .SetRequestedHeight(140.0f)
                        .SetBackgroundColor(UiColor(0x0b2545))
                        .SetCornerRadius(70.0f)
                        .Children({
                            Label::New("LH").SetFontSize(46).SetTextColor(UiColor(0xffc72c)),
                        }),
                    Label::New("Lufthansa").SetFontSize(49).SetTextColor(UiColor(0x1a1a2e)).SetMargin(Extents(42, 0, 0, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).Children({
                    View::New().SetBackgroundColor(UiColor(0x1f8a4c)).SetRequestedWidth(28.0f).SetRequestedHeight(28.0f).SetCornerRadius(14.0f),
                    Label::New("BOARDING").SetFontSize(39).SetTextColor(UiColor(0x1f8a4c)).SetMargin(Extents(28, 0, 0, 0)),
                }),
            }),

        // ========== BOARDING PASS CARD ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x0b2545))
            .SetCornerRadius(98.0f)
            .SetMargin(Extents(84, 84, 0, 0))
            .SetPadding(Extents(112, 112, 105, 98))
            .Children({

                // --- Top info row: FLIGHT + DATE ---
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("FLIGHT").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("LH 440").SetFontSize(77).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 21, 0)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                            Label::New("DATE").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("Apr 15, 2026").SetFontSize(77).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 21, 0)),
                        }),
                    }),

                View::New().SetRequestedHeight(154.7f),

                // --- Route: FRA → SFO ---
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("FRANKFURT").SetFontSize(39).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("FRA").SetFontSize(203).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 7, 0)),
                            Label::New("07:45").SetFontSize(49).SetTextColor(UiColor(0xcbd5e1)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).SetJustifyContent(FlexJustify::CENTER).Children({
                            Label::New("◆").SetFontSize(84).SetTextColor(UiColor(0xffc72c)),
                            View::New().SetRequestedWidth(420.0f).SetRequestedHeight(3.5f).SetBackgroundColor(UiColor(0x4a6b9a)).SetMargin(Extents(0, 0, 28, 28)),
                            Label::New("11h 35m").SetFontSize(39).SetTextColor(UiColor(0x7b90b5)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                            Label::New("SAN FRANCISCO").SetFontSize(39).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("SFO").SetFontSize(203).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 7, 0)),
                            Label::New("10:20").SetFontSize(49).SetTextColor(UiColor(0xcbd5e1)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                    }),

                View::New().SetRequestedHeight(136.5f),

                // --- Divider ---
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(14.0f).Children({
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                    View::New().SetBackgroundColor(UiColor(0x4a6b9a)).SetRequestedWidth(28.0f).SetRequestedHeight(7.0f),
                }),

                View::New().SetRequestedHeight(100.1f),

                // --- Passenger info grid: 3 cols × 2 rows ---
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("PASSENGER").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("ALEX MORGAN").SetFontSize(60).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("CLASS").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("BUSINESS").SetFontSize(60).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("SEAT").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("4A").SetFontSize(60).SetTextColor(UiColor(0xffc72c)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                    }),

                View::New().SetRequestedHeight(91.0f),

                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("GATE").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("Z18").SetFontSize(60).SetTextColor(UiColor(0xffc72c)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("BOARDING").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("07:05").SetFontSize(60).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("GROUP").SetFontSize(35).SetTextColor(UiColor(0x7b90b5)),
                            Label::New("2").SetFontSize(60).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 14, 0)),
                        }),
                    }),

                View::New().SetRequestedHeight(118.3f),
                View::New().SetBackgroundColor(UiColor(0x1b3763)).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                View::New().SetRequestedHeight(118.3f),

                // --- Barcode (stylized vertical bars) ---
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(266.0f)
                    .Children({
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(14.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(21.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(14.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(10.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(21.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(14.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(10.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(17.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(21.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(14.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(10.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(21.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(14.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(17.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(10.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(21.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(14.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(21.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(10.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(14.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(17.5f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(7.0f).SetRequestedHeight(266.0f),
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(10.5f).SetRequestedHeight(266.0f),
                    }),

                View::New().SetRequestedHeight(63.7f),
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetRequestedWidth(MATCH_PARENT).Children({
                    Label::New("LH0440  ·  FRA-SFO  ·  15APR  ·  BUSINESS").SetFontSize(39).SetTextColor(UiColor(0x7b90b5)),
                }),
            }),

        View::New().SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f)),

        // ========== CTA: ADD TO WALLET ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::CENTER)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(196.0f)
            .SetBackgroundColor(UiColor(0x1a1a2e))
            .SetCornerRadius(98.0f)
            .SetMargin(Extents(280, 280, 0, 0))
            .Children({
                Label::New("Add to Wallet  →").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
            }),
    });
