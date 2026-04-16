// @preview-config: name="Fitness Dashboard", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .Spacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0b0d16))
    .SetViewPadding(Extents(112, 112, 196, 112))
    .Children({

        // ========== HEADER ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .AlignItems(FlexAlign::FLEX_START)
                    .Children({
                        Label::New("Good morning,")
                            .SetFontSize(56)
                            .SetTextColor(UiColor(0x8087a6)),
                        Label::New("Alex")
                            .SetFontSize(119)
                            .SetTextColor(UiColor(0xffffff))
                            .SetViewMargin(Extents(0, 0, 14, 0)),
                    }),
                ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait1.jpg")
                    .SetRequestedWidth(238.0f)
                    .SetRequestedHeight(238.0f)
                    .SetCornerRadius(119.0f),
            }),

        View::New().SetRequestedHeight(127.4f),

        // ========== ACTIVITY SUMMARY CARD ==========
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x15182a))
            .SetCornerRadius(84.0f)
            .SetViewPadding(Extents(91, 91, 84, 84))
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .AlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        Label::New("TODAY'S ACTIVITY")
                            .SetFontSize(39)
                            .SetTextColor(UiColor(0x7a82a5)),
                        Label::New("Apr 14")
                            .SetFontSize(39)
                            .SetTextColor(UiColor(0x7a82a5)),
                    }),

                View::New().SetRequestedHeight(63.7f),

                Label::New("<font size='217'>8,412</font><font size='84'>  / 10,000 steps</font>")
                    .SetMarkupEnabled(true)
                    .SetTextColor(UiColor(0xffffff)),

                View::New().SetRequestedHeight(63.7f),

                // Progress bar
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(28.0f)
                    .SetBackgroundColor(UiColor(0x242842))
                    .SetCornerRadius(14.0f)
                    .Children({
                        View::New()
                            .SetBackgroundColor(UiColor(0x00d4a8))
                            .SetRequestedWidth(1764.0f)
                            .SetRequestedHeight(28.0f)
                            .SetCornerRadius(14.0f),
                    }),

                View::New().SetRequestedHeight(100.1f),

                // Stat pills row
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("Calories").SetFontSize(42).SetTextColor(UiColor(0x7a82a5)),
                            Label::New("<color value='#ff8a5c'>⧫ </color><color value='#ffffff'>482</color>").SetMarkupEnabled(true).SetFontSize(77).SetViewMargin(Extents(0, 0, 14, 0)),
                            Label::New("kcal").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("Distance").SetFontSize(42).SetTextColor(UiColor(0x7a82a5)),
                            Label::New("<color value='#5cb2ff'>◉ </color><color value='#ffffff'>6.2</color>").SetMarkupEnabled(true).SetFontSize(77).SetViewMargin(Extents(0, 0, 14, 0)),
                            Label::New("km").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("Active").SetFontSize(42).SetTextColor(UiColor(0x7a82a5)),
                            Label::New("<color value='#c879ff'>◆ </color><color value='#ffffff'>54</color>").SetMarkupEnabled(true).SetFontSize(77).SetViewMargin(Extents(0, 0, 14, 0)),
                            Label::New("min").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                        }),
                    }),
            }),

        View::New().SetRequestedHeight(81.9f),

        // ========== HEART RATE CARD ==========
        FlexLayout::New()
            .Direction(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x15182a))
            .SetCornerRadius(84.0f)
            .SetViewPadding(Extents(91, 91, 77, 77))
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .AlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                            Label::New("HEART RATE").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                            Label::New("<color value='#ff4d7a'>♥ </color><color value='#ffffff'><font size='140'>72</font></color><color value='#7a82a5'><font size='63'> bpm</font></color>")
                                .SetMarkupEnabled(true).SetViewMargin(Extents(0, 0, 21, 0)),
                        }),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_END).Children({
                            Label::New("RESTING").SetFontSize(35).SetTextColor(UiColor(0x7a82a5)),
                            Label::New("62").SetFontSize(77).SetTextColor(UiColor(0xd7ddf5)).SetViewMargin(Extents(0, 0, 14, 0)),
                        }),
                    }),

                View::New().SetRequestedHeight(72.8f),

                // Fake heart-rate sparkline using bars of varying height
                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .AlignItems(FlexAlign::FLEX_END)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(280.0f)
                    .Children({
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(91.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(119.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(77.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(161.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(203.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(245.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(224.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(182.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(140.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(168.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(217.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(196.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(154.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(133.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(175.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(231.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(147.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(105.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(126.0f).SetCornerRadius(10.5f),
                        View::New().SetBackgroundColor(UiColor(0xff4d7a)).SetRequestedWidth(21.0f).SetRequestedHeight(98.0f).SetCornerRadius(10.5f),
                    }),

                View::New().SetRequestedHeight(45.5f),

                FlexLayout::New()
                    .Direction(FlexDirection::ROW)
                    .JustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        Label::New("6AM").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                        Label::New("9AM").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                        Label::New("12PM").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                        Label::New("3PM").SetFontSize(39).SetTextColor(UiColor(0x7a82a5)),
                        Label::New("Now").SetFontSize(39).SetTextColor(UiColor(0xffffff)),
                    }),
            }),

        View::New().SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f)),

        // ========== WORKOUTS ROW ==========
        Label::New("Recent Workouts")
            .SetFontSize(63)
            .SetTextColor(UiColor(0xffffff)),

        View::New().SetRequestedHeight(63.7f),

        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .SetRequestedWidth(686.0f)
                    .SetBackgroundColor(UiColor(0x15182a))
                    .SetCornerRadius(70.0f)
                    .SetViewPadding(Extents(63, 63, 63, 63))
                    .SetViewMargin(Extents(0, 49, 0, 0))
                    .Children({
                        Label::New("◉").SetFontSize(98).SetTextColor(UiColor(0x00d4a8)),
                        Label::New("Running").SetFontSize(53).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 49, 0)),
                        Label::New("5.2 km").SetFontSize(46).SetTextColor(UiColor(0x7a82a5)).SetViewMargin(Extents(0, 0, 14, 0)),
                        Label::New("32 min").SetFontSize(46).SetTextColor(UiColor(0x7a82a5)),
                    }),
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .SetRequestedWidth(686.0f)
                    .SetBackgroundColor(UiColor(0x15182a))
                    .SetCornerRadius(70.0f)
                    .SetViewPadding(Extents(63, 63, 63, 63))
                    .SetViewMargin(Extents(0, 49, 0, 0))
                    .Children({
                        Label::New("◆").SetFontSize(98).SetTextColor(UiColor(0xc879ff)),
                        Label::New("Yoga").SetFontSize(53).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 49, 0)),
                        Label::New("Flow class").SetFontSize(46).SetTextColor(UiColor(0x7a82a5)).SetViewMargin(Extents(0, 0, 14, 0)),
                        Label::New("45 min").SetFontSize(46).SetTextColor(UiColor(0x7a82a5)),
                    }),
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .SetRequestedWidth(686.0f)
                    .SetBackgroundColor(UiColor(0x15182a))
                    .SetCornerRadius(70.0f)
                    .SetViewPadding(Extents(63, 63, 63, 63))
                    .Children({
                        Label::New("⧫").SetFontSize(98).SetTextColor(UiColor(0xff8a5c)),
                        Label::New("Cycling").SetFontSize(53).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 49, 0)),
                        Label::New("18.4 km").SetFontSize(46).SetTextColor(UiColor(0x7a82a5)).SetViewMargin(Extents(0, 0, 14, 0)),
                        Label::New("52 min").SetFontSize(46).SetTextColor(UiColor(0x7a82a5)),
                    }),
            }),
    });
