// @render-only — async ImageView loads (form L): pixel non-deterministic across env/timing (broke broken-image→real-photo in M5); verified by compile+render, not a flaky pixel golden.
// @preview-config: name="Food Delivery", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .SetSpacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0xfafafa))
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
                Label::New("9:41").SetFontSize(49).SetTextColor(UiColor(0x1a1a1a)),
                Label::New("●●●  5G  ▮ 88%").SetFontSize(39).SetTextColor(UiColor(0x1a1a1a)),
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
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::FLEX_START).Children({
                    Label::New("DELIVER TO").SetFontSize(42).SetTextColor(UiColor(0xff5a1f)),
                    Label::New("450 Market St  ⌄").SetFontSize(67).SetTextColor(UiColor(0x1a1a1a)).SetMargin(Extents(0, 0, 18, 0)),
                }),
                FlexLayout::New()
                    .SetDirection(FlexDirection::COLUMN)
                    .SetJustifyContent(FlexJustify::CENTER)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(154.0f)
                    .SetRequestedHeight(154.0f)
                    .SetBackgroundColor(UiColor(0xf2f2f2))
                    .SetCornerRadius(77.0f)
                    .Children({
                        Label::New("◉").SetFontSize(63).SetTextColor(UiColor(0x1a1a1a)),
                    }),
            }),

        // ========== SEARCH BAR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(182.0f)
            .SetBackgroundColor(UiColor(0xf2f2f2))
            .SetCornerRadius(91.0f)
            .SetPadding(Extents(84, 84, 0, 0))
            .SetMargin(Extents(84, 84, 14, 0))
            .Children({
                Label::New("⌕  Search restaurants, cuisines...").SetFontSize(56).SetTextColor(UiColor(0x8a8a8a)),
            }),

        View::New().SetRequestedHeight(109.2f),

        // ========== CATEGORIES ROW ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(84, 84, 0, 0))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(252.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0xfff5ed)).SetCornerRadius(126.0f).Children({
                        Label::New("★").SetFontSize(105).SetTextColor(UiColor(0xff5a1f)),
                    }),
                    Label::New("Popular").SetFontSize(49).SetTextColor(UiColor(0x1a1a1a)).SetMargin(Extents(0, 0, 35, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(252.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0xe8f5ff)).SetCornerRadius(126.0f).Children({
                        Label::New("◉").SetFontSize(105).SetTextColor(UiColor(0x2563eb)),
                    }),
                    Label::New("Pizza").SetFontSize(49).SetTextColor(UiColor(0x1a1a1a)).SetMargin(Extents(0, 0, 35, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(252.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0xf3f0ff)).SetCornerRadius(126.0f).Children({
                        Label::New("◆").SetFontSize(105).SetTextColor(UiColor(0x7c3aed)),
                    }),
                    Label::New("Sushi").SetFontSize(49).SetTextColor(UiColor(0x1a1a1a)).SetMargin(Extents(0, 0, 35, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(252.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0xecfaf1)).SetCornerRadius(126.0f).Children({
                        Label::New("✿").SetFontSize(105).SetTextColor(UiColor(0x1f8a4c)),
                    }),
                    Label::New("Salad").SetFontSize(49).SetTextColor(UiColor(0x1a1a1a)).SetMargin(Extents(0, 0, 35, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(252.0f).SetRequestedHeight(252.0f).SetBackgroundColor(UiColor(0xfff9e6)).SetCornerRadius(126.0f).Children({
                        Label::New("❁").SetFontSize(98).SetTextColor(UiColor(0xe0a800)),
                    }),
                    Label::New("Ramen").SetFontSize(49).SetTextColor(UiColor(0x1a1a1a)).SetMargin(Extents(0, 0, 35, 0)),
                }),
            }),

        View::New().SetRequestedHeight(118.3f),

        // ========== HERO PROMO BANNER ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetMargin(Extents(84, 84, 0, 0))
            .Children({
                ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/banner_food.jpg")
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(630.0f)
                    .SetCornerRadius(70.0f),
            }),

        View::New().SetRequestedHeight(109.2f),

        // ========== POPULAR NEAR YOU HEADER ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetPadding(Extents(98, 98, 0, 0))
            .Children({
                Label::New("Popular near you").SetFontSize(70).SetTextColor(UiColor(0x1a1a1a)),
                Label::New("See all  →").SetFontSize(46).SetTextColor(UiColor(0xff5a1f)),
            }),

        View::New().SetRequestedHeight(63.7f),

        // ========== RESTAURANT CARD 1 ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0xffffff))
            .SetCornerRadius(70.0f)
            .SetMargin(Extents(84, 84, 0, 0))
            .Children({
                ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/meal1.jpg")
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(490.0f)
                    .SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f),
                FlexLayout::New()
                    .SetDirection(FlexDirection::COLUMN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetPadding(Extents(63, 63, 49, 56))
                    .Children({
                        FlexLayout::New()
                            .SetDirection(FlexDirection::ROW)
                            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                            .SetAlignItems(FlexAlign::CENTER)
                            .SetRequestedWidth(MATCH_PARENT)
                            .Children({
                                Label::New("Bella Vista Trattoria").SetFontSize(70).SetTextColor(UiColor(0x1a1a1a)),
                                Label::New("♥").SetFontSize(70).SetTextColor(UiColor(0xff3b30)),
                            }),
                        Label::New("Italian  ·  $$  ·  1.2 mi")
                            .SetFontSize(49)
                            .SetTextColor(UiColor(0x8a8a8a))
                            .SetMargin(Extents(0, 0, 28, 0)),
                        FlexLayout::New()
                            .SetDirection(FlexDirection::ROW)
                            .SetAlignItems(FlexAlign::CENTER)
                            .SetMargin(Extents(0, 0, 35, 0))
                            .Children({
                                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xecfaf1)).SetCornerRadius(38.5f).SetPadding(Extents(35, 35, 14, 14)).SetMargin(Extents(0, 28, 0, 0)).Children({
                                    Label::New("★ 4.8").SetFontSize(39).SetTextColor(UiColor(0x1f8a4c)),
                                }),
                                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xfff5ed)).SetCornerRadius(38.5f).SetPadding(Extents(35, 35, 14, 14)).SetMargin(Extents(0, 28, 0, 0)).Children({
                                    Label::New("25–35 min").SetFontSize(39).SetTextColor(UiColor(0xff5a1f)),
                                }),
                                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xf2f2f2)).SetCornerRadius(38.5f).SetPadding(Extents(35, 35, 14, 14)).Children({
                                    Label::New("Free delivery").SetFontSize(39).SetTextColor(UiColor(0x1a1a1a)),
                                }),
                            }),
                    }),
            }),

        View::New().SetRequestedHeight(63.7f),

        // ========== RESTAURANT CARD 2 ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0xffffff))
            .SetCornerRadius(70.0f)
            .SetMargin(Extents(84, 84, 0, 0))
            .Children({
                ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/meal2.jpg")
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(490.0f)
                    .SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f),
                FlexLayout::New()
                    .SetDirection(FlexDirection::COLUMN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetPadding(Extents(63, 63, 49, 56))
                    .Children({
                        FlexLayout::New()
                            .SetDirection(FlexDirection::ROW)
                            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                            .SetAlignItems(FlexAlign::CENTER)
                            .SetRequestedWidth(MATCH_PARENT)
                            .Children({
                                Label::New("Sakura Sushi Bar").SetFontSize(70).SetTextColor(UiColor(0x1a1a1a)),
                                Label::New("♡").SetFontSize(70).SetTextColor(UiColor(0x8a8a8a)),
                            }),
                        Label::New("Japanese  ·  $$$  ·  0.8 mi")
                            .SetFontSize(49)
                            .SetTextColor(UiColor(0x8a8a8a))
                            .SetMargin(Extents(0, 0, 28, 0)),
                        FlexLayout::New()
                            .SetDirection(FlexDirection::ROW)
                            .SetAlignItems(FlexAlign::CENTER)
                            .SetMargin(Extents(0, 0, 35, 0))
                            .Children({
                                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xecfaf1)).SetCornerRadius(38.5f).SetPadding(Extents(35, 35, 14, 14)).SetMargin(Extents(0, 28, 0, 0)).Children({
                                    Label::New("★ 4.9").SetFontSize(39).SetTextColor(UiColor(0x1f8a4c)),
                                }),
                                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xfff5ed)).SetCornerRadius(38.5f).SetPadding(Extents(35, 35, 14, 14)).SetMargin(Extents(0, 28, 0, 0)).Children({
                                    Label::New("15–25 min").SetFontSize(39).SetTextColor(UiColor(0xff5a1f)),
                                }),
                                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xfef3f3)).SetCornerRadius(38.5f).SetPadding(Extents(35, 35, 14, 14)).Children({
                                    Label::New("$2.99 deliv").SetFontSize(39).SetTextColor(UiColor(0xdc2626)),
                                }),
                            }),
                    }),
            }),

        View::New().SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f)),

        // ========== BOTTOM TAB BAR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_EVENLY)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(252.0f)
            .SetBackgroundColor(UiColor(0xffffff))
            .Children({
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("⌂").SetFontSize(77).SetTextColor(UiColor(0xff5a1f)),
                    Label::New("Home").SetFontSize(35).SetTextColor(UiColor(0xff5a1f)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("⌕").SetFontSize(77).SetTextColor(UiColor(0x8a8a8a)),
                    Label::New("Search").SetFontSize(35).SetTextColor(UiColor(0x8a8a8a)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("☰").SetFontSize(77).SetTextColor(UiColor(0x8a8a8a)),
                    Label::New("Orders").SetFontSize(35).SetTextColor(UiColor(0x8a8a8a)).SetMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                    Label::New("◉").SetFontSize(77).SetTextColor(UiColor(0x8a8a8a)),
                    Label::New("Profile").SetFontSize(35).SetTextColor(UiColor(0x8a8a8a)).SetMargin(Extents(0, 0, 14, 0)),
                }),
            }),
    });
