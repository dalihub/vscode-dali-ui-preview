FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x1e1e2e));

Label label = Label::New("Hello DALi!");
label.SetFontSize(48);
label.SetTextColor(UiColor(0xFFFFFF));
root.AddChildren({ label });
return root;
