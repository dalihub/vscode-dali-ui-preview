// @preview-config: name="RTL", locale=ar
// F3.4 (WU-M3.5) — locale=ar mirrors a rendered ROW. An RTL locale (ar/he/fa/ur)
// makes the build set the root view's LAYOUT_DIRECTION to RIGHT_TO_LEFT after the
// tree is built (Dali::LayoutDirection::RIGHT_TO_LEFT; children inherit it). So
// this ROW's main-axis order mirrors: the FIRST child (red "1", left-most in LTR)
// renders on the RIGHT, and the LAST child (blue "3") on the LEFT. The labels and
// colors are unchanged — this is LAYOUT mirroring only, NOT translation (no
// catalog is loaded; the tool never fabricates a translated string). Compare with
// the same ROW at the default LTR locale: red-green-blue left→right becomes
// blue-green-red left→right under locale=ar.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::ROW);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x1e1e2e));

View box1 = View::New();
box1.SetBackgroundColor(UiColor(0xE05050));
box1.SetRequestedWidth(120.0f);
box1.SetRequestedHeight(120.0f);

Label label1 = Label::New("1");
label1.SetFontSize(40.0f);
label1.SetTextColor(UiColor(0xFFFFFF));
box1.AddChildren({ label1 });

View box2 = View::New();
box2.SetBackgroundColor(UiColor(0x50E050));
box2.SetRequestedWidth(120.0f);
box2.SetRequestedHeight(120.0f);

Label label2 = Label::New("2");
label2.SetFontSize(40.0f);
label2.SetTextColor(UiColor(0xFFFFFF));
box2.AddChildren({ label2 });

View box3 = View::New();
box3.SetBackgroundColor(UiColor(0x5070E0));
box3.SetRequestedWidth(120.0f);
box3.SetRequestedHeight(120.0f);

Label label3 = Label::New("3");
label3.SetFontSize(40.0f);
label3.SetTextColor(UiColor(0xFFFFFF));
box3.AddChildren({ label3 });

root.AddChildren({ box1, box2, box3 });
return root;
