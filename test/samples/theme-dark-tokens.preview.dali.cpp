// @preview-config: name="Dark", theme=dark
// F3.2 — theme=dark token reskin. These widgets color themselves via dali-ui
// COLOR TOKENS (UiColor::PRIMARY / UiColor("Background") / UiColor("OnSurface")),
// not hex. With theme=dark the build installs a dark color override
// (UiColorManager::SetColorOverride) so those tokens resolve to dark-palette
// RGBA — the boxes reskin, not just the window background. A hex-colored box is
// included to prove the honest boundary: hex never routes through the override,
// so it stays the same regardless of theme.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor("Background"));

View primaryBox = View::New();
primaryBox.SetBackgroundColor(UiColor::PRIMARY);
primaryBox.SetRequestedWidth(180.0f);
primaryBox.SetRequestedHeight(70.0f);
primaryBox.SetMargin(Extents(10, 10, 10, 10));

View surfaceBox = View::New();
surfaceBox.SetBackgroundColor(UiColor("Surface"));
surfaceBox.SetRequestedWidth(180.0f);
surfaceBox.SetRequestedHeight(70.0f);
surfaceBox.SetMargin(Extents(10, 10, 10, 10));

Label tokenText = Label::New("Token text");
tokenText.SetFontSize(28);
tokenText.SetTextColor(UiColor("OnSurface"));

View hexBox = View::New();
hexBox.SetBackgroundColor(UiColor(0xFF8800));
hexBox.SetRequestedWidth(180.0f);
hexBox.SetRequestedHeight(40.0f);
hexBox.SetMargin(Extents(10, 10, 10, 10));

root.AddChildren({ primaryBox, surfaceBox, tokenText, hexBox });
return root;
