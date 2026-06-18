// M0 characterization sample for the SERVER scene-builder path.
// At M0 the server ignores SetCornerRadius → this teal box renders with SQUARE
// corners (on purpose). M1/F1.1 adds SetCornerRadius to the server, after which
// the box renders ROUNDED and this golden is updated (red→green proof).
FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetBackgroundColor(UiColor(0x101418))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        View::New()
            .SetBackgroundColor(UiColor(0x00d4a8))
            .SetCornerRadius(64.0f)
            .SetRequestedWidth(220.0f)
            .SetRequestedHeight(220.0f),
    });
