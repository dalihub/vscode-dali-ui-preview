// M1/F1.4 server-path sample: method-form Label text + markup.
// First label sets its text via .SetText() (not the constructor); second uses
// markup. Before M1 the server only read constructor-arg text → method-form
// .SetText() labels rendered empty, and markup tags showed as literal text.
StackLayout::New(StackOrientation::VERTICAL)
    .SetSpacing(24.0f)
    .SetBackgroundColor(UiColor(0x101418))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetPadding(Extents(40, 40, 40, 40))
    .Children({
        Label::New()
            .SetText("Method Text")
            .SetTextColor(UiColor(0xffffff))
            .SetFontSize(36),
        Label::New("<color value='#00d4a8'>Markup</color>")
            .SetMarkupEnabled(true)
            .SetFontSize(36),
    });
