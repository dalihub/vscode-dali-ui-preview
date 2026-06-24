FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::STRETCH);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetPadding(Extents(24, 24, 32, 24));
root.SetBackgroundColor(UiColor(0x121212));

// ── Header ──
FlexLayout header = FlexLayout::New();
header.SetDirection(FlexDirection::ROW);
header.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
header.SetAlignItems(FlexAlign::FLEX_END);
header.SetRequestedWidth(MATCH_PARENT);
header.SetPadding(Extents(0, 0, 0, 16));

Label headerTitle = Label::New("Gallery");
headerTitle.SetFontSize(36);
headerTitle.SetTextColor(UiColor(0xFFFFFF));

Label headerCount = Label::New("24 Photos");
headerCount.SetFontSize(14);
headerCount.SetTextColor(UiColor(0x888888));
header.AddChildren({
    headerTitle,
    headerCount,
});

// ── Divider ──
View divider = View::New();
divider.SetBackgroundColor(UiColor(0x2A2A2A));
divider.SetRequestedWidth(MATCH_PARENT);
divider.SetRequestedHeight(1.0f);
divider.SetMargin(Extents(0, 0, 0, 16));

// ── Photo Grid 3x3 ──
FlexLayout grid = FlexLayout::New();
grid.SetDirection(FlexDirection::ROW);
grid.SetWrap(FlexWrap::WRAP);
grid.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
grid.SetRequestedWidth(MATCH_PARENT);
// Row 1
View photo1 = View::New();
photo1.SetBackgroundColor(UiColor(0x6C63FF));
photo1.SetRequestedWidth(150.0f);
photo1.SetRequestedHeight(150.0f);
photo1.SetMargin(Extents(0, 0, 0, 8));

View photo2 = View::New();
photo2.SetBackgroundColor(UiColor(0xFF6584));
photo2.SetRequestedWidth(150.0f);
photo2.SetRequestedHeight(150.0f);
photo2.SetMargin(Extents(0, 0, 0, 8));

View photo3 = View::New();
photo3.SetBackgroundColor(UiColor(0x43E97B));
photo3.SetRequestedWidth(150.0f);
photo3.SetRequestedHeight(150.0f);
photo3.SetMargin(Extents(0, 0, 0, 8));
// Row 2
View photo4 = View::New();
photo4.SetBackgroundColor(UiColor(0xF7971E));
photo4.SetRequestedWidth(150.0f);
photo4.SetRequestedHeight(150.0f);
photo4.SetMargin(Extents(0, 0, 0, 8));

View photo5 = View::New();
photo5.SetBackgroundColor(UiColor(0x38F9D7));
photo5.SetRequestedWidth(150.0f);
photo5.SetRequestedHeight(150.0f);
photo5.SetMargin(Extents(0, 0, 0, 8));

View photo6 = View::New();
photo6.SetBackgroundColor(UiColor(0xA18CD1));
photo6.SetRequestedWidth(150.0f);
photo6.SetRequestedHeight(150.0f);
photo6.SetMargin(Extents(0, 0, 0, 8));
// Row 3
View photo7 = View::New();
photo7.SetBackgroundColor(UiColor(0xFDA085));
photo7.SetRequestedWidth(150.0f);
photo7.SetRequestedHeight(150.0f);
photo7.SetMargin(Extents(0, 0, 0, 8));

View photo8 = View::New();
photo8.SetBackgroundColor(UiColor(0x667EEA));
photo8.SetRequestedWidth(150.0f);
photo8.SetRequestedHeight(150.0f);
photo8.SetMargin(Extents(0, 0, 0, 8));

View photo9 = View::New();
photo9.SetBackgroundColor(UiColor(0xF093FB));
photo9.SetRequestedWidth(150.0f);
photo9.SetRequestedHeight(150.0f);
photo9.SetMargin(Extents(0, 0, 0, 8));
grid.AddChildren({
    photo1,
    photo2,
    photo3,
    photo4,
    photo5,
    photo6,
    photo7,
    photo8,
    photo9,
});

// ── Spacer ──
View spacer = View::New();
spacer.SetRequestedHeight(20.0f);

// ── Category Pills ──
FlexLayout pills = FlexLayout::New();
pills.SetDirection(FlexDirection::ROW);
pills.SetJustifyContent(FlexJustify::CENTER);
pills.SetAlignItems(FlexAlign::CENTER);
pills.SetRequestedWidth(MATCH_PARENT);

View pillAll = View::New();
pillAll.SetBackgroundColor(UiColor(0x6C63FF));
pillAll.SetPadding(Extents(28, 28, 10, 10));
pillAll.SetMargin(Extents(0, 8, 0, 0));

Label pillAllLabel = Label::New("All");
pillAllLabel.SetFontSize(14);
pillAllLabel.SetTextColor(UiColor(0xFFFFFF));
pillAll.AddChildren({ pillAllLabel });

View pillFavorites = View::New();
pillFavorites.SetBackgroundColor(UiColor(0x2A2A2A));
pillFavorites.SetPadding(Extents(28, 28, 10, 10));
pillFavorites.SetMargin(Extents(0, 8, 0, 0));

Label pillFavoritesLabel = Label::New("Favorites");
pillFavoritesLabel.SetFontSize(14);
pillFavoritesLabel.SetTextColor(UiColor(0xAAAAAA));
pillFavorites.AddChildren({ pillFavoritesLabel });

View pillRecent = View::New();
pillRecent.SetBackgroundColor(UiColor(0x2A2A2A));
pillRecent.SetPadding(Extents(28, 28, 10, 10));

Label pillRecentLabel = Label::New("Recent");
pillRecentLabel.SetFontSize(14);
pillRecentLabel.SetTextColor(UiColor(0xAAAAAA));
pillRecent.AddChildren({ pillRecentLabel });
pills.AddChildren({
    pillAll,
    pillFavorites,
    pillRecent,
});

root.AddChildren({
    header,
    divider,
    grid,
    spacer,
    pills,
});
return root;
