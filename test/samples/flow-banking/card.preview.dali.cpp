// @preview-config: name="Flow Banking — Card", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0d1117));

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
statusTime.SetTextColor(UiColor(0xffffff));

Label statusIcons = Label::New("●●●  5G  ▮ 86%");
statusIcons.SetFontSize(39);
statusIcons.SetTextColor(UiColor(0xffffff));
statusBar.AddChildren({
    statusTime,
    statusIcons,
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
headerBack.SetFontSize(84);
headerBack.SetTextColor(UiColor(0xffffff));

Label headerTitle = Label::New("Card Details");
headerTitle.SetFontSize(56);
headerTitle.SetTextColor(UiColor(0xffffff));

Label headerGear = Label::New("⚙");
headerGear.SetFontSize(77);
headerGear.SetTextColor(UiColor(0xffffff));
header.AddChildren({
    headerBack,
    headerTitle,
    headerGear,
});

View headerSpacer = View::New();
headerSpacer.SetRequestedHeight(54.6f);

// ========== VIRTUAL CARD (HERO) ==========
FlexLayout hero = FlexLayout::New();
hero.SetDirection(FlexDirection::COLUMN);
hero.SetRequestedWidth(MATCH_PARENT);
hero.SetRequestedHeight(980.0f);
hero.SetBackgroundColor(UiColor(0x00d4a8));
hero.SetCornerRadius(98.0f);
hero.SetMargin(Extents(168, 168, 0, 0));
hero.SetPadding(Extents(98, 98, 98, 98));

FlexLayout heroTopRow = FlexLayout::New();
heroTopRow.SetDirection(FlexDirection::ROW);
heroTopRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
heroTopRow.SetAlignItems(FlexAlign::CENTER);
heroTopRow.SetRequestedWidth(MATCH_PARENT);

FlexLayout heroBrand = FlexLayout::New();
heroBrand.SetDirection(FlexDirection::COLUMN);
heroBrand.SetAlignItems(FlexAlign::FLEX_START);

Label heroBrandName = Label::New("flow.");
heroBrandName.SetFontSize(84);
heroBrandName.SetTextColor(UiColor(0x0d1117));

Label heroBrandType = Label::New("DEBIT");
heroBrandType.SetFontSize(35);
heroBrandType.SetTextColor(UiColor(0x0a3a33));
heroBrandType.SetMargin(Extents(0, 0, 7, 0));
heroBrand.AddChildren({
    heroBrandName,
    heroBrandType,
});

Label heroChevrons = Label::New("»»»");
heroChevrons.SetFontSize(77);
heroChevrons.SetTextColor(UiColor(0x0d1117));
heroTopRow.AddChildren({
    heroBrand,
    heroChevrons,
});

View heroSpacer1 = View::New();
heroSpacer1.SetRequestedWidth(MATCH_PARENT);
heroSpacer1.SetRequestedHeight(3.5f);

Label heroCardNumber = Label::New("4821   ••••   ••••   2847");
heroCardNumber.SetFontSize(84);
heroCardNumber.SetTextColor(UiColor(0x0d1117));

View heroSpacer2 = View::New();
heroSpacer2.SetRequestedHeight(72.8f);

FlexLayout heroBottomRow = FlexLayout::New();
heroBottomRow.SetDirection(FlexDirection::ROW);
heroBottomRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
heroBottomRow.SetAlignItems(FlexAlign::FLEX_END);
heroBottomRow.SetRequestedWidth(MATCH_PARENT);

FlexLayout heroCardholder = FlexLayout::New();
heroCardholder.SetDirection(FlexDirection::COLUMN);
heroCardholder.SetAlignItems(FlexAlign::FLEX_START);

Label heroCardholderLabel = Label::New("CARDHOLDER");
heroCardholderLabel.SetFontSize(32);
heroCardholderLabel.SetTextColor(UiColor(0x0a3a33));

Label heroCardholderName = Label::New("ALEX MORGAN");
heroCardholderName.SetFontSize(46);
heroCardholderName.SetTextColor(UiColor(0x0d1117));
heroCardholderName.SetMargin(Extents(0, 0, 11, 0));
heroCardholder.AddChildren({
    heroCardholderLabel,
    heroCardholderName,
});

FlexLayout heroExpires = FlexLayout::New();
heroExpires.SetDirection(FlexDirection::COLUMN);
heroExpires.SetAlignItems(FlexAlign::FLEX_START);

Label heroExpiresLabel = Label::New("EXPIRES");
heroExpiresLabel.SetFontSize(32);
heroExpiresLabel.SetTextColor(UiColor(0x0a3a33));

Label heroExpiresValue = Label::New("08/28");
heroExpiresValue.SetFontSize(46);
heroExpiresValue.SetTextColor(UiColor(0x0d1117));
heroExpiresValue.SetMargin(Extents(0, 0, 11, 0));
heroExpires.AddChildren({
    heroExpiresLabel,
    heroExpiresValue,
});

Label heroVisa = Label::New("VISA");
heroVisa.SetFontSize(70);
heroVisa.SetTextColor(UiColor(0x0d1117));
heroBottomRow.AddChildren({
    heroCardholder,
    heroExpires,
    heroVisa,
});

hero.AddChildren({
    heroTopRow,
    heroSpacer1,
    heroCardNumber,
    heroSpacer2,
    heroBottomRow,
});

View heroAfterSpacer = View::New();
heroAfterSpacer.SetRequestedHeight(63.7f);

// ========== CARD PAGINATION DOTS ==========
FlexLayout dots = FlexLayout::New();
dots.SetDirection(FlexDirection::ROW);
dots.SetJustifyContent(FlexJustify::CENTER);
dots.SetAlignItems(FlexAlign::CENTER);
dots.SetRequestedWidth(MATCH_PARENT);

View dot1 = View::New();
dot1.SetBackgroundColor(UiColor(0x242c36));
dot1.SetRequestedWidth(28.0f);
dot1.SetRequestedHeight(28.0f);
dot1.SetCornerRadius(14.0f);
dot1.SetMargin(Extents(0, 28, 0, 0));

View dot2 = View::New();
dot2.SetBackgroundColor(UiColor(0x00d4a8));
dot2.SetRequestedWidth(70.0f);
dot2.SetRequestedHeight(28.0f);
dot2.SetCornerRadius(14.0f);
dot2.SetMargin(Extents(0, 28, 0, 0));

View dot3 = View::New();
dot3.SetBackgroundColor(UiColor(0x242c36));
dot3.SetRequestedWidth(28.0f);
dot3.SetRequestedHeight(28.0f);
dot3.SetCornerRadius(14.0f);
dots.AddChildren({
    dot1,
    dot2,
    dot3,
});

View dotsAfterSpacer = View::New();
dotsAfterSpacer.SetRequestedHeight(91.0f);

// ========== SPENDING SUMMARY CARD ==========
FlexLayout summary = FlexLayout::New();
summary.SetDirection(FlexDirection::COLUMN);
summary.SetRequestedWidth(MATCH_PARENT);
summary.SetBackgroundColor(UiColor(0x161c24));
summary.SetCornerRadius(70.0f);
summary.SetMargin(Extents(70, 70, 0, 0));
summary.SetPadding(Extents(70, 70, 63, 63));

FlexLayout summaryHeader = FlexLayout::New();
summaryHeader.SetDirection(FlexDirection::ROW);
summaryHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
summaryHeader.SetAlignItems(FlexAlign::CENTER);
summaryHeader.SetRequestedWidth(MATCH_PARENT);

Label summaryTitle = Label::New("April spending");
summaryTitle.SetFontSize(46);
summaryTitle.SetTextColor(UiColor(0x9ba1b0));

Label summaryReport = Label::New("view report  →");
summaryReport.SetFontSize(39);
summaryReport.SetTextColor(UiColor(0x00d4a8));
summaryHeader.AddChildren({
    summaryTitle,
    summaryReport,
});

View summarySpacer1 = View::New();
summarySpacer1.SetRequestedHeight(36.4f);

Label summaryAmount = Label::New("<font size='119'><color value='#ffffff'>$2,148</color></font><font size='56'><color value='#5e6673'> / $3,500 limit</color></font>");
summaryAmount.SetMarkupEnabled(true);

View summarySpacer2 = View::New();
summarySpacer2.SetRequestedHeight(63.7f);

// Progress bar
FlexLayout progressTrack = FlexLayout::New();
progressTrack.SetDirection(FlexDirection::ROW);
progressTrack.SetRequestedWidth(MATCH_PARENT);
progressTrack.SetRequestedHeight(28.0f);
progressTrack.SetBackgroundColor(UiColor(0x242c36));
progressTrack.SetCornerRadius(14.0f);

View progressFill = View::New();
progressFill.SetBackgroundColor(UiColor(0x00d4a8));
progressFill.SetRequestedWidth(1372.0f);
progressFill.SetRequestedHeight(28.0f);
progressFill.SetCornerRadius(14.0f);
progressTrack.AddChildren({ progressFill });

View summarySpacer3 = View::New();
summarySpacer3.SetRequestedHeight(45.5f);

FlexLayout summaryFooter = FlexLayout::New();
summaryFooter.SetDirection(FlexDirection::ROW);
summaryFooter.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
summaryFooter.SetRequestedWidth(MATCH_PARENT);

Label summaryUsed = Label::New("61% used");
summaryUsed.SetFontSize(39);
summaryUsed.SetTextColor(UiColor(0x9ba1b0));

Label summaryDaysLeft = Label::New("15 days left");
summaryDaysLeft.SetFontSize(39);
summaryDaysLeft.SetTextColor(UiColor(0x9ba1b0));
summaryFooter.AddChildren({
    summaryUsed,
    summaryDaysLeft,
});

summary.AddChildren({
    summaryHeader,
    summarySpacer1,
    summaryAmount,
    summarySpacer2,
    progressTrack,
    summarySpacer3,
    summaryFooter,
});

View summaryAfterSpacer = View::New();
summaryAfterSpacer.SetRequestedHeight(72.8f);

// ========== SPENDING CATEGORIES ==========
FlexLayout categories = FlexLayout::New();
categories.SetDirection(FlexDirection::ROW);
categories.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
categories.SetRequestedWidth(MATCH_PARENT);
categories.SetPadding(Extents(70, 70, 0, 0));

FlexLayout catFood = FlexLayout::New();
catFood.SetDirection(FlexDirection::COLUMN);
catFood.SetAlignItems(FlexAlign::FLEX_START);
catFood.SetRequestedWidth(553.0f);
catFood.SetRequestedHeight(252.0f);
catFood.SetBackgroundColor(UiColor(0x161c24));
catFood.SetCornerRadius(56.0f);
catFood.SetPadding(Extents(49, 49, 42, 35));

Label catFoodLabel = Label::New("◉ Food");
catFoodLabel.SetFontSize(39);
catFoodLabel.SetTextColor(UiColor(0x9ba1b0));

Label catFoodValue = Label::New("$428");
catFoodValue.SetFontSize(63);
catFoodValue.SetTextColor(UiColor(0xffffff));
catFoodValue.SetMargin(Extents(0, 0, 28, 0));
catFood.AddChildren({
    catFoodLabel,
    catFoodValue,
});

FlexLayout catShopping = FlexLayout::New();
catShopping.SetDirection(FlexDirection::COLUMN);
catShopping.SetAlignItems(FlexAlign::FLEX_START);
catShopping.SetRequestedWidth(553.0f);
catShopping.SetRequestedHeight(252.0f);
catShopping.SetBackgroundColor(UiColor(0x161c24));
catShopping.SetCornerRadius(56.0f);
catShopping.SetPadding(Extents(49, 49, 42, 35));

Label catShoppingLabel = Label::New("◎ Shopping");
catShoppingLabel.SetFontSize(39);
catShoppingLabel.SetTextColor(UiColor(0x9ba1b0));

Label catShoppingValue = Label::New("$612");
catShoppingValue.SetFontSize(63);
catShoppingValue.SetTextColor(UiColor(0xffffff));
catShoppingValue.SetMargin(Extents(0, 0, 28, 0));
catShopping.AddChildren({
    catShoppingLabel,
    catShoppingValue,
});

FlexLayout catTransport = FlexLayout::New();
catTransport.SetDirection(FlexDirection::COLUMN);
catTransport.SetAlignItems(FlexAlign::FLEX_START);
catTransport.SetRequestedWidth(553.0f);
catTransport.SetRequestedHeight(252.0f);
catTransport.SetBackgroundColor(UiColor(0x161c24));
catTransport.SetCornerRadius(56.0f);
catTransport.SetPadding(Extents(49, 49, 42, 35));

Label catTransportLabel = Label::New("◈ Transport");
catTransportLabel.SetFontSize(39);
catTransportLabel.SetTextColor(UiColor(0x9ba1b0));

Label catTransportValue = Label::New("$184");
catTransportValue.SetFontSize(63);
catTransportValue.SetTextColor(UiColor(0xffffff));
catTransportValue.SetMargin(Extents(0, 0, 28, 0));
catTransport.AddChildren({
    catTransportLabel,
    catTransportValue,
});
categories.AddChildren({
    catFood,
    catShopping,
    catTransport,
});

View categoriesAfterSpacer = View::New();
categoriesAfterSpacer.SetRequestedHeight(100.1f);

// ========== CARD CONTROLS HEADER ==========
Label controlsHeader = Label::New("Card controls");
controlsHeader.SetFontSize(56);
controlsHeader.SetTextColor(UiColor(0xffffff));
controlsHeader.SetMargin(Extents(98, 0, 0, 0));

View controlsHeaderSpacer = View::New();
controlsHeaderSpacer.SetRequestedHeight(54.6f);

// ========== CONTROLS LIST ==========
FlexLayout controls = FlexLayout::New();
controls.SetDirection(FlexDirection::COLUMN);
controls.SetRequestedWidth(MATCH_PARENT);
controls.SetBackgroundColor(UiColor(0x161c24));
controls.SetCornerRadius(70.0f);
controls.SetMargin(Extents(70, 70, 0, 0));

// Row 1: Freeze card - toggle OFF
FlexLayout row1 = FlexLayout::New();
row1.SetDirection(FlexDirection::ROW);
row1.SetAlignItems(FlexAlign::CENTER);
row1.SetRequestedWidth(MATCH_PARENT);
row1.SetRequestedHeight(231.0f);
row1.SetPadding(Extents(56, 56, 0, 0));

FlexLayout row1Icon = FlexLayout::New();
row1Icon.SetDirection(FlexDirection::COLUMN);
row1Icon.SetJustifyContent(FlexJustify::CENTER);
row1Icon.SetAlignItems(FlexAlign::CENTER);
row1Icon.SetRequestedWidth(140.0f);
row1Icon.SetRequestedHeight(140.0f);
row1Icon.SetBackgroundColor(UiColor(0x1f2730));
row1Icon.SetCornerRadius(42.0f);

Label row1IconLabel = Label::New("※");
row1IconLabel.SetFontSize(63);
row1IconLabel.SetTextColor(UiColor(0xffffff));
row1Icon.AddChildren({ row1IconLabel });

FlexLayout row1Text = FlexLayout::New();
row1Text.SetDirection(FlexDirection::COLUMN);
row1Text.SetAlignItems(FlexAlign::FLEX_START);
row1Text.SetRequestedWidth(1330.0f);
row1Text.SetMargin(Extents(49, 0, 0, 0));

Label row1Title = Label::New("Freeze card");
row1Title.SetFontSize(49);
row1Title.SetTextColor(UiColor(0xffffff));

Label row1Subtitle = Label::New("Temporarily disable payments");
row1Subtitle.SetFontSize(39);
row1Subtitle.SetTextColor(UiColor(0x5e6673));
row1Subtitle.SetMargin(Extents(0, 0, 11, 0));
row1Text.AddChildren({
    row1Title,
    row1Subtitle,
});

View row1Spacer = View::New();
row1Spacer.SetRequestedWidth(MATCH_PARENT);
row1Spacer.SetRequestedHeight(3.5f);

FlexLayout row1Toggle = FlexLayout::New();
row1Toggle.SetDirection(FlexDirection::ROW);
row1Toggle.SetAlignItems(FlexAlign::CENTER);
row1Toggle.SetRequestedWidth(182.0f);
row1Toggle.SetRequestedHeight(105.0f);
row1Toggle.SetBackgroundColor(UiColor(0x242c36));
row1Toggle.SetCornerRadius(52.5f);
row1Toggle.SetPadding(Extents(14, 14, 7, 7));

View row1Knob = View::New();
row1Knob.SetBackgroundColor(UiColor(0xffffff));
row1Knob.SetRequestedWidth(84.0f);
row1Knob.SetRequestedHeight(84.0f);
row1Knob.SetCornerRadius(42.0f);
row1Toggle.AddChildren({ row1Knob });
row1.AddChildren({
    row1Icon,
    row1Text,
    row1Spacer,
    row1Toggle,
});

View divider1 = View::New();
divider1.SetBackgroundColor(UiColor(0x242c36));
divider1.SetRequestedHeight(3.5f);
divider1.SetMargin(Extents(56, 56, 0, 0));

// Row 2: Location lock - toggle ON
FlexLayout row2 = FlexLayout::New();
row2.SetDirection(FlexDirection::ROW);
row2.SetAlignItems(FlexAlign::CENTER);
row2.SetRequestedWidth(MATCH_PARENT);
row2.SetRequestedHeight(231.0f);
row2.SetPadding(Extents(56, 56, 0, 0));

FlexLayout row2Icon = FlexLayout::New();
row2Icon.SetDirection(FlexDirection::COLUMN);
row2Icon.SetJustifyContent(FlexJustify::CENTER);
row2Icon.SetAlignItems(FlexAlign::CENTER);
row2Icon.SetRequestedWidth(140.0f);
row2Icon.SetRequestedHeight(140.0f);
row2Icon.SetBackgroundColor(UiColor(0x1f2730));
row2Icon.SetCornerRadius(42.0f);

Label row2IconLabel = Label::New("◉");
row2IconLabel.SetFontSize(63);
row2IconLabel.SetTextColor(UiColor(0xffffff));
row2Icon.AddChildren({ row2IconLabel });

FlexLayout row2Text = FlexLayout::New();
row2Text.SetDirection(FlexDirection::COLUMN);
row2Text.SetAlignItems(FlexAlign::FLEX_START);
row2Text.SetRequestedWidth(1330.0f);
row2Text.SetMargin(Extents(49, 0, 0, 0));

Label row2Title = Label::New("Location lock");
row2Title.SetFontSize(49);
row2Title.SetTextColor(UiColor(0xffffff));

Label row2Subtitle = Label::New("Only allow in United States");
row2Subtitle.SetFontSize(39);
row2Subtitle.SetTextColor(UiColor(0x5e6673));
row2Subtitle.SetMargin(Extents(0, 0, 11, 0));
row2Text.AddChildren({
    row2Title,
    row2Subtitle,
});

View row2Spacer = View::New();
row2Spacer.SetRequestedWidth(MATCH_PARENT);
row2Spacer.SetRequestedHeight(3.5f);

FlexLayout row2Toggle = FlexLayout::New();
row2Toggle.SetDirection(FlexDirection::ROW);
row2Toggle.SetJustifyContent(FlexJustify::FLEX_END);
row2Toggle.SetAlignItems(FlexAlign::CENTER);
row2Toggle.SetRequestedWidth(182.0f);
row2Toggle.SetRequestedHeight(105.0f);
row2Toggle.SetBackgroundColor(UiColor(0x00d4a8));
row2Toggle.SetCornerRadius(52.5f);
row2Toggle.SetPadding(Extents(7, 14, 7, 7));

View row2Knob = View::New();
row2Knob.SetBackgroundColor(UiColor(0xffffff));
row2Knob.SetRequestedWidth(84.0f);
row2Knob.SetRequestedHeight(84.0f);
row2Knob.SetCornerRadius(42.0f);
row2Toggle.AddChildren({ row2Knob });
row2.AddChildren({
    row2Icon,
    row2Text,
    row2Spacer,
    row2Toggle,
});

View divider2 = View::New();
divider2.SetBackgroundColor(UiColor(0x242c36));
divider2.SetRequestedHeight(3.5f);
divider2.SetMargin(Extents(56, 56, 0, 0));

// Row 3: Online payments - toggle ON
FlexLayout row3 = FlexLayout::New();
row3.SetDirection(FlexDirection::ROW);
row3.SetAlignItems(FlexAlign::CENTER);
row3.SetRequestedWidth(MATCH_PARENT);
row3.SetRequestedHeight(231.0f);
row3.SetPadding(Extents(56, 56, 0, 0));

FlexLayout row3Icon = FlexLayout::New();
row3Icon.SetDirection(FlexDirection::COLUMN);
row3Icon.SetJustifyContent(FlexJustify::CENTER);
row3Icon.SetAlignItems(FlexAlign::CENTER);
row3Icon.SetRequestedWidth(140.0f);
row3Icon.SetRequestedHeight(140.0f);
row3Icon.SetBackgroundColor(UiColor(0x1f2730));
row3Icon.SetCornerRadius(42.0f);

Label row3IconLabel = Label::New("◯");
row3IconLabel.SetFontSize(63);
row3IconLabel.SetTextColor(UiColor(0xffffff));
row3Icon.AddChildren({ row3IconLabel });

FlexLayout row3Text = FlexLayout::New();
row3Text.SetDirection(FlexDirection::COLUMN);
row3Text.SetAlignItems(FlexAlign::FLEX_START);
row3Text.SetRequestedWidth(1330.0f);
row3Text.SetMargin(Extents(49, 0, 0, 0));

Label row3Title = Label::New("Online payments");
row3Title.SetFontSize(49);
row3Title.SetTextColor(UiColor(0xffffff));

Label row3Subtitle = Label::New("E-commerce transactions");
row3Subtitle.SetFontSize(39);
row3Subtitle.SetTextColor(UiColor(0x5e6673));
row3Subtitle.SetMargin(Extents(0, 0, 11, 0));
row3Text.AddChildren({
    row3Title,
    row3Subtitle,
});

View row3Spacer = View::New();
row3Spacer.SetRequestedWidth(MATCH_PARENT);
row3Spacer.SetRequestedHeight(3.5f);

FlexLayout row3Toggle = FlexLayout::New();
row3Toggle.SetDirection(FlexDirection::ROW);
row3Toggle.SetJustifyContent(FlexJustify::FLEX_END);
row3Toggle.SetAlignItems(FlexAlign::CENTER);
row3Toggle.SetRequestedWidth(182.0f);
row3Toggle.SetRequestedHeight(105.0f);
row3Toggle.SetBackgroundColor(UiColor(0x00d4a8));
row3Toggle.SetCornerRadius(52.5f);
row3Toggle.SetPadding(Extents(7, 14, 7, 7));

View row3Knob = View::New();
row3Knob.SetBackgroundColor(UiColor(0xffffff));
row3Knob.SetRequestedWidth(84.0f);
row3Knob.SetRequestedHeight(84.0f);
row3Knob.SetCornerRadius(42.0f);
row3Toggle.AddChildren({ row3Knob });
row3.AddChildren({
    row3Icon,
    row3Text,
    row3Spacer,
    row3Toggle,
});

View divider3 = View::New();
divider3.SetBackgroundColor(UiColor(0x242c36));
divider3.SetRequestedHeight(3.5f);
divider3.SetMargin(Extents(56, 56, 0, 0));

// Row 4: Replace card - arrow
FlexLayout row4 = FlexLayout::New();
row4.SetDirection(FlexDirection::ROW);
row4.SetAlignItems(FlexAlign::CENTER);
row4.SetRequestedWidth(MATCH_PARENT);
row4.SetRequestedHeight(231.0f);
row4.SetPadding(Extents(56, 56, 0, 0));

FlexLayout row4Icon = FlexLayout::New();
row4Icon.SetDirection(FlexDirection::COLUMN);
row4Icon.SetJustifyContent(FlexJustify::CENTER);
row4Icon.SetAlignItems(FlexAlign::CENTER);
row4Icon.SetRequestedWidth(140.0f);
row4Icon.SetRequestedHeight(140.0f);
row4Icon.SetBackgroundColor(UiColor(0x1f2730));
row4Icon.SetCornerRadius(42.0f);

Label row4IconLabel = Label::New("◈");
row4IconLabel.SetFontSize(63);
row4IconLabel.SetTextColor(UiColor(0xffffff));
row4Icon.AddChildren({ row4IconLabel });

FlexLayout row4Text = FlexLayout::New();
row4Text.SetDirection(FlexDirection::COLUMN);
row4Text.SetAlignItems(FlexAlign::FLEX_START);
row4Text.SetRequestedWidth(1330.0f);
row4Text.SetMargin(Extents(49, 0, 0, 0));

Label row4Title = Label::New("Replace card");
row4Title.SetFontSize(49);
row4Title.SetTextColor(UiColor(0xffffff));

Label row4Subtitle = Label::New("Request a new physical card");
row4Subtitle.SetFontSize(39);
row4Subtitle.SetTextColor(UiColor(0x5e6673));
row4Subtitle.SetMargin(Extents(0, 0, 11, 0));
row4Text.AddChildren({
    row4Title,
    row4Subtitle,
});

View row4Spacer = View::New();
row4Spacer.SetRequestedWidth(MATCH_PARENT);
row4Spacer.SetRequestedHeight(3.5f);

Label row4Arrow = Label::New("→");
row4Arrow.SetFontSize(63);
row4Arrow.SetTextColor(UiColor(0x5e6673));
row4.AddChildren({
    row4Icon,
    row4Text,
    row4Spacer,
    row4Arrow,
});
controls.AddChildren({
    // Row 1: Freeze card - toggle OFF
    row1,
    divider1,

    // Row 2: Location lock - toggle ON
    row2,
    divider2,

    // Row 3: Online payments - toggle ON
    row3,
    divider3,

    // Row 4: Replace card - arrow
    row4,
});

View controlsAfterSpacer = View::New();
controlsAfterSpacer.SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f));

// ========== BOTTOM NAV ==========
FlexLayout bottomNav = FlexLayout::New();
bottomNav.SetDirection(FlexDirection::ROW);
bottomNav.SetJustifyContent(FlexJustify::SPACE_EVENLY);
bottomNav.SetAlignItems(FlexAlign::CENTER);
bottomNav.SetRequestedWidth(MATCH_PARENT);
bottomNav.SetRequestedHeight(252.0f);
bottomNav.SetBackgroundColor(UiColor(0x161c24));

FlexLayout navHome = FlexLayout::New();
navHome.SetDirection(FlexDirection::COLUMN);
navHome.SetAlignItems(FlexAlign::CENTER);

Label navHomeIcon = Label::New("⌂");
navHomeIcon.SetFontSize(77);
navHomeIcon.SetTextColor(UiColor(0x5e6673));

Label navHomeLabel = Label::New("Home");
navHomeLabel.SetFontSize(35);
navHomeLabel.SetTextColor(UiColor(0x5e6673));
navHomeLabel.SetMargin(Extents(0, 0, 14, 0));
navHome.AddChildren({
    navHomeIcon,
    navHomeLabel,
});

FlexLayout navCards = FlexLayout::New();
navCards.SetDirection(FlexDirection::COLUMN);
navCards.SetAlignItems(FlexAlign::CENTER);

Label navCardsIcon = Label::New("▭");
navCardsIcon.SetFontSize(77);
navCardsIcon.SetTextColor(UiColor(0x00d4a8));

Label navCardsLabel = Label::New("Cards");
navCardsLabel.SetFontSize(35);
navCardsLabel.SetTextColor(UiColor(0x00d4a8));
navCardsLabel.SetMargin(Extents(0, 0, 14, 0));
navCards.AddChildren({
    navCardsIcon,
    navCardsLabel,
});

FlexLayout navTransfer = FlexLayout::New();
navTransfer.SetDirection(FlexDirection::COLUMN);
navTransfer.SetAlignItems(FlexAlign::CENTER);

Label navTransferIcon = Label::New("⇄");
navTransferIcon.SetFontSize(77);
navTransferIcon.SetTextColor(UiColor(0x5e6673));

Label navTransferLabel = Label::New("Transfer");
navTransferLabel.SetFontSize(35);
navTransferLabel.SetTextColor(UiColor(0x5e6673));
navTransferLabel.SetMargin(Extents(0, 0, 14, 0));
navTransfer.AddChildren({
    navTransferIcon,
    navTransferLabel,
});

FlexLayout navProfile = FlexLayout::New();
navProfile.SetDirection(FlexDirection::COLUMN);
navProfile.SetAlignItems(FlexAlign::CENTER);

Label navProfileIcon = Label::New("◎");
navProfileIcon.SetFontSize(77);
navProfileIcon.SetTextColor(UiColor(0x5e6673));

Label navProfileLabel = Label::New("Profile");
navProfileLabel.SetFontSize(35);
navProfileLabel.SetTextColor(UiColor(0x5e6673));
navProfileLabel.SetMargin(Extents(0, 0, 14, 0));
navProfile.AddChildren({
    navProfileIcon,
    navProfileLabel,
});
bottomNav.AddChildren({
    navHome,
    navCards,
    navTransfer,
    navProfile,
});

root.AddChildren({

    // ========== STATUS BAR ==========
    statusBar,

    // ========== HEADER ==========
    header,

    headerSpacer,

    // ========== VIRTUAL CARD (HERO) ==========
    hero,

    heroAfterSpacer,

    // ========== CARD PAGINATION DOTS ==========
    dots,

    dotsAfterSpacer,

    // ========== SPENDING SUMMARY CARD ==========
    summary,

    summaryAfterSpacer,

    // ========== SPENDING CATEGORIES ==========
    categories,

    categoriesAfterSpacer,

    // ========== CARD CONTROLS HEADER ==========
    controlsHeader,

    controlsHeaderSpacer,

    // ========== CONTROLS LIST ==========
    controls,

    controlsAfterSpacer,

    // ========== BOTTOM NAV ==========
    bottomNav,
});
return root;
