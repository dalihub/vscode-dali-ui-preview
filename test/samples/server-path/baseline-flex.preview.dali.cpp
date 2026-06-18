// @preview-config: width=400, height=400
// Baseline that the resident server scene-builder (SBBuildNode) already renders
// correctly: hex UiColor, FlexLayout COLUMN, MATCH_PARENT, constructor-arg Label.
// Deliberately avoids cornerRadius / named-colors / method-form text so this stays
// a green reference for the server-path golden suite.
return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetBackgroundColor(UiColor(0x1b2330))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        Label::New("Server Path OK")
            .SetTextColor(UiColor(0xffffff))
            .SetFontSize(40),
    });
