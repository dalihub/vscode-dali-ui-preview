FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetPadding(Extents(30, 30, 30, 30));
root.SetBackgroundColor(UiColor(0x1a1a2e));

Label title = Label::New("Test");
title.SetFontSize(28);
title.SetTextColor(UiColor(0xFF0000));

View card = View::New();
card.SetBackgroundColor(UiColor(0x4a90d9));
card.SetRequestedWidth(400.0f);
card.SetRequestedHeight(250.0f);

Label temp = Label::New("25 C");
temp.SetFontSize(100);
temp.SetTextColor(UiColor(0xE0E0E0));
root.AddChildren({
    title,
    card,
    temp,
});
return root;
