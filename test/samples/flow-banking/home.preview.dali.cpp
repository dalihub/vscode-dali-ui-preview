// @preview-config: name="Flow Banking — Home", width=2520, height=4480
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
Label statusSignal = Label::New("●●●  5G  ▮ 86%");
statusSignal.SetFontSize(39);
statusSignal.SetTextColor(UiColor(0xffffff));
statusBar.AddChildren({
    statusTime,
    statusSignal,
});

// ========== HEADER ==========
FlexLayout header = FlexLayout::New();
header.SetDirection(FlexDirection::ROW);
header.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
header.SetAlignItems(FlexAlign::CENTER);
header.SetRequestedWidth(MATCH_PARENT);
header.SetRequestedHeight(252.0f);
header.SetPadding(Extents(98, 98, 14, 0));
FlexLayout headerLeft = FlexLayout::New();
headerLeft.SetDirection(FlexDirection::ROW);
headerLeft.SetAlignItems(FlexAlign::CENTER);
ImageView avatar = ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait3.jpg");
avatar.SetRequestedWidth(154.0f);
avatar.SetRequestedHeight(154.0f);
avatar.SetCornerRadius(77.0f);
FlexLayout headerText = FlexLayout::New();
headerText.SetDirection(FlexDirection::COLUMN);
headerText.SetAlignItems(FlexAlign::FLEX_START);
headerText.SetMargin(Extents(42, 0, 0, 0));
Label welcome = Label::New("Welcome back");
welcome.SetFontSize(39);
welcome.SetTextColor(UiColor(0x9ba1b0));
Label userName = Label::New("Alex Morgan");
userName.SetFontSize(56);
userName.SetTextColor(UiColor(0xffffff));
userName.SetMargin(Extents(0, 0, 11, 0));
headerText.AddChildren({
    welcome,
    userName,
});
headerLeft.AddChildren({
    avatar,
    headerText,
});
FlexLayout headerBell = FlexLayout::New();
headerBell.SetDirection(FlexDirection::COLUMN);
headerBell.SetJustifyContent(FlexJustify::CENTER);
headerBell.SetAlignItems(FlexAlign::CENTER);
headerBell.SetRequestedWidth(154.0f);
headerBell.SetRequestedHeight(154.0f);
headerBell.SetBackgroundColor(UiColor(0x1f2730));
headerBell.SetCornerRadius(77.0f);
Label headerBellIcon = Label::New("◉");
headerBellIcon.SetFontSize(56);
headerBellIcon.SetTextColor(UiColor(0xffffff));
headerBell.AddChildren({
    headerBellIcon,
});
header.AddChildren({
    headerLeft,
    headerBell,
});

View spacer1 = View::New();
spacer1.SetRequestedHeight(27.3f);

// ========== BALANCE HERO CARD (TEAL) ==========
FlexLayout balanceCard = FlexLayout::New();
balanceCard.SetDirection(FlexDirection::COLUMN);
balanceCard.SetRequestedWidth(MATCH_PARENT);
balanceCard.SetRequestedHeight(728.0f);
balanceCard.SetBackgroundColor(UiColor(0x00d4a8));
balanceCard.SetCornerRadius(98.0f);
balanceCard.SetMargin(Extents(70, 70, 0, 0));
balanceCard.SetPadding(Extents(91, 91, 84, 77));
FlexLayout balanceTopRow = FlexLayout::New();
balanceTopRow.SetDirection(FlexDirection::ROW);
balanceTopRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
balanceTopRow.SetAlignItems(FlexAlign::CENTER);
balanceTopRow.SetRequestedWidth(MATCH_PARENT);
Label balanceLabel = Label::New("TOTAL BALANCE");
balanceLabel.SetFontSize(42);
balanceLabel.SetTextColor(UiColor(0x073028));
Label balanceEye = Label::New("◉");
balanceEye.SetFontSize(63);
balanceEye.SetTextColor(UiColor(0x073028));
balanceTopRow.AddChildren({
    balanceLabel,
    balanceEye,
});
Label balanceAmount = Label::New("<font size='105'><color value='#073028'>$</color></font><font size='203'><color value='#0d1117'>12,486</color></font><font size='91'><color value='#073028'>.92</color></font>");
balanceAmount.SetMarkupEnabled(true);
balanceAmount.SetMargin(Extents(0, 0, 35, 0));
View balanceSpacer1 = View::New();
balanceSpacer1.SetRequestedHeight(27.3f);
FlexLayout balanceTrend = FlexLayout::New();
balanceTrend.SetDirection(FlexDirection::ROW);
balanceTrend.SetJustifyContent(FlexJustify::CENTER);
balanceTrend.SetAlignItems(FlexAlign::CENTER);
balanceTrend.SetBackgroundColor(UiColor(0x0a3a33));
balanceTrend.SetCornerRadius(45.5f);
balanceTrend.SetPadding(Extents(49, 49, 21, 21));
balanceTrend.SetRequestedWidth(700.0f);
balanceTrend.SetRequestedHeight(98.0f);
Label balanceTrendLabel = Label::New("▲ $320.45 this week");
balanceTrendLabel.SetFontSize(39);
balanceTrendLabel.SetTextColor(UiColor(0x00d4a8));
balanceTrend.AddChildren({
    balanceTrendLabel,
});
View balanceSpacer2 = View::New();
balanceSpacer2.SetRequestedHeight(72.8f);
FlexLayout balanceCardRow = FlexLayout::New();
balanceCardRow.SetDirection(FlexDirection::ROW);
balanceCardRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
balanceCardRow.SetAlignItems(FlexAlign::CENTER);
balanceCardRow.SetRequestedWidth(MATCH_PARENT);
FlexLayout balanceCardInfo = FlexLayout::New();
balanceCardInfo.SetDirection(FlexDirection::COLUMN);
balanceCardInfo.SetAlignItems(FlexAlign::FLEX_START);
Label cardNumber = Label::New("•••• 4821");
cardNumber.SetFontSize(46);
cardNumber.SetTextColor(UiColor(0x0d1117));
Label cardName = Label::New("Flow Debit");
cardName.SetFontSize(35);
cardName.SetTextColor(UiColor(0x0a3a33));
cardName.SetMargin(Extents(0, 0, 11, 0));
balanceCardInfo.AddChildren({
    cardNumber,
    cardName,
});
Label cardBrand = Label::New("VISA");
cardBrand.SetFontSize(49);
cardBrand.SetTextColor(UiColor(0x0d1117));
balanceCardRow.AddChildren({
    balanceCardInfo,
    cardBrand,
});
balanceCard.AddChildren({
    balanceTopRow,
    balanceAmount,
    balanceSpacer1,
    balanceTrend,
    balanceSpacer2,
    balanceCardRow,
});

View spacer2 = View::New();
spacer2.SetRequestedHeight(109.2f);

// ========== QUICK ACTIONS ==========
FlexLayout quickActions = FlexLayout::New();
quickActions.SetDirection(FlexDirection::ROW);
quickActions.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
quickActions.SetRequestedWidth(MATCH_PARENT);
quickActions.SetPadding(Extents(98, 98, 0, 0));
FlexLayout actionSend = FlexLayout::New();
actionSend.SetDirection(FlexDirection::COLUMN);
actionSend.SetAlignItems(FlexAlign::CENTER);
FlexLayout actionSendIcon = FlexLayout::New();
actionSendIcon.SetDirection(FlexDirection::COLUMN);
actionSendIcon.SetJustifyContent(FlexJustify::CENTER);
actionSendIcon.SetAlignItems(FlexAlign::CENTER);
actionSendIcon.SetRequestedWidth(196.0f);
actionSendIcon.SetRequestedHeight(196.0f);
actionSendIcon.SetBackgroundColor(UiColor(0x161c24));
actionSendIcon.SetCornerRadius(98.0f);
Label actionSendGlyph = Label::New("↑");
actionSendGlyph.SetFontSize(77);
actionSendGlyph.SetTextColor(UiColor(0x00d4a8));
actionSendIcon.AddChildren({
    actionSendGlyph,
});
Label actionSendLabel = Label::New("Send");
actionSendLabel.SetFontSize(39);
actionSendLabel.SetTextColor(UiColor(0xffffff));
actionSendLabel.SetMargin(Extents(0, 0, 28, 0));
actionSend.AddChildren({
    actionSendIcon,
    actionSendLabel,
});
FlexLayout actionRequest = FlexLayout::New();
actionRequest.SetDirection(FlexDirection::COLUMN);
actionRequest.SetAlignItems(FlexAlign::CENTER);
FlexLayout actionRequestIcon = FlexLayout::New();
actionRequestIcon.SetDirection(FlexDirection::COLUMN);
actionRequestIcon.SetJustifyContent(FlexJustify::CENTER);
actionRequestIcon.SetAlignItems(FlexAlign::CENTER);
actionRequestIcon.SetRequestedWidth(196.0f);
actionRequestIcon.SetRequestedHeight(196.0f);
actionRequestIcon.SetBackgroundColor(UiColor(0x161c24));
actionRequestIcon.SetCornerRadius(98.0f);
Label actionRequestGlyph = Label::New("↓");
actionRequestGlyph.SetFontSize(77);
actionRequestGlyph.SetTextColor(UiColor(0x00d4a8));
actionRequestIcon.AddChildren({
    actionRequestGlyph,
});
Label actionRequestLabel = Label::New("Request");
actionRequestLabel.SetFontSize(39);
actionRequestLabel.SetTextColor(UiColor(0xffffff));
actionRequestLabel.SetMargin(Extents(0, 0, 28, 0));
actionRequest.AddChildren({
    actionRequestIcon,
    actionRequestLabel,
});
FlexLayout actionTransfer = FlexLayout::New();
actionTransfer.SetDirection(FlexDirection::COLUMN);
actionTransfer.SetAlignItems(FlexAlign::CENTER);
FlexLayout actionTransferIcon = FlexLayout::New();
actionTransferIcon.SetDirection(FlexDirection::COLUMN);
actionTransferIcon.SetJustifyContent(FlexJustify::CENTER);
actionTransferIcon.SetAlignItems(FlexAlign::CENTER);
actionTransferIcon.SetRequestedWidth(196.0f);
actionTransferIcon.SetRequestedHeight(196.0f);
actionTransferIcon.SetBackgroundColor(UiColor(0x161c24));
actionTransferIcon.SetCornerRadius(98.0f);
Label actionTransferGlyph = Label::New("⇄");
actionTransferGlyph.SetFontSize(77);
actionTransferGlyph.SetTextColor(UiColor(0x00d4a8));
actionTransferIcon.AddChildren({
    actionTransferGlyph,
});
Label actionTransferLabel = Label::New("Transfer");
actionTransferLabel.SetFontSize(39);
actionTransferLabel.SetTextColor(UiColor(0xffffff));
actionTransferLabel.SetMargin(Extents(0, 0, 28, 0));
actionTransfer.AddChildren({
    actionTransferIcon,
    actionTransferLabel,
});
FlexLayout actionTopup = FlexLayout::New();
actionTopup.SetDirection(FlexDirection::COLUMN);
actionTopup.SetAlignItems(FlexAlign::CENTER);
FlexLayout actionTopupIcon = FlexLayout::New();
actionTopupIcon.SetDirection(FlexDirection::COLUMN);
actionTopupIcon.SetJustifyContent(FlexJustify::CENTER);
actionTopupIcon.SetAlignItems(FlexAlign::CENTER);
actionTopupIcon.SetRequestedWidth(196.0f);
actionTopupIcon.SetRequestedHeight(196.0f);
actionTopupIcon.SetBackgroundColor(UiColor(0x161c24));
actionTopupIcon.SetCornerRadius(98.0f);
Label actionTopupGlyph = Label::New("+");
actionTopupGlyph.SetFontSize(84);
actionTopupGlyph.SetTextColor(UiColor(0x00d4a8));
actionTopupIcon.AddChildren({
    actionTopupGlyph,
});
Label actionTopupLabel = Label::New("Top up");
actionTopupLabel.SetFontSize(39);
actionTopupLabel.SetTextColor(UiColor(0xffffff));
actionTopupLabel.SetMargin(Extents(0, 0, 28, 0));
actionTopup.AddChildren({
    actionTopupIcon,
    actionTopupLabel,
});
quickActions.AddChildren({
    actionSend,
    actionRequest,
    actionTransfer,
    actionTopup,
});

View spacer3 = View::New();
spacer3.SetRequestedHeight(100.1f);

// ========== RECENT TRANSACTIONS HEADER ==========
FlexLayout txnHeader = FlexLayout::New();
txnHeader.SetDirection(FlexDirection::ROW);
txnHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
txnHeader.SetAlignItems(FlexAlign::CENTER);
txnHeader.SetRequestedWidth(MATCH_PARENT);
txnHeader.SetPadding(Extents(98, 98, 0, 0));
Label txnHeaderTitle = Label::New("Recent Transactions");
txnHeaderTitle.SetFontSize(56);
txnHeaderTitle.SetTextColor(UiColor(0xffffff));
Label txnHeaderSeeAll = Label::New("See all →");
txnHeaderSeeAll.SetFontSize(39);
txnHeaderSeeAll.SetTextColor(UiColor(0x00d4a8));
txnHeader.AddChildren({
    txnHeaderTitle,
    txnHeaderSeeAll,
});

View spacer4 = View::New();
spacer4.SetRequestedHeight(54.6f);

// ========== TRANSACTION LIST ==========
FlexLayout txnList = FlexLayout::New();
txnList.SetDirection(FlexDirection::COLUMN);
txnList.SetRequestedWidth(MATCH_PARENT);
txnList.SetBackgroundColor(UiColor(0x161c24));
txnList.SetCornerRadius(70.0f);
txnList.SetMargin(Extents(70, 70, 0, 0));

// Txn 1
FlexLayout txn1 = FlexLayout::New();
txn1.SetDirection(FlexDirection::ROW);
txn1.SetAlignItems(FlexAlign::CENTER);
txn1.SetRequestedWidth(MATCH_PARENT);
txn1.SetRequestedHeight(245.0f);
txn1.SetPadding(Extents(56, 56, 0, 0));
FlexLayout txn1Icon = FlexLayout::New();
txn1Icon.SetDirection(FlexDirection::COLUMN);
txn1Icon.SetJustifyContent(FlexJustify::CENTER);
txn1Icon.SetAlignItems(FlexAlign::CENTER);
txn1Icon.SetRequestedWidth(147.0f);
txn1Icon.SetRequestedHeight(147.0f);
txn1Icon.SetBackgroundColor(UiColor(0x1f2730));
txn1Icon.SetCornerRadius(45.5f);
Label txn1IconGlyph = Label::New("◉");
txn1IconGlyph.SetFontSize(63);
txn1IconGlyph.SetTextColor(UiColor(0xf59e0b));
txn1Icon.AddChildren({
    txn1IconGlyph,
});
FlexLayout txn1Info = FlexLayout::New();
txn1Info.SetDirection(FlexDirection::COLUMN);
txn1Info.SetAlignItems(FlexAlign::FLEX_START);
txn1Info.SetRequestedWidth(1155.0f);
txn1Info.SetMargin(Extents(49, 0, 0, 0));
Label txn1Title = Label::New("Blue Bottle Coffee");
txn1Title.SetFontSize(49);
txn1Title.SetTextColor(UiColor(0xffffff));
Label txn1Sub = Label::New("Food & Drink  ·  9:12 AM");
txn1Sub.SetFontSize(39);
txn1Sub.SetTextColor(UiColor(0x5e6673));
txn1Sub.SetMargin(Extents(0, 0, 11, 0));
txn1Info.AddChildren({
    txn1Title,
    txn1Sub,
});
View txn1Spacer = View::New();
txn1Spacer.SetRequestedWidth(MATCH_PARENT);
txn1Spacer.SetRequestedHeight(3.5f);
FlexLayout txn1Amount = FlexLayout::New();
txn1Amount.SetDirection(FlexDirection::COLUMN);
txn1Amount.SetAlignItems(FlexAlign::FLEX_END);
Label txn1AmountValue = Label::New("-$6.80");
txn1AmountValue.SetFontSize(49);
txn1AmountValue.SetTextColor(UiColor(0xffffff));
Label txn1AmountStatus = Label::New("Completed");
txn1AmountStatus.SetFontSize(35);
txn1AmountStatus.SetTextColor(UiColor(0x5e6673));
txn1AmountStatus.SetMargin(Extents(0, 0, 11, 0));
txn1Amount.AddChildren({
    txn1AmountValue,
    txn1AmountStatus,
});
txn1.AddChildren({
    txn1Icon,
    txn1Info,
    txn1Spacer,
    txn1Amount,
});
View divider1 = View::New();
divider1.SetBackgroundColor(UiColor(0x242c36));
divider1.SetRequestedHeight(3.5f);
divider1.SetMargin(Extents(56, 56, 0, 0));

// Txn 2
FlexLayout txn2 = FlexLayout::New();
txn2.SetDirection(FlexDirection::ROW);
txn2.SetAlignItems(FlexAlign::CENTER);
txn2.SetRequestedWidth(MATCH_PARENT);
txn2.SetRequestedHeight(245.0f);
txn2.SetPadding(Extents(56, 56, 0, 0));
FlexLayout txn2Icon = FlexLayout::New();
txn2Icon.SetDirection(FlexDirection::COLUMN);
txn2Icon.SetJustifyContent(FlexJustify::CENTER);
txn2Icon.SetAlignItems(FlexAlign::CENTER);
txn2Icon.SetRequestedWidth(147.0f);
txn2Icon.SetRequestedHeight(147.0f);
txn2Icon.SetBackgroundColor(UiColor(0x0a3a33));
txn2Icon.SetCornerRadius(45.5f);
Label txn2IconGlyph = Label::New("↓");
txn2IconGlyph.SetFontSize(63);
txn2IconGlyph.SetTextColor(UiColor(0x22c55e));
txn2Icon.AddChildren({
    txn2IconGlyph,
});
FlexLayout txn2Info = FlexLayout::New();
txn2Info.SetDirection(FlexDirection::COLUMN);
txn2Info.SetAlignItems(FlexAlign::FLEX_START);
txn2Info.SetRequestedWidth(1155.0f);
txn2Info.SetMargin(Extents(49, 0, 0, 0));
Label txn2Title = Label::New("Salary — Acme Corp");
txn2Title.SetFontSize(49);
txn2Title.SetTextColor(UiColor(0xffffff));
Label txn2Sub = Label::New("Income  ·  Yesterday");
txn2Sub.SetFontSize(39);
txn2Sub.SetTextColor(UiColor(0x5e6673));
txn2Sub.SetMargin(Extents(0, 0, 11, 0));
txn2Info.AddChildren({
    txn2Title,
    txn2Sub,
});
View txn2Spacer = View::New();
txn2Spacer.SetRequestedWidth(MATCH_PARENT);
txn2Spacer.SetRequestedHeight(3.5f);
FlexLayout txn2Amount = FlexLayout::New();
txn2Amount.SetDirection(FlexDirection::COLUMN);
txn2Amount.SetAlignItems(FlexAlign::FLEX_END);
Label txn2AmountValue = Label::New("+$4,250.00");
txn2AmountValue.SetFontSize(49);
txn2AmountValue.SetTextColor(UiColor(0x22c55e));
Label txn2AmountStatus = Label::New("Deposited");
txn2AmountStatus.SetFontSize(35);
txn2AmountStatus.SetTextColor(UiColor(0x5e6673));
txn2AmountStatus.SetMargin(Extents(0, 0, 11, 0));
txn2Amount.AddChildren({
    txn2AmountValue,
    txn2AmountStatus,
});
txn2.AddChildren({
    txn2Icon,
    txn2Info,
    txn2Spacer,
    txn2Amount,
});
View divider2 = View::New();
divider2.SetBackgroundColor(UiColor(0x242c36));
divider2.SetRequestedHeight(3.5f);
divider2.SetMargin(Extents(56, 56, 0, 0));

// Txn 3
FlexLayout txn3 = FlexLayout::New();
txn3.SetDirection(FlexDirection::ROW);
txn3.SetAlignItems(FlexAlign::CENTER);
txn3.SetRequestedWidth(MATCH_PARENT);
txn3.SetRequestedHeight(245.0f);
txn3.SetPadding(Extents(56, 56, 0, 0));
FlexLayout txn3Icon = FlexLayout::New();
txn3Icon.SetDirection(FlexDirection::COLUMN);
txn3Icon.SetJustifyContent(FlexJustify::CENTER);
txn3Icon.SetAlignItems(FlexAlign::CENTER);
txn3Icon.SetRequestedWidth(147.0f);
txn3Icon.SetRequestedHeight(147.0f);
txn3Icon.SetBackgroundColor(UiColor(0x1f2730));
txn3Icon.SetCornerRadius(45.5f);
Label txn3IconGlyph = Label::New("◎");
txn3IconGlyph.SetFontSize(63);
txn3IconGlyph.SetTextColor(UiColor(0x2dd4a8));
txn3Icon.AddChildren({
    txn3IconGlyph,
});
FlexLayout txn3Info = FlexLayout::New();
txn3Info.SetDirection(FlexDirection::COLUMN);
txn3Info.SetAlignItems(FlexAlign::FLEX_START);
txn3Info.SetRequestedWidth(1155.0f);
txn3Info.SetMargin(Extents(49, 0, 0, 0));
Label txn3Title = Label::New("Whole Foods Market");
txn3Title.SetFontSize(49);
txn3Title.SetTextColor(UiColor(0xffffff));
Label txn3Sub = Label::New("Groceries  ·  Yesterday");
txn3Sub.SetFontSize(39);
txn3Sub.SetTextColor(UiColor(0x5e6673));
txn3Sub.SetMargin(Extents(0, 0, 11, 0));
txn3Info.AddChildren({
    txn3Title,
    txn3Sub,
});
View txn3Spacer = View::New();
txn3Spacer.SetRequestedWidth(MATCH_PARENT);
txn3Spacer.SetRequestedHeight(3.5f);
FlexLayout txn3Amount = FlexLayout::New();
txn3Amount.SetDirection(FlexDirection::COLUMN);
txn3Amount.SetAlignItems(FlexAlign::FLEX_END);
Label txn3AmountValue = Label::New("-$84.37");
txn3AmountValue.SetFontSize(49);
txn3AmountValue.SetTextColor(UiColor(0xffffff));
Label txn3AmountStatus = Label::New("Completed");
txn3AmountStatus.SetFontSize(35);
txn3AmountStatus.SetTextColor(UiColor(0x5e6673));
txn3AmountStatus.SetMargin(Extents(0, 0, 11, 0));
txn3Amount.AddChildren({
    txn3AmountValue,
    txn3AmountStatus,
});
txn3.AddChildren({
    txn3Icon,
    txn3Info,
    txn3Spacer,
    txn3Amount,
});
View divider3 = View::New();
divider3.SetBackgroundColor(UiColor(0x242c36));
divider3.SetRequestedHeight(3.5f);
divider3.SetMargin(Extents(56, 56, 0, 0));

// Txn 4
FlexLayout txn4 = FlexLayout::New();
txn4.SetDirection(FlexDirection::ROW);
txn4.SetAlignItems(FlexAlign::CENTER);
txn4.SetRequestedWidth(MATCH_PARENT);
txn4.SetRequestedHeight(245.0f);
txn4.SetPadding(Extents(56, 56, 0, 0));
FlexLayout txn4Icon = FlexLayout::New();
txn4Icon.SetDirection(FlexDirection::COLUMN);
txn4Icon.SetJustifyContent(FlexJustify::CENTER);
txn4Icon.SetAlignItems(FlexAlign::CENTER);
txn4Icon.SetRequestedWidth(147.0f);
txn4Icon.SetRequestedHeight(147.0f);
txn4Icon.SetBackgroundColor(UiColor(0x1f2730));
txn4Icon.SetCornerRadius(45.5f);
Label txn4IconGlyph = Label::New("♪");
txn4IconGlyph.SetFontSize(63);
txn4IconGlyph.SetTextColor(UiColor(0x1ed760));
txn4Icon.AddChildren({
    txn4IconGlyph,
});
FlexLayout txn4Info = FlexLayout::New();
txn4Info.SetDirection(FlexDirection::COLUMN);
txn4Info.SetAlignItems(FlexAlign::FLEX_START);
txn4Info.SetRequestedWidth(1155.0f);
txn4Info.SetMargin(Extents(49, 0, 0, 0));
Label txn4Title = Label::New("Spotify");
txn4Title.SetFontSize(49);
txn4Title.SetTextColor(UiColor(0xffffff));
Label txn4Sub = Label::New("Subscription  ·  Apr 13");
txn4Sub.SetFontSize(39);
txn4Sub.SetTextColor(UiColor(0x5e6673));
txn4Sub.SetMargin(Extents(0, 0, 11, 0));
txn4Info.AddChildren({
    txn4Title,
    txn4Sub,
});
View txn4Spacer = View::New();
txn4Spacer.SetRequestedWidth(MATCH_PARENT);
txn4Spacer.SetRequestedHeight(3.5f);
FlexLayout txn4Amount = FlexLayout::New();
txn4Amount.SetDirection(FlexDirection::COLUMN);
txn4Amount.SetAlignItems(FlexAlign::FLEX_END);
Label txn4AmountValue = Label::New("-$9.99");
txn4AmountValue.SetFontSize(49);
txn4AmountValue.SetTextColor(UiColor(0xffffff));
Label txn4AmountStatus = Label::New("Recurring");
txn4AmountStatus.SetFontSize(35);
txn4AmountStatus.SetTextColor(UiColor(0x5e6673));
txn4AmountStatus.SetMargin(Extents(0, 0, 11, 0));
txn4Amount.AddChildren({
    txn4AmountValue,
    txn4AmountStatus,
});
txn4.AddChildren({
    txn4Icon,
    txn4Info,
    txn4Spacer,
    txn4Amount,
});
View divider4 = View::New();
divider4.SetBackgroundColor(UiColor(0x242c36));
divider4.SetRequestedHeight(3.5f);
divider4.SetMargin(Extents(56, 56, 0, 0));

// Txn 5
FlexLayout txn5 = FlexLayout::New();
txn5.SetDirection(FlexDirection::ROW);
txn5.SetAlignItems(FlexAlign::CENTER);
txn5.SetRequestedWidth(MATCH_PARENT);
txn5.SetRequestedHeight(245.0f);
txn5.SetPadding(Extents(56, 56, 0, 0));
FlexLayout txn5Icon = FlexLayout::New();
txn5Icon.SetDirection(FlexDirection::COLUMN);
txn5Icon.SetJustifyContent(FlexJustify::CENTER);
txn5Icon.SetAlignItems(FlexAlign::CENTER);
txn5Icon.SetRequestedWidth(147.0f);
txn5Icon.SetRequestedHeight(147.0f);
txn5Icon.SetBackgroundColor(UiColor(0x1f2730));
txn5Icon.SetCornerRadius(45.5f);
Label txn5IconGlyph = Label::New("◈");
txn5IconGlyph.SetFontSize(63);
txn5IconGlyph.SetTextColor(UiColor(0x000000));
txn5Icon.AddChildren({
    txn5IconGlyph,
});
FlexLayout txn5Info = FlexLayout::New();
txn5Info.SetDirection(FlexDirection::COLUMN);
txn5Info.SetAlignItems(FlexAlign::FLEX_START);
txn5Info.SetRequestedWidth(1155.0f);
txn5Info.SetMargin(Extents(49, 0, 0, 0));
Label txn5Title = Label::New("Uber");
txn5Title.SetFontSize(49);
txn5Title.SetTextColor(UiColor(0xffffff));
Label txn5Sub = Label::New("Transport  ·  Apr 13");
txn5Sub.SetFontSize(39);
txn5Sub.SetTextColor(UiColor(0x5e6673));
txn5Sub.SetMargin(Extents(0, 0, 11, 0));
txn5Info.AddChildren({
    txn5Title,
    txn5Sub,
});
View txn5Spacer = View::New();
txn5Spacer.SetRequestedWidth(MATCH_PARENT);
txn5Spacer.SetRequestedHeight(3.5f);
FlexLayout txn5Amount = FlexLayout::New();
txn5Amount.SetDirection(FlexDirection::COLUMN);
txn5Amount.SetAlignItems(FlexAlign::FLEX_END);
Label txn5AmountValue = Label::New("-$18.50");
txn5AmountValue.SetFontSize(49);
txn5AmountValue.SetTextColor(UiColor(0xffffff));
Label txn5AmountStatus = Label::New("Completed");
txn5AmountStatus.SetFontSize(35);
txn5AmountStatus.SetTextColor(UiColor(0x5e6673));
txn5AmountStatus.SetMargin(Extents(0, 0, 11, 0));
txn5Amount.AddChildren({
    txn5AmountValue,
    txn5AmountStatus,
});
txn5.AddChildren({
    txn5Icon,
    txn5Info,
    txn5Spacer,
    txn5Amount,
});
txnList.AddChildren({
    // Txn 1
    txn1,
    divider1,

    // Txn 2
    txn2,
    divider2,

    // Txn 3
    txn3,
    divider3,

    // Txn 4
    txn4,
    divider4,

    // Txn 5
    txn5,
});

View navSpacer = View::New();
navSpacer.SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f));

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
navHomeIcon.SetTextColor(UiColor(0x00d4a8));
Label navHomeLabel = Label::New("Home");
navHomeLabel.SetFontSize(35);
navHomeLabel.SetTextColor(UiColor(0x00d4a8));
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
navCardsIcon.SetTextColor(UiColor(0x5e6673));
Label navCardsLabel = Label::New("Cards");
navCardsLabel.SetFontSize(35);
navCardsLabel.SetTextColor(UiColor(0x5e6673));
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

    spacer1,

    // ========== BALANCE HERO CARD (TEAL) ==========
    balanceCard,

    spacer2,

    // ========== QUICK ACTIONS ==========
    quickActions,

    spacer3,

    // ========== RECENT TRANSACTIONS HEADER ==========
    txnHeader,

    spacer4,

    // ========== TRANSACTION LIST ==========
    txnList,

    navSpacer,

    // ========== BOTTOM NAV ==========
    bottomNav,
});
return root;
