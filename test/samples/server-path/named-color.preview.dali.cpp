// F1.5: named UiColor (Color::RED) + .WithAlpha on a UiColor(...) call.
// Previously the server rendered both as BLACK (silent-wrong). Now: a solid red
// box + a translucent teal box. (Color::CYAN.WithAlpha is avoided: the T1 parser
// only allows .Method() chains after a (...) call — Color::CYAN is not a call,
// but UiColor(0x..) is, so .WithAlpha attaches there.)
FlexLayout::New()
    .SetDirection(FlexDirection::ROW)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetBackgroundColor(UiColor(0x101418))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        View::New()
            .SetBackgroundColor(Color::RED)
            .SetRequestedWidth(150.0f)
            .SetRequestedHeight(150.0f)
            .SetMargin(Extents(16, 16, 16, 16)),
        View::New()
            .SetBackgroundColor(UiColor(0x00d4a8).WithAlpha(0.5f))
            .SetRequestedWidth(150.0f)
            .SetRequestedHeight(150.0f)
            .SetMargin(Extents(16, 16, 16, 16)),
    });
