// @preview-config: name="Crypto Portfolio", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0e0f1a));

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
Label statusSignal = Label::New("●●●  5G  ▮ 76%");
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
header.SetRequestedHeight(224.0f);
header.SetPadding(Extents(98, 98, 28, 0));
Label headerTitle = Label::New("Portfolio");
headerTitle.SetFontSize(84);
headerTitle.SetTextColor(UiColor(0xffffff));
ImageView headerAvatar = ImageView::New("/home/woochan/tizen/paperclip/test/samples/assets/portrait2.jpg");
headerAvatar.SetRequestedWidth(154.0f);
headerAvatar.SetRequestedHeight(154.0f);
headerAvatar.SetCornerRadius(77.0f);
header.AddChildren({
    headerTitle,
    headerAvatar,
});

// ========== BALANCE HERO ==========
FlexLayout balanceHero = FlexLayout::New();
balanceHero.SetDirection(FlexDirection::COLUMN);
balanceHero.SetAlignItems(FlexAlign::FLEX_START);
balanceHero.SetRequestedWidth(MATCH_PARENT);
balanceHero.SetPadding(Extents(98, 98, 42, 0));
Label balanceLabel = Label::New("TOTAL BALANCE");
balanceLabel.SetFontSize(39);
balanceLabel.SetTextColor(UiColor(0x6b7190));
Label balanceAmount = Label::New("<font size='91'><color value='#ffffff'>$</color></font><font size='210'><color value='#ffffff'>48,327</color></font><font size='91'><color value='#6b7190'>.94</color></font>");
balanceAmount.SetMarkupEnabled(true);
balanceAmount.SetMargin(Extents(0, 0, 21, 0));
FlexLayout balanceChangeRow = FlexLayout::New();
balanceChangeRow.SetDirection(FlexDirection::ROW);
balanceChangeRow.SetAlignItems(FlexAlign::CENTER);
balanceChangeRow.SetMargin(Extents(0, 0, 35, 0));
FlexLayout balanceChangePill = FlexLayout::New();
balanceChangePill.SetDirection(FlexDirection::ROW);
balanceChangePill.SetJustifyContent(FlexJustify::CENTER);
balanceChangePill.SetAlignItems(FlexAlign::CENTER);
balanceChangePill.SetBackgroundColor(UiColor(0x0d3a22));
balanceChangePill.SetCornerRadius(49.0f);
balanceChangePill.SetPadding(Extents(42, 42, 21, 21));
Label balanceChangePct = Label::New("▲ 4.82%");
balanceChangePct.SetFontSize(42);
balanceChangePct.SetTextColor(UiColor(0x22c55e));
balanceChangePill.AddChildren({
    balanceChangePct,
});
Label balanceChangeToday = Label::New("+$2,218.55 today");
balanceChangeToday.SetFontSize(42);
balanceChangeToday.SetTextColor(UiColor(0x9ca3af));
balanceChangeToday.SetMargin(Extents(42, 0, 0, 0));
balanceChangeRow.AddChildren({
    balanceChangePill,
    balanceChangeToday,
});
balanceHero.AddChildren({
    balanceLabel,
    balanceAmount,
    balanceChangeRow,
});

View spacer1 = View::New();
spacer1.SetRequestedHeight(81.9f);

// ========== FAKE CHART CARD ==========
FlexLayout chartCard = FlexLayout::New();
chartCard.SetDirection(FlexDirection::COLUMN);
chartCard.SetRequestedWidth(MATCH_PARENT);
chartCard.SetBackgroundColor(UiColor(0x141628));
chartCard.SetCornerRadius(70.0f);
chartCard.SetMargin(Extents(70, 70, 0, 0));
chartCard.SetPadding(Extents(56, 56, 56, 49));
// Chart bars
FlexLayout chartBars = FlexLayout::New();
chartBars.SetDirection(FlexDirection::ROW);
chartBars.SetAlignItems(FlexAlign::FLEX_END);
chartBars.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
chartBars.SetRequestedWidth(MATCH_PARENT);
chartBars.SetRequestedHeight(420.0f);
View bar1 = View::New(); bar1.SetBackgroundColor(UiColor(0x22c55e)); bar1.SetRequestedWidth(28.0f); bar1.SetRequestedHeight(140.0f); bar1.SetCornerRadius(10.5f);
View bar2 = View::New(); bar2.SetBackgroundColor(UiColor(0x22c55e)); bar2.SetRequestedWidth(28.0f); bar2.SetRequestedHeight(154.0f); bar2.SetCornerRadius(10.5f);
View bar3 = View::New(); bar3.SetBackgroundColor(UiColor(0x22c55e)); bar3.SetRequestedWidth(28.0f); bar3.SetRequestedHeight(133.0f); bar3.SetCornerRadius(10.5f);
View bar4 = View::New(); bar4.SetBackgroundColor(UiColor(0x22c55e)); bar4.SetRequestedWidth(28.0f); bar4.SetRequestedHeight(168.0f); bar4.SetCornerRadius(10.5f);
View bar5 = View::New(); bar5.SetBackgroundColor(UiColor(0x22c55e)); bar5.SetRequestedWidth(28.0f); bar5.SetRequestedHeight(182.0f); bar5.SetCornerRadius(10.5f);
View bar6 = View::New(); bar6.SetBackgroundColor(UiColor(0x22c55e)); bar6.SetRequestedWidth(28.0f); bar6.SetRequestedHeight(196.0f); bar6.SetCornerRadius(10.5f);
View bar7 = View::New(); bar7.SetBackgroundColor(UiColor(0x22c55e)); bar7.SetRequestedWidth(28.0f); bar7.SetRequestedHeight(175.0f); bar7.SetCornerRadius(10.5f);
View bar8 = View::New(); bar8.SetBackgroundColor(UiColor(0x22c55e)); bar8.SetRequestedWidth(28.0f); bar8.SetRequestedHeight(203.0f); bar8.SetCornerRadius(10.5f);
View bar9 = View::New(); bar9.SetBackgroundColor(UiColor(0x22c55e)); bar9.SetRequestedWidth(28.0f); bar9.SetRequestedHeight(224.0f); bar9.SetCornerRadius(10.5f);
View bar10 = View::New(); bar10.SetBackgroundColor(UiColor(0x22c55e)); bar10.SetRequestedWidth(28.0f); bar10.SetRequestedHeight(238.0f); bar10.SetCornerRadius(10.5f);
View bar11 = View::New(); bar11.SetBackgroundColor(UiColor(0x22c55e)); bar11.SetRequestedWidth(28.0f); bar11.SetRequestedHeight(217.0f); bar11.SetCornerRadius(10.5f);
View bar12 = View::New(); bar12.SetBackgroundColor(UiColor(0x22c55e)); bar12.SetRequestedWidth(28.0f); bar12.SetRequestedHeight(252.0f); bar12.SetCornerRadius(10.5f);
View bar13 = View::New(); bar13.SetBackgroundColor(UiColor(0x22c55e)); bar13.SetRequestedWidth(28.0f); bar13.SetRequestedHeight(266.0f); bar13.SetCornerRadius(10.5f);
View bar14 = View::New(); bar14.SetBackgroundColor(UiColor(0x22c55e)); bar14.SetRequestedWidth(28.0f); bar14.SetRequestedHeight(245.0f); bar14.SetCornerRadius(10.5f);
View bar15 = View::New(); bar15.SetBackgroundColor(UiColor(0x22c55e)); bar15.SetRequestedWidth(28.0f); bar15.SetRequestedHeight(287.0f); bar15.SetCornerRadius(10.5f);
View bar16 = View::New(); bar16.SetBackgroundColor(UiColor(0x22c55e)); bar16.SetRequestedWidth(28.0f); bar16.SetRequestedHeight(301.0f); bar16.SetCornerRadius(10.5f);
View bar17 = View::New(); bar17.SetBackgroundColor(UiColor(0x22c55e)); bar17.SetRequestedWidth(28.0f); bar17.SetRequestedHeight(280.0f); bar17.SetCornerRadius(10.5f);
View bar18 = View::New(); bar18.SetBackgroundColor(UiColor(0x22c55e)); bar18.SetRequestedWidth(28.0f); bar18.SetRequestedHeight(322.0f); bar18.SetCornerRadius(10.5f);
View bar19 = View::New(); bar19.SetBackgroundColor(UiColor(0x22c55e)); bar19.SetRequestedWidth(28.0f); bar19.SetRequestedHeight(336.0f); bar19.SetCornerRadius(10.5f);
View bar20 = View::New(); bar20.SetBackgroundColor(UiColor(0x22c55e)); bar20.SetRequestedWidth(28.0f); bar20.SetRequestedHeight(315.0f); bar20.SetCornerRadius(10.5f);
View bar21 = View::New(); bar21.SetBackgroundColor(UiColor(0x22c55e)); bar21.SetRequestedWidth(28.0f); bar21.SetRequestedHeight(350.0f); bar21.SetCornerRadius(10.5f);
View bar22 = View::New(); bar22.SetBackgroundColor(UiColor(0x22c55e)); bar22.SetRequestedWidth(28.0f); bar22.SetRequestedHeight(364.0f); bar22.SetCornerRadius(10.5f);
View bar23 = View::New(); bar23.SetBackgroundColor(UiColor(0x22c55e)); bar23.SetRequestedWidth(28.0f); bar23.SetRequestedHeight(343.0f); bar23.SetCornerRadius(10.5f);
View bar24 = View::New(); bar24.SetBackgroundColor(UiColor(0x22c55e)); bar24.SetRequestedWidth(28.0f); bar24.SetRequestedHeight(385.0f); bar24.SetCornerRadius(10.5f);
View bar25 = View::New(); bar25.SetBackgroundColor(UiColor(0x22c55e)); bar25.SetRequestedWidth(28.0f); bar25.SetRequestedHeight(399.0f); bar25.SetCornerRadius(10.5f);
View bar26 = View::New(); bar26.SetBackgroundColor(UiColor(0x22c55e)); bar26.SetRequestedWidth(28.0f); bar26.SetRequestedHeight(378.0f); bar26.SetCornerRadius(10.5f);
View bar27 = View::New(); bar27.SetBackgroundColor(UiColor(0x22c55e)); bar27.SetRequestedWidth(28.0f); bar27.SetRequestedHeight(413.0f); bar27.SetCornerRadius(10.5f);
View bar28 = View::New(); bar28.SetBackgroundColor(UiColor(0x22c55e)); bar28.SetRequestedWidth(28.0f); bar28.SetRequestedHeight(420.0f); bar28.SetCornerRadius(10.5f);
chartBars.AddChildren({
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
});

View chartSpacer = View::New();
chartSpacer.SetRequestedHeight(63.7f);

// Time range pills
FlexLayout timeRangePills = FlexLayout::New();
timeRangePills.SetDirection(FlexDirection::ROW);
timeRangePills.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
timeRangePills.SetRequestedWidth(MATCH_PARENT);
FlexLayout pill1H = FlexLayout::New(); pill1H.SetDirection(FlexDirection::ROW); pill1H.SetJustifyContent(FlexJustify::CENTER); pill1H.SetAlignItems(FlexAlign::CENTER); pill1H.SetBackgroundColor(UiColor(0x1a1d30)); pill1H.SetCornerRadius(42.0f); pill1H.SetPadding(Extents(56, 56, 21, 21));
Label pill1HLabel = Label::New("1H"); pill1HLabel.SetFontSize(39); pill1HLabel.SetTextColor(UiColor(0x6b7190));
pill1H.AddChildren({
    pill1HLabel,
});
FlexLayout pill1D = FlexLayout::New(); pill1D.SetDirection(FlexDirection::ROW); pill1D.SetJustifyContent(FlexJustify::CENTER); pill1D.SetAlignItems(FlexAlign::CENTER); pill1D.SetBackgroundColor(UiColor(0x1a1d30)); pill1D.SetCornerRadius(42.0f); pill1D.SetPadding(Extents(56, 56, 21, 21));
Label pill1DLabel = Label::New("1D"); pill1DLabel.SetFontSize(39); pill1DLabel.SetTextColor(UiColor(0x6b7190));
pill1D.AddChildren({
    pill1DLabel,
});
FlexLayout pill1W = FlexLayout::New(); pill1W.SetDirection(FlexDirection::ROW); pill1W.SetJustifyContent(FlexJustify::CENTER); pill1W.SetAlignItems(FlexAlign::CENTER); pill1W.SetBackgroundColor(UiColor(0x7c3aed)); pill1W.SetCornerRadius(42.0f); pill1W.SetPadding(Extents(56, 56, 21, 21));
Label pill1WLabel = Label::New("1W"); pill1WLabel.SetFontSize(39); pill1WLabel.SetTextColor(UiColor(0xffffff));
pill1W.AddChildren({
    pill1WLabel,
});
FlexLayout pill1M = FlexLayout::New(); pill1M.SetDirection(FlexDirection::ROW); pill1M.SetJustifyContent(FlexJustify::CENTER); pill1M.SetAlignItems(FlexAlign::CENTER); pill1M.SetBackgroundColor(UiColor(0x1a1d30)); pill1M.SetCornerRadius(42.0f); pill1M.SetPadding(Extents(56, 56, 21, 21));
Label pill1MLabel = Label::New("1M"); pill1MLabel.SetFontSize(39); pill1MLabel.SetTextColor(UiColor(0x6b7190));
pill1M.AddChildren({
    pill1MLabel,
});
FlexLayout pill1Y = FlexLayout::New(); pill1Y.SetDirection(FlexDirection::ROW); pill1Y.SetJustifyContent(FlexJustify::CENTER); pill1Y.SetAlignItems(FlexAlign::CENTER); pill1Y.SetBackgroundColor(UiColor(0x1a1d30)); pill1Y.SetCornerRadius(42.0f); pill1Y.SetPadding(Extents(56, 56, 21, 21));
Label pill1YLabel = Label::New("1Y"); pill1YLabel.SetFontSize(39); pill1YLabel.SetTextColor(UiColor(0x6b7190));
pill1Y.AddChildren({
    pill1YLabel,
});
FlexLayout pillAll = FlexLayout::New(); pillAll.SetDirection(FlexDirection::ROW); pillAll.SetJustifyContent(FlexJustify::CENTER); pillAll.SetAlignItems(FlexAlign::CENTER); pillAll.SetBackgroundColor(UiColor(0x1a1d30)); pillAll.SetCornerRadius(42.0f); pillAll.SetPadding(Extents(56, 56, 21, 21));
Label pillAllLabel = Label::New("ALL"); pillAllLabel.SetFontSize(39); pillAllLabel.SetTextColor(UiColor(0x6b7190));
pillAll.AddChildren({
    pillAllLabel,
});
timeRangePills.AddChildren({
    pill1H,
    pill1D,
    pill1W,
    pill1M,
    pill1Y,
    pillAll,
});
chartCard.AddChildren({
    chartBars,
    chartSpacer,
    timeRangePills,
});

View spacer2 = View::New();
spacer2.SetRequestedHeight(72.8f);

// ========== QUICK ACTIONS ==========
FlexLayout quickActions = FlexLayout::New();
quickActions.SetDirection(FlexDirection::ROW);
quickActions.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
quickActions.SetRequestedWidth(MATCH_PARENT);
quickActions.SetPadding(Extents(70, 70, 0, 0));
FlexLayout actionSend = FlexLayout::New(); actionSend.SetDirection(FlexDirection::COLUMN); actionSend.SetJustifyContent(FlexJustify::CENTER); actionSend.SetAlignItems(FlexAlign::CENTER); actionSend.SetRequestedWidth(525.0f); actionSend.SetRequestedHeight(266.0f); actionSend.SetBackgroundColor(UiColor(0x141628)); actionSend.SetCornerRadius(56.0f);
Label actionSendIcon = Label::New("↑"); actionSendIcon.SetFontSize(77); actionSendIcon.SetTextColor(UiColor(0x7c3aed));
Label actionSendLabel = Label::New("Send"); actionSendLabel.SetFontSize(42); actionSendLabel.SetTextColor(UiColor(0xffffff)); actionSendLabel.SetMargin(Extents(0, 0, 21, 0));
actionSend.AddChildren({
    actionSendIcon,
    actionSendLabel,
});
FlexLayout actionReceive = FlexLayout::New(); actionReceive.SetDirection(FlexDirection::COLUMN); actionReceive.SetJustifyContent(FlexJustify::CENTER); actionReceive.SetAlignItems(FlexAlign::CENTER); actionReceive.SetRequestedWidth(525.0f); actionReceive.SetRequestedHeight(266.0f); actionReceive.SetBackgroundColor(UiColor(0x141628)); actionReceive.SetCornerRadius(56.0f);
Label actionReceiveIcon = Label::New("↓"); actionReceiveIcon.SetFontSize(77); actionReceiveIcon.SetTextColor(UiColor(0x7c3aed));
Label actionReceiveLabel = Label::New("Receive"); actionReceiveLabel.SetFontSize(42); actionReceiveLabel.SetTextColor(UiColor(0xffffff)); actionReceiveLabel.SetMargin(Extents(0, 0, 21, 0));
actionReceive.AddChildren({
    actionReceiveIcon,
    actionReceiveLabel,
});
FlexLayout actionSwap = FlexLayout::New(); actionSwap.SetDirection(FlexDirection::COLUMN); actionSwap.SetJustifyContent(FlexJustify::CENTER); actionSwap.SetAlignItems(FlexAlign::CENTER); actionSwap.SetRequestedWidth(525.0f); actionSwap.SetRequestedHeight(266.0f); actionSwap.SetBackgroundColor(UiColor(0x141628)); actionSwap.SetCornerRadius(56.0f);
Label actionSwapIcon = Label::New("⇄"); actionSwapIcon.SetFontSize(77); actionSwapIcon.SetTextColor(UiColor(0x7c3aed));
Label actionSwapLabel = Label::New("Swap"); actionSwapLabel.SetFontSize(42); actionSwapLabel.SetTextColor(UiColor(0xffffff)); actionSwapLabel.SetMargin(Extents(0, 0, 21, 0));
actionSwap.AddChildren({
    actionSwapIcon,
    actionSwapLabel,
});
FlexLayout actionBuy = FlexLayout::New(); actionBuy.SetDirection(FlexDirection::COLUMN); actionBuy.SetJustifyContent(FlexJustify::CENTER); actionBuy.SetAlignItems(FlexAlign::CENTER); actionBuy.SetRequestedWidth(525.0f); actionBuy.SetRequestedHeight(266.0f); actionBuy.SetBackgroundColor(UiColor(0x141628)); actionBuy.SetCornerRadius(56.0f);
Label actionBuyIcon = Label::New("+"); actionBuyIcon.SetFontSize(84); actionBuyIcon.SetTextColor(UiColor(0x7c3aed));
Label actionBuyLabel = Label::New("Buy"); actionBuyLabel.SetFontSize(42); actionBuyLabel.SetTextColor(UiColor(0xffffff)); actionBuyLabel.SetMargin(Extents(0, 0, 21, 0));
actionBuy.AddChildren({
    actionBuyIcon,
    actionBuyLabel,
});
quickActions.AddChildren({
    actionSend,
    actionReceive,
    actionSwap,
    actionBuy,
});

View spacer3 = View::New();
spacer3.SetRequestedHeight(100.1f);

// ========== YOUR ASSETS HEADER ==========
FlexLayout assetsHeader = FlexLayout::New();
assetsHeader.SetDirection(FlexDirection::ROW);
assetsHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
assetsHeader.SetAlignItems(FlexAlign::CENTER);
assetsHeader.SetRequestedWidth(MATCH_PARENT);
assetsHeader.SetPadding(Extents(98, 98, 0, 0));
Label assetsTitle = Label::New("Your Assets");
assetsTitle.SetFontSize(63);
assetsTitle.SetTextColor(UiColor(0xffffff));
Label assetsSeeAll = Label::New("See all →");
assetsSeeAll.SetFontSize(42);
assetsSeeAll.SetTextColor(UiColor(0x7c3aed));
assetsHeader.AddChildren({
    assetsTitle,
    assetsSeeAll,
});

View spacer4 = View::New();
spacer4.SetRequestedHeight(45.5f);

// ========== ASSET ROW: BTC ==========
FlexLayout btcRow = FlexLayout::New();
btcRow.SetDirection(FlexDirection::ROW);
btcRow.SetAlignItems(FlexAlign::CENTER);
btcRow.SetRequestedWidth(MATCH_PARENT);
btcRow.SetRequestedHeight(266.0f);
btcRow.SetBackgroundColor(UiColor(0x141628));
btcRow.SetCornerRadius(56.0f);
btcRow.SetMargin(Extents(70, 70, 0, 35));
btcRow.SetPadding(Extents(56, 56, 0, 0));
FlexLayout btcIcon = FlexLayout::New(); btcIcon.SetDirection(FlexDirection::COLUMN); btcIcon.SetJustifyContent(FlexJustify::CENTER); btcIcon.SetAlignItems(FlexAlign::CENTER); btcIcon.SetRequestedWidth(154.0f); btcIcon.SetRequestedHeight(154.0f); btcIcon.SetBackgroundColor(UiColor(0x3a2510)); btcIcon.SetCornerRadius(77.0f);
Label btcIconLabel = Label::New("BTC"); btcIconLabel.SetFontSize(39); btcIconLabel.SetTextColor(UiColor(0xf7931a));
btcIcon.AddChildren({
    btcIconLabel,
});
FlexLayout btcInfo = FlexLayout::New(); btcInfo.SetDirection(FlexDirection::COLUMN); btcInfo.SetAlignItems(FlexAlign::FLEX_START); btcInfo.SetRequestedWidth(910.0f); btcInfo.SetMargin(Extents(49, 0, 0, 0));
Label btcName = Label::New("Bitcoin"); btcName.SetFontSize(53); btcName.SetTextColor(UiColor(0xffffff));
Label btcTicker = Label::New("BTC · $67,420"); btcTicker.SetFontSize(42); btcTicker.SetTextColor(UiColor(0x9ca3af)); btcTicker.SetMargin(Extents(0, 0, 11, 0));
btcInfo.AddChildren({
    btcName,
    btcTicker,
});
View btcSpacer = View::New(); btcSpacer.SetRequestedWidth(MATCH_PARENT); btcSpacer.SetRequestedHeight(3.5f);
FlexLayout btcValue = FlexLayout::New(); btcValue.SetDirection(FlexDirection::COLUMN); btcValue.SetAlignItems(FlexAlign::FLEX_END);
Label btcAmount = Label::New("$28,104.20"); btcAmount.SetFontSize(53); btcAmount.SetTextColor(UiColor(0xffffff));
Label btcChange = Label::New("▲ 3.42%"); btcChange.SetFontSize(42); btcChange.SetTextColor(UiColor(0x22c55e)); btcChange.SetMargin(Extents(0, 0, 11, 0));
btcValue.AddChildren({
    btcAmount,
    btcChange,
});
btcRow.AddChildren({
    btcIcon,
    btcInfo,
    btcSpacer,
    btcValue,
});

// ========== ASSET ROW: ETH ==========
FlexLayout ethRow = FlexLayout::New();
ethRow.SetDirection(FlexDirection::ROW);
ethRow.SetAlignItems(FlexAlign::CENTER);
ethRow.SetRequestedWidth(MATCH_PARENT);
ethRow.SetRequestedHeight(266.0f);
ethRow.SetBackgroundColor(UiColor(0x141628));
ethRow.SetCornerRadius(56.0f);
ethRow.SetMargin(Extents(70, 70, 0, 35));
ethRow.SetPadding(Extents(56, 56, 0, 0));
FlexLayout ethIcon = FlexLayout::New(); ethIcon.SetDirection(FlexDirection::COLUMN); ethIcon.SetJustifyContent(FlexJustify::CENTER); ethIcon.SetAlignItems(FlexAlign::CENTER); ethIcon.SetRequestedWidth(154.0f); ethIcon.SetRequestedHeight(154.0f); ethIcon.SetBackgroundColor(UiColor(0x181e3a)); ethIcon.SetCornerRadius(77.0f);
Label ethIconLabel = Label::New("ETH"); ethIconLabel.SetFontSize(39); ethIconLabel.SetTextColor(UiColor(0x8faee5));
ethIcon.AddChildren({
    ethIconLabel,
});
FlexLayout ethInfo = FlexLayout::New(); ethInfo.SetDirection(FlexDirection::COLUMN); ethInfo.SetAlignItems(FlexAlign::FLEX_START); ethInfo.SetRequestedWidth(910.0f); ethInfo.SetMargin(Extents(49, 0, 0, 0));
Label ethName = Label::New("Ethereum"); ethName.SetFontSize(53); ethName.SetTextColor(UiColor(0xffffff));
Label ethTicker = Label::New("ETH · $3,520"); ethTicker.SetFontSize(42); ethTicker.SetTextColor(UiColor(0x9ca3af)); ethTicker.SetMargin(Extents(0, 0, 11, 0));
ethInfo.AddChildren({
    ethName,
    ethTicker,
});
View ethSpacer = View::New(); ethSpacer.SetRequestedWidth(MATCH_PARENT); ethSpacer.SetRequestedHeight(3.5f);
FlexLayout ethValue = FlexLayout::New(); ethValue.SetDirection(FlexDirection::COLUMN); ethValue.SetAlignItems(FlexAlign::FLEX_END);
Label ethAmount = Label::New("$12,580.00"); ethAmount.SetFontSize(53); ethAmount.SetTextColor(UiColor(0xffffff));
Label ethChange = Label::New("▲ 2.18%"); ethChange.SetFontSize(42); ethChange.SetTextColor(UiColor(0x22c55e)); ethChange.SetMargin(Extents(0, 0, 11, 0));
ethValue.AddChildren({
    ethAmount,
    ethChange,
});
ethRow.AddChildren({
    ethIcon,
    ethInfo,
    ethSpacer,
    ethValue,
});

// ========== ASSET ROW: SOL ==========
FlexLayout solRow = FlexLayout::New();
solRow.SetDirection(FlexDirection::ROW);
solRow.SetAlignItems(FlexAlign::CENTER);
solRow.SetRequestedWidth(MATCH_PARENT);
solRow.SetRequestedHeight(266.0f);
solRow.SetBackgroundColor(UiColor(0x141628));
solRow.SetCornerRadius(56.0f);
solRow.SetMargin(Extents(70, 70, 0, 35));
solRow.SetPadding(Extents(56, 56, 0, 0));
FlexLayout solIcon = FlexLayout::New(); solIcon.SetDirection(FlexDirection::COLUMN); solIcon.SetJustifyContent(FlexJustify::CENTER); solIcon.SetAlignItems(FlexAlign::CENTER); solIcon.SetRequestedWidth(154.0f); solIcon.SetRequestedHeight(154.0f); solIcon.SetBackgroundColor(UiColor(0x0a2b24)); solIcon.SetCornerRadius(77.0f);
Label solIconLabel = Label::New("SOL"); solIconLabel.SetFontSize(39); solIconLabel.SetTextColor(UiColor(0x14f195));
solIcon.AddChildren({
    solIconLabel,
});
FlexLayout solInfo = FlexLayout::New(); solInfo.SetDirection(FlexDirection::COLUMN); solInfo.SetAlignItems(FlexAlign::FLEX_START); solInfo.SetRequestedWidth(910.0f); solInfo.SetMargin(Extents(49, 0, 0, 0));
Label solName = Label::New("Solana"); solName.SetFontSize(53); solName.SetTextColor(UiColor(0xffffff));
Label solTicker = Label::New("SOL · $148.70"); solTicker.SetFontSize(42); solTicker.SetTextColor(UiColor(0x9ca3af)); solTicker.SetMargin(Extents(0, 0, 11, 0));
solInfo.AddChildren({
    solName,
    solTicker,
});
View solSpacer = View::New(); solSpacer.SetRequestedWidth(MATCH_PARENT); solSpacer.SetRequestedHeight(3.5f);
FlexLayout solValue = FlexLayout::New(); solValue.SetDirection(FlexDirection::COLUMN); solValue.SetAlignItems(FlexAlign::FLEX_END);
Label solAmount = Label::New("$5,243.74"); solAmount.SetFontSize(53); solAmount.SetTextColor(UiColor(0xffffff));
Label solChange = Label::New("▼ 1.24%"); solChange.SetFontSize(42); solChange.SetTextColor(UiColor(0xef4444)); solChange.SetMargin(Extents(0, 0, 11, 0));
solValue.AddChildren({
    solAmount,
    solChange,
});
solRow.AddChildren({
    solIcon,
    solInfo,
    solSpacer,
    solValue,
});

// ========== ASSET ROW: ADA ==========
FlexLayout adaRow = FlexLayout::New();
adaRow.SetDirection(FlexDirection::ROW);
adaRow.SetAlignItems(FlexAlign::CENTER);
adaRow.SetRequestedWidth(MATCH_PARENT);
adaRow.SetRequestedHeight(266.0f);
adaRow.SetBackgroundColor(UiColor(0x141628));
adaRow.SetCornerRadius(56.0f);
adaRow.SetMargin(Extents(70, 70, 0, 0));
adaRow.SetPadding(Extents(56, 56, 0, 0));
FlexLayout adaIcon = FlexLayout::New(); adaIcon.SetDirection(FlexDirection::COLUMN); adaIcon.SetJustifyContent(FlexJustify::CENTER); adaIcon.SetAlignItems(FlexAlign::CENTER); adaIcon.SetRequestedWidth(154.0f); adaIcon.SetRequestedHeight(154.0f); adaIcon.SetBackgroundColor(UiColor(0x0d1f3a)); adaIcon.SetCornerRadius(77.0f);
Label adaIconLabel = Label::New("ADA"); adaIconLabel.SetFontSize(39); adaIconLabel.SetTextColor(UiColor(0x6fa0ff));
adaIcon.AddChildren({
    adaIconLabel,
});
FlexLayout adaInfo = FlexLayout::New(); adaInfo.SetDirection(FlexDirection::COLUMN); adaInfo.SetAlignItems(FlexAlign::FLEX_START); adaInfo.SetRequestedWidth(910.0f); adaInfo.SetMargin(Extents(49, 0, 0, 0));
Label adaName = Label::New("Cardano"); adaName.SetFontSize(53); adaName.SetTextColor(UiColor(0xffffff));
Label adaTicker = Label::New("ADA · $0.58"); adaTicker.SetFontSize(42); adaTicker.SetTextColor(UiColor(0x9ca3af)); adaTicker.SetMargin(Extents(0, 0, 11, 0));
adaInfo.AddChildren({
    adaName,
    adaTicker,
});
View adaSpacer = View::New(); adaSpacer.SetRequestedWidth(MATCH_PARENT); adaSpacer.SetRequestedHeight(3.5f);
FlexLayout adaValue = FlexLayout::New(); adaValue.SetDirection(FlexDirection::COLUMN); adaValue.SetAlignItems(FlexAlign::FLEX_END);
Label adaAmount = Label::New("$2,400.00"); adaAmount.SetFontSize(53); adaAmount.SetTextColor(UiColor(0xffffff));
Label adaChange = Label::New("▲ 0.88%"); adaChange.SetFontSize(42); adaChange.SetTextColor(UiColor(0x22c55e)); adaChange.SetMargin(Extents(0, 0, 11, 0));
adaValue.AddChildren({
    adaAmount,
    adaChange,
});
adaRow.AddChildren({
    adaIcon,
    adaInfo,
    adaSpacer,
    adaValue,
});

View flexSpacer = View::New();
StackLayoutParams flexSpacerParams = StackLayoutParams::New();
flexSpacerParams.SetWeight(1.0f);
flexSpacer.SetLayoutParams(flexSpacerParams);

// ========== BOTTOM NAV ==========
FlexLayout bottomNav = FlexLayout::New();
bottomNav.SetDirection(FlexDirection::ROW);
bottomNav.SetJustifyContent(FlexJustify::SPACE_EVENLY);
bottomNav.SetAlignItems(FlexAlign::CENTER);
bottomNav.SetRequestedWidth(MATCH_PARENT);
bottomNav.SetRequestedHeight(252.0f);
bottomNav.SetBackgroundColor(UiColor(0x141628));
FlexLayout navPortfolio = FlexLayout::New(); navPortfolio.SetDirection(FlexDirection::COLUMN); navPortfolio.SetAlignItems(FlexAlign::CENTER);
Label navPortfolioIcon = Label::New("◈"); navPortfolioIcon.SetFontSize(77); navPortfolioIcon.SetTextColor(UiColor(0x7c3aed));
Label navPortfolioLabel = Label::New("Portfolio"); navPortfolioLabel.SetFontSize(35); navPortfolioLabel.SetTextColor(UiColor(0x7c3aed)); navPortfolioLabel.SetMargin(Extents(0, 0, 14, 0));
navPortfolio.AddChildren({
    navPortfolioIcon,
    navPortfolioLabel,
});
FlexLayout navMarkets = FlexLayout::New(); navMarkets.SetDirection(FlexDirection::COLUMN); navMarkets.SetAlignItems(FlexAlign::CENTER);
Label navMarketsIcon = Label::New("◉"); navMarketsIcon.SetFontSize(77); navMarketsIcon.SetTextColor(UiColor(0x6b7190));
Label navMarketsLabel = Label::New("Markets"); navMarketsLabel.SetFontSize(35); navMarketsLabel.SetTextColor(UiColor(0x6b7190)); navMarketsLabel.SetMargin(Extents(0, 0, 14, 0));
navMarkets.AddChildren({
    navMarketsIcon,
    navMarketsLabel,
});
FlexLayout navTrade = FlexLayout::New(); navTrade.SetDirection(FlexDirection::COLUMN); navTrade.SetAlignItems(FlexAlign::CENTER);
Label navTradeIcon = Label::New("⇄"); navTradeIcon.SetFontSize(77); navTradeIcon.SetTextColor(UiColor(0x6b7190));
Label navTradeLabel = Label::New("Trade"); navTradeLabel.SetFontSize(35); navTradeLabel.SetTextColor(UiColor(0x6b7190)); navTradeLabel.SetMargin(Extents(0, 0, 14, 0));
navTrade.AddChildren({
    navTradeIcon,
    navTradeLabel,
});
FlexLayout navProfile = FlexLayout::New(); navProfile.SetDirection(FlexDirection::COLUMN); navProfile.SetAlignItems(FlexAlign::CENTER);
Label navProfileIcon = Label::New("◎"); navProfileIcon.SetFontSize(77); navProfileIcon.SetTextColor(UiColor(0x6b7190));
Label navProfileLabel = Label::New("Profile"); navProfileLabel.SetFontSize(35); navProfileLabel.SetTextColor(UiColor(0x6b7190)); navProfileLabel.SetMargin(Extents(0, 0, 14, 0));
navProfile.AddChildren({
    navProfileIcon,
    navProfileLabel,
});
bottomNav.AddChildren({
    navPortfolio,
    navMarkets,
    navTrade,
    navProfile,
});

root.AddChildren({

    statusBar,

    header,

    balanceHero,

    spacer1,

    chartCard,

    spacer2,

    quickActions,

    spacer3,

    assetsHeader,

    spacer4,

    btcRow,

    ethRow,

    solRow,

    adaRow,

    flexSpacer,

    bottomNav,
});
return root;
