// @preview-config: name="Crypto Portfolio", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .Spacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0e0f1a))
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
                Label::New("●●●  5G  ▮ 76%").SetFontSize(39).SetTextColor(UiColor(0xffffff)),
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
                Label::New("Portfolio").SetFontSize(84).SetTextColor(UiColor(0xffffff)),
                ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait2.jpg")
                    .SetRequestedWidth(154.0f)
                    .SetRequestedHeight(154.0f)
                    .SetCornerRadius(77.0f),
            }),

        // ========== BALANCE HERO ==========
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .AlignItems(FlexAlign::FLEX_START)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(98, 98, 42, 0))
            .Children({
                Label::New("TOTAL BALANCE").SetFontSize(39).SetTextColor(UiColor(0x6b7190)),
                Label::New("<font size='91'><color value='#ffffff'>$</color></font><font size='210'><color value='#ffffff'>48,327</color></font><font size='91'><color value='#6b7190'>.94</color></font>")
                    .SetMarkupEnabled(true)
                    .SetViewMargin(Extents(0, 0, 21, 0)),
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .AlignItems(FlexAlign::CENTER)
                    .SetViewMargin(Extents(0, 0, 35, 0))
                    .Children({
                        FlexLayout::New()
                            .Direction(FlexDirection::ROW)
                            .JustifyContent(FlexJustify::CENTER)
                            .AlignItems(FlexAlign::CENTER)
                            .SetBackgroundColor(UiColor(0x0d3a22))
                            .SetCornerRadius(49.0f)
                            .SetViewPadding(Extents(42, 42, 21, 21))
                            .Children({
                                Label::New("▲ 4.82%").SetFontSize(42).SetTextColor(UiColor(0x22c55e)),
                            }),
                        Label::New("+$2,218.55 today")
                            .SetFontSize(42)
                            .SetTextColor(UiColor(0x9ca3af))
                            .SetViewMargin(Extents(42, 0, 0, 0)),
                    }),
            }),

        View::New().SetRequestedHeight(81.9f),

        // ========== FAKE CHART CARD ==========
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x141628))
            .SetCornerRadius(70.0f)
            .SetViewMargin(Extents(70, 70, 0, 0))
            .SetViewPadding(Extents(56, 56, 56, 49))
            .Children({
                // Chart bars
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .AlignItems(FlexAlign::FLEX_END)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(420.0f)
                    .Children({
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(140.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(154.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(133.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(168.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(182.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(196.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(175.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(203.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(224.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(238.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(217.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(252.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(266.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(245.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(287.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(301.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(280.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(322.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(336.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(315.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(350.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(364.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(343.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(385.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(399.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(378.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(413.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0x22c55e)).SetRequestedWidth(28.0f).SetRequestedHeight(420.0f).SetCornerRadius(10.5f),
                    }),

                View::New().SetRequestedHeight(63.7f),

                // Time range pills
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x1a1d30)).SetCornerRadius(42.0f).SetViewPadding(Extents(56, 56, 21, 21)).Children({
                            Label::New("1H").SetFontSize(39).SetTextColor(UiColor(0x6b7190)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x1a1d30)).SetCornerRadius(42.0f).SetViewPadding(Extents(56, 56, 21, 21)).Children({
                            Label::New("1D").SetFontSize(39).SetTextColor(UiColor(0x6b7190)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x7c3aed)).SetCornerRadius(42.0f).SetViewPadding(Extents(56, 56, 21, 21)).Children({
                            Label::New("1W").SetFontSize(39).SetTextColor(UiColor(0xffffff)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x1a1d30)).SetCornerRadius(42.0f).SetViewPadding(Extents(56, 56, 21, 21)).Children({
                            Label::New("1M").SetFontSize(39).SetTextColor(UiColor(0x6b7190)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x1a1d30)).SetCornerRadius(42.0f).SetViewPadding(Extents(56, 56, 21, 21)).Children({
                            Label::New("1Y").SetFontSize(39).SetTextColor(UiColor(0x6b7190)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x1a1d30)).SetCornerRadius(42.0f).SetViewPadding(Extents(56, 56, 21, 21)).Children({
                            Label::New("ALL").SetFontSize(39).SetTextColor(UiColor(0x6b7190)),
                        }),
                    }),
            }),

        View::New().SetRequestedHeight(72.8f),

        // ========== QUICK ACTIONS ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(70, 70, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(525.0f).SetRequestedHeight(266.0f).SetBackgroundColor(UiColor(0x141628)).SetCornerRadius(56.0f).Children({
                    Label::New("↑").SetFontSize(77).SetTextColor(UiColor(0x7c3aed)),
                    Label::New("Send").SetFontSize(42).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 21, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(525.0f).SetRequestedHeight(266.0f).SetBackgroundColor(UiColor(0x141628)).SetCornerRadius(56.0f).Children({
                    Label::New("↓").SetFontSize(77).SetTextColor(UiColor(0x7c3aed)),
                    Label::New("Receive").SetFontSize(42).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 21, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(525.0f).SetRequestedHeight(266.0f).SetBackgroundColor(UiColor(0x141628)).SetCornerRadius(56.0f).Children({
                    Label::New("⇄").SetFontSize(77).SetTextColor(UiColor(0x7c3aed)),
                    Label::New("Swap").SetFontSize(42).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 21, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(525.0f).SetRequestedHeight(266.0f).SetBackgroundColor(UiColor(0x141628)).SetCornerRadius(56.0f).Children({
                    Label::New("+").SetFontSize(84).SetTextColor(UiColor(0x7c3aed)),
                    Label::New("Buy").SetFontSize(42).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 21, 0)),
                }),
            }),

        View::New().SetRequestedHeight(100.1f),

        // ========== YOUR ASSETS HEADER ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(98, 98, 0, 0))
            .Children({
                Label::New("Your Assets").SetFontSize(63).SetTextColor(UiColor(0xffffff)),
                Label::New("See all →").SetFontSize(42).SetTextColor(UiColor(0x7c3aed)),
            }),

        View::New().SetRequestedHeight(45.5f),

        // ========== ASSET ROW: BTC ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(266.0f)
            .SetBackgroundColor(UiColor(0x141628))
            .SetCornerRadius(56.0f)
            .SetViewMargin(Extents(70, 70, 0, 35))
            .SetViewPadding(Extents(56, 56, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(154.0f).SetRequestedHeight(154.0f).SetBackgroundColor(UiColor(0x3a2510)).SetCornerRadius(77.0f).Children({
                    Label::New("BTC").SetFontSize(39).SetTextColor(UiColor(0xf7931a)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(910.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                    Label::New("Bitcoin").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("BTC · $67,420").SetFontSize(42).SetTextColor(UiColor(0x9ca3af)).SetViewMargin(Extents(0, 0, 11, 0)),
                }),
                View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_END).Children({
                    Label::New("$28,104.20").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("▲ 3.42%").SetFontSize(42).SetTextColor(UiColor(0x22c55e)).SetViewMargin(Extents(0, 0, 11, 0)),
                }),
            }),

        // ========== ASSET ROW: ETH ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(266.0f)
            .SetBackgroundColor(UiColor(0x141628))
            .SetCornerRadius(56.0f)
            .SetViewMargin(Extents(70, 70, 0, 35))
            .SetViewPadding(Extents(56, 56, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(154.0f).SetRequestedHeight(154.0f).SetBackgroundColor(UiColor(0x181e3a)).SetCornerRadius(77.0f).Children({
                    Label::New("ETH").SetFontSize(39).SetTextColor(UiColor(0x8faee5)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(910.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                    Label::New("Ethereum").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("ETH · $3,520").SetFontSize(42).SetTextColor(UiColor(0x9ca3af)).SetViewMargin(Extents(0, 0, 11, 0)),
                }),
                View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_END).Children({
                    Label::New("$12,580.00").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("▲ 2.18%").SetFontSize(42).SetTextColor(UiColor(0x22c55e)).SetViewMargin(Extents(0, 0, 11, 0)),
                }),
            }),

        // ========== ASSET ROW: SOL ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(266.0f)
            .SetBackgroundColor(UiColor(0x141628))
            .SetCornerRadius(56.0f)
            .SetViewMargin(Extents(70, 70, 0, 35))
            .SetViewPadding(Extents(56, 56, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(154.0f).SetRequestedHeight(154.0f).SetBackgroundColor(UiColor(0x0a2b24)).SetCornerRadius(77.0f).Children({
                    Label::New("SOL").SetFontSize(39).SetTextColor(UiColor(0x14f195)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(910.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                    Label::New("Solana").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("SOL · $148.70").SetFontSize(42).SetTextColor(UiColor(0x9ca3af)).SetViewMargin(Extents(0, 0, 11, 0)),
                }),
                View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_END).Children({
                    Label::New("$5,243.74").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("▼ 1.24%").SetFontSize(42).SetTextColor(UiColor(0xef4444)).SetViewMargin(Extents(0, 0, 11, 0)),
                }),
            }),

        // ========== ASSET ROW: ADA ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(266.0f)
            .SetBackgroundColor(UiColor(0x141628))
            .SetCornerRadius(56.0f)
            .SetViewMargin(Extents(70, 70, 0, 0))
            .SetViewPadding(Extents(56, 56, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(154.0f).SetRequestedHeight(154.0f).SetBackgroundColor(UiColor(0x0d1f3a)).SetCornerRadius(77.0f).Children({
                    Label::New("ADA").SetFontSize(39).SetTextColor(UiColor(0x6fa0ff)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(910.0f).SetViewMargin(Extents(49, 0, 0, 0)).Children({
                    Label::New("Cardano").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("ADA · $0.58").SetFontSize(42).SetTextColor(UiColor(0x9ca3af)).SetViewMargin(Extents(0, 0, 11, 0)),
                }),
                View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_END).Children({
                    Label::New("$2,400.00").SetFontSize(53).SetTextColor(UiColor(0xffffff)),
                    Label::New("▲ 0.88%").SetFontSize(42).SetTextColor(UiColor(0x22c55e)).SetViewMargin(Extents(0, 0, 11, 0)),
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
            .SetBackgroundColor(UiColor(0x141628))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("◈").SetFontSize(77).SetTextColor(UiColor(0x7c3aed)),
                    Label::New("Portfolio").SetFontSize(35).SetTextColor(UiColor(0x7c3aed)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("◉").SetFontSize(77).SetTextColor(UiColor(0x6b7190)),
                    Label::New("Markets").SetFontSize(35).SetTextColor(UiColor(0x6b7190)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("⇄").SetFontSize(77).SetTextColor(UiColor(0x6b7190)),
                    Label::New("Trade").SetFontSize(35).SetTextColor(UiColor(0x6b7190)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER).Children({
                    Label::New("◎").SetFontSize(77).SetTextColor(UiColor(0x6b7190)),
                    Label::New("Profile").SetFontSize(35).SetTextColor(UiColor(0x6b7190)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
            }),
    });
