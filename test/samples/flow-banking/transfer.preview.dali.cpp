// @preview-config: name="Flow Banking — Transfer", width=2520, height=4480
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

Label statusInfo = Label::New("●●●  5G  ▮ 86%");
statusInfo.SetFontSize(39);
statusInfo.SetTextColor(UiColor(0xffffff));
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
headerBack.SetFontSize(84);
headerBack.SetTextColor(UiColor(0xffffff));

Label headerTitle = Label::New("Send Money");
headerTitle.SetFontSize(56);
headerTitle.SetTextColor(UiColor(0xffffff));

Label headerMore = Label::New("⋯");
headerMore.SetFontSize(84);
headerMore.SetTextColor(UiColor(0xffffff));
header.AddChildren({
    headerBack,
    headerTitle,
    headerMore,
});

View spacer1 = View::New();
spacer1.SetRequestedHeight(72.8f);

// ========== AMOUNT HERO ==========
FlexLayout amountHero = FlexLayout::New();
amountHero.SetDirection(FlexDirection::COLUMN);
amountHero.SetAlignItems(FlexAlign::CENTER);
amountHero.SetRequestedWidth(MATCH_PARENT);

Label amountLabel = Label::New("YOU SEND");
amountLabel.SetFontSize(39);
amountLabel.SetTextColor(UiColor(0x5e6673));

Label amountValue = Label::New("<font size='105'><color value='#9ba1b0'>$</color></font><font size='287'><color value='#ffffff'>250</color></font><font size='133'><color value='#9ba1b0'>.00</color></font>");
amountValue.SetMarkupEnabled(true);
amountValue.SetMargin(Extents(0, 0, 28, 0));

Label amountConv = Label::New("≈ 229.14 EUR");
amountConv.SetFontSize(46);
amountConv.SetTextColor(UiColor(0x5e6673));
amountConv.SetMargin(Extents(0, 0, 28, 0));

View amountSpacer = View::New();
amountSpacer.SetRequestedHeight(36.4f);

FlexLayout noFeeBadge = FlexLayout::New();
noFeeBadge.SetDirection(FlexDirection::ROW);
noFeeBadge.SetJustifyContent(FlexJustify::CENTER);
noFeeBadge.SetAlignItems(FlexAlign::CENTER);
noFeeBadge.SetBackgroundColor(UiColor(0x0a3a33));
noFeeBadge.SetCornerRadius(56.0f);
noFeeBadge.SetPadding(Extents(49, 49, 25, 25));

Label noFeeLabel = Label::New("✓ No fee");
noFeeLabel.SetFontSize(39);
noFeeLabel.SetTextColor(UiColor(0x00d4a8));
noFeeBadge.AddChildren({ noFeeLabel });
amountHero.AddChildren({
    amountLabel,
    amountValue,
    amountConv,
    amountSpacer,
    noFeeBadge,
});

View spacer2 = View::New();
spacer2.SetRequestedHeight(118.3f);

// ========== FROM CARD SELECTOR ==========
FlexLayout fromCard = FlexLayout::New();
fromCard.SetDirection(FlexDirection::ROW);
fromCard.SetAlignItems(FlexAlign::CENTER);
fromCard.SetRequestedWidth(MATCH_PARENT);
fromCard.SetRequestedHeight(280.0f);
fromCard.SetBackgroundColor(UiColor(0x161c24));
fromCard.SetCornerRadius(70.0f);
fromCard.SetMargin(Extents(70, 70, 0, 0));
fromCard.SetPadding(Extents(56, 56, 0, 0));

FlexLayout fromBadge = FlexLayout::New();
fromBadge.SetDirection(FlexDirection::COLUMN);
fromBadge.SetJustifyContent(FlexJustify::CENTER);
fromBadge.SetAlignItems(FlexAlign::CENTER);
fromBadge.SetRequestedWidth(168.0f);
fromBadge.SetRequestedHeight(168.0f);
fromBadge.SetBackgroundColor(UiColor(0x00d4a8));
fromBadge.SetCornerRadius(49.0f);

Label fromBadgeLabel = Label::New("flow.");
fromBadgeLabel.SetFontSize(39);
fromBadgeLabel.SetTextColor(UiColor(0x0d1117));
fromBadge.AddChildren({ fromBadgeLabel });

FlexLayout fromInfo = FlexLayout::New();
fromInfo.SetDirection(FlexDirection::COLUMN);
fromInfo.SetAlignItems(FlexAlign::FLEX_START);
fromInfo.SetRequestedWidth(1260.0f);
fromInfo.SetMargin(Extents(49, 0, 0, 0));

Label fromInfoTitle = Label::New("FROM");
fromInfoTitle.SetFontSize(35);
fromInfoTitle.SetTextColor(UiColor(0x5e6673));

Label fromInfoCard = Label::New("Flow Debit · •••• 4821");
fromInfoCard.SetFontSize(49);
fromInfoCard.SetTextColor(UiColor(0xffffff));
fromInfoCard.SetMargin(Extents(0, 0, 11, 0));
fromInfo.AddChildren({
    fromInfoTitle,
    fromInfoCard,
});

View fromSpacer = View::New();
fromSpacer.SetRequestedWidth(MATCH_PARENT);
fromSpacer.SetRequestedHeight(3.5f);

FlexLayout fromBalance = FlexLayout::New();
fromBalance.SetDirection(FlexDirection::COLUMN);
fromBalance.SetAlignItems(FlexAlign::FLEX_END);

Label fromBalanceTitle = Label::New("BALANCE");
fromBalanceTitle.SetFontSize(35);
fromBalanceTitle.SetTextColor(UiColor(0x5e6673));

Label fromBalanceValue = Label::New("$12,486.92");
fromBalanceValue.SetFontSize(49);
fromBalanceValue.SetTextColor(UiColor(0xffffff));
fromBalanceValue.SetMargin(Extents(0, 0, 11, 0));
fromBalance.AddChildren({
    fromBalanceTitle,
    fromBalanceValue,
});
fromCard.AddChildren({
    fromBadge,
    fromInfo,
    fromSpacer,
    fromBalance,
});

View spacer3 = View::New();
spacer3.SetRequestedHeight(100.1f);

// ========== SEND TO HEADER ==========
FlexLayout sendToHeader = FlexLayout::New();
sendToHeader.SetDirection(FlexDirection::ROW);
sendToHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
sendToHeader.SetAlignItems(FlexAlign::CENTER);
sendToHeader.SetRequestedWidth(MATCH_PARENT);
sendToHeader.SetPadding(Extents(98, 98, 0, 0));

Label sendToLabel = Label::New("Send to");
sendToLabel.SetFontSize(49);
sendToLabel.SetTextColor(UiColor(0xffffff));

Label sendToNew = Label::New("+ New contact");
sendToNew.SetFontSize(39);
sendToNew.SetTextColor(UiColor(0x00d4a8));
sendToHeader.AddChildren({
    sendToLabel,
    sendToNew,
});

View spacer4 = View::New();
spacer4.SetRequestedHeight(63.7f);

// ========== CONTACTS ROW ==========
FlexLayout contactsRow = FlexLayout::New();
contactsRow.SetDirection(FlexDirection::ROW);
contactsRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
contactsRow.SetRequestedWidth(MATCH_PARENT);
contactsRow.SetPadding(Extents(84, 84, 0, 0));
// Add new slot
FlexLayout addSlot = FlexLayout::New();
addSlot.SetDirection(FlexDirection::COLUMN);
addSlot.SetAlignItems(FlexAlign::CENTER);
addSlot.SetRequestedWidth(336.0f);

FlexLayout addCircle = FlexLayout::New();
addCircle.SetDirection(FlexDirection::COLUMN);
addCircle.SetJustifyContent(FlexJustify::CENTER);
addCircle.SetAlignItems(FlexAlign::CENTER);
addCircle.SetRequestedWidth(224.0f);
addCircle.SetRequestedHeight(224.0f);
addCircle.SetBackgroundColor(UiColor(0x161c24));
addCircle.SetCornerRadius(112.0f);

Label addPlus = Label::New("+");
addPlus.SetFontSize(98);
addPlus.SetTextColor(UiColor(0x00d4a8));
addCircle.AddChildren({ addPlus });

Label addLabel = Label::New("Add");
addLabel.SetFontSize(39);
addLabel.SetTextColor(UiColor(0x5e6673));
addLabel.SetMargin(Extents(0, 0, 28, 0));
addSlot.AddChildren({
    addCircle,
    addLabel,
});
// Sarah (selected — teal ring)
FlexLayout sarahSlot = FlexLayout::New();
sarahSlot.SetDirection(FlexDirection::COLUMN);
sarahSlot.SetAlignItems(FlexAlign::CENTER);
sarahSlot.SetRequestedWidth(336.0f);

FlexLayout sarahRing = FlexLayout::New();
sarahRing.SetDirection(FlexDirection::COLUMN);
sarahRing.SetJustifyContent(FlexJustify::CENTER);
sarahRing.SetAlignItems(FlexAlign::CENTER);
sarahRing.SetRequestedWidth(252.0f);
sarahRing.SetRequestedHeight(252.0f);
sarahRing.SetBackgroundColor(UiColor(0x00d4a8));
sarahRing.SetCornerRadius(126.0f);

ImageView sarahImage = ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait2.jpg");
sarahImage.SetRequestedWidth(210.0f);
sarahImage.SetRequestedHeight(210.0f);
sarahImage.SetCornerRadius(105.0f);
sarahRing.AddChildren({ sarahImage });

Label sarahName = Label::New("Sarah");
sarahName.SetFontSize(39);
sarahName.SetTextColor(UiColor(0xffffff));
sarahName.SetMargin(Extents(0, 0, 21, 0));

Label sarahHandle = Label::New("@sarahm");
sarahHandle.SetFontSize(32);
sarahHandle.SetTextColor(UiColor(0x5e6673));
sarahHandle.SetMargin(Extents(0, 0, 7, 0));
sarahSlot.AddChildren({
    sarahRing,
    sarahName,
    sarahHandle,
});
// David
FlexLayout davidSlot = FlexLayout::New();
davidSlot.SetDirection(FlexDirection::COLUMN);
davidSlot.SetAlignItems(FlexAlign::CENTER);
davidSlot.SetRequestedWidth(336.0f);

ImageView davidImage = ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait3.jpg");
davidImage.SetRequestedWidth(224.0f);
davidImage.SetRequestedHeight(224.0f);
davidImage.SetCornerRadius(112.0f);

Label davidName = Label::New("David");
davidName.SetFontSize(39);
davidName.SetTextColor(UiColor(0xffffff));
davidName.SetMargin(Extents(0, 0, 28, 0));

Label davidHandle = Label::New("@dlee");
davidHandle.SetFontSize(32);
davidHandle.SetTextColor(UiColor(0x5e6673));
davidHandle.SetMargin(Extents(0, 0, 7, 0));
davidSlot.AddChildren({
    davidImage,
    davidName,
    davidHandle,
});
// Maya
FlexLayout mayaSlot = FlexLayout::New();
mayaSlot.SetDirection(FlexDirection::COLUMN);
mayaSlot.SetAlignItems(FlexAlign::CENTER);
mayaSlot.SetRequestedWidth(336.0f);

ImageView mayaImage = ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait4.jpg");
mayaImage.SetRequestedWidth(224.0f);
mayaImage.SetRequestedHeight(224.0f);
mayaImage.SetCornerRadius(112.0f);

Label mayaName = Label::New("Maya");
mayaName.SetFontSize(39);
mayaName.SetTextColor(UiColor(0xffffff));
mayaName.SetMargin(Extents(0, 0, 28, 0));

Label mayaHandle = Label::New("@mrossi");
mayaHandle.SetFontSize(32);
mayaHandle.SetTextColor(UiColor(0x5e6673));
mayaHandle.SetMargin(Extents(0, 0, 7, 0));
mayaSlot.AddChildren({
    mayaImage,
    mayaName,
    mayaHandle,
});
// Chris
FlexLayout chrisSlot = FlexLayout::New();
chrisSlot.SetDirection(FlexDirection::COLUMN);
chrisSlot.SetAlignItems(FlexAlign::CENTER);
chrisSlot.SetRequestedWidth(336.0f);

ImageView chrisImage = ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait5.jpg");
chrisImage.SetRequestedWidth(224.0f);
chrisImage.SetRequestedHeight(224.0f);
chrisImage.SetCornerRadius(112.0f);

Label chrisName = Label::New("Chris");
chrisName.SetFontSize(39);
chrisName.SetTextColor(UiColor(0xffffff));
chrisName.SetMargin(Extents(0, 0, 28, 0));

Label chrisHandle = Label::New("@cpark");
chrisHandle.SetFontSize(32);
chrisHandle.SetTextColor(UiColor(0x5e6673));
chrisHandle.SetMargin(Extents(0, 0, 7, 0));
chrisSlot.AddChildren({
    chrisImage,
    chrisName,
    chrisHandle,
});
contactsRow.AddChildren({
    addSlot,
    sarahSlot,
    davidSlot,
    mayaSlot,
    chrisSlot,
});

View spacer5 = View::New();
spacer5.SetRequestedHeight(100.1f);

// ========== NOTE FIELD ==========
FlexLayout noteField = FlexLayout::New();
noteField.SetDirection(FlexDirection::ROW);
noteField.SetAlignItems(FlexAlign::CENTER);
noteField.SetRequestedWidth(MATCH_PARENT);
noteField.SetRequestedHeight(196.0f);
noteField.SetBackgroundColor(UiColor(0x161c24));
noteField.SetCornerRadius(56.0f);
noteField.SetMargin(Extents(70, 70, 0, 0));
noteField.SetPadding(Extents(56, 56, 0, 0));

Label noteIcon = Label::New("✎");
noteIcon.SetFontSize(63);
noteIcon.SetTextColor(UiColor(0x5e6673));

Label noteText = Label::New("Dinner split — thanks!");
noteText.SetFontSize(49);
noteText.SetTextColor(UiColor(0xffffff));
noteText.SetMargin(Extents(49, 0, 0, 0));
noteField.AddChildren({
    noteIcon,
    noteText,
});

View spacer6 = View::New();
spacer6.SetRequestedHeight(91.0f);

// ========== PAYMENT METHOD HEADER ==========
Label paymentHeader = Label::New("Payment method");
paymentHeader.SetFontSize(49);
paymentHeader.SetTextColor(UiColor(0xffffff));
paymentHeader.SetMargin(Extents(98, 0, 0, 0));

View spacer7 = View::New();
spacer7.SetRequestedHeight(54.6f);

// ========== PAYMENT METHOD PILLS ==========
FlexLayout paymentPills = FlexLayout::New();
paymentPills.SetDirection(FlexDirection::ROW);
paymentPills.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
paymentPills.SetRequestedWidth(MATCH_PARENT);
paymentPills.SetPadding(Extents(70, 70, 0, 0));

FlexLayout instantPill = FlexLayout::New();
instantPill.SetDirection(FlexDirection::ROW);
instantPill.SetAlignItems(FlexAlign::CENTER);
instantPill.SetRequestedWidth(752.5f);
instantPill.SetRequestedHeight(210.0f);
instantPill.SetBackgroundColor(UiColor(0x00d4a8));
instantPill.SetCornerRadius(56.0f);
instantPill.SetPadding(Extents(49, 49, 0, 0));

Label instantIcon = Label::New("⚡");
instantIcon.SetFontSize(70);
instantIcon.SetTextColor(UiColor(0x0d1117));

FlexLayout instantText = FlexLayout::New();
instantText.SetDirection(FlexDirection::COLUMN);
instantText.SetAlignItems(FlexAlign::FLEX_START);
instantText.SetMargin(Extents(35, 0, 0, 0));

Label instantTitle = Label::New("Instant");
instantTitle.SetFontSize(42);
instantTitle.SetTextColor(UiColor(0x0d1117));

Label instantSub = Label::New("Free, 1 sec");
instantSub.SetFontSize(35);
instantSub.SetTextColor(UiColor(0x0a3a33));
instantSub.SetMargin(Extents(0, 0, 7, 0));
instantText.AddChildren({
    instantTitle,
    instantSub,
});
instantPill.AddChildren({
    instantIcon,
    instantText,
});

FlexLayout standardPill = FlexLayout::New();
standardPill.SetDirection(FlexDirection::ROW);
standardPill.SetAlignItems(FlexAlign::CENTER);
standardPill.SetRequestedWidth(752.5f);
standardPill.SetRequestedHeight(210.0f);
standardPill.SetBackgroundColor(UiColor(0x161c24));
standardPill.SetCornerRadius(56.0f);
standardPill.SetPadding(Extents(49, 49, 0, 0));

Label standardIcon = Label::New("◉");
standardIcon.SetFontSize(70);
standardIcon.SetTextColor(UiColor(0x9ba1b0));

FlexLayout standardText = FlexLayout::New();
standardText.SetDirection(FlexDirection::COLUMN);
standardText.SetAlignItems(FlexAlign::FLEX_START);
standardText.SetMargin(Extents(35, 0, 0, 0));

Label standardTitle = Label::New("Standard");
standardTitle.SetFontSize(42);
standardTitle.SetTextColor(UiColor(0xffffff));

Label standardSub = Label::New("1–2 days");
standardSub.SetFontSize(35);
standardSub.SetTextColor(UiColor(0x5e6673));
standardSub.SetMargin(Extents(0, 0, 7, 0));
standardText.AddChildren({
    standardTitle,
    standardSub,
});
standardPill.AddChildren({
    standardIcon,
    standardText,
});

FlexLayout wirePill = FlexLayout::New();
wirePill.SetDirection(FlexDirection::ROW);
wirePill.SetAlignItems(FlexAlign::CENTER);
wirePill.SetRequestedWidth(752.5f);
wirePill.SetRequestedHeight(210.0f);
wirePill.SetBackgroundColor(UiColor(0x161c24));
wirePill.SetCornerRadius(56.0f);
wirePill.SetPadding(Extents(49, 49, 0, 0));

Label wireIcon = Label::New("◎");
wireIcon.SetFontSize(70);
wireIcon.SetTextColor(UiColor(0x9ba1b0));

FlexLayout wireText = FlexLayout::New();
wireText.SetDirection(FlexDirection::COLUMN);
wireText.SetAlignItems(FlexAlign::FLEX_START);
wireText.SetMargin(Extents(35, 0, 0, 0));

Label wireTitle = Label::New("Wire");
wireTitle.SetFontSize(42);
wireTitle.SetTextColor(UiColor(0xffffff));

Label wireSub = Label::New("$15 fee");
wireSub.SetFontSize(35);
wireSub.SetTextColor(UiColor(0x5e6673));
wireSub.SetMargin(Extents(0, 0, 7, 0));
wireText.AddChildren({
    wireTitle,
    wireSub,
});
wirePill.AddChildren({
    wireIcon,
    wireText,
});
paymentPills.AddChildren({
    instantPill,
    standardPill,
    wirePill,
});

View spacer8 = View::New();
spacer8.SetRequestedHeight(100.1f);

// ========== SUMMARY CARD ==========
FlexLayout summaryCard = FlexLayout::New();
summaryCard.SetDirection(FlexDirection::COLUMN);
summaryCard.SetRequestedWidth(MATCH_PARENT);
summaryCard.SetBackgroundColor(UiColor(0x161c24));
summaryCard.SetCornerRadius(70.0f);
summaryCard.SetMargin(Extents(70, 70, 0, 0));
summaryCard.SetPadding(Extents(70, 70, 56, 56));

FlexLayout summaryAmountRow = FlexLayout::New();
summaryAmountRow.SetDirection(FlexDirection::ROW);
summaryAmountRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
summaryAmountRow.SetRequestedWidth(MATCH_PARENT);

Label summaryAmountLabel = Label::New("Amount");
summaryAmountLabel.SetFontSize(46);
summaryAmountLabel.SetTextColor(UiColor(0x9ba1b0));

Label summaryAmountValue = Label::New("$250.00");
summaryAmountValue.SetFontSize(46);
summaryAmountValue.SetTextColor(UiColor(0xffffff));
summaryAmountRow.AddChildren({
    summaryAmountLabel,
    summaryAmountValue,
});

View summarySpacer1 = View::New();
summarySpacer1.SetRequestedHeight(36.4f);

FlexLayout summaryFeeRow = FlexLayout::New();
summaryFeeRow.SetDirection(FlexDirection::ROW);
summaryFeeRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
summaryFeeRow.SetRequestedWidth(MATCH_PARENT);

Label summaryFeeLabel = Label::New("Fee");
summaryFeeLabel.SetFontSize(46);
summaryFeeLabel.SetTextColor(UiColor(0x9ba1b0));

Label summaryFeeValue = Label::New("$0.00");
summaryFeeValue.SetFontSize(46);
summaryFeeValue.SetTextColor(UiColor(0x22c55e));
summaryFeeRow.AddChildren({
    summaryFeeLabel,
    summaryFeeValue,
});

View summarySpacer2 = View::New();
summarySpacer2.SetRequestedHeight(45.5f);

View summaryDivider = View::New();
summaryDivider.SetBackgroundColor(UiColor(0x242c36));
summaryDivider.SetRequestedWidth(MATCH_PARENT);
summaryDivider.SetRequestedHeight(3.5f);

View summarySpacer3 = View::New();
summarySpacer3.SetRequestedHeight(45.5f);

FlexLayout summaryTotalRow = FlexLayout::New();
summaryTotalRow.SetDirection(FlexDirection::ROW);
summaryTotalRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
summaryTotalRow.SetAlignItems(FlexAlign::CENTER);
summaryTotalRow.SetRequestedWidth(MATCH_PARENT);

Label summaryTotalLabel = Label::New("Total");
summaryTotalLabel.SetFontSize(53);
summaryTotalLabel.SetTextColor(UiColor(0xffffff));

Label summaryTotalValue = Label::New("$250.00");
summaryTotalValue.SetFontSize(60);
summaryTotalValue.SetTextColor(UiColor(0x00d4a8));
summaryTotalRow.AddChildren({
    summaryTotalLabel,
    summaryTotalValue,
});
summaryCard.AddChildren({
    summaryAmountRow,
    summarySpacer1,
    summaryFeeRow,
    summarySpacer2,
    summaryDivider,
    summarySpacer3,
    summaryTotalRow,
});

View spacer9 = View::New();
spacer9.SetRequestedHeight(81.9f);

// ========== CTA SEND BUTTON ==========
FlexLayout ctaButton = FlexLayout::New();
ctaButton.SetDirection(FlexDirection::ROW);
ctaButton.SetJustifyContent(FlexJustify::CENTER);
ctaButton.SetAlignItems(FlexAlign::CENTER);
ctaButton.SetRequestedWidth(MATCH_PARENT);
ctaButton.SetRequestedHeight(210.0f);
ctaButton.SetBackgroundColor(UiColor(0x00d4a8));
ctaButton.SetCornerRadius(70.0f);
ctaButton.SetMargin(Extents(70, 70, 0, 0));

Label ctaLabel = Label::New("Send $250.00  →");
ctaLabel.SetFontSize(56);
ctaLabel.SetTextColor(UiColor(0x0d1117));
ctaButton.AddChildren({ ctaLabel });

View ctaFlexSpacer = View::New();
ctaFlexSpacer.SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f));

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
navTransferIcon.SetTextColor(UiColor(0x00d4a8));

Label navTransferLabel = Label::New("Transfer");
navTransferLabel.SetFontSize(35);
navTransferLabel.SetTextColor(UiColor(0x00d4a8));
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
    statusBar,
    header,
    spacer1,
    amountHero,
    spacer2,
    fromCard,
    spacer3,
    sendToHeader,
    spacer4,
    contactsRow,
    spacer5,
    noteField,
    spacer6,
    paymentHeader,
    spacer7,
    paymentPills,
    spacer8,
    summaryCard,
    spacer9,
    ctaButton,
    ctaFlexSpacer,
    bottomNav,
});

return root;
