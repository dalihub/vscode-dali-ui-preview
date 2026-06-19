// @preview-preset: light-dark
// @preview-config: name="Phone", width=720, height=1280
// @preview-config: name="Tablet", width=1280, height=800
// @preview-config: name="Dark", theme=dark
// @preview-config: name="Large", fontScale=1.5
// @preview-config: name="RTL", locale=ar
//
// ONE builder, rendered under every config above. Each key changes a different
// dimension of the SAME tree, so you can see them side-by-side in the panel:
//   - theme=dark   reskins the TOKEN-coloured boxes/text (UiColor("Surface"),
//                  UiColor::PRIMARY, UiColor("OnSurface")) to the dark palette;
//                  the hex box (0xFF8800) never routes through the override, so
//                  it stays the same — the honest boundary.
//   - fontScale=1.5 scales the _spx-sized heading 1.5x (raw-pixel text would not).
//   - locale=ar    mirrors the ROW: red "1" moves to the right, blue "3" to the left.
//   - width/height re-lay-out the column for each device frame.
return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::CENTER)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor("Background"))
    .Children({
        // _spx heading — scales under fontScale=1.5
        Label::New("Config Showcase")
            .SetFontSize(40.0_spx)
            .SetTextColor(UiColor("OnSurface")),
        // token-coloured boxes — reskin under theme=dark
        View::New()
            .SetBackgroundColor(UiColor::PRIMARY)
            .SetRequestedWidth(180.0f)
            .SetRequestedHeight(60.0f)
            .SetMargin(Extents(10, 10, 10, 10)),
        View::New()
            .SetBackgroundColor(UiColor("Surface"))
            .SetRequestedWidth(180.0f)
            .SetRequestedHeight(60.0f)
            .SetMargin(Extents(10, 10, 10, 10)),
        // hex box — never reskins (proves the boundary)
        View::New()
            .SetBackgroundColor(UiColor(0xFF8800))
            .SetRequestedWidth(180.0f)
            .SetRequestedHeight(40.0f)
            .SetMargin(Extents(10, 10, 10, 10)),
        // labelled ROW — mirrors under locale=ar (1-2-3 left→right becomes 3-2-1)
        FlexLayout::New()
            .SetDirection(FlexDirection::ROW)
            .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
            .SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(560.0f)
            .Children({
                View::New()
                    .SetBackgroundColor(UiColor(0xE05050))
                    .SetRequestedWidth(110.0f)
                    .SetRequestedHeight(110.0f)
                    .Children({
                        Label::New("1")
                            .SetFontSize(36.0f)
                            .SetTextColor(UiColor(0xFFFFFF)),
                    }),
                View::New()
                    .SetBackgroundColor(UiColor(0x50E050))
                    .SetRequestedWidth(110.0f)
                    .SetRequestedHeight(110.0f)
                    .Children({
                        Label::New("2")
                            .SetFontSize(36.0f)
                            .SetTextColor(UiColor(0xFFFFFF)),
                    }),
                View::New()
                    .SetBackgroundColor(UiColor(0x5070E0))
                    .SetRequestedWidth(110.0f)
                    .SetRequestedHeight(110.0f)
                    .Children({
                        Label::New("3")
                            .SetFontSize(36.0f)
                            .SetTextColor(UiColor(0xFFFFFF)),
                    }),
            }),
    });
