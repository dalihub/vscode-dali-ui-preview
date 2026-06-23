StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0a0a14));

// ===== TOP BAR =====
FlexLayout topBar = FlexLayout::New();
topBar.SetDirection(FlexDirection::ROW);
topBar.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
topBar.SetAlignItems(FlexAlign::CENTER);
topBar.SetRequestedWidth(MATCH_PARENT);
topBar.SetRequestedHeight(40.0f);
topBar.SetPadding(Extents(40, 40, 0, 0));
topBar.SetBackgroundColor(UiColor(0x0f0f1a));
Label topTime = Label::New("12:30");
topTime.SetFontSize(18);
topTime.SetTextColor(UiColor(0xCCCCCC));
Label topName = Label::New("Samsung TV");
topName.SetFontSize(14);
topName.SetTextColor(UiColor(0x888899));
Label topSettings = Label::New("Settings");
topSettings.SetFontSize(14);
topSettings.SetTextColor(UiColor(0x666677));
topBar.AddChildren({
    topTime,
    topName,
    topSettings,
});

// ===== HERO BANNER =====
FlexLayout hero = FlexLayout::New();
hero.SetDirection(FlexDirection::COLUMN);
hero.SetJustifyContent(FlexJustify::FLEX_END);
hero.SetRequestedWidth(MATCH_PARENT);
hero.SetRequestedHeight(180.0f);
hero.SetMargin(Extents(40, 40, 12, 0));
hero.SetPadding(Extents(24, 24, 0, 16));
hero.SetBackgroundColor(UiColor(0x1a27EE));
Label heroTitle = Label::New("Nature");
heroTitle.SetFontSize(24);
heroTitle.SetTextColor(UiColor(0xFFFFFF));
Label heroDesc = Label::New("Explore the wonders of the natural world");
heroDesc.SetFontSize(12);
heroDesc.SetTextColor(UiColor(0x8888AA));
hero.AddChildren({
    heroTitle,
    heroDesc,
});

// Progress bar
FlexLayout progress = FlexLayout::New();
progress.SetDirection(FlexDirection::ROW);
progress.SetAlignItems(FlexAlign::CENTER);
progress.SetRequestedWidth(MATCH_PARENT);
progress.SetRequestedHeight(24.0f);
progress.SetMargin(Extents(40, 40, 0, 0));
progress.SetBackgroundColor(UiColor(0x141428));
progress.SetPadding(Extents(24, 24, 0, 0));
View progressFill = View::New();
progressFill.SetBackgroundColor(UiColor(0x4a90d9));
progressFill.SetRequestedWidth(80.0f);
progressFill.SetRequestedHeight(3.0f);
View progressTrack = View::New();
progressTrack.SetBackgroundColor(UiColor(0x333344));
progressTrack.SetRequestedWidth(MATCH_PARENT);
progressTrack.SetRequestedHeight(3.0f);
progress.AddChildren({
    progressFill,
    progressTrack,
});

// ===== CONTINUE WATCHING =====
Label continueLabel = Label::New("Continue Watching");
continueLabel.SetFontSize(16);
continueLabel.SetTextColor(UiColor(0xDDDDEE));
continueLabel.SetRequestedHeight(28.0f);
continueLabel.SetMargin(Extents(40, 0, 12, 0));

FlexLayout continueRow = FlexLayout::New();
continueRow.SetDirection(FlexDirection::ROW);
continueRow.SetJustifyContent(FlexJustify::FLEX_START);
continueRow.SetRequestedWidth(MATCH_PARENT);
continueRow.SetRequestedHeight(110.0f);
continueRow.SetPadding(Extents(40, 40, 0, 0));
FlexLayout cw1 = FlexLayout::New();
cw1.SetDirection(FlexDirection::COLUMN);
cw1.SetMargin(Extents(0, 10, 0, 0));
View cw1Thumb = View::New();
cw1Thumb.SetBackgroundColor(UiColor(0x2a3f5f));
cw1Thumb.SetRequestedWidth(160.0f);
cw1Thumb.SetRequestedHeight(86.0f);
Label cw1Label = Label::New("Ocean Blue");
cw1Label.SetFontSize(11);
cw1Label.SetTextColor(UiColor(0xAABBCC));
cw1.AddChildren({
    cw1Thumb,
    cw1Label,
});
FlexLayout cw2 = FlexLayout::New();
cw2.SetDirection(FlexDirection::COLUMN);
cw2.SetMargin(Extents(0, 10, 0, 0));
View cw2Thumb = View::New();
cw2Thumb.SetBackgroundColor(UiColor(0x3f5f2a));
cw2Thumb.SetRequestedWidth(160.0f);
cw2Thumb.SetRequestedHeight(86.0f);
Label cw2Label = Label::New("Mountain Trek");
cw2Label.SetFontSize(11);
cw2Label.SetTextColor(UiColor(0xAABBCC));
cw2.AddChildren({
    cw2Thumb,
    cw2Label,
});
FlexLayout cw3 = FlexLayout::New();
cw3.SetDirection(FlexDirection::COLUMN);
cw3.SetMargin(Extents(0, 10, 0, 0));
View cw3Thumb = View::New();
cw3Thumb.SetBackgroundColor(UiColor(0x5f2a3f));
cw3Thumb.SetRequestedWidth(160.0f);
cw3Thumb.SetRequestedHeight(86.0f);
Label cw3Label = Label::New("City Lights");
cw3Label.SetFontSize(11);
cw3Label.SetTextColor(UiColor(0xAABBCC));
cw3.AddChildren({
    cw3Thumb,
    cw3Label,
});
FlexLayout cw4 = FlexLayout::New();
cw4.SetDirection(FlexDirection::COLUMN);
View cw4Thumb = View::New();
cw4Thumb.SetBackgroundColor(UiColor(0x4f3f1a));
cw4Thumb.SetRequestedWidth(160.0f);
cw4Thumb.SetRequestedHeight(86.0f);
Label cw4Label = Label::New("Sunset Valley");
cw4Label.SetFontSize(11);
cw4Label.SetTextColor(UiColor(0xAABBCC));
cw4.AddChildren({
    cw4Thumb,
    cw4Label,
});
continueRow.AddChildren({
    cw1,
    cw2,
    cw3,
    cw4,
});

// ===== RECOMMENDED =====
Label recommendedLabel = Label::New("Recommended");
recommendedLabel.SetFontSize(16);
recommendedLabel.SetTextColor(UiColor(0xDDDDEE));
recommendedLabel.SetRequestedHeight(28.0f);
recommendedLabel.SetMargin(Extents(40, 0, 8, 0));

FlexLayout recommendedRow = FlexLayout::New();
recommendedRow.SetDirection(FlexDirection::ROW);
recommendedRow.SetJustifyContent(FlexJustify::FLEX_START);
recommendedRow.SetRequestedWidth(MATCH_PARENT);
recommendedRow.SetRequestedHeight(80.0f);
recommendedRow.SetPadding(Extents(40, 40, 0, 0));
FlexLayout rec1 = FlexLayout::New();
rec1.SetDirection(FlexDirection::COLUMN);
rec1.SetAlignItems(FlexAlign::CENTER);
rec1.SetMargin(Extents(0, 16, 0, 0));
View rec1Icon = View::New();
rec1Icon.SetBackgroundColor(UiColor(0xE50914));
rec1Icon.SetRequestedWidth(52.0f);
rec1Icon.SetRequestedHeight(52.0f);
Label rec1Label = Label::New("Netflix");
rec1Label.SetFontSize(10);
rec1Label.SetTextColor(UiColor(0x9999AA));
rec1.AddChildren({
    rec1Icon,
    rec1Label,
});
FlexLayout rec2 = FlexLayout::New();
rec2.SetDirection(FlexDirection::COLUMN);
rec2.SetAlignItems(FlexAlign::CENTER);
rec2.SetMargin(Extents(0, 16, 0, 0));
View rec2Icon = View::New();
rec2Icon.SetBackgroundColor(UiColor(0xFF0000));
rec2Icon.SetRequestedWidth(52.0f);
rec2Icon.SetRequestedHeight(52.0f);
Label rec2Label = Label::New("YouTube");
rec2Label.SetFontSize(10);
rec2Label.SetTextColor(UiColor(0x9999AA));
rec2.AddChildren({
    rec2Icon,
    rec2Label,
});
FlexLayout rec3 = FlexLayout::New();
rec3.SetDirection(FlexDirection::COLUMN);
rec3.SetAlignItems(FlexAlign::CENTER);
rec3.SetMargin(Extents(0, 16, 0, 0));
View rec3Icon = View::New();
rec3Icon.SetBackgroundColor(UiColor(0x00A8E1));
rec3Icon.SetRequestedWidth(52.0f);
rec3Icon.SetRequestedHeight(52.0f);
Label rec3Label = Label::New("Prime");
rec3Label.SetFontSize(10);
rec3Label.SetTextColor(UiColor(0x9999AA));
rec3.AddChildren({
    rec3Icon,
    rec3Label,
});
FlexLayout rec4 = FlexLayout::New();
rec4.SetDirection(FlexDirection::COLUMN);
rec4.SetAlignItems(FlexAlign::CENTER);
View rec4Icon = View::New();
rec4Icon.SetBackgroundColor(UiColor(0x113CCF));
rec4Icon.SetRequestedWidth(52.0f);
rec4Icon.SetRequestedHeight(52.0f);
Label rec4Label = Label::New("Disney+");
rec4Label.SetFontSize(10);
rec4Label.SetTextColor(UiColor(0x9999AA));
rec4.AddChildren({
    rec4Icon,
    rec4Label,
});
recommendedRow.AddChildren({
    rec1,
    rec2,
    rec3,
    rec4,
});

root.AddChildren({
    topBar,
    hero,
    progress,
    continueLabel,
    continueRow,
    recommendedLabel,
    recommendedRow,
});
return root;
