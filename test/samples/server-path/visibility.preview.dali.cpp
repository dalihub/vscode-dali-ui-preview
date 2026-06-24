// F1.6 SetVisibility coverage (external-review gap): two same-size boxes side by
// side; the RED one is SetVisibility(false) → only the teal box renders. If the
// server regresses to ignoring SetVisibility, the red box reappears → golden FAILS.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::ROW);
root.SetJustifyContent(FlexJustify::SPACE_EVENLY);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);

View tealBox = View::New();
tealBox.SetBackgroundColor(UiColor(0x00d4a8));
tealBox.SetRequestedWidth(140.0f);
tealBox.SetRequestedHeight(140.0f);

View redBox = View::New();
redBox.SetBackgroundColor(UiColor(0xe24a4a));
redBox.SetVisibility(false);
redBox.SetRequestedWidth(140.0f);
redBox.SetRequestedHeight(140.0f);
root.AddChildren({ tealBox, redBox });
return root;
