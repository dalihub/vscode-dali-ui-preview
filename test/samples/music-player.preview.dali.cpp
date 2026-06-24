// @render-only — async ImageView loads (form L): pixel non-deterministic across env/timing (broke broken-image→real-photo in M5); verified by compile+render, not a flaky pixel golden.
// @preview-config: name="Music Player", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0a0a14));
root.SetPadding(Extents(140, 140, 210, 140));

// ========== TOP BAR ==========
FlexLayout topBar = FlexLayout::New();
topBar.SetDirection(FlexDirection::ROW);
topBar.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
topBar.SetAlignItems(FlexAlign::CENTER);
topBar.SetRequestedWidth(MATCH_PARENT);
topBar.SetRequestedHeight(168.0f);

Label topBarChevron = Label::New("⌄");
topBarChevron.SetFontSize(119);
topBarChevron.SetTextColor(UiColor(0xffffff));

FlexLayout topBarCenter = FlexLayout::New();
topBarCenter.SetDirection(FlexDirection::COLUMN);
topBarCenter.SetAlignItems(FlexAlign::CENTER);

Label playingFromLabel = Label::New("PLAYING FROM PLAYLIST");
playingFromLabel.SetFontSize(42);
playingFromLabel.SetTextColor(UiColor(0xd1d5e3));

Label playlistName = Label::New("Late Night Drive");
playlistName.SetFontSize(56);
playlistName.SetTextColor(UiColor(0xffffff));
playlistName.SetMargin(Extents(0, 0, 14, 0));

topBarCenter.AddChildren({
    playingFromLabel,
    playlistName,
});

Label topBarMore = Label::New("⋯");
topBarMore.SetFontSize(119);
topBarMore.SetTextColor(UiColor(0xffffff));

topBar.AddChildren({
    topBarChevron,
    topBarCenter,
    topBarMore,
});

// Spacer
View spacer1 = View::New();
spacer1.SetRequestedHeight(218.4f);

// ========== ALBUM ART ==========
FlexLayout albumArtRow = FlexLayout::New();
albumArtRow.SetDirection(FlexDirection::ROW);
albumArtRow.SetJustifyContent(FlexJustify::CENTER);
albumArtRow.SetRequestedWidth(MATCH_PARENT);

ImageView albumArt = ImageView::New("assets/album_art.jpg");
albumArt.SetRequestedWidth(1820.0f);
albumArt.SetRequestedHeight(1820.0f);
albumArt.SetCornerRadius(84.0f);

albumArtRow.AddChildren({ albumArt });

// Spacer
View spacer2 = View::New();
spacer2.SetRequestedHeight(254.8f);

// ========== SONG TITLE + ARTIST ==========
FlexLayout songRow = FlexLayout::New();
songRow.SetDirection(FlexDirection::ROW);
songRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
songRow.SetAlignItems(FlexAlign::CENTER);
songRow.SetRequestedWidth(MATCH_PARENT);

FlexLayout songInfo = FlexLayout::New();
songInfo.SetDirection(FlexDirection::COLUMN);
songInfo.SetAlignItems(FlexAlign::FLEX_START);

Label songTitle = Label::New("Midnight City");
songTitle.SetFontSize(140);
songTitle.SetTextColor(UiColor(0xffffff));

Label songArtist = Label::New("M83");
songArtist.SetFontSize(70);
songArtist.SetTextColor(UiColor(0x9ba1b8));
songArtist.SetMargin(Extents(0, 0, 21, 0));

songInfo.AddChildren({
    songTitle,
    songArtist,
});

Label heart = Label::New("♥");
heart.SetFontSize(112);
heart.SetTextColor(UiColor(0xff4d7a));

songRow.AddChildren({
    songInfo,
    heart,
});

// Spacer
View spacer3 = View::New();
spacer3.SetRequestedHeight(145.6f);

// ========== PROGRESS BAR ==========
FlexLayout progressBar = FlexLayout::New();
progressBar.SetDirection(FlexDirection::ROW);
progressBar.SetAlignItems(FlexAlign::CENTER);
progressBar.SetRequestedWidth(MATCH_PARENT);
progressBar.SetRequestedHeight(21.0f);
progressBar.SetBackgroundColor(UiColor(0x1f2540));

View progressFill = View::New();
progressFill.SetBackgroundColor(UiColor(0xffffff));
progressFill.SetRequestedWidth(910.0f);
progressFill.SetRequestedHeight(21.0f);

progressBar.AddChildren({ progressFill });

// Time row
FlexLayout timeRow = FlexLayout::New();
timeRow.SetDirection(FlexDirection::ROW);
timeRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
timeRow.SetRequestedWidth(MATCH_PARENT);
timeRow.SetMargin(Extents(0, 0, 35, 0));

Label timeElapsed = Label::New("1:32");
timeElapsed.SetFontSize(46);
timeElapsed.SetTextColor(UiColor(0x9ba1b8));

Label timeTotal = Label::New("4:03");
timeTotal.SetFontSize(46);
timeTotal.SetTextColor(UiColor(0x9ba1b8));

timeRow.AddChildren({
    timeElapsed,
    timeTotal,
});

// Spacer
View spacer4 = View::New();
spacer4.SetRequestedHeight(163.8f);

// ========== PLAYBACK CONTROLS ==========
FlexLayout controls = FlexLayout::New();
controls.SetDirection(FlexDirection::ROW);
controls.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
controls.SetAlignItems(FlexAlign::CENTER);
controls.SetRequestedWidth(MATCH_PARENT);

Label shuffle = Label::New("⇄");
shuffle.SetFontSize(133);
shuffle.SetTextColor(UiColor(0xd1d5e3));

Label prev = Label::New("◀◀");
prev.SetFontSize(133);
prev.SetTextColor(UiColor(0xffffff));

FlexLayout playButton = FlexLayout::New();
playButton.SetDirection(FlexDirection::COLUMN);
playButton.SetJustifyContent(FlexJustify::CENTER);
playButton.SetAlignItems(FlexAlign::CENTER);
playButton.SetRequestedWidth(336.0f);
playButton.SetRequestedHeight(336.0f);
playButton.SetBackgroundColor(UiColor(0xffffff));
playButton.SetCornerRadius(168.0f);

Label playIcon = Label::New("▶");
playIcon.SetFontSize(140);
playIcon.SetTextColor(UiColor(0x0a0a14));

playButton.AddChildren({ playIcon });

Label next = Label::New("▶▶");
next.SetFontSize(133);
next.SetTextColor(UiColor(0xffffff));

Label repeat = Label::New("↻");
repeat.SetFontSize(133);
repeat.SetTextColor(UiColor(0xd1d5e3));

controls.AddChildren({
    shuffle,
    prev,
    playButton,
    next,
    repeat,
});

// Spacer
View spacer5 = View::New();
spacer5.SetRequestedHeight(191.1f);

// ========== BOTTOM ACTION BAR ==========
FlexLayout bottomBar = FlexLayout::New();
bottomBar.SetDirection(FlexDirection::ROW);
bottomBar.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
bottomBar.SetAlignItems(FlexAlign::CENTER);
bottomBar.SetRequestedWidth(MATCH_PARENT);

Label device = Label::New("◉ JBL Flip 5");
device.SetFontSize(49);
device.SetTextColor(UiColor(0x2dd47b));

FlexLayout bottomIcons = FlexLayout::New();
bottomIcons.SetDirection(FlexDirection::ROW);

Label noteIcon = Label::New("♫");
noteIcon.SetFontSize(77);
noteIcon.SetTextColor(UiColor(0x9ba1b8));
noteIcon.SetMargin(Extents(0, 98, 0, 0));

Label listIcon = Label::New("≡");
listIcon.SetFontSize(91);
listIcon.SetTextColor(UiColor(0x9ba1b8));

bottomIcons.AddChildren({
    noteIcon,
    listIcon,
});

bottomBar.AddChildren({
    device,
    bottomIcons,
});

root.AddChildren({
    topBar,
    spacer1,
    albumArtRow,
    spacer2,
    songRow,
    spacer3,
    progressBar,
    timeRow,
    spacer4,
    controls,
    spacer5,
    bottomBar,
});

return root;
