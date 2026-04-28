// @preview-config: name="Flow Banking — Transfer", width=2520, height=4480
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
            .SetRequestedHeight(224.0f)
            .SetPadding(Extents(98, 98, 28, 0))
            .Children({
                Label::New("←").SetFontSize(84).SetTextColor(UiColor(0xffffff)),
                Label::New("Send Money").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                Label::New("⋯").SetFontSize(84).SetTextColor(UiColor(0xffffff)),
            }),

        View::New().SetRequestedHeight(72.8f),

        // ========== AMOUNT HERO ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                Label::New("YOU SEND").SetFontSize(39).SetTextColor(UiColor(0x5e6673)),
                Label::New("<font size='105'><color value='#9ba1b0'>$</color></font><font size='287'><color value='#ffffff'>250</color></font><font size='133'><color value='#9ba1b0'>.00</color></font>")
                    .SetMarkupEnabled(true)
                    .SetMargin(Extents(0, 0, 28, 0)),
                Label::New("≈ 229.14 EUR")
                    .SetFontSize(46)
                    .SetTextColor(UiColor(0x5e6673))
                    .SetMargin(Extents(0, 0, 28, 0)),
                View::New().SetRequestedHeight(36.4f),
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x0a3a33)).SetCornerRadius(56.0f).SetPadding(Extents(49, 49, 25, 25)).Children({
                    Label::New("✓ No fee").SetFontSize(39).SetTextColor(UiColor(0x00d4a8)),
                }),
            }),

        View::New().SetRequestedHeight(118.3f),

        // ========== FROM CARD SELECTOR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(280.0f)
            .SetBackgroundColor(UiColor(0x161c24))
            .SetCornerRadius(70.0f)
            .SetMargin(Extents(70, 70, 0, 0))
            .SetPadding(Extents(56, 56, 0, 0))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(168.0f).SetRequestedHeight(168.0f).SetBackgroundColor(UiColor(0x00d4a8)).SetCornerRadius(49.0f).Children({
                    Label::New("flow.").SetFontSize(39).SetTextColor(UiColor(0x0d1117)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetRequestedWidth(1260.0f).SetMargin(Extents(49, 0, 0, 0)).Children({
                    Label::New("FROM").SetFontSize(35).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Flow Debit · •••• 4821").SetFontSize(49).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 11, 0)),
                }),
                View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_END).Children({
                    Label::New("BALANCE").SetFontSize(35).SetTextColor(UiColor(0x5e6673)),
                    Label::New("$12,486.92").SetFontSize(49).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 11, 0)),
                }),
            }),

        View::New().SetRequestedHeight(100.1f),

        // ========== SEND TO HEADER ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(98, 98, 0, 0))
            .Children({
                Label::New("Send to").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                Label::New("+ New contact").SetFontSize(39).SetTextColor(UiColor(0x00d4a8)),
            }),

        View::New().SetRequestedHeight(63.7f),

        // ========== CONTACTS ROW ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(84, 84, 0, 0))
            .Children({
                // Add new slot
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(336.0f).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(224.0f).SetRequestedHeight(224.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(112.0f).Children({
                        Label::New("+").SetFontSize(98).SetTextColor(UiColor(0x00d4a8)),
                    }),
                    Label::New("Add").SetFontSize(39).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 28, 0)),
                }),
                // Sarah (selected — teal ring)
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(336.0f).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(252.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0x00d4a8)).SetCornerRadius(126.0f).Children({
                        ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait2.jpg")
                            .SetRequestedWidth(210.0f)
                            .SetRequestedHeight(210.0f)
                            .SetCornerRadius(105.0f),
                    }),
                    Label::New("Sarah").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 21, 0)),
                    Label::New("@sarahm").SetFontSize(32).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 7, 0)),
                }),
                // David
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(336.0f).Children({
                    ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait3.jpg")
                        .SetRequestedWidth(224.0f)
                        .SetRequestedHeight(224.0f)
                        .SetCornerRadius(112.0f),
                    Label::New("David").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 28, 0)),
                    Label::New("@dlee").SetFontSize(32).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 7, 0)),
                }),
                // Maya
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(336.0f).Children({
                    ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait4.jpg")
                        .SetRequestedWidth(224.0f)
                        .SetRequestedHeight(224.0f)
                        .SetCornerRadius(112.0f),
                    Label::New("Maya").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 28, 0)),
                    Label::New("@mrossi").SetFontSize(32).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 7, 0)),
                }),
                // Chris
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(336.0f).Children({
                    ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait5.jpg")
                        .SetRequestedWidth(224.0f)
                        .SetRequestedHeight(224.0f)
                        .SetCornerRadius(112.0f),
                    Label::New("Chris").SetFontSize(39).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(0, 0, 28, 0)),
                    Label::New("@cpark").SetFontSize(32).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 7, 0)),
                }),
            }),

        View::New().SetRequestedHeight(100.1f),

        // ========== NOTE FIELD ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(196.0f)
            .SetBackgroundColor(UiColor(0x161c24))
            .SetCornerRadius(56.0f)
            .SetMargin(Extents(70, 70, 0, 0))
            .SetPadding(Extents(56, 56, 0, 0))
            .Children({
                Label::New("✎").SetFontSize(63).SetTextColor(UiColor(0x5e6673)),
                Label::New("Dinner split — thanks!").SetFontSize(49).SetTextColor(UiColor(0xffffff)).SetMargin(Extents(49, 0, 0, 0)),
            }),

        View::New().SetRequestedHeight(91.0f),

        // ========== PAYMENT METHOD HEADER ==========
        Label::New("Payment method")
            .SetFontSize(49)
            .SetTextColor(UiColor(0xffffff))
            .SetMargin(Extents(98, 0, 0, 0)),

        View::New().SetRequestedHeight(54.6f),

        // ========== PAYMENT METHOD PILLS ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(70, 70, 0, 0))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(752.5f).SetRequestedHeight(210.0f).SetBackgroundColor(UiColor(0x00d4a8)).SetCornerRadius(56.0f).SetPadding(Extents(49, 49, 0, 0)).Children({
                    Label::New("⚡").SetFontSize(70).SetTextColor(UiColor(0x0d1117)),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetMargin(Extents(35, 0, 0, 0)).Children({
                        Label::New("Instant").SetFontSize(42).SetTextColor(UiColor(0x0d1117)),
                        Label::New("Free, 1 sec").SetFontSize(35).SetTextColor(UiColor(0x0a3a33)).SetMargin(Extents(0, 0, 7, 0)),
                    }),
                }),
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(752.5f).SetRequestedHeight(210.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(56.0f).SetPadding(Extents(49, 49, 0, 0)).Children({
                    Label::New("◉").SetFontSize(70).SetTextColor(UiColor(0x9ba1b0)),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetMargin(Extents(35, 0, 0, 0)).Children({
                        Label::New("Standard").SetFontSize(42).SetTextColor(UiColor(0xffffff)),
                        Label::New("1–2 days").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 7, 0)),
                    }),
                }),
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(752.5f).SetRequestedHeight(210.0f).SetBackgroundColor(UiColor(0x161c24)).SetCornerRadius(56.0f).SetPadding(Extents(49, 49, 0, 0)).Children({
                    Label::New("◎").SetFontSize(70).SetTextColor(UiColor(0x9ba1b0)),
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).SetMargin(Extents(35, 0, 0, 0)).Children({
                        Label::New("Wire").SetFontSize(42).SetTextColor(UiColor(0xffffff)),
                        Label::New("$15 fee").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 7, 0)),
                    }),
                }),
            }),

        View::New().SetRequestedHeight(100.1f),

        // ========== SUMMARY CARD ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x161c24))
            .SetCornerRadius(70.0f)
            .SetMargin(Extents(70, 70, 0, 0))
            .SetPadding(Extents(70, 70, 56, 56))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetRequestedWidth(MATCH_PARENT).Children({
                    Label::New("Amount").SetFontSize(46).SetTextColor(UiColor(0x9ba1b0)),
                    Label::New("$250.00").SetFontSize(46).SetTextColor(UiColor(0xffffff)),
                }),
                View::New().SetRequestedHeight(36.4f),
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetRequestedWidth(MATCH_PARENT).Children({
                    Label::New("Fee").SetFontSize(46).SetTextColor(UiColor(0x9ba1b0)),
                    Label::New("$0.00").SetFontSize(46).SetTextColor(UiColor(0x22c55e)),
                }),
                View::New().SetRequestedHeight(45.5f),
                View::New().SetBackgroundColor(UiColor(0x242c36)).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                View::New().SetRequestedHeight(45.5f),
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).Children({
                    Label::New("Total").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("$250.00").SetFontSize(60).SetTextColor(UiColor(0x00d4a8)),
                }),
            }),

        View::New().SetRequestedHeight(81.9f),

        // ========== CTA SEND BUTTON ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::CENTER)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(210.0f)
            .SetBackgroundColor(UiColor(0x00d4a8))
            .SetCornerRadius(70.0f)
            .SetMargin(Extents(70, 70, 0, 0))
            .Children({
                Label::New("Send $250.00  →").SetFontSize(56).SetTextColor(UiColor(0x0d1117)),
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
                    Label::New("⌂").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Home").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("▭").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Cards").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("⇄").SetFontSize(77).SetTextColor(UiColor(0x00d4a8)),
                    Label::New("Transfer").SetFontSize(35).SetTextColor(UiColor(0x00d4a8)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("◎").SetFontSize(77).SetTextColor(UiColor(0x5e6673)),
                    Label::New("Profile").SetFontSize(35).SetTextColor(UiColor(0x5e6673)).SetMargin(Extents(0, 0, 14, 0)),
                }),
            }),
    });
