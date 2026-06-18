// F1.6 SetVisibility coverage (external-review gap): two same-size boxes side by
// side; the RED one is SetVisibility(false) → only the teal box renders. If the
// server regresses to ignoring SetVisibility, the red box reappears → golden FAILS.
FlexLayout::New()
    .SetDirection(FlexDirection::ROW)
    .SetJustifyContent(FlexJustify::SPACE_EVENLY)
    .SetAlignItems(FlexAlign::CENTER)
    .SetBackgroundColor(UiColor(0x101418))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        View::New()
            .SetBackgroundColor(UiColor(0x00d4a8))
            .SetRequestedWidth(140.0f)
            .SetRequestedHeight(140.0f),
        View::New()
            .SetBackgroundColor(UiColor(0xe24a4a))
            .SetVisibility(false)
            .SetRequestedWidth(140.0f)
            .SetRequestedHeight(140.0f),
    });
