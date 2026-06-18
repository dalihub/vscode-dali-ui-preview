// @preview-config: name="Large", fontScale=1.5
// F3.1 — fontScale really scales rendered text. The build chains
// UiConfig::SetScalingFactor(1.5) BEFORE Apply() (frozen, ui-config.h:177). That
// scales the _spx unit (unit.h: "_spx is multiplied by a scaling-factor
// configured via UiConfig"). So these labels — sized with _spx, NOT raw pixels —
// render 1.5x larger than at fontScale 1.0. (Raw .SetFontSize(48.0f) pixels would
// NOT scale; the sample sizes in _spx on purpose so the scaling is visible.)
// _spx evaluates at render time, inside CreatePreviewUI(), which runs after
// Apply() — so the literal is valid and picks up the scaling factor.
return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::CENTER)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x1e1e2e))
    .Children({
        Label::New("Scaled Heading")
            .SetFontSize(48.0_spx)
            .SetTextColor(UiColor(0xFFFFFF)),
        Label::New("Body at 1.5x")
            .SetFontSize(28.0_spx)
            .SetTextColor(UiColor(0xC0C8E0)),
    });
