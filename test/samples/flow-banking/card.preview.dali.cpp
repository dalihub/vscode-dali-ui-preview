// @preview-config: name="Flow Banking — Card", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .Spacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0d1117))
    .Children({

        // ========== STATUS BAR ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(154.0f)
            .SetViewPadding(Extents(98, 98, 49, 0))
            .Children({
                Label::New("9:41").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                Label::New("●●●  5G  ▮ 86%").SetFontSize(39).SetTextColor(UiColor(0xffffff)),
            }),

        // ========== HEADER ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(224.0f)
            .SetViewPadding(Extents(98, 98, 28, 0))
            .Children({
                Label::New("←").SetFontSize(84).SetTextColor(UiColor(0xffffff)),
                Label::New("Card Details").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                Label::New("⚙").SetFontSize(77).SetTextColor(UiColor(0xffffff)),
            }),

        View::New().SetRequestedHeight(54.6f),

        // ========== VIRTUAL CARD (HERO) ==========
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(980.0f)
            .SetBackgroundColor(UiColor(0x00d4a8))
            .SetCornerRadius(98.0f)
            .SetViewMargin(Extents(168, 168, 0, 0))
            .SetViewPadding(Extents(98, 98, 98, 98))
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .AlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("flow.").SetFontSize(84).SetTextColor(UiColor(0x0d1117)),
                            Label::New("DEBIT").SetFontSize(35).SetTextColor(UiColor(0x0a3a33)).SetViewMargin(Extents(0, 0, 7, 0)),
                        }),
                        Label::New("»»»").SetFontSize(77).SetTextColor(UiColor(0x0d1117)),
                    }),

                View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),

                Label::New("4821   ••••   ••••   2847")
                    .SetFontSize(84)
                    .SetTextColor(UiColor(0x0d1117)),

                View::New().SetRequestedHeight(72.8f),

                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .AlignItems(FlexAlign::FLEX_END)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("CARDHOLDER").SetFontSize(32).SetTextColor(UiColor(0x0a3a33)),
                            Label::New("ALEX MORGAN").SetFontSize(46).SetTextColor(UiColor(0x0d1117)).SetViewMargin(Extents(0, 0, 11, 0)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("EXPIRES").SetFontSize(32).SetTextColor(UiColor(0x0a3a33)),
                            Label::New("08/28").SetFontSize(46).SetTextColor(UiColor(0x0d1117)).SetViewMargin(Extents(0, 0, 11, 0)),
                        }),
                        Label::New("VISA").SetFontSize(70).SetTextColor(UiColor(0x0d1117)),
                    }),
            }),

        View::New().SetRequestedHeight(63.7f),

        // ========== CARD PAGINATION DOTS ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::CENTER)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedWidth(28.0f).SetRequestedHeight(28.0f).SetCornerRadius(14.0f).SetViewMargin(Extents(0, 28, 0, 0)),
                View::New().SetBackgroundColor(UiColor(0x00d4a8)).SetRequestedWidth(70.0f).SetRequestedHeight(28.0f).SetCornerRadius(14.0f).SetViewMargin(Extents(0, 28, 0, 0)),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedWidth(28.0f).SetRequestedHeight(28.0f).SetCornerRadius(14.0f),
            }),

        View::New().SetRequestedHeight(91.0f),

        // ========== SPENDING SUMMARY CARD ==========
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x161c24))
            .SetCornerRadius(70.0f)
            .SetViewMargin(Extents(70, 70, 0, 0))
            .SetViewPadding(Extents(70, 70, 63, 63))
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .AlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        Label::New("April spending").SetFontSize(46).SetTextColor(UiColor(0x9ba1b0)),
                        Label::New("view report  →").SetFontSize(39).SetTextColor(UiColor(0x00d4a8)),
                    }),

                View::New().SetRequestedHeight(36.4f),

                Label::New("<font size='119'><color value='#ffffff'>$2,148</color></font><font size='56'><color value='#5e6673'> / $3,500 limit</color></font>")
                    .SetMarkupEnabled(true),

                View::New().SetRequestedHeight(63.7f),

                // Progress bar
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(28.0f)
                    .SetBackgroundColor(UiColor(0x242c36))
                    .SetCornerRadius(14.0f)
                    .Children({
                        View::New().SetBackgroundColor(UiColor(0x00d4a8)).SetRequestedWidth(1372.0f).SetRequestedHeight(28.0f).SetCornerRadius(14.0f),
                    }),

                View::New().SetRequestedHeight(45.5f),

                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        Label::New("61% used").SetFontSize(39).SetTextColor(UiColor(0x9ba1b0)),
                        Label::New("15 days left").SetFontSize(39).SetTextColor(UiColor(0x9ba1b0)),
                    }),
            }),

        View::New().SetRequestedHeight(72.8f),

        // ========== SPENDING CATEGORIES ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(70, 70, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(553.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(56.0f).SetViewPadding(Extents(49, 49, 42, 35)).Children({
                    Label::New("◉ Food").SetFontSize(39).SetTextColor(UiColor(0x9ba1b0)),
                    Label::New("$428").SetFontSize(63).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 28, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(553.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(56.0f).SetViewPadding(Extents(49, 49, 42, 35)).Children({
                    Label::New("◎ Shopping").SetFontSize(39).SetTextColor(UiColor(0x9ba1b0)),
                    Label::New("$612").SetFontSize(63).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 28, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(553.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(56.0f).SetViewPadding(Extents(49, 49, 42, 35)).Children({
                    Label::New("◈ Transport").SetFontSize(39).SetTextColor(UiColor(0x9ba1b0)),
                    Label::New("$184").SetFontSize(63).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 28, 0)),
                }),
            }),

        View::New().SetRequestedHeight(100.1f),

        // ========== CARD CONTROLS HEADER ==========
        Label::New("Card controls")
            .SetFontSize(56)
            .SetTextColor(UiColor(0xffffff))
            .SetViewMargin(Extents(98, 0, 0, 0)),

        View::New().SetRequestedHeight(54.6f),

        // ========== CONTROLS LIST ==========
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x161c24))
            .SetCornerRadius(70.0f)
            .SetViewMargin(Extents(70, 70, 0, 0))
            .Children({
                // Row 1: Freeze card - toggle OFF
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(231.0f).SetViewPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(140.0f).SetRequestedHeight(140.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(42.0f).Children({
                        Label::New("※").SetFontSize(63).SetTextColor(UiColor(0xffffff)),
                    }),
                    FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1330.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Freeze card").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Temporarily disable payments").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetViewMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).SetRequestedWidth(182.0f).SetRequestedHeight(105.0f).SetBackgroundColor(UiColor(0x242c36)).SetCornerRadius(52.5f).SetViewPadding(Extents(14, 14, 7, 7)).Children({
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(84.0f).SetRequestedHeight(84.0f).SetCornerRadius(42.0f),
                    }),
                }),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedHeight(3.5f).SetViewMargin(Extents(56, 56, 0, 0)),

                // Row 2: Location lock - toggle ON
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(231.0f).SetViewPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(140.0f).SetRequestedHeight(140.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(42.0f).Children({
                        Label::New("◉").SetFontSize(63).SetTextColor(UiColor(0xffffff)),
                    }),
                    FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1330.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Location lock").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Only allow in United States").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetViewMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::FLEX_END).AlignItems(FlexAlign::CENTER).SetRequestedWidth(182.0f).SetRequestedHeight(105.0f).SetBackgroundColor(UiColor(0x00d4a8)).SetCornerRadius(52.5f).SetViewPadding(Extents(7, 14, 7, 7)).Children({
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(84.0f).SetRequestedHeight(84.0f).SetCornerRadius(42.0f),
                    }),
                }),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedHeight(3.5f).SetViewMargin(Extents(56, 56, 0, 0)),

                // Row 3: Online payments - toggle ON
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(231.0f).SetViewPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(140.0f).SetRequestedHeight(140.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(42.0f).Children({
                        Label::New("◯").SetFontSize(63).SetTextColor(UiColor(0xffffff)),
                    }),
                    FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1330.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Online payments").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("E-commerce transactions").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetViewMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::FLEX_END).AlignItems(FlexAlign::CENTER).SetRequestedWidth(182.0f).SetRequestedHeight(105.0f).SetBackgroundColor(UiColor(0x00d4a8)).SetCornerRadius(52.5f).SetViewPadding(Extents(7, 14, 7, 7)).Children({
                        View::New().SetBackgroundColor(UiColor(0xffffff)).SetRequestedWidth(84.0f).SetRequestedHeight(84.0f).SetCornerRadius(42.0f),
                    }),
                }),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedHeight(3.5f).SetViewMargin(Extents(56, 56, 0, 0)),

                // Row 4: Replace card - arrow
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(231.0f).SetViewPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(140.0f).SetRequestedHeight(140.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(42.0f).Children({
                        Label::New("◈").SetFontSize(63).SetTextColor(UiColor(0xffffff)),
                    }),
                    FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1330.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Replace card").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Request a new physical card").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetViewMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    Label::New("→").SetFontSize(63).SetTextColor(UiColor(0x5e6673)),
                }),
            }),

        View::New().SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f)),

        // ========== BOTTOM NAV ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_EVENLY)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(252.0f)
            .SetBackgroundColor(UiColor(0x161c24))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("⌂").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Home").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("▭").SetFontSize(77).SetTextColor(UiColor(0x00d4a8)),
                    Label::New("Cards").SetFontSize(35).SetTextColor(UiColor(0x00d4a8)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("⇄").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Transfer").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("◎").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Profile").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
            }),
    });
