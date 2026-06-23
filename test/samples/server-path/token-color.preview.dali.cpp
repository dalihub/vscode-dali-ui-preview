// @preview-config: name="Tokens", theme=dark
// F3.3 — server-path UiColor token resolution. These boxes color themselves with
// dali-ui color TOKENS (UiColor::PRIMARY / UiColor("Background") /
// UiColor("Surface")), not hex. The server's SBParseUiColor now resolves token
// strings through UiColorManager, and a theme=dark RENDER_JSON installs the dark
// override — so the tokens render as dark-palette colors instead of the old
// magenta "unresolved" fallback. A hex box proves the honest boundary: hex is
// theme-independent (never routes through the override).
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor("Background"));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);

View primaryBox = View::New();
primaryBox.SetBackgroundColor(UiColor::PRIMARY);
primaryBox.SetRequestedWidth(150.0f);
primaryBox.SetRequestedHeight(70.0f);
primaryBox.SetMargin(Extents(12, 12, 12, 12));

View surfaceBox = View::New();
surfaceBox.SetBackgroundColor(UiColor("Surface"));
surfaceBox.SetRequestedWidth(150.0f);
surfaceBox.SetRequestedHeight(70.0f);
surfaceBox.SetMargin(Extents(12, 12, 12, 12));

View hexBox = View::New();
hexBox.SetBackgroundColor(UiColor(0xFF8800));
hexBox.SetRequestedWidth(150.0f);
hexBox.SetRequestedHeight(40.0f);
hexBox.SetMargin(Extents(12, 12, 12, 12));

root.AddChildren({ primaryBox, surfaceBox, hexBox });
return root;
