// @preview-config: name="Boarding Pass", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0xeef0f5));

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
statusTime.SetTextColor(UiColor(0x1a1a2e));

Label statusInfo = Label::New("●●●  5G  ▮ 81%");
statusInfo.SetFontSize(39);
statusInfo.SetTextColor(UiColor(0x1a1a2e));
statusBar.AddChildren({
    statusTime,
    statusInfo,
});

// ========== HEADER ==========
FlexLayout header = FlexLayout::New();
header.SetDirection(FlexDirection::ROW);
header.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
header.SetAlignItems(FlexAlign::CENTER);
header.SetRequestedWidth(MATCH_PARENT);
header.SetRequestedHeight(224.0f);
header.SetPadding(Extents(98, 98, 28, 0));

Label headerBack = Label::New("←");
headerBack.SetFontSize(91);
headerBack.SetTextColor(UiColor(0x1a1a2e));

Label headerTitle = Label::New("Boarding Pass");
headerTitle.SetFontSize(63);
headerTitle.SetTextColor(UiColor(0x1a1a2e));

Label headerMore = Label::New("⋯");
headerMore.SetFontSize(91);
headerMore.SetTextColor(UiColor(0x1a1a2e));
header.AddChildren({
    headerBack,
    headerTitle,
    headerMore,
});

// ========== AIRLINE BADGE ==========
FlexLayout badge = FlexLayout::New();
badge.SetDirection(FlexDirection::ROW);
badge.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
badge.SetAlignItems(FlexAlign::CENTER);
badge.SetRequestedWidth(MATCH_PARENT);
badge.SetPadding(Extents(119, 119, 14, 49));

FlexLayout badgeLeft = FlexLayout::New();
badgeLeft.SetDirection(FlexDirection::ROW);
badgeLeft.SetAlignItems(FlexAlign::CENTER);

FlexLayout badgeLogo = FlexLayout::New();
badgeLogo.SetDirection(FlexDirection::COLUMN);
badgeLogo.SetJustifyContent(FlexJustify::CENTER);
badgeLogo.SetAlignItems(FlexAlign::CENTER);
badgeLogo.SetRequestedWidth(140.0f);
badgeLogo.SetRequestedHeight(140.0f);
badgeLogo.SetBackgroundColor(UiColor(0x0b2545));
badgeLogo.SetCornerRadius(70.0f);

Label badgeLogoText = Label::New("LH");
badgeLogoText.SetFontSize(46);
badgeLogoText.SetTextColor(UiColor(0xffc72c));
badgeLogo.AddChildren({ badgeLogoText });

Label badgeName = Label::New("Lufthansa");
badgeName.SetFontSize(49);
badgeName.SetTextColor(UiColor(0x1a1a2e));
badgeName.SetMargin(Extents(42, 0, 0, 0));
badgeLeft.AddChildren({
    badgeLogo,
    badgeName,
});

FlexLayout badgeRight = FlexLayout::New();
badgeRight.SetDirection(FlexDirection::ROW);
badgeRight.SetAlignItems(FlexAlign::CENTER);

View badgeDot = View::New();
badgeDot.SetBackgroundColor(UiColor(0x1f8a4c));
badgeDot.SetRequestedWidth(28.0f);
badgeDot.SetRequestedHeight(28.0f);
badgeDot.SetCornerRadius(14.0f);

Label badgeStatus = Label::New("BOARDING");
badgeStatus.SetFontSize(39);
badgeStatus.SetTextColor(UiColor(0x1f8a4c));
badgeStatus.SetMargin(Extents(28, 0, 0, 0));
badgeRight.AddChildren({
    badgeDot,
    badgeStatus,
});
badge.AddChildren({
    badgeLeft,
    badgeRight,
});

// ========== BOARDING PASS CARD ==========
FlexLayout card = FlexLayout::New();
card.SetDirection(FlexDirection::COLUMN);
card.SetRequestedWidth(MATCH_PARENT);
card.SetBackgroundColor(UiColor(0x0b2545));
card.SetCornerRadius(98.0f);
card.SetMargin(Extents(84, 84, 0, 0));
card.SetPadding(Extents(112, 112, 105, 98));

// --- Top info row: FLIGHT + DATE ---
FlexLayout infoRow = FlexLayout::New();
infoRow.SetDirection(FlexDirection::ROW);
infoRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
infoRow.SetAlignItems(FlexAlign::CENTER);
infoRow.SetRequestedWidth(MATCH_PARENT);

FlexLayout flightCol = FlexLayout::New();
flightCol.SetDirection(FlexDirection::COLUMN);
flightCol.SetAlignItems(FlexAlign::FLEX_START);

Label flightLabel = Label::New("FLIGHT");
flightLabel.SetFontSize(35);
flightLabel.SetTextColor(UiColor(0x7b90b5));

Label flightValue = Label::New("LH 440");
flightValue.SetFontSize(77);
flightValue.SetTextColor(UiColor(0xffffff));
flightValue.SetMargin(Extents(0, 0, 21, 0));
flightCol.AddChildren({
    flightLabel,
    flightValue,
});

FlexLayout dateCol = FlexLayout::New();
dateCol.SetDirection(FlexDirection::COLUMN);
dateCol.SetAlignItems(FlexAlign::FLEX_END);

Label dateLabel = Label::New("DATE");
dateLabel.SetFontSize(35);
dateLabel.SetTextColor(UiColor(0x7b90b5));

Label dateValue = Label::New("Apr 15, 2026");
dateValue.SetFontSize(77);
dateValue.SetTextColor(UiColor(0xffffff));
dateValue.SetMargin(Extents(0, 0, 21, 0));
dateCol.AddChildren({
    dateLabel,
    dateValue,
});
infoRow.AddChildren({
    flightCol,
    dateCol,
});

View spacer1 = View::New();
spacer1.SetRequestedHeight(154.7f);

// --- Route: FRA → SFO ---
FlexLayout routeRow = FlexLayout::New();
routeRow.SetDirection(FlexDirection::ROW);
routeRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
routeRow.SetAlignItems(FlexAlign::CENTER);
routeRow.SetRequestedWidth(MATCH_PARENT);

FlexLayout fraCol = FlexLayout::New();
fraCol.SetDirection(FlexDirection::COLUMN);
fraCol.SetAlignItems(FlexAlign::FLEX_START);

Label fraCity = Label::New("FRANKFURT");
fraCity.SetFontSize(39);
fraCity.SetTextColor(UiColor(0x7b90b5));

Label fraCode = Label::New("FRA");
fraCode.SetFontSize(203);
fraCode.SetTextColor(UiColor(0xffffff));
fraCode.SetMargin(Extents(0, 0, 7, 0));

Label fraTime = Label::New("07:45");
fraTime.SetFontSize(49);
fraTime.SetTextColor(UiColor(0xcbd5e1));
fraTime.SetMargin(Extents(0, 0, 14, 0));
fraCol.AddChildren({
    fraCity,
    fraCode,
    fraTime,
});

FlexLayout midCol = FlexLayout::New();
midCol.SetDirection(FlexDirection::COLUMN);
midCol.SetAlignItems(FlexAlign::CENTER);
midCol.SetJustifyContent(FlexJustify::CENTER);

Label midDiamond = Label::New("◆");
midDiamond.SetFontSize(84);
midDiamond.SetTextColor(UiColor(0xffc72c));

View midLine = View::New();
midLine.SetRequestedWidth(420.0f);
midLine.SetRequestedHeight(3.5f);
midLine.SetBackgroundColor(UiColor(0x4a6b9a));
midLine.SetMargin(Extents(0, 0, 28, 28));

Label midDuration = Label::New("11h 35m");
midDuration.SetFontSize(39);
midDuration.SetTextColor(UiColor(0x7b90b5));
midCol.AddChildren({
    midDiamond,
    midLine,
    midDuration,
});

FlexLayout sfoCol = FlexLayout::New();
sfoCol.SetDirection(FlexDirection::COLUMN);
sfoCol.SetAlignItems(FlexAlign::FLEX_END);

Label sfoCity = Label::New("SAN FRANCISCO");
sfoCity.SetFontSize(39);
sfoCity.SetTextColor(UiColor(0x7b90b5));

Label sfoCode = Label::New("SFO");
sfoCode.SetFontSize(203);
sfoCode.SetTextColor(UiColor(0xffffff));
sfoCode.SetMargin(Extents(0, 0, 7, 0));

Label sfoTime = Label::New("10:20");
sfoTime.SetFontSize(49);
sfoTime.SetTextColor(UiColor(0xcbd5e1));
sfoTime.SetMargin(Extents(0, 0, 14, 0));
sfoCol.AddChildren({
    sfoCity,
    sfoCode,
    sfoTime,
});
routeRow.AddChildren({
    fraCol,
    midCol,
    sfoCol,
});

View spacer2 = View::New();
spacer2.SetRequestedHeight(136.5f);

// --- Divider ---
FlexLayout divider = FlexLayout::New();
divider.SetDirection(FlexDirection::ROW);
divider.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
divider.SetRequestedWidth(MATCH_PARENT);
divider.SetRequestedHeight(14.0f);

View dividerDot1 = View::New();
dividerDot1.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot1.SetRequestedWidth(28.0f);
dividerDot1.SetRequestedHeight(7.0f);

View dividerDot2 = View::New();
dividerDot2.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot2.SetRequestedWidth(28.0f);
dividerDot2.SetRequestedHeight(7.0f);

View dividerDot3 = View::New();
dividerDot3.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot3.SetRequestedWidth(28.0f);
dividerDot3.SetRequestedHeight(7.0f);

View dividerDot4 = View::New();
dividerDot4.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot4.SetRequestedWidth(28.0f);
dividerDot4.SetRequestedHeight(7.0f);

View dividerDot5 = View::New();
dividerDot5.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot5.SetRequestedWidth(28.0f);
dividerDot5.SetRequestedHeight(7.0f);

View dividerDot6 = View::New();
dividerDot6.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot6.SetRequestedWidth(28.0f);
dividerDot6.SetRequestedHeight(7.0f);

View dividerDot7 = View::New();
dividerDot7.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot7.SetRequestedWidth(28.0f);
dividerDot7.SetRequestedHeight(7.0f);

View dividerDot8 = View::New();
dividerDot8.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot8.SetRequestedWidth(28.0f);
dividerDot8.SetRequestedHeight(7.0f);

View dividerDot9 = View::New();
dividerDot9.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot9.SetRequestedWidth(28.0f);
dividerDot9.SetRequestedHeight(7.0f);

View dividerDot10 = View::New();
dividerDot10.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot10.SetRequestedWidth(28.0f);
dividerDot10.SetRequestedHeight(7.0f);

View dividerDot11 = View::New();
dividerDot11.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot11.SetRequestedWidth(28.0f);
dividerDot11.SetRequestedHeight(7.0f);

View dividerDot12 = View::New();
dividerDot12.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot12.SetRequestedWidth(28.0f);
dividerDot12.SetRequestedHeight(7.0f);

View dividerDot13 = View::New();
dividerDot13.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot13.SetRequestedWidth(28.0f);
dividerDot13.SetRequestedHeight(7.0f);

View dividerDot14 = View::New();
dividerDot14.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot14.SetRequestedWidth(28.0f);
dividerDot14.SetRequestedHeight(7.0f);

View dividerDot15 = View::New();
dividerDot15.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot15.SetRequestedWidth(28.0f);
dividerDot15.SetRequestedHeight(7.0f);

View dividerDot16 = View::New();
dividerDot16.SetBackgroundColor(UiColor(0x4a6b9a));
dividerDot16.SetRequestedWidth(28.0f);
dividerDot16.SetRequestedHeight(7.0f);
divider.AddChildren({
    dividerDot1,
    dividerDot2,
    dividerDot3,
    dividerDot4,
    dividerDot5,
    dividerDot6,
    dividerDot7,
    dividerDot8,
    dividerDot9,
    dividerDot10,
    dividerDot11,
    dividerDot12,
    dividerDot13,
    dividerDot14,
    dividerDot15,
    dividerDot16,
});

View spacer3 = View::New();
spacer3.SetRequestedHeight(100.1f);

// --- Passenger info grid: 3 cols × 2 rows ---
FlexLayout grid1 = FlexLayout::New();
grid1.SetDirection(FlexDirection::ROW);
grid1.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
grid1.SetRequestedWidth(MATCH_PARENT);

FlexLayout passengerCol = FlexLayout::New();
passengerCol.SetDirection(FlexDirection::COLUMN);
passengerCol.SetAlignItems(FlexAlign::FLEX_START);

Label passengerLabel = Label::New("PASSENGER");
passengerLabel.SetFontSize(35);
passengerLabel.SetTextColor(UiColor(0x7b90b5));

Label passengerValue = Label::New("ALEX MORGAN");
passengerValue.SetFontSize(60);
passengerValue.SetTextColor(UiColor(0xffffff));
passengerValue.SetMargin(Extents(0, 0, 14, 0));
passengerCol.AddChildren({
    passengerLabel,
    passengerValue,
});

FlexLayout classCol = FlexLayout::New();
classCol.SetDirection(FlexDirection::COLUMN);
classCol.SetAlignItems(FlexAlign::FLEX_START);

Label classLabel = Label::New("CLASS");
classLabel.SetFontSize(35);
classLabel.SetTextColor(UiColor(0x7b90b5));

Label classValue = Label::New("BUSINESS");
classValue.SetFontSize(60);
classValue.SetTextColor(UiColor(0xffffff));
classValue.SetMargin(Extents(0, 0, 14, 0));
classCol.AddChildren({
    classLabel,
    classValue,
});

FlexLayout seatCol = FlexLayout::New();
seatCol.SetDirection(FlexDirection::COLUMN);
seatCol.SetAlignItems(FlexAlign::FLEX_START);

Label seatLabel = Label::New("SEAT");
seatLabel.SetFontSize(35);
seatLabel.SetTextColor(UiColor(0x7b90b5));

Label seatValue = Label::New("4A");
seatValue.SetFontSize(60);
seatValue.SetTextColor(UiColor(0xffc72c));
seatValue.SetMargin(Extents(0, 0, 14, 0));
seatCol.AddChildren({
    seatLabel,
    seatValue,
});
grid1.AddChildren({
    passengerCol,
    classCol,
    seatCol,
});

View spacer4 = View::New();
spacer4.SetRequestedHeight(91.0f);

FlexLayout grid2 = FlexLayout::New();
grid2.SetDirection(FlexDirection::ROW);
grid2.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
grid2.SetRequestedWidth(MATCH_PARENT);

FlexLayout gateCol = FlexLayout::New();
gateCol.SetDirection(FlexDirection::COLUMN);
gateCol.SetAlignItems(FlexAlign::FLEX_START);

Label gateLabel = Label::New("GATE");
gateLabel.SetFontSize(35);
gateLabel.SetTextColor(UiColor(0x7b90b5));

Label gateValue = Label::New("Z18");
gateValue.SetFontSize(60);
gateValue.SetTextColor(UiColor(0xffc72c));
gateValue.SetMargin(Extents(0, 0, 14, 0));
gateCol.AddChildren({
    gateLabel,
    gateValue,
});

FlexLayout boardingCol = FlexLayout::New();
boardingCol.SetDirection(FlexDirection::COLUMN);
boardingCol.SetAlignItems(FlexAlign::FLEX_START);

Label boardingLabel = Label::New("BOARDING");
boardingLabel.SetFontSize(35);
boardingLabel.SetTextColor(UiColor(0x7b90b5));

Label boardingValue = Label::New("07:05");
boardingValue.SetFontSize(60);
boardingValue.SetTextColor(UiColor(0xffffff));
boardingValue.SetMargin(Extents(0, 0, 14, 0));
boardingCol.AddChildren({
    boardingLabel,
    boardingValue,
});

FlexLayout groupCol = FlexLayout::New();
groupCol.SetDirection(FlexDirection::COLUMN);
groupCol.SetAlignItems(FlexAlign::FLEX_START);

Label groupLabel = Label::New("GROUP");
groupLabel.SetFontSize(35);
groupLabel.SetTextColor(UiColor(0x7b90b5));

Label groupValue = Label::New("2");
groupValue.SetFontSize(60);
groupValue.SetTextColor(UiColor(0xffffff));
groupValue.SetMargin(Extents(0, 0, 14, 0));
groupCol.AddChildren({
    groupLabel,
    groupValue,
});
grid2.AddChildren({
    gateCol,
    boardingCol,
    groupCol,
});

View spacer5 = View::New();
spacer5.SetRequestedHeight(118.3f);

View hairline = View::New();
hairline.SetBackgroundColor(UiColor(0x1b3763));
hairline.SetRequestedWidth(MATCH_PARENT);
hairline.SetRequestedHeight(3.5f);

View spacer6 = View::New();
spacer6.SetRequestedHeight(118.3f);

// --- Barcode (stylized vertical bars) ---
FlexLayout barcode = FlexLayout::New();
barcode.SetDirection(FlexDirection::ROW);
barcode.SetAlignItems(FlexAlign::CENTER);
barcode.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
barcode.SetRequestedWidth(MATCH_PARENT);
barcode.SetRequestedHeight(266.0f);

View bar1 = View::New();
bar1.SetBackgroundColor(UiColor(0xffffff));
bar1.SetRequestedWidth(14.0f);
bar1.SetRequestedHeight(266.0f);

View bar2 = View::New();
bar2.SetBackgroundColor(UiColor(0xffffff));
bar2.SetRequestedWidth(7.0f);
bar2.SetRequestedHeight(266.0f);

View bar3 = View::New();
bar3.SetBackgroundColor(UiColor(0xffffff));
bar3.SetRequestedWidth(21.0f);
bar3.SetRequestedHeight(266.0f);

View bar4 = View::New();
bar4.SetBackgroundColor(UiColor(0xffffff));
bar4.SetRequestedWidth(7.0f);
bar4.SetRequestedHeight(266.0f);

View bar5 = View::New();
bar5.SetBackgroundColor(UiColor(0xffffff));
bar5.SetRequestedWidth(14.0f);
bar5.SetRequestedHeight(266.0f);

View bar6 = View::New();
bar6.SetBackgroundColor(UiColor(0xffffff));
bar6.SetRequestedWidth(10.5f);
bar6.SetRequestedHeight(266.0f);

View bar7 = View::New();
bar7.SetBackgroundColor(UiColor(0xffffff));
bar7.SetRequestedWidth(7.0f);
bar7.SetRequestedHeight(266.0f);

View bar8 = View::New();
bar8.SetBackgroundColor(UiColor(0xffffff));
bar8.SetRequestedWidth(21.0f);
bar8.SetRequestedHeight(266.0f);

View bar9 = View::New();
bar9.SetBackgroundColor(UiColor(0xffffff));
bar9.SetRequestedWidth(14.0f);
bar9.SetRequestedHeight(266.0f);

View bar10 = View::New();
bar10.SetBackgroundColor(UiColor(0xffffff));
bar10.SetRequestedWidth(7.0f);
bar10.SetRequestedHeight(266.0f);

View bar11 = View::New();
bar11.SetBackgroundColor(UiColor(0xffffff));
bar11.SetRequestedWidth(10.5f);
bar11.SetRequestedHeight(266.0f);

View bar12 = View::New();
bar12.SetBackgroundColor(UiColor(0xffffff));
bar12.SetRequestedWidth(17.5f);
bar12.SetRequestedHeight(266.0f);

View bar13 = View::New();
bar13.SetBackgroundColor(UiColor(0xffffff));
bar13.SetRequestedWidth(7.0f);
bar13.SetRequestedHeight(266.0f);

View bar14 = View::New();
bar14.SetBackgroundColor(UiColor(0xffffff));
bar14.SetRequestedWidth(21.0f);
bar14.SetRequestedHeight(266.0f);

View bar15 = View::New();
bar15.SetBackgroundColor(UiColor(0xffffff));
bar15.SetRequestedWidth(7.0f);
bar15.SetRequestedHeight(266.0f);

View bar16 = View::New();
bar16.SetBackgroundColor(UiColor(0xffffff));
bar16.SetRequestedWidth(14.0f);
bar16.SetRequestedHeight(266.0f);

View bar17 = View::New();
bar17.SetBackgroundColor(UiColor(0xffffff));
bar17.SetRequestedWidth(10.5f);
bar17.SetRequestedHeight(266.0f);

View bar18 = View::New();
bar18.SetBackgroundColor(UiColor(0xffffff));
bar18.SetRequestedWidth(7.0f);
bar18.SetRequestedHeight(266.0f);

View bar19 = View::New();
bar19.SetBackgroundColor(UiColor(0xffffff));
bar19.SetRequestedWidth(21.0f);
bar19.SetRequestedHeight(266.0f);

View bar20 = View::New();
bar20.SetBackgroundColor(UiColor(0xffffff));
bar20.SetRequestedWidth(7.0f);
bar20.SetRequestedHeight(266.0f);

View bar21 = View::New();
bar21.SetBackgroundColor(UiColor(0xffffff));
bar21.SetRequestedWidth(14.0f);
bar21.SetRequestedHeight(266.0f);

View bar22 = View::New();
bar22.SetBackgroundColor(UiColor(0xffffff));
bar22.SetRequestedWidth(17.5f);
bar22.SetRequestedHeight(266.0f);

View bar23 = View::New();
bar23.SetBackgroundColor(UiColor(0xffffff));
bar23.SetRequestedWidth(7.0f);
bar23.SetRequestedHeight(266.0f);

View bar24 = View::New();
bar24.SetBackgroundColor(UiColor(0xffffff));
bar24.SetRequestedWidth(10.5f);
bar24.SetRequestedHeight(266.0f);

View bar25 = View::New();
bar25.SetBackgroundColor(UiColor(0xffffff));
bar25.SetRequestedWidth(21.0f);
bar25.SetRequestedHeight(266.0f);

View bar26 = View::New();
bar26.SetBackgroundColor(UiColor(0xffffff));
bar26.SetRequestedWidth(7.0f);
bar26.SetRequestedHeight(266.0f);

View bar27 = View::New();
bar27.SetBackgroundColor(UiColor(0xffffff));
bar27.SetRequestedWidth(14.0f);
bar27.SetRequestedHeight(266.0f);

View bar28 = View::New();
bar28.SetBackgroundColor(UiColor(0xffffff));
bar28.SetRequestedWidth(7.0f);
bar28.SetRequestedHeight(266.0f);

View bar29 = View::New();
bar29.SetBackgroundColor(UiColor(0xffffff));
bar29.SetRequestedWidth(21.0f);
bar29.SetRequestedHeight(266.0f);

View bar30 = View::New();
bar30.SetBackgroundColor(UiColor(0xffffff));
bar30.SetRequestedWidth(10.5f);
bar30.SetRequestedHeight(266.0f);

View bar31 = View::New();
bar31.SetBackgroundColor(UiColor(0xffffff));
bar31.SetRequestedWidth(7.0f);
bar31.SetRequestedHeight(266.0f);

View bar32 = View::New();
bar32.SetBackgroundColor(UiColor(0xffffff));
bar32.SetRequestedWidth(14.0f);
bar32.SetRequestedHeight(266.0f);

View bar33 = View::New();
bar33.SetBackgroundColor(UiColor(0xffffff));
bar33.SetRequestedWidth(17.5f);
bar33.SetRequestedHeight(266.0f);

View bar34 = View::New();
bar34.SetBackgroundColor(UiColor(0xffffff));
bar34.SetRequestedWidth(7.0f);
bar34.SetRequestedHeight(266.0f);

View bar35 = View::New();
bar35.SetBackgroundColor(UiColor(0xffffff));
bar35.SetRequestedWidth(10.5f);
bar35.SetRequestedHeight(266.0f);
barcode.AddChildren({
    bar1,
    bar2,
    bar3,
    bar4,
    bar5,
    bar6,
    bar7,
    bar8,
    bar9,
    bar10,
    bar11,
    bar12,
    bar13,
    bar14,
    bar15,
    bar16,
    bar17,
    bar18,
    bar19,
    bar20,
    bar21,
    bar22,
    bar23,
    bar24,
    bar25,
    bar26,
    bar27,
    bar28,
    bar29,
    bar30,
    bar31,
    bar32,
    bar33,
    bar34,
    bar35,
});

View spacer7 = View::New();
spacer7.SetRequestedHeight(63.7f);

FlexLayout footerRow = FlexLayout::New();
footerRow.SetDirection(FlexDirection::ROW);
footerRow.SetJustifyContent(FlexJustify::CENTER);
footerRow.SetRequestedWidth(MATCH_PARENT);

Label footerText = Label::New("LH0440  ·  FRA-SFO  ·  15APR  ·  BUSINESS");
footerText.SetFontSize(39);
footerText.SetTextColor(UiColor(0x7b90b5));
footerRow.AddChildren({ footerText });

card.AddChildren({
    infoRow,
    spacer1,
    routeRow,
    spacer2,
    divider,
    spacer3,
    grid1,
    spacer4,
    grid2,
    spacer5,
    hairline,
    spacer6,
    barcode,
    spacer7,
    footerRow,
});

View cardSpacer = View::New();
cardSpacer.SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f));

// ========== CTA: ADD TO WALLET ==========
FlexLayout cta = FlexLayout::New();
cta.SetDirection(FlexDirection::ROW);
cta.SetJustifyContent(FlexJustify::CENTER);
cta.SetAlignItems(FlexAlign::CENTER);
cta.SetRequestedWidth(MATCH_PARENT);
cta.SetRequestedHeight(196.0f);
cta.SetBackgroundColor(UiColor(0x1a1a2e));
cta.SetCornerRadius(98.0f);
cta.SetMargin(Extents(280, 280, 0, 0));

Label ctaLabel = Label::New("Add to Wallet  →");
ctaLabel.SetFontSize(53);
ctaLabel.SetTextColor(UiColor(0xffffff));
cta.AddChildren({ ctaLabel });

root.AddChildren({

    // ========== STATUS BAR ==========
    statusBar,

    // ========== HEADER ==========
    header,

    // ========== AIRLINE BADGE ==========
    badge,

    // ========== BOARDING PASS CARD ==========
    card,

    cardSpacer,

    // ========== CTA: ADD TO WALLET ==========
    cta,
});
return root;
