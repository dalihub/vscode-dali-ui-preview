// @preview-config: name="Tokens", theme=dark
// F3.3 — server-path UiColor token resolution. These boxes color themselves with
// dali-ui color TOKENS (UiColor::PRIMARY / UiColor("Background") /
// UiColor("Surface")), not hex. The server's SBParseUiColor now resolves token
// strings through UiColorManager, and a theme=dark RENDER_JSON installs the dark
// override — so the tokens render as dark-palette colors instead of the old
// magenta "unresolved" fallback. A hex box proves the honest boundary: hex is
// theme-independent (never routes through the override).
FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetBackgroundColor(UiColor("Background"))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        View::New()
            .SetBackgroundColor(UiColor::PRIMARY)
            .SetRequestedWidth(150.0f)
            .SetRequestedHeight(70.0f)
            .SetMargin(Extents(12, 12, 12, 12)),
        View::New()
            .SetBackgroundColor(UiColor("Surface"))
            .SetRequestedWidth(150.0f)
            .SetRequestedHeight(70.0f)
            .SetMargin(Extents(12, 12, 12, 12)),
        View::New()
            .SetBackgroundColor(UiColor(0xFF8800))
            .SetRequestedWidth(150.0f)
            .SetRequestedHeight(40.0f)
            .SetMargin(Extents(12, 12, 12, 12)),
    });
