// @dali-preview
// A zero-arg `@dali-preview` factory (ADR-001 Mode 2) — the harness extracts
// this body and renders it through CreatePreviewUI, exactly like the marker
// paths. Self-contained / same-file (cross-file composition is M4).
View MakeHomePreview()
{
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::COLUMN);
    root.SetJustifyContent(FlexJustify::CENTER);
    root.SetAlignItems(FlexAlign::CENTER);
    root.SetBackgroundColor(UiColor(0x1b2330));
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(MATCH_PARENT);

    Label label = Label::New("Zero-Arg Entry");
    label.SetTextColor(UiColor(0xffffff));
    label.SetFontSize(44);
    root.AddChildren({ label });
    return root;
}
