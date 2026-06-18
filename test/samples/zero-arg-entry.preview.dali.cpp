// @dali-preview
// A zero-arg `@dali-preview` factory (ADR-001 Mode 2) — the harness extracts
// this body and renders it through CreatePreviewUI, exactly like the marker
// paths. Self-contained / same-file (cross-file composition is M4).
View MakeHomePreview()
{
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetJustifyContent(FlexJustify::CENTER)
        .SetAlignItems(FlexAlign::CENTER)
        .SetBackgroundColor(UiColor(0x1b2330))
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(MATCH_PARENT)
        .Children({
            Label::New("Zero-Arg Entry")
                .SetTextColor(UiColor(0xffffff))
                .SetFontSize(44),
        });
}
