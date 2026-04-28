// @preview-config: name="Music Player", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .SetSpacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0a0a14))
    .SetPadding(Extents(140, 140, 210, 140))
    .Children({

        // ========== TOP BAR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(168.0f)
            .Children({
                Label::New("⌄").SetFontSize(119).SetTextColor(UiColor(0xffffff)),
                FlexLayout::New()
                    .SetDirection(FlexDirection::COLUMN)
                    .SetAlignItems(FlexAlign::CENTER)
                    .Children({
                        Label::New("PLAYING FROM PLAYLIST")
                            .SetFontSize(42)
                            .SetTextColor(UiColor(0xd1d5e3)),
                        Label::New("Late Night Drive")
                            .SetFontSize(56)
                            .SetTextColor(UiColor(0xffffff))
                            .SetMargin(Extents(0, 0, 14, 0)),
                    }),
                Label::New("⋯").SetFontSize(119).SetTextColor(UiColor(0xffffff)),
            }),

        // Spacer
        View::New().SetRequestedHeight(218.4f),

        // ========== ALBUM ART ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/album_art.jpg")
                    .SetRequestedWidth(1820.0f)
                    .SetRequestedHeight(1820.0f)
                    .SetCornerRadius(84.0f),
            }),

        // Spacer
        View::New().SetRequestedHeight(254.8f),

        // ========== SONG TITLE + ARTIST ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                FlexLayout::New()
                    .SetDirection(FlexDirection::COLUMN)
                    .SetAlignItems(FlexAlign::FLEX_START)
                    .Children({
                        Label::New("Midnight City")
                            .SetFontSize(140)
                            .SetTextColor(UiColor(0xffffff)),
                        Label::New("M83")
                            .SetFontSize(70)
                            .SetTextColor(UiColor(0x9ba1b8))
                            .SetMargin(Extents(0, 0, 21, 0)),
                    }),
                Label::New("♥")
                    .SetFontSize(112)
                    .SetTextColor(UiColor(0xff4d7a)),
            }),

        // Spacer
        View::New().SetRequestedHeight(145.6f),

        // ========== PROGRESS BAR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(21.0f)
            .SetBackgroundColor(UiColor(0x1f2540))
            .Children({
                View::New()
                    .SetBackgroundColor(UiColor(0xffffff))
                    .SetRequestedWidth(910.0f)
                    .SetRequestedHeight(21.0f),
            }),

        // Time row
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetMargin(Extents(0, 0, 35, 0))
            .Children({
                Label::New("1:32").SetFontSize(46).SetTextColor(UiColor(0x9ba1b8)),
                Label::New("4:03").SetFontSize(46).SetTextColor(UiColor(0x9ba1b8)),
            }),

        // Spacer
        View::New().SetRequestedHeight(163.8f),

        // ========== PLAYBACK CONTROLS ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                Label::New("⇄").SetFontSize(133).SetTextColor(UiColor(0xd1d5e3)),
                Label::New("◀◀").SetFontSize(133).SetTextColor(UiColor(0xffffff)),
                FlexLayout::New()
                    .SetDirection(FlexDirection::COLUMN)
                    .SetJustifyContent(FlexJustify::CENTER)
                    .SetAlignItems(FlexAlign::CENTER)
                    .SetRequestedWidth(336.0f)
                    .SetRequestedHeight(336.0f)
                    .SetBackgroundColor(UiColor(0xffffff))
                    .SetCornerRadius(168.0f)
                    .Children({
                        Label::New("▶")
                            .SetFontSize(140)
                            .SetTextColor(UiColor(0x0a0a14)),
                    }),
                Label::New("▶▶").SetFontSize(133).SetTextColor(UiColor(0xffffff)),
                Label::New("↻").SetFontSize(133).SetTextColor(UiColor(0xd1d5e3)),
            }),

        // Spacer
        View::New().SetRequestedHeight(191.1f),

        // ========== BOTTOM ACTION BAR ==========
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .Children({
                Label::New("◉ JBL Flip 5").SetFontSize(49).SetTextColor(UiColor(0x2dd47b)),
                FlexLayout::New()
                    .SetDirection(FlexDirection::ROW)
                    .Children({
                        Label::New("♫").SetFontSize(77).SetTextColor(UiColor(0x9ba1b8)).SetMargin(Extents(0, 98, 0, 0)),
                        Label::New("≡").SetFontSize(91).SetTextColor(UiColor(0x9ba1b8)),
                    }),
            }),
    });
