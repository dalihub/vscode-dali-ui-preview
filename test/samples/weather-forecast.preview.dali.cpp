// @preview-config: name="Weather Forecast", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .SetSpacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0e1225))
    .SetPadding(Extents(126, 126, 210, 126))
    .Children({

        // ========== STATUS BAR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(98.0f)
            .Children({
                Label::New("9:41").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                Label::New("●●●  5G  ▮▮▮▮").SetFontSize(39).SetTextColor(UiColor(0xffffff)),
            }),

        // Spacer
        View::New().SetRequestedHeight(91.0f),

        // ========== LOCATION HEADER ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                Label::New("San Francisco")
                    .SetFontSize(105)
                    .SetTextColor(UiColor(0xffffff)),
                Label::New("Tuesday, April 14")
                    .SetFontSize(49)
                    .SetTextColor(UiColor(0x8d95b8))
                    .SetMargin(Extents(0, 0, 21, 0)),
            }),

        // Spacer
        View::New().SetRequestedHeight(127.4f),

        // ========== HERO TEMPERATURE ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                Label::New("☀")
                    .SetFontSize(308)
                    .SetTextColor(UiColor(0xffce4a)),
                Label::New("<font size='420'>68</font><font size='168'>°</font>")
                    .SetMarkupEnabled(true)
                    .SetTextColor(UiColor(0xffffff))
                    .SetMargin(Extents(0, 0, 49, 0)),
                Label::New("Partly Sunny")
                    .SetFontSize(70)
                    .SetTextColor(UiColor(0xd7ddf5))
                    .SetMargin(Extents(0, 0, 35, 0)),
                Label::New("<color value='#ff7a7a'>H 73°</color>   <color value='#7aaeff'>L 58°</color>")
                    .SetMarkupEnabled(true)
                    .SetFontSize(56)
                    .SetMargin(Extents(0, 0, 28, 0)),
            }),

        // Spacer
        View::New().SetRequestedHeight(182.0f),

        // ========== HOURLY FORECAST CARD ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x1a1f3a))
            .SetCornerRadius(77.0f)
            .SetPadding(Extents(70, 70, 63, 63))
            .Children({
                Label::New("HOURLY FORECAST")
                    .SetFontSize(39)
                    .SetTextColor(UiColor(0x7a82a5)),
                View::New()
                    .SetBackgroundColor(UiColor(0x262c4e))
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(3.5f)
                    .SetMargin(Extents(0, 0, 35, 49)),

                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(MATCH_PARENT)
                    .Children({
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                            Label::New("Now").SetFontSize(46).SetTextColor(UiColor(0xffffff)),
                            Label::New("☀").SetFontSize(91).SetTextColor(UiColor(0xffce4a)).SetMargin(Extents(0, 0, 28, 28)),
                            Label::New("68°").SetFontSize(60).SetTextColor(UiColor(0xffffff)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                            Label::New("11AM").SetFontSize(46).SetTextColor(UiColor(0xd7ddf5)),
                            Label::New("☀").SetFontSize(91).SetTextColor(UiColor(0xffce4a)).SetMargin(Extents(0, 0, 28, 28)),
                            Label::New("70°").SetFontSize(60).SetTextColor(UiColor(0xd7ddf5)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                            Label::New("12PM").SetFontSize(46).SetTextColor(UiColor(0xd7ddf5)),
                            Label::New("⛅").SetFontSize(91).SetTextColor(UiColor(0xfff0a0)).SetMargin(Extents(0, 0, 28, 28)),
                            Label::New("72°").SetFontSize(60).SetTextColor(UiColor(0xd7ddf5)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                            Label::New("1PM").SetFontSize(46).SetTextColor(UiColor(0xd7ddf5)),
                            Label::New("☁").SetFontSize(91).SetTextColor(UiColor(0xcfd8ea)).SetMargin(Extents(0, 0, 28, 28)),
                            Label::New("71°").SetFontSize(60).SetTextColor(UiColor(0xd7ddf5)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                            Label::New("2PM").SetFontSize(46).SetTextColor(UiColor(0xd7ddf5)),
                            Label::New("☁").SetFontSize(91).SetTextColor(UiColor(0xcfd8ea)).SetMargin(Extents(0, 0, 28, 28)),
                            Label::New("69°").SetFontSize(60).SetTextColor(UiColor(0xd7ddf5)),
                        }),
                        FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetAlignItems(FlexAlign::CENTER).Children({
                            Label::New("3PM").SetFontSize(46).SetTextColor(UiColor(0xd7ddf5)),
                            Label::New("☂").SetFontSize(91).SetTextColor(UiColor(0x7aaeff)).SetMargin(Extents(0, 0, 28, 28)),
                            Label::New("66°").SetFontSize(60).SetTextColor(UiColor(0xd7ddf5)),
                        }),
                    }),
            }),

        // Spacer
        View::New().SetRequestedHeight(81.9f),

        // ========== 5-DAY FORECAST CARD ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetBackgroundColor(UiColor(0x1a1f3a))
            .SetCornerRadius(77.0f)
            .SetPadding(Extents(70, 70, 63, 63))
            .Children({
                Label::New("5-DAY FORECAST")
                    .SetFontSize(39)
                    .SetTextColor(UiColor(0x7a82a5)),
                View::New()
                    .SetBackgroundColor(UiColor(0x262c4e))
                    .SetRequestedWidth(MATCH_PARENT)
                    .SetRequestedHeight(3.5f)
                    .SetMargin(Extents(0, 0, 35, 21)),

                // Day row: Wednesday
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(154.0f).Children({
                    Label::New("Wed").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                    Label::New("☁").SetFontSize(77).SetTextColor(UiColor(0xcfd8ea)),
                    Label::New("<color value='#7aaeff'>55°</color> ━━━━━━ <color value='#ff7a7a'>70°</color>").SetMarkupEnabled(true).SetFontSize(49),
                }),

                // Day row: Thursday
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(154.0f).Children({
                    Label::New("Thu").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                    Label::New("☂").SetFontSize(77).SetTextColor(UiColor(0x7aaeff)),
                    Label::New("<color value='#7aaeff'>52°</color> ━━━━━ <color value='#ff7a7a'>64°</color>").SetMarkupEnabled(true).SetFontSize(49),
                }),

                // Day row: Friday
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(154.0f).Children({
                    Label::New("Fri").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                    Label::New("⛅").SetFontSize(77).SetTextColor(UiColor(0xfff0a0)),
                    Label::New("<color value='#7aaeff'>58°</color> ━━━━━━━ <color value='#ff7a7a'>76°</color>").SetMarkupEnabled(true).SetFontSize(49),
                }),

                // Day row: Saturday
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(154.0f).Children({
                    Label::New("Sat").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                    Label::New("☀").SetFontSize(77).SetTextColor(UiColor(0xffce4a)),
                    Label::New("<color value='#7aaeff'>60°</color> ━━━━━━━━ <color value='#ff7a7a'>79°</color>").SetMarkupEnabled(true).SetFontSize(49),
                }),

                // Day row: Sunday
                FlexLayout::New().SetDirection(FlexDirection::ROW).SetJustifyContent(FlexJustify::SPACE_BETWEEN).SetAlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(154.0f).Children({
                    Label::New("Sun").SetFontSize(56).SetTextColor(UiColor(0xffffff)),
                    Label::New("☀").SetFontSize(77).SetTextColor(UiColor(0xffce4a)),
                    Label::New("<color value='#7aaeff'>62°</color> ━━━━━━━━ <color value='#ff7a7a'>82°</color>").SetMarkupEnabled(true).SetFontSize(49),
                }),
            }),
    });
