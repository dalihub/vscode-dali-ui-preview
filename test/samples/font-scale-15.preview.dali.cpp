// @preview-config: name="Large", fontScale=1.5
// F3.1 — fontScale really scales rendered text. The build chains
// UiConfig::SetScalingFactor(1.5) BEFORE Apply() (frozen, ui-config.h:177). That
// scales the _spx unit (unit.h: "_spx is multiplied by a scaling-factor
// configured via UiConfig"). So these labels — sized with _spx, NOT raw pixels —
// render 1.5x larger than at fontScale 1.0. (Raw .SetFontSize(48.0f) pixels would
// NOT scale; the sample sizes in _spx on purpose so the scaling is visible.)
// _spx evaluates at render time, inside CreatePreviewUI(), which runs after
// Apply() — so the literal is valid and picks up the scaling factor.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x1e1e2e));
Label heading = Label::New("Scaled Heading");
heading.SetFontSize(48.0_spx);
heading.SetTextColor(UiColor(0xFFFFFF));
Label body = Label::New("Body at 1.5x");
body.SetFontSize(28.0_spx);
body.SetTextColor(UiColor(0xC0C8E0));
root.AddChildren({
    heading,
    body,
});
return root;
