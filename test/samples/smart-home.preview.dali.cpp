// @render-only — async ImageView loads (form L): pixel non-deterministic across env/timing (broke broken-image→real-photo in M5); verified by compile+render, not a flaky pixel golden.
// @preview-config: name="Smart Home", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0xf4f5f7));

// ========== STATUS BAR ==========
FlexLayout statusBar = FlexLayout::New();
statusBar.SetDirection(FlexDirection::ROW);
statusBar.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
statusBar.SetAlignItems(FlexAlign::CENTER);
statusBar.SetRequestedWidth(MATCH_PARENT);
statusBar.SetRequestedHeight(154.0f);
statusBar.SetPadding(Extents(98, 98, 49, 0));

Label statusTime = Label::New("9:41");
statusTime.SetFontSize(49);
statusTime.SetTextColor(UiColor(0x1a1a2b));

Label statusInfo = Label::New("●●●  5G  ▮ 92%");
statusInfo.SetFontSize(39);
statusInfo.SetTextColor(UiColor(0x1a1a2b));
statusBar.AddChildren({ statusTime, statusInfo });

// ========== HEADER ==========
FlexLayout header = FlexLayout::New();
header.SetDirection(FlexDirection::ROW);
header.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
header.SetAlignItems(FlexAlign::CENTER);
header.SetRequestedWidth(MATCH_PARENT);
header.SetRequestedHeight(280.0f);
header.SetPadding(Extents(98, 98, 28, 14));

FlexLayout headerGreeting = FlexLayout::New();
headerGreeting.SetDirection(FlexDirection::COLUMN);
headerGreeting.SetAlignItems(FlexAlign::FLEX_START);

Label greetingLine = Label::New("Good evening,");
greetingLine.SetFontSize(53);
greetingLine.SetTextColor(UiColor(0x6b7280));

Label greetingName = Label::New("Alex");
greetingName.SetFontSize(112);
greetingName.SetTextColor(UiColor(0x1a1a2b));
greetingName.SetMargin(Extents(0, 0, 21, 0));
headerGreeting.AddChildren({ greetingLine, greetingName });

FlexLayout headerActions = FlexLayout::New();
headerActions.SetDirection(FlexDirection::ROW);
headerActions.SetAlignItems(FlexAlign::CENTER);

FlexLayout bellButton = FlexLayout::New();
bellButton.SetDirection(FlexDirection::COLUMN);
bellButton.SetJustifyContent(FlexJustify::CENTER);
bellButton.SetAlignItems(FlexAlign::CENTER);
bellButton.SetRequestedWidth(154.0f);
bellButton.SetRequestedHeight(154.0f);
bellButton.SetBackgroundColor(UiColor(0xffffff));
bellButton.SetCornerRadius(77.0f);
bellButton.SetMargin(Extents(0, 35, 0, 0));

Label bellIcon = Label::New("◉");
bellIcon.SetFontSize(60);
bellIcon.SetTextColor(UiColor(0x1a1a2b));
bellButton.AddChildren({ bellIcon });

ImageView avatar = ImageView::New("assets/portrait4.jpg");
avatar.SetRequestedWidth(154.0f);
avatar.SetRequestedHeight(154.0f);
avatar.SetCornerRadius(77.0f);
headerActions.AddChildren({ bellButton, avatar });
header.AddChildren({ headerGreeting, headerActions });

// ========== STATUS LINE ==========
FlexLayout statusLine = FlexLayout::New();
statusLine.SetDirection(FlexDirection::ROW);
statusLine.SetAlignItems(FlexAlign::CENTER);
statusLine.SetRequestedWidth(MATCH_PARENT);
statusLine.SetPadding(Extents(98, 98, 0, 0));

Label weather = Label::New("☀ 72°F");
weather.SetFontSize(42);
weather.SetTextColor(UiColor(0x1a1a2b));

Label devicesOnline = Label::New("  ·  14 devices online  ·  ");
devicesOnline.SetFontSize(42);
devicesOnline.SetTextColor(UiColor(0x6b7280));

Label homeMode = Label::New("Home mode");
homeMode.SetFontSize(42);
homeMode.SetTextColor(UiColor(0x2563eb));
statusLine.AddChildren({ weather, devicesOnline, homeMode });

View spacer1 = View::New();
spacer1.SetRequestedHeight(81.9f);

// ========== SEGMENTED CONTROL ==========
FlexLayout segmented = FlexLayout::New();
segmented.SetDirection(FlexDirection::ROW);
segmented.SetRequestedWidth(MATCH_PARENT);
segmented.SetPadding(Extents(84, 84, 0, 0));

FlexLayout segAll = FlexLayout::New();
segAll.SetDirection(FlexDirection::ROW);
segAll.SetJustifyContent(FlexJustify::CENTER);
segAll.SetAlignItems(FlexAlign::CENTER);
segAll.SetBackgroundColor(UiColor(0x1a1a2b));
segAll.SetCornerRadius(70.0f);
segAll.SetPadding(Extents(70, 70, 35, 35));
segAll.SetMargin(Extents(0, 42, 0, 0));

Label segAllLabel = Label::New("All");
segAllLabel.SetFontSize(49);
segAllLabel.SetTextColor(UiColor(0xffffff));
segAll.AddChildren({ segAllLabel });

FlexLayout segLiving = FlexLayout::New();
segLiving.SetDirection(FlexDirection::ROW);
segLiving.SetJustifyContent(FlexJustify::CENTER);
segLiving.SetAlignItems(FlexAlign::CENTER);
segLiving.SetBackgroundColor(UiColor(0xffffff));
segLiving.SetCornerRadius(70.0f);
segLiving.SetPadding(Extents(70, 70, 35, 35));
segLiving.SetMargin(Extents(0, 42, 0, 0));

Label segLivingLabel = Label::New("Living");
segLivingLabel.SetFontSize(49);
segLivingLabel.SetTextColor(UiColor(0x6b7280));
segLiving.AddChildren({ segLivingLabel });

FlexLayout segBedroom = FlexLayout::New();
segBedroom.SetDirection(FlexDirection::ROW);
segBedroom.SetJustifyContent(FlexJustify::CENTER);
segBedroom.SetAlignItems(FlexAlign::CENTER);
segBedroom.SetBackgroundColor(UiColor(0xffffff));
segBedroom.SetCornerRadius(70.0f);
segBedroom.SetPadding(Extents(70, 70, 35, 35));
segBedroom.SetMargin(Extents(0, 42, 0, 0));

Label segBedroomLabel = Label::New("Bedroom");
segBedroomLabel.SetFontSize(49);
segBedroomLabel.SetTextColor(UiColor(0x6b7280));
segBedroom.AddChildren({ segBedroomLabel });

FlexLayout segKitchen = FlexLayout::New();
segKitchen.SetDirection(FlexDirection::ROW);
segKitchen.SetJustifyContent(FlexJustify::CENTER);
segKitchen.SetAlignItems(FlexAlign::CENTER);
segKitchen.SetBackgroundColor(UiColor(0xffffff));
segKitchen.SetCornerRadius(70.0f);
segKitchen.SetPadding(Extents(70, 70, 35, 35));

Label segKitchenLabel = Label::New("Kitchen");
segKitchenLabel.SetFontSize(49);
segKitchenLabel.SetTextColor(UiColor(0x6b7280));
segKitchen.AddChildren({ segKitchenLabel });
segmented.AddChildren({ segAll, segLiving, segBedroom, segKitchen });

View spacer2 = View::New();
spacer2.SetRequestedHeight(81.9f);

// ========== SCENE ROW ==========
FlexLayout sceneRow = FlexLayout::New();
sceneRow.SetDirection(FlexDirection::ROW);
sceneRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
sceneRow.SetRequestedWidth(MATCH_PARENT);
sceneRow.SetPadding(Extents(84, 84, 0, 0));

FlexLayout sceneMorning = FlexLayout::New();
sceneMorning.SetDirection(FlexDirection::COLUMN);
sceneMorning.SetAlignItems(FlexAlign::FLEX_START);
sceneMorning.SetRequestedWidth(742.0f);
sceneMorning.SetRequestedHeight(385.0f);
sceneMorning.SetBackgroundColor(UiColor(0xffffff));
sceneMorning.SetCornerRadius(70.0f);
sceneMorning.SetPadding(Extents(63, 63, 56, 0));

FlexLayout sceneMorningIcon = FlexLayout::New();
sceneMorningIcon.SetDirection(FlexDirection::COLUMN);
sceneMorningIcon.SetJustifyContent(FlexJustify::CENTER);
sceneMorningIcon.SetAlignItems(FlexAlign::CENTER);
sceneMorningIcon.SetRequestedWidth(140.0f);
sceneMorningIcon.SetRequestedHeight(140.0f);
sceneMorningIcon.SetBackgroundColor(UiColor(0xfff3e0));
sceneMorningIcon.SetCornerRadius(70.0f);

Label sceneMorningGlyph = Label::New("◐");
sceneMorningGlyph.SetFontSize(70);
sceneMorningGlyph.SetTextColor(UiColor(0xf59e0b));
sceneMorningIcon.AddChildren({ sceneMorningGlyph });

Label sceneMorningTitle = Label::New("Morning");
sceneMorningTitle.SetFontSize(49);
sceneMorningTitle.SetTextColor(UiColor(0x1a1a2b));
sceneMorningTitle.SetMargin(Extents(0, 0, 35, 0));

Label sceneMorningCount = Label::New("8 devices");
sceneMorningCount.SetFontSize(39);
sceneMorningCount.SetTextColor(UiColor(0x6b7280));
sceneMorningCount.SetMargin(Extents(0, 0, 14, 0));
sceneMorning.AddChildren({ sceneMorningIcon, sceneMorningTitle, sceneMorningCount });

FlexLayout sceneMovie = FlexLayout::New();
sceneMovie.SetDirection(FlexDirection::COLUMN);
sceneMovie.SetAlignItems(FlexAlign::FLEX_START);
sceneMovie.SetRequestedWidth(742.0f);
sceneMovie.SetRequestedHeight(385.0f);
sceneMovie.SetBackgroundColor(UiColor(0xffffff));
sceneMovie.SetCornerRadius(70.0f);
sceneMovie.SetPadding(Extents(63, 63, 56, 0));

FlexLayout sceneMovieIcon = FlexLayout::New();
sceneMovieIcon.SetDirection(FlexDirection::COLUMN);
sceneMovieIcon.SetJustifyContent(FlexJustify::CENTER);
sceneMovieIcon.SetAlignItems(FlexAlign::CENTER);
sceneMovieIcon.SetRequestedWidth(140.0f);
sceneMovieIcon.SetRequestedHeight(140.0f);
sceneMovieIcon.SetBackgroundColor(UiColor(0xeae1ff));
sceneMovieIcon.SetCornerRadius(70.0f);

Label sceneMovieGlyph = Label::New("▶");
sceneMovieGlyph.SetFontSize(63);
sceneMovieGlyph.SetTextColor(UiColor(0x7c3aed));
sceneMovieIcon.AddChildren({ sceneMovieGlyph });

Label sceneMovieTitle = Label::New("Movie Time");
sceneMovieTitle.SetFontSize(49);
sceneMovieTitle.SetTextColor(UiColor(0x1a1a2b));
sceneMovieTitle.SetMargin(Extents(0, 0, 35, 0));

Label sceneMovieCount = Label::New("5 devices");
sceneMovieCount.SetFontSize(39);
sceneMovieCount.SetTextColor(UiColor(0x6b7280));
sceneMovieCount.SetMargin(Extents(0, 0, 14, 0));
sceneMovie.AddChildren({ sceneMovieIcon, sceneMovieTitle, sceneMovieCount });

FlexLayout sceneNight = FlexLayout::New();
sceneNight.SetDirection(FlexDirection::COLUMN);
sceneNight.SetAlignItems(FlexAlign::FLEX_START);
sceneNight.SetRequestedWidth(742.0f);
sceneNight.SetRequestedHeight(385.0f);
sceneNight.SetBackgroundColor(UiColor(0xffffff));
sceneNight.SetCornerRadius(70.0f);
sceneNight.SetPadding(Extents(63, 63, 56, 0));

FlexLayout sceneNightIcon = FlexLayout::New();
sceneNightIcon.SetDirection(FlexDirection::COLUMN);
sceneNightIcon.SetJustifyContent(FlexJustify::CENTER);
sceneNightIcon.SetAlignItems(FlexAlign::CENTER);
sceneNightIcon.SetRequestedWidth(140.0f);
sceneNightIcon.SetRequestedHeight(140.0f);
sceneNightIcon.SetBackgroundColor(UiColor(0xe0ecff));
sceneNightIcon.SetCornerRadius(70.0f);

Label sceneNightGlyph = Label::New("◑");
sceneNightGlyph.SetFontSize(70);
sceneNightGlyph.SetTextColor(UiColor(0x2563eb));
sceneNightIcon.AddChildren({ sceneNightGlyph });

Label sceneNightTitle = Label::New("Night");
sceneNightTitle.SetFontSize(49);
sceneNightTitle.SetTextColor(UiColor(0x1a1a2b));
sceneNightTitle.SetMargin(Extents(0, 0, 35, 0));

Label sceneNightCount = Label::New("12 devices");
sceneNightCount.SetFontSize(39);
sceneNightCount.SetTextColor(UiColor(0x6b7280));
sceneNightCount.SetMargin(Extents(0, 0, 14, 0));
sceneNight.AddChildren({ sceneNightIcon, sceneNightTitle, sceneNightCount });
sceneRow.AddChildren({ sceneMorning, sceneMovie, sceneNight });

View spacer3 = View::New();
spacer3.SetRequestedHeight(91.0f);

// ========== ROOMS HEADER ==========
FlexLayout roomsHeader = FlexLayout::New();
roomsHeader.SetDirection(FlexDirection::ROW);
roomsHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
roomsHeader.SetAlignItems(FlexAlign::CENTER);
roomsHeader.SetRequestedWidth(MATCH_PARENT);
roomsHeader.SetPadding(Extents(98, 98, 0, 0));

Label roomsTitle = Label::New("Rooms");
roomsTitle.SetFontSize(63);
roomsTitle.SetTextColor(UiColor(0x1a1a2b));

Label roomsAdd = Label::New("+ Add");
roomsAdd.SetFontSize(42);
roomsAdd.SetTextColor(UiColor(0x2563eb));
roomsHeader.AddChildren({ roomsTitle, roomsAdd });

View spacer4 = View::New();
spacer4.SetRequestedHeight(54.6f);

// ========== ROOMS ROW 1 ==========
FlexLayout roomsRow1 = FlexLayout::New();
roomsRow1.SetDirection(FlexDirection::ROW);
roomsRow1.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
roomsRow1.SetRequestedWidth(MATCH_PARENT);
roomsRow1.SetPadding(Extents(84, 84, 0, 0));

FlexLayout livingCard = FlexLayout::New();
livingCard.SetDirection(FlexDirection::COLUMN);
livingCard.SetRequestedWidth(1148.0f);
livingCard.SetBackgroundColor(UiColor(0xffffff));
livingCard.SetCornerRadius(70.0f);

ImageView livingImage = ImageView::New("assets/interior1.jpg");
livingImage.SetRequestedWidth(MATCH_PARENT);
livingImage.SetRequestedHeight(350.0f);
livingImage.SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f);

FlexLayout livingBody = FlexLayout::New();
livingBody.SetDirection(FlexDirection::COLUMN);
livingBody.SetPadding(Extents(49, 49, 42, 42));

FlexLayout livingTitleRow = FlexLayout::New();
livingTitleRow.SetDirection(FlexDirection::ROW);
livingTitleRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
livingTitleRow.SetAlignItems(FlexAlign::CENTER);
livingTitleRow.SetRequestedWidth(MATCH_PARENT);

Label livingName = Label::New("Living Room");
livingName.SetFontSize(60);
livingName.SetTextColor(UiColor(0x1a1a2b));

FlexLayout livingBadge = FlexLayout::New();
livingBadge.SetDirection(FlexDirection::ROW);
livingBadge.SetJustifyContent(FlexJustify::CENTER);
livingBadge.SetAlignItems(FlexAlign::CENTER);
livingBadge.SetBackgroundColor(UiColor(0xeefaf3));
livingBadge.SetCornerRadius(38.5f);
livingBadge.SetPadding(Extents(35, 35, 14, 14));

Label livingBadgeLabel = Label::New("ON");
livingBadgeLabel.SetFontSize(35);
livingBadgeLabel.SetTextColor(UiColor(0x1f8a4c));
livingBadge.AddChildren({ livingBadgeLabel });
livingTitleRow.AddChildren({ livingName, livingBadge });

Label livingMeta = Label::New("6 devices  ·  72°F");
livingMeta.SetFontSize(39);
livingMeta.SetTextColor(UiColor(0x6b7280));
livingMeta.SetMargin(Extents(0, 0, 21, 0));
livingBody.AddChildren({ livingTitleRow, livingMeta });
livingCard.AddChildren({ livingImage, livingBody });

FlexLayout bedroomCard = FlexLayout::New();
bedroomCard.SetDirection(FlexDirection::COLUMN);
bedroomCard.SetRequestedWidth(1148.0f);
bedroomCard.SetBackgroundColor(UiColor(0xffffff));
bedroomCard.SetCornerRadius(70.0f);

ImageView bedroomImage = ImageView::New("assets/interior2.jpg");
bedroomImage.SetRequestedWidth(MATCH_PARENT);
bedroomImage.SetRequestedHeight(350.0f);
bedroomImage.SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f);

FlexLayout bedroomBody = FlexLayout::New();
bedroomBody.SetDirection(FlexDirection::COLUMN);
bedroomBody.SetPadding(Extents(49, 49, 42, 42));

FlexLayout bedroomTitleRow = FlexLayout::New();
bedroomTitleRow.SetDirection(FlexDirection::ROW);
bedroomTitleRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
bedroomTitleRow.SetAlignItems(FlexAlign::CENTER);
bedroomTitleRow.SetRequestedWidth(MATCH_PARENT);

Label bedroomName = Label::New("Bedroom");
bedroomName.SetFontSize(60);
bedroomName.SetTextColor(UiColor(0x1a1a2b));

FlexLayout bedroomBadge = FlexLayout::New();
bedroomBadge.SetDirection(FlexDirection::ROW);
bedroomBadge.SetJustifyContent(FlexJustify::CENTER);
bedroomBadge.SetAlignItems(FlexAlign::CENTER);
bedroomBadge.SetBackgroundColor(UiColor(0xf4f5f7));
bedroomBadge.SetCornerRadius(38.5f);
bedroomBadge.SetPadding(Extents(35, 35, 14, 14));

Label bedroomBadgeLabel = Label::New("OFF");
bedroomBadgeLabel.SetFontSize(35);
bedroomBadgeLabel.SetTextColor(UiColor(0x6b7280));
bedroomBadge.AddChildren({ bedroomBadgeLabel });
bedroomTitleRow.AddChildren({ bedroomName, bedroomBadge });

Label bedroomMeta = Label::New("4 devices  ·  68°F");
bedroomMeta.SetFontSize(39);
bedroomMeta.SetTextColor(UiColor(0x6b7280));
bedroomMeta.SetMargin(Extents(0, 0, 21, 0));
bedroomBody.AddChildren({ bedroomTitleRow, bedroomMeta });
bedroomCard.AddChildren({ bedroomImage, bedroomBody });
roomsRow1.AddChildren({ livingCard, bedroomCard });

View spacer5 = View::New();
spacer5.SetRequestedHeight(63.7f);

// ========== ROOMS ROW 2 ==========
FlexLayout roomsRow2 = FlexLayout::New();
roomsRow2.SetDirection(FlexDirection::ROW);
roomsRow2.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
roomsRow2.SetRequestedWidth(MATCH_PARENT);
roomsRow2.SetPadding(Extents(84, 84, 0, 0));

FlexLayout kitchenCard = FlexLayout::New();
kitchenCard.SetDirection(FlexDirection::COLUMN);
kitchenCard.SetRequestedWidth(1148.0f);
kitchenCard.SetBackgroundColor(UiColor(0xffffff));
kitchenCard.SetCornerRadius(70.0f);

ImageView kitchenImage = ImageView::New("assets/interior3.jpg");
kitchenImage.SetRequestedWidth(MATCH_PARENT);
kitchenImage.SetRequestedHeight(350.0f);
kitchenImage.SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f);

FlexLayout kitchenBody = FlexLayout::New();
kitchenBody.SetDirection(FlexDirection::COLUMN);
kitchenBody.SetPadding(Extents(49, 49, 42, 42));

FlexLayout kitchenTitleRow = FlexLayout::New();
kitchenTitleRow.SetDirection(FlexDirection::ROW);
kitchenTitleRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
kitchenTitleRow.SetAlignItems(FlexAlign::CENTER);
kitchenTitleRow.SetRequestedWidth(MATCH_PARENT);

Label kitchenName = Label::New("Kitchen");
kitchenName.SetFontSize(60);
kitchenName.SetTextColor(UiColor(0x1a1a2b));

FlexLayout kitchenBadge = FlexLayout::New();
kitchenBadge.SetDirection(FlexDirection::ROW);
kitchenBadge.SetJustifyContent(FlexJustify::CENTER);
kitchenBadge.SetAlignItems(FlexAlign::CENTER);
kitchenBadge.SetBackgroundColor(UiColor(0xeefaf3));
kitchenBadge.SetCornerRadius(38.5f);
kitchenBadge.SetPadding(Extents(35, 35, 14, 14));

Label kitchenBadgeLabel = Label::New("ON");
kitchenBadgeLabel.SetFontSize(35);
kitchenBadgeLabel.SetTextColor(UiColor(0x1f8a4c));
kitchenBadge.AddChildren({ kitchenBadgeLabel });
kitchenTitleRow.AddChildren({ kitchenName, kitchenBadge });

Label kitchenMeta = Label::New("5 devices  ·  74°F");
kitchenMeta.SetFontSize(39);
kitchenMeta.SetTextColor(UiColor(0x6b7280));
kitchenMeta.SetMargin(Extents(0, 0, 21, 0));
kitchenBody.AddChildren({ kitchenTitleRow, kitchenMeta });
kitchenCard.AddChildren({ kitchenImage, kitchenBody });

FlexLayout officeCard = FlexLayout::New();
officeCard.SetDirection(FlexDirection::COLUMN);
officeCard.SetRequestedWidth(1148.0f);
officeCard.SetBackgroundColor(UiColor(0xffffff));
officeCard.SetCornerRadius(70.0f);

ImageView officeImage = ImageView::New("assets/interior4.jpg");
officeImage.SetRequestedWidth(MATCH_PARENT);
officeImage.SetRequestedHeight(350.0f);
officeImage.SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f);

FlexLayout officeBody = FlexLayout::New();
officeBody.SetDirection(FlexDirection::COLUMN);
officeBody.SetPadding(Extents(49, 49, 42, 42));

FlexLayout officeTitleRow = FlexLayout::New();
officeTitleRow.SetDirection(FlexDirection::ROW);
officeTitleRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
officeTitleRow.SetAlignItems(FlexAlign::CENTER);
officeTitleRow.SetRequestedWidth(MATCH_PARENT);

Label officeName = Label::New("Office");
officeName.SetFontSize(60);
officeName.SetTextColor(UiColor(0x1a1a2b));

FlexLayout officeBadge = FlexLayout::New();
officeBadge.SetDirection(FlexDirection::ROW);
officeBadge.SetJustifyContent(FlexJustify::CENTER);
officeBadge.SetAlignItems(FlexAlign::CENTER);
officeBadge.SetBackgroundColor(UiColor(0xeefaf3));
officeBadge.SetCornerRadius(38.5f);
officeBadge.SetPadding(Extents(35, 35, 14, 14));

Label officeBadgeLabel = Label::New("ON");
officeBadgeLabel.SetFontSize(35);
officeBadgeLabel.SetTextColor(UiColor(0x1f8a4c));
officeBadge.AddChildren({ officeBadgeLabel });
officeTitleRow.AddChildren({ officeName, officeBadge });

Label officeMeta = Label::New("3 devices  ·  71°F");
officeMeta.SetFontSize(39);
officeMeta.SetTextColor(UiColor(0x6b7280));
officeMeta.SetMargin(Extents(0, 0, 21, 0));
officeBody.AddChildren({ officeTitleRow, officeMeta });
officeCard.AddChildren({ officeImage, officeBody });
roomsRow2.AddChildren({ kitchenCard, officeCard });

View spacer6 = View::New();
spacer6.SetRequestedHeight(72.8f);

// ========== ENERGY STRIP ==========
FlexLayout energyStrip = FlexLayout::New();
energyStrip.SetDirection(FlexDirection::ROW);
energyStrip.SetAlignItems(FlexAlign::CENTER);
energyStrip.SetRequestedWidth(MATCH_PARENT);
energyStrip.SetRequestedHeight(287.0f);
energyStrip.SetBackgroundColor(UiColor(0x1a1a2b));
energyStrip.SetCornerRadius(70.0f);
energyStrip.SetMargin(Extents(84, 84, 0, 0));
energyStrip.SetPadding(Extents(70, 70, 0, 0));

FlexLayout energyText = FlexLayout::New();
energyText.SetDirection(FlexDirection::COLUMN);
energyText.SetAlignItems(FlexAlign::FLEX_START);

Label energyLabel = Label::New("TODAY'S ENERGY");
energyLabel.SetFontSize(35);
energyLabel.SetTextColor(UiColor(0x8e94b8));

Label energyValue = Label::New("6.2 kWh");
energyValue.SetFontSize(77);
energyValue.SetTextColor(UiColor(0xffffff));
energyValue.SetMargin(Extents(0, 0, 14, 0));
energyText.AddChildren({ energyLabel, energyValue });

View energySpacer = View::New();
energySpacer.SetRequestedWidth(MATCH_PARENT);
energySpacer.SetRequestedHeight(3.5f);

FlexLayout energyBadge = FlexLayout::New();
energyBadge.SetDirection(FlexDirection::ROW);
energyBadge.SetJustifyContent(FlexJustify::CENTER);
energyBadge.SetAlignItems(FlexAlign::CENTER);
energyBadge.SetBackgroundColor(UiColor(0x0d3a22));
energyBadge.SetCornerRadius(52.5f);
energyBadge.SetPadding(Extents(49, 49, 28, 28));
energyBadge.SetMargin(Extents(0, 49, 0, 0));

Label energyBadgeLabel = Label::New("▼ 12%");
energyBadgeLabel.SetFontSize(42);
energyBadgeLabel.SetTextColor(UiColor(0x22c55e));
energyBadge.AddChildren({ energyBadgeLabel });

Label energyArrow = Label::New("→");
energyArrow.SetFontSize(77);
energyArrow.SetTextColor(UiColor(0xffffff));
energyStrip.AddChildren({ energyText, energySpacer, energyBadge, energyArrow });

root.AddChildren({
    statusBar,
    header,
    statusLine,
    spacer1,
    segmented,
    spacer2,
    sceneRow,
    spacer3,
    roomsHeader,
    spacer4,
    roomsRow1,
    spacer5,
    roomsRow2,
    spacer6,
    energyStrip,
});
return root;
