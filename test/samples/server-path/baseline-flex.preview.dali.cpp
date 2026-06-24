// @preview-config: width=400, height=400
// Baseline that the resident server scene-builder (SBBuildNode) already renders
// correctly: hex UiColor, FlexLayout COLUMN, MATCH_PARENT, constructor-arg Label.
// Deliberately avoids cornerRadius / named-colors / method-form text so this stays
// a green reference for the server-path golden suite.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetBackgroundColor(UiColor(0x1b2330));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);

Label label = Label::New("Server Path OK");
label.SetTextColor(UiColor(0xffffff));
label.SetFontSize(40);
root.AddChildren({ label });
return root;
