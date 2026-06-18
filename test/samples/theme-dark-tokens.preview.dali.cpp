// @preview-config: name="Dark", theme=dark
// F3.2 — theme=dark token reskin. These widgets color themselves via dali-ui
// COLOR TOKENS (UiColor::PRIMARY / UiColor("Background") / UiColor("OnSurface")),
// not hex. With theme=dark the build installs a dark color override
// (UiColorManager::SetColorOverride) so those tokens resolve to dark-palette
// RGBA — the boxes reskin, not just the window background. A hex-colored box is
// included to prove the honest boundary: hex never routes through the override,
// so it stays the same regardless of theme.
return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::CENTER)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor("Background"))
    .Children({
        View::New()
            .SetBackgroundColor(UiColor::PRIMARY)
            .SetRequestedWidth(180.0f)
            .SetRequestedHeight(70.0f)
            .SetMargin(Extents(10, 10, 10, 10)),
        View::New()
            .SetBackgroundColor(UiColor("Surface"))
            .SetRequestedWidth(180.0f)
            .SetRequestedHeight(70.0f)
            .SetMargin(Extents(10, 10, 10, 10)),
        Label::New("Token text")
            .SetFontSize(28)
            .SetTextColor(UiColor("OnSurface")),
        View::New()
            .SetBackgroundColor(UiColor(0xFF8800))
            .SetRequestedWidth(180.0f)
            .SetRequestedHeight(40.0f)
            .SetMargin(Extents(10, 10, 10, 10)),
    });
