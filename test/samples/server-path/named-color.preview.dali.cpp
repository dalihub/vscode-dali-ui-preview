// F1.5: named UiColor (Color::RED) + .WithAlpha on a UiColor(...) call.
// Previously the server rendered both as BLACK (silent-wrong). Now: a solid red
// box + a translucent teal box. (Color::CYAN.WithAlpha is avoided: the T1 parser
// only allows .Method() chains after a (...) call — Color::CYAN is not a call,
// but UiColor(0x..) is, so .WithAlpha attaches there.)
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::ROW);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
View redBox = View::New();
redBox.SetBackgroundColor(Color::RED);
redBox.SetRequestedWidth(150.0f);
redBox.SetRequestedHeight(150.0f);
redBox.SetMargin(Extents(16, 16, 16, 16));
View tealBox = View::New();
tealBox.SetBackgroundColor(UiColor(0x00d4a8).WithAlpha(0.5f));
tealBox.SetRequestedWidth(150.0f);
tealBox.SetRequestedHeight(150.0f);
tealBox.SetMargin(Extents(16, 16, 16, 16));
root.AddChildren({ redBox, tealBox });
return root;
