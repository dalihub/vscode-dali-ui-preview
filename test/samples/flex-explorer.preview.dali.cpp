FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);

Label header = Label::New("Header");
header.SetFontSize(24.0f);

View bar = View::New();
bar.SetBackgroundColor(UiColor(0x007acc));
bar.SetRequestedWidth(MATCH_PARENT);
bar.SetRequestedHeight(100.0f);

Label footer = Label::New("Footer");
footer.SetFontSize(16.0f);
root.AddChildren({
    header,
    bar,
    footer,
});
return root;
