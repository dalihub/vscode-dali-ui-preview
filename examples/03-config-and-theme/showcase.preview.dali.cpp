// @preview-preset: light-dark
// @preview-config: name="Phone", width=720, height=1280
// @preview-config: name="Tablet", width=1280, height=800
// @preview-config: name="Dark", theme=dark
// @preview-config: name="Large", fontScale=1.5
// @preview-config: name="RTL", locale=ar
//
// ONE builder, rendered under every config above. Each key changes a different
// dimension of the SAME tree, so you can see them side-by-side in the panel:
//   - theme=dark   reskins the TOKEN-coloured boxes/text (UiColor("Surface"),
//                  UiColor::PRIMARY, UiColor("OnSurface")) to the dark palette;
//                  the hex box (0xFF8800) never routes through the override, so
//                  it stays the same — the honest boundary.
//   - fontScale=1.5 scales the _spx-sized heading 1.5x (raw-pixel text would not).
//   - locale=ar    mirrors the ROW: red "1" moves to the right, blue "3" to the left.
//   - width/height re-lay-out the column for each device frame.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor("Background"));

// _spx heading — scales under fontScale=1.5
Label heading = Label::New("Config Showcase");
heading.SetFontSize(40.0_spx);
heading.SetTextColor(UiColor("OnSurface"));

// token-coloured boxes — reskin under theme=dark
View primaryBox = View::New();
primaryBox.SetBackgroundColor(UiColor::PRIMARY);
primaryBox.SetRequestedWidth(180.0f);
primaryBox.SetRequestedHeight(60.0f);
primaryBox.SetMargin(Extents(10, 10, 10, 10));

View surfaceBox = View::New();
surfaceBox.SetBackgroundColor(UiColor("Surface"));
surfaceBox.SetRequestedWidth(180.0f);
surfaceBox.SetRequestedHeight(60.0f);
surfaceBox.SetMargin(Extents(10, 10, 10, 10));

// hex box — never reskins (proves the boundary)
View hexBox = View::New();
hexBox.SetBackgroundColor(UiColor(0xFF8800));
hexBox.SetRequestedWidth(180.0f);
hexBox.SetRequestedHeight(40.0f);
hexBox.SetMargin(Extents(10, 10, 10, 10));

// labelled ROW — mirrors under locale=ar (1-2-3 left→right becomes 3-2-1)
View box1 = View::New();
box1.SetBackgroundColor(UiColor(0xE05050));
box1.SetRequestedWidth(110.0f);
box1.SetRequestedHeight(110.0f);
Label label1 = Label::New("1");
label1.SetFontSize(36.0f);
label1.SetTextColor(UiColor(0xFFFFFF));
box1.AddChildren({ label1 });

View box2 = View::New();
box2.SetBackgroundColor(UiColor(0x50E050));
box2.SetRequestedWidth(110.0f);
box2.SetRequestedHeight(110.0f);
Label label2 = Label::New("2");
label2.SetFontSize(36.0f);
label2.SetTextColor(UiColor(0xFFFFFF));
box2.AddChildren({ label2 });

View box3 = View::New();
box3.SetBackgroundColor(UiColor(0x5070E0));
box3.SetRequestedWidth(110.0f);
box3.SetRequestedHeight(110.0f);
Label label3 = Label::New("3");
label3.SetFontSize(36.0f);
label3.SetTextColor(UiColor(0xFFFFFF));
box3.AddChildren({ label3 });

FlexLayout row = FlexLayout::New();
row.SetDirection(FlexDirection::ROW);
row.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
row.SetAlignItems(FlexAlign::CENTER);
row.SetRequestedWidth(560.0f);
row.AddChildren({ box1, box2, box3 });

root.AddChildren({ heading, primaryBox, surfaceBox, hexBox, row });
return root;
