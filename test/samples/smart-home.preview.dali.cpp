// @preview-config: name="Smart Home", width=2520, height=4480
return StackLayout::New(StackOrientation::VERTICAL)
    .Spacing(0.0f)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0xf4f5f7))
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
                Label::New("9:41").SetFontSize(49).SetTextColor(UiColor(0x1a1a2b)),
                Label::New("●●●  5G  ▮ 92%").SetFontSize(39).SetTextColor(UiColor(0x1a1a2b)),
            }),

        // ========== HEADER ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(280.0f)
            .SetViewPadding(Extents(98, 98, 28, 14))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                    Label::New("Good evening,").SetFontSize(53).SetTextColor(UiColor(0x6b7280)),
                    Label::New("Alex").SetFontSize(112).SetTextColor(UiColor(0x1a1a2b)).SetViewMargin(Extents(0, 0, 21, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::ROW).AlignItems(FlexAlign::CENTER).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(154.0f).SetRequestedHeight(154.0f).SetBackgroundColor(UiColor(0xffffff)).SetCornerRadius(77.0f).SetViewMargin(Extents(0, 35, 0, 0)).Children({
                        Label::New("◉").SetFontSize(60).SetTextColor(UiColor(0x1a1a2b)),
                    }),
                    ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait4.jpg")
                        .SetRequestedWidth(154.0f)
                        .SetRequestedHeight(154.0f)
                        .SetCornerRadius(77.0f),
                }),
            }),

        // ========== STATUS LINE ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(98, 98, 0, 0))
            .Children({
                Label::New("☀ 72°F").SetFontSize(42).SetTextColor(UiColor(0x1a1a2b)),
                Label::New("  ·  14 devices online  ·  ").SetFontSize(42).SetTextColor(UiColor(0x6b7280)),
                Label::New("Home mode").SetFontSize(42).SetTextColor(UiColor(0x2563eb)),
            }),

        View::New().SetRequestedHeight(81.9f),

        // ========== SEGMENTED CONTROL ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(84, 84, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x1a1a2b)).SetCornerRadius(70.0f).SetViewPadding(Extents(70, 70, 35, 35)).SetViewMargin(Extents(0, 42, 0, 0)).Children({
                    Label::New("All").SetFontSize(49).SetTextColor(UiColor(0xffffff)),
                }),
                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xffffff)).SetCornerRadius(70.0f).SetViewPadding(Extents(70, 70, 35, 35)).SetViewMargin(Extents(0, 42, 0, 0)).Children({
                    Label::New("Living").SetFontSize(49).SetTextColor(UiColor(0x6b7280)),
                }),
                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xffffff)).SetCornerRadius(70.0f).SetViewPadding(Extents(70, 70, 35, 35)).SetViewMargin(Extents(0, 42, 0, 0)).Children({
                    Label::New("Bedroom").SetFontSize(49).SetTextColor(UiColor(0x6b7280)),
                }),
                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xffffff)).SetCornerRadius(70.0f).SetViewPadding(Extents(70, 70, 35, 35)).Children({
                    Label::New("Kitchen").SetFontSize(49).SetTextColor(UiColor(0x6b7280)),
                }),
            }),

        View::New().SetRequestedHeight(81.9f),

        // ========== SCENE ROW ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(84, 84, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(742.0f).SetRequestedHeight(385.0f).SetBackgroundColor(UiColor(0xffffff)).SetCornerRadius(70.0f).SetViewPadding(Extents(63, 63, 56, 0)).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(140.0f).SetRequestedHeight(140.0f).SetBackgroundColor(UiColor(0xfff3e0)).SetCornerRadius(70.0f).Children({
                        Label::New("◐").SetFontSize(70).SetTextColor(UiColor(0xf59e0b)),
                    }),
                    Label::New("Morning").SetFontSize(49).SetTextColor(UiColor(0x1a1a2b)).SetViewMargin(Extents(0, 0, 35, 0)),
                    Label::New("8 devices").SetFontSize(39).SetTextColor(UiColor(0x6b7280)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(742.0f).SetRequestedHeight(385.0f).SetBackgroundColor(UiColor(0xffffff)).SetCornerRadius(70.0f).SetViewPadding(Extents(63, 63, 56, 0)).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(140.0f).SetRequestedHeight(140.0f).SetBackgroundColor(UiColor(0xeae1ff)).SetCornerRadius(70.0f).Children({
                        Label::New("▶").SetFontSize(63).SetTextColor(UiColor(0x7c3aed)),
                    }),
                    Label::New("Movie Time").SetFontSize(49).SetTextColor(UiColor(0x1a1a2b)).SetViewMargin(Extents(0, 0, 35, 0)),
                    Label::New("5 devices").SetFontSize(39).SetTextColor(UiColor(0x6b7280)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).SetRequestedWidth(742.0f).SetRequestedHeight(385.0f).SetBackgroundColor(UiColor(0xffffff)).SetCornerRadius(70.0f).SetViewPadding(Extents(63, 63, 56, 0)).Children({
                    FlexLayout::New().Direction(FlexDirection::COLUMN).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetRequestedWidth(140.0f).SetRequestedHeight(140.0f).SetBackgroundColor(UiColor(0xe0ecff)).SetCornerRadius(70.0f).Children({
                        Label::New("◑").SetFontSize(70).SetTextColor(UiColor(0x2563eb)),
                    }),
                    Label::New("Night").SetFontSize(49).SetTextColor(UiColor(0x1a1a2b)).SetViewMargin(Extents(0, 0, 35, 0)),
                    Label::New("12 devices").SetFontSize(39).SetTextColor(UiColor(0x6b7280)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
            }),

        View::New().SetRequestedHeight(91.0f),

        // ========== ROOMS HEADER ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(98, 98, 0, 0))
            .Children({
                Label::New("Rooms").SetFontSize(63).SetTextColor(UiColor(0x1a1a2b)),
                Label::New("+ Add").SetFontSize(42).SetTextColor(UiColor(0x2563eb)),
            }),

        View::New().SetRequestedHeight(54.6f),

        // ========== ROOMS ROW 1 ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(84, 84, 0, 0))
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .SetRequestedWidth(1148.0f)
                    .SetBackgroundColor(UiColor(0xffffff))
                    .SetCornerRadius(70.0f)
                    .Children({
                        ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/interior1.jpg")
                            .SetRequestedWidth(MATCH_PARENT)
                            .SetRequestedHeight(350.0f)
                            .SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).SetViewPadding(Extents(49, 49, 42, 42)).Children({
                            FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::SPACE_BETWEEN).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).Children({
                                Label::New("Living Room").SetFontSize(60).SetTextColor(UiColor(0x1a1a2b)),
                                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xeefaf3)).SetCornerRadius(38.5f).SetViewPadding(Extents(35, 35, 14, 14)).Children({
                                    Label::New("ON").SetFontSize(35).SetTextColor(UiColor(0x1f8a4c)),
                                }),
                            }),
                            Label::New("6 devices  ·  72°F").SetFontSize(39).SetTextColor(UiColor(0x6b7280)).SetViewMargin(Extents(0, 0, 21, 0)),
                        }),
                    }),
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .SetRequestedWidth(1148.0f)
                    .SetBackgroundColor(UiColor(0xffffff))
                    .SetCornerRadius(70.0f)
                    .Children({
                        ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/interior2.jpg")
                            .SetRequestedWidth(MATCH_PARENT)
                            .SetRequestedHeight(350.0f)
                            .SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).SetViewPadding(Extents(49, 49, 42, 42)).Children({
                            FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::SPACE_BETWEEN).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).Children({
                                Label::New("Bedroom").SetFontSize(60).SetTextColor(UiColor(0x1a1a2b)),
                                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xf4f5f7)).SetCornerRadius(38.5f).SetViewPadding(Extents(35, 35, 14, 14)).Children({
                                    Label::New("OFF").SetFontSize(35).SetTextColor(UiColor(0x6b7280)),
                                }),
                            }),
                            Label::New("4 devices  ·  68°F").SetFontSize(39).SetTextColor(UiColor(0x6b7280)).SetViewMargin(Extents(0, 0, 21, 0)),
                        }),
                    }),
            }),

        View::New().SetRequestedHeight(63.7f),

        // ========== ROOMS ROW 2 ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .JustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetRequestedWidth(MATCH_PARENT)
            .SetViewPadding(Extents(84, 84, 0, 0))
            .Children({
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .SetRequestedWidth(1148.0f)
                    .SetBackgroundColor(UiColor(0xffffff))
                    .SetCornerRadius(70.0f)
                    .Children({
                        ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/interior3.jpg")
                            .SetRequestedWidth(MATCH_PARENT)
                            .SetRequestedHeight(350.0f)
                            .SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).SetViewPadding(Extents(49, 49, 42, 42)).Children({
                            FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::SPACE_BETWEEN).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).Children({
                                Label::New("Kitchen").SetFontSize(60).SetTextColor(UiColor(0x1a1a2b)),
                                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xeefaf3)).SetCornerRadius(38.5f).SetViewPadding(Extents(35, 35, 14, 14)).Children({
                                    Label::New("ON").SetFontSize(35).SetTextColor(UiColor(0x1f8a4c)),
                                }),
                            }),
                            Label::New("5 devices  ·  74°F").SetFontSize(39).SetTextColor(UiColor(0x6b7280)).SetViewMargin(Extents(0, 0, 21, 0)),
                        }),
                    }),
                FlexLayout::New()
                    .Direction(FlexDirection::COLUMN)
                    .SetRequestedWidth(1148.0f)
                    .SetBackgroundColor(UiColor(0xffffff))
                    .SetCornerRadius(70.0f)
                    .Children({
                        ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/interior4.jpg")
                            .SetRequestedWidth(MATCH_PARENT)
                            .SetRequestedHeight(350.0f)
                            .SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f),
                        FlexLayout::New().Direction(FlexDirection::COLUMN).SetViewPadding(Extents(49, 49, 42, 42)).Children({
                            FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::SPACE_BETWEEN).AlignItems(FlexAlign::CENTER).SetRequestedWidth(MATCH_PARENT).Children({
                                Label::New("Office").SetFontSize(60).SetTextColor(UiColor(0x1a1a2b)),
                                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0xeefaf3)).SetCornerRadius(38.5f).SetViewPadding(Extents(35, 35, 14, 14)).Children({
                                    Label::New("ON").SetFontSize(35).SetTextColor(UiColor(0x1f8a4c)),
                                }),
                            }),
                            Label::New("3 devices  ·  71°F").SetFontSize(39).SetTextColor(UiColor(0x6b7280)).SetViewMargin(Extents(0, 0, 21, 0)),
                        }),
                    }),
            }),

        View::New().SetRequestedHeight(72.8f),

        // ========== ENERGY STRIP ==========
        FlexLayout::New()
            .Direction(FlexDirection::ROW)
            .AlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(MATCH_PARENT)
            .SetRequestedHeight(287.0f)
            .SetBackgroundColor(UiColor(0x1a1a2b))
            .SetCornerRadius(70.0f)
            .SetViewMargin(Extents(84, 84, 0, 0))
            .SetViewPadding(Extents(70, 70, 0, 0))
            .Children({
                FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::FLEX_START).Children({
                    Label::New("TODAY'S ENERGY").SetFontSize(35).SetTextColor(UiColor(0x8e94b8)),
                    Label::New("6.2 kWh").SetFontSize(77).SetTextColor(UiColor(0xffffff)).SetViewMargin(Extents(0, 0, 14, 0)),
                }),
                View::New().SetRequestedWidth(MATCH_PARENT).SetRequestedHeight(3.5f),
                FlexLayout::New().Direction(FlexDirection::ROW).JustifyContent(FlexJustify::CENTER).AlignItems(FlexAlign::CENTER).SetBackgroundColor(UiColor(0x0d3a22)).SetCornerRadius(52.5f).SetViewPadding(Extents(49, 49, 28, 28)).SetViewMargin(Extents(0, 49, 0, 0)).Children({
                    Label::New("▼ 12%").SetFontSize(42).SetTextColor(UiColor(0x22c55e)),
                }),
                Label::New("→").SetFontSize(77).SetTextColor(UiColor(0xffffff)),
            }),
    });
