// ⚡ Parser path test (~80ms)
// Pure fluent chain — TypeScript parses directly, NO C++ compile.
// Expected log: parse: 0ms (success), renderJson: ~80ms

FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::STRETCH);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetPadding(Extents(20, 20, 24, 20));
root.SetBackgroundColor(UiColor(0x1B1B2F));

Label title = Label::New("Parser Path");
title.SetFontSize(28);
title.SetTextColor(UiColor(0x00FF88));

View divider = View::New();
divider.SetBackgroundColor(UiColor(0x333355));
divider.SetRequestedWidth(MATCH_PARENT);
divider.SetRequestedHeight(2.0f);
divider.SetMargin(Extents(0, 0, 12, 12));

FlexLayout row = FlexLayout::New();
row.SetDirection(FlexDirection::ROW);
row.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
row.SetRequestedWidth(MATCH_PARENT);

View box1 = View::New();
box1.SetBackgroundColor(UiColor(0x6C63FF));
box1.SetRequestedWidth(100.0f);
box1.SetRequestedHeight(80.0f);

View box2 = View::New();
box2.SetBackgroundColor(UiColor(0xFF6584));
box2.SetRequestedWidth(100.0f);
box2.SetRequestedHeight(80.0f);

View box3 = View::New();
box3.SetBackgroundColor(UiColor(0x43E97B));
box3.SetRequestedWidth(100.0f);
box3.SetRequestedHeight(80.0f);

row.AddChildren({ box1, box2, box3 });

Label caption = Label::New("No C++ compile needed");
caption.SetFontSize(12);
caption.SetTextColor(UiColor(0x888888));
caption.SetMargin(Extents(0, 0, 16, 0));

root.AddChildren({ title, divider, row, caption });
return root;
