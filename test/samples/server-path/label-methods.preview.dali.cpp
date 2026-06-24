// M1/F1.4 server-path sample: method-form Label text + markup.
// First label sets its text via .SetText() (not the constructor); second uses
// markup. Before M1 the server only read constructor-arg text → method-form
// .SetText() labels rendered empty, and markup tags showed as literal text.
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(24.0f);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetPadding(Extents(40, 40, 40, 40));

Label label1 = Label::New();
label1.SetText("Method Text");
label1.SetTextColor(UiColor(0xffffff));
label1.SetFontSize(36);

Label label2 = Label::New("<color value='#00d4a8'>Markup</color>");
label2.SetMarkupEnabled(true);
label2.SetFontSize(36);
root.AddChildren({
    label1,
    label2,
});
return root;
