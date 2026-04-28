// @preview-config: name="Flow Banking — Home", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .SetSpacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0d1117))
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
                Label::New("9:41").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                Label::New("●●●  5G  ▮ 86%").SetFontSize(39).SetTextColor(UiColor(0xffffff)),
            }),

        // ========== HEADER ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(252.0f)
            .SetPadding(Extents(98, 98, 14, 0))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).Children({
                    ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait3.jpg")
                        .SetRequestedWidth(154.0f)
                        .SetRequestedHeight(154.0f)
                        .SetCornerRadius(77.0f),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetMargin(Extents(42, 0, 0, 0)).Children({
                        Label::New("Welcome back").SetFontSize(39).SetTextColor(UiColor(0x9ba1b0)),
                        Label::New("Alex Morgan").SetFontSize(56).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(154.0f).SetRequestedHeight(154.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(77.0f).Children({
                    Label::New("◉").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                }),
            }),

        View::New().SetRequestedHeight(27.3f),

        // ========== BALANCE HERO CARD (TEAL) ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(728.0f)
            .SetBackgroundColor(UiColor(0x00d4a8))
            .SetCornerRadius(98.0f)
            .SetMargin(Extents(70, 70, 0, 0))
            .SetPadding(Extents(91, 91, 84, 77))
            .Children({
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        Label::New("TOTAL BALANCE").SetFontSize(42).SetTextColor(UiColor(0x073028)),
                        Label::New("◉").SetFontSize(63).SetTextColor(UiColor(0x073028)),
                    }),
                Label::New("<font size='105'><color value='#073028'>$</color></font><font size='203'><color value='#0d1117'>12,486</color></font><font size='91'><color value='#073028'>.92</color></font>")
                    .SetMarkupEnabled(true)
                    .SetMargin(Extents(0, 0, 35, 0)),
                View::New().SetRequestedHeight(27.3f),
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::CENTER)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetBackgroundColor(UiColor(0x0a3a33))
                    .SetCornerRadius(45.5f)
                    .SetPadding(Extents(49, 49, 21, 21))
                    .SetRequestedWidth(700.0f)
                    .SetRequestedHeight(98.0f)
                    .Children({
                        Label::New("▲ $320.45 this week").SetFontSize(39).SetTextColor(UiColor(0x00d4a8)),
                    }),
                View::New().SetRequestedHeight(72.8f),
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("•••• 4821").SetFontSize(46).SetTextColor(UiColor(0x0d1117)),
                            Label::New("Flow Debit").SetFontSize(35).SetTextColor(UiColor(0x0a3a33)).SetMargin(Extents(0, 0, 11, 0)),
                        }),
                        Label::New("VISA").SetFontSize(49).SetTextColor(UiColor(0x0d1117)),
                    }),
            }),

        View::New().SetRequestedHeight(109.2f),

        // ========== QUICK ACTIONS ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(98, 98, 0, 0))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(196.0f).SetRequestedHeight(196.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(98.0f).Children({
                        Label::New("↑").SetFontSize(77).SetTextColor(UiColor(0x00d4a8)),
                    }),
                    Label::New("Send").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 28, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(196.0f).SetRequestedHeight(196.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(98.0f).Children({
                        Label::New("↓").SetFontSize(77).SetTextColor(UiColor(0x00d4a8)),
                    }),
                    Label::New("Request").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 28, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(196.0f).SetRequestedHeight(196.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(98.0f).Children({
                        Label::New("⇄").SetFontSize(77).SetTextColor(UiColor(0x00d4a8)),
                    }),
                    Label::New("Transfer").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 28, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(196.0f).SetRequestedHeight(196.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(98.0f).Children({
                        Label::New("+").SetFontSize(84).SetTextColor(UiColor(0x00d4a8)),
                    }),
                    Label::New("Top up").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 28, 0)),
                }),
            }),

        View::New().SetRequestedHeight(100.1f),

        // ========== RECENT TRANSACTIONS HEADER ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(98, 98, 0, 0))
            .Children({
                Label::New("Recent Transactions").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                Label::New("See all →").SetFontSize(39).SetTextColor(UiColor(0x00d4a8)),
            }),

        View::New().SetRequestedHeight(54.6f),

        // ========== TRANSACTION LIST ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x161c24))
            .SetCornerRadius(70.0f)
            .SetMargin(Extents(70, 70, 0, 0))
            .Children({
                // Txn 1
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(245.0f).SetPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(147.0f).SetRequestedHeight(147.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(45.5f).Children({
                        Label::New("◉").SetFontSize(63).SetTextColor(UiColor(0xf59e0b)),
                    }),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1155.0f).SetMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Blue Bottle Coffee").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Food & Drink  ·  9:12 AM").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                        Label::New("-$6.80").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Completed").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                }),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedHeight(3.5f).SetMargin(Extents(56, 56, 0, 0)),

                // Txn 2
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(245.0f).SetPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(147.0f).SetRequestedHeight(147.0f).SetBackgroundColor(UiColor(0x0a3a33)).SetCornerRadius(45.5f).Children({
                        Label::New("↓").SetFontSize(63).SetTextColor(UiColor(0x22c55e)),
                    }),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1155.0f).SetMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Salary — Acme Corp").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Income  ·  Yesterday").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                        Label::New("+$4,250.00").SetFontSize(49).SetTextColor(UiColor(0x22c55e)),
                        Label::New("Deposited").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                }),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedHeight(3.5f).SetMargin(Extents(56, 56, 0, 0)),

                // Txn 3
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(245.0f).SetPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(147.0f).SetRequestedHeight(147.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(45.5f).Children({
                        Label::New("◎").SetFontSize(63).SetTextColor(UiColor(0x2dd4a8)),
                    }),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1155.0f).SetMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Whole Foods Market").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Groceries  ·  Yesterday").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                        Label::New("-$84.37").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Completed").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                }),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedHeight(3.5f).SetMargin(Extents(56, 56, 0, 0)),

                // Txn 4
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(245.0f).SetPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(147.0f).SetRequestedHeight(147.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(45.5f).Children({
                        Label::New("♪").SetFontSize(63).SetTextColor(UiColor(0x1ed760)),
                    }),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1155.0f).SetMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Spotify").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Subscription  ·  Apr 13").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                        Label::New("-$9.99").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Recurring").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                }),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedHeight(3.5f).SetMargin(Extents(56, 56, 0, 0)),

                // Txn 5
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(245.0f).SetPadding(Extents(56, 56, 0, 0)).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(147.0f).SetRequestedHeight(147.0f).SetBackgroundColor(UiColor(0x1f2730)).SetCornerRadius(45.5f).Children({
                        Label::New("◈").SetFontSize(63).SetTextColor(UiColor(0x000000)),
                    }),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1155.0f).SetMargin(Extents(49, 0, 0, 0)).Children({
                        Label::New("Uber").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Transport  ·  Apr 13").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                    View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                        Label::New("-$18.50").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                        Label::New("Completed").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 11, 0)),
                    }),
                }),
            }),

        View::New().SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f)),

        // ========== BOTTOM NAV ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_EVENLY)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(252.0f)
            .SetBackgroundColor(UiColor(0x161c24))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("⌂").SetFontSize(77).SetTextColor(UiColor(0x00d4a8)),
                    Label::New("Home").SetFontSize(35).SetTextColor(UiColor(0x00d4a8)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("▭").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Cards").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("⇄").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Transfer").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("◎").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Profile").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 14, 0)),
                }),
            }),
    });
