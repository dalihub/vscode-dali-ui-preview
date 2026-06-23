// @render-only — async ImageView loads (form L): pixel non-deterministic across env/timing (broke broken-image→real-photo in M5); verified by compile+render, not a flaky pixel golden.
// @preview-config: name="Food Delivery", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0xfafafa));

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
statusTime.SetTextColor(UiColor(0x1a1a1a));
Label statusInfo = Label::New("●●●  5G  ▮ 88%");
statusInfo.SetFontSize(39);
statusInfo.SetTextColor(UiColor(0x1a1a1a));
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
header.SetRequestedHeight(252.0f);
header.SetPadding(Extents(98, 98, 14, 0));
FlexLayout headerAddress = FlexLayout::New();
headerAddress.SetDirection(FlexDirection::COLUMN);
headerAddress.SetAlignItems(FlexAlign::FLEX_START);
Label deliverTo = Label::New("DELIVER TO");
deliverTo.SetFontSize(42);
deliverTo.SetTextColor(UiColor(0xff5a1f));
Label addressLine = Label::New("450 Market St  ⌄");
addressLine.SetFontSize(67);
addressLine.SetTextColor(UiColor(0x1a1a1a));
addressLine.SetMargin(Extents(0, 0, 18, 0));
headerAddress.AddChildren({
    deliverTo,
    addressLine,
});
FlexLayout headerAvatar = FlexLayout::New();
headerAvatar.SetDirection(FlexDirection::COLUMN);
headerAvatar.SetJustifyContent(FlexJustify::CENTER);
headerAvatar.SetAlignItems(FlexAlign::CENTER);
headerAvatar.SetRequestedWidth(154.0f);
headerAvatar.SetRequestedHeight(154.0f);
headerAvatar.SetBackgroundColor(UiColor(0xf2f2f2));
headerAvatar.SetCornerRadius(77.0f);
Label avatarIcon = Label::New("◉");
avatarIcon.SetFontSize(63);
avatarIcon.SetTextColor(UiColor(0x1a1a1a));
headerAvatar.AddChildren({
    avatarIcon,
});
header.AddChildren({
    headerAddress,
    headerAvatar,
});

// ========== SEARCH BAR ==========
FlexLayout searchBar = FlexLayout::New();
searchBar.SetDirection(FlexDirection::ROW);
searchBar.SetAlignItems(FlexAlign::CENTER);
searchBar.SetRequestedWidth(MATCH_PARENT);
searchBar.SetRequestedHeight(182.0f);
searchBar.SetBackgroundColor(UiColor(0xf2f2f2));
searchBar.SetCornerRadius(91.0f);
searchBar.SetPadding(Extents(84, 84, 0, 0));
searchBar.SetMargin(Extents(84, 84, 14, 0));
Label searchLabel = Label::New("⌕  Search restaurants, cuisines...");
searchLabel.SetFontSize(56);
searchLabel.SetTextColor(UiColor(0x8a8a8a));
searchBar.AddChildren({
    searchLabel,
});

View spacer1 = View::New();
spacer1.SetRequestedHeight(109.2f);

// ========== CATEGORIES ROW ==========
FlexLayout categoriesRow = FlexLayout::New();
categoriesRow.SetDirection(FlexDirection::ROW);
categoriesRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
categoriesRow.SetAlignItems(FlexAlign::CENTER);
categoriesRow.SetRequestedWidth(MATCH_PARENT);
categoriesRow.SetPadding(Extents(84, 84, 0, 0));

FlexLayout catPopular = FlexLayout::New();
catPopular.SetDirection(FlexDirection::COLUMN);
catPopular.SetAlignItems(FlexAlign::CENTER);
FlexLayout catPopularCircle = FlexLayout::New();
catPopularCircle.SetDirection(FlexDirection::COLUMN);
catPopularCircle.SetJustifyContent(FlexJustify::CENTER);
catPopularCircle.SetAlignItems(FlexAlign::CENTER);
catPopularCircle.SetRequestedWidth(252.0f);
catPopularCircle.SetRequestedHeight(252.0f);
catPopularCircle.SetBackgroundColor(UiColor(0xfff5ed));
catPopularCircle.SetCornerRadius(126.0f);
Label catPopularIcon = Label::New("★");
catPopularIcon.SetFontSize(105);
catPopularIcon.SetTextColor(UiColor(0xff5a1f));
catPopularCircle.AddChildren({
    catPopularIcon,
});
Label catPopularLabel = Label::New("Popular");
catPopularLabel.SetFontSize(49);
catPopularLabel.SetTextColor(UiColor(0x1a1a1a));
catPopularLabel.SetMargin(Extents(0, 0, 35, 0));
catPopular.AddChildren({
    catPopularCircle,
    catPopularLabel,
});

FlexLayout catPizza = FlexLayout::New();
catPizza.SetDirection(FlexDirection::COLUMN);
catPizza.SetAlignItems(FlexAlign::CENTER);
FlexLayout catPizzaCircle = FlexLayout::New();
catPizzaCircle.SetDirection(FlexDirection::COLUMN);
catPizzaCircle.SetJustifyContent(FlexJustify::CENTER);
catPizzaCircle.SetAlignItems(FlexAlign::CENTER);
catPizzaCircle.SetRequestedWidth(252.0f);
catPizzaCircle.SetRequestedHeight(252.0f);
catPizzaCircle.SetBackgroundColor(UiColor(0xe8f5ff));
catPizzaCircle.SetCornerRadius(126.0f);
Label catPizzaIcon = Label::New("◉");
catPizzaIcon.SetFontSize(105);
catPizzaIcon.SetTextColor(UiColor(0x2563eb));
catPizzaCircle.AddChildren({
    catPizzaIcon,
});
Label catPizzaLabel = Label::New("Pizza");
catPizzaLabel.SetFontSize(49);
catPizzaLabel.SetTextColor(UiColor(0x1a1a1a));
catPizzaLabel.SetMargin(Extents(0, 0, 35, 0));
catPizza.AddChildren({
    catPizzaCircle,
    catPizzaLabel,
});

FlexLayout catSushi = FlexLayout::New();
catSushi.SetDirection(FlexDirection::COLUMN);
catSushi.SetAlignItems(FlexAlign::CENTER);
FlexLayout catSushiCircle = FlexLayout::New();
catSushiCircle.SetDirection(FlexDirection::COLUMN);
catSushiCircle.SetJustifyContent(FlexJustify::CENTER);
catSushiCircle.SetAlignItems(FlexAlign::CENTER);
catSushiCircle.SetRequestedWidth(252.0f);
catSushiCircle.SetRequestedHeight(252.0f);
catSushiCircle.SetBackgroundColor(UiColor(0xf3f0ff));
catSushiCircle.SetCornerRadius(126.0f);
Label catSushiIcon = Label::New("◆");
catSushiIcon.SetFontSize(105);
catSushiIcon.SetTextColor(UiColor(0x7c3aed));
catSushiCircle.AddChildren({
    catSushiIcon,
});
Label catSushiLabel = Label::New("Sushi");
catSushiLabel.SetFontSize(49);
catSushiLabel.SetTextColor(UiColor(0x1a1a1a));
catSushiLabel.SetMargin(Extents(0, 0, 35, 0));
catSushi.AddChildren({
    catSushiCircle,
    catSushiLabel,
});

FlexLayout catSalad = FlexLayout::New();
catSalad.SetDirection(FlexDirection::COLUMN);
catSalad.SetAlignItems(FlexAlign::CENTER);
FlexLayout catSaladCircle = FlexLayout::New();
catSaladCircle.SetDirection(FlexDirection::COLUMN);
catSaladCircle.SetJustifyContent(FlexJustify::CENTER);
catSaladCircle.SetAlignItems(FlexAlign::CENTER);
catSaladCircle.SetRequestedWidth(252.0f);
catSaladCircle.SetRequestedHeight(252.0f);
catSaladCircle.SetBackgroundColor(UiColor(0xecfaf1));
catSaladCircle.SetCornerRadius(126.0f);
Label catSaladIcon = Label::New("✿");
catSaladIcon.SetFontSize(105);
catSaladIcon.SetTextColor(UiColor(0x1f8a4c));
catSaladCircle.AddChildren({
    catSaladIcon,
});
Label catSaladLabel = Label::New("Salad");
catSaladLabel.SetFontSize(49);
catSaladLabel.SetTextColor(UiColor(0x1a1a1a));
catSaladLabel.SetMargin(Extents(0, 0, 35, 0));
catSalad.AddChildren({
    catSaladCircle,
    catSaladLabel,
});

FlexLayout catRamen = FlexLayout::New();
catRamen.SetDirection(FlexDirection::COLUMN);
catRamen.SetAlignItems(FlexAlign::CENTER);
FlexLayout catRamenCircle = FlexLayout::New();
catRamenCircle.SetDirection(FlexDirection::COLUMN);
catRamenCircle.SetJustifyContent(FlexJustify::CENTER);
catRamenCircle.SetAlignItems(FlexAlign::CENTER);
catRamenCircle.SetRequestedWidth(252.0f);
catRamenCircle.SetRequestedHeight(252.0f);
catRamenCircle.SetBackgroundColor(UiColor(0xfff9e6));
catRamenCircle.SetCornerRadius(126.0f);
Label catRamenIcon = Label::New("❁");
catRamenIcon.SetFontSize(98);
catRamenIcon.SetTextColor(UiColor(0xe0a800));
catRamenCircle.AddChildren({
    catRamenIcon,
});
Label catRamenLabel = Label::New("Ramen");
catRamenLabel.SetFontSize(49);
catRamenLabel.SetTextColor(UiColor(0x1a1a1a));
catRamenLabel.SetMargin(Extents(0, 0, 35, 0));
catRamen.AddChildren({
    catRamenCircle,
    catRamenLabel,
});

categoriesRow.AddChildren({
    catPopular,
    catPizza,
    catSushi,
    catSalad,
    catRamen,
});

View spacer2 = View::New();
spacer2.SetRequestedHeight(118.3f);

// ========== HERO PROMO BANNER ==========
FlexLayout heroBanner = FlexLayout::New();
heroBanner.SetDirection(FlexDirection::COLUMN);
heroBanner.SetRequestedWidth(MATCH_PARENT);
heroBanner.SetMargin(Extents(84, 84, 0, 0));
ImageView heroImage = ImageView::New("assets/banner_food.jpg");
heroImage.SetRequestedWidth(MATCH_PARENT);
heroImage.SetRequestedHeight(630.0f);
heroImage.SetCornerRadius(70.0f);
heroBanner.AddChildren({
    heroImage,
});

View spacer3 = View::New();
spacer3.SetRequestedHeight(109.2f);

// ========== POPULAR NEAR YOU HEADER ==========
FlexLayout popularHeader = FlexLayout::New();
popularHeader.SetDirection(FlexDirection::ROW);
popularHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
popularHeader.SetAlignItems(FlexAlign::CENTER);
popularHeader.SetRequestedWidth(MATCH_PARENT);
popularHeader.SetPadding(Extents(98, 98, 0, 0));
Label popularTitle = Label::New("Popular near you");
popularTitle.SetFontSize(70);
popularTitle.SetTextColor(UiColor(0x1a1a1a));
Label popularSeeAll = Label::New("See all  →");
popularSeeAll.SetFontSize(46);
popularSeeAll.SetTextColor(UiColor(0xff5a1f));
popularHeader.AddChildren({
    popularTitle,
    popularSeeAll,
});

View spacer4 = View::New();
spacer4.SetRequestedHeight(63.7f);

// ========== RESTAURANT CARD 1 ==========
FlexLayout card1 = FlexLayout::New();
card1.SetDirection(FlexDirection::COLUMN);
card1.SetRequestedWidth(MATCH_PARENT);
card1.SetBackgroundColor(UiColor(0xffffff));
card1.SetCornerRadius(70.0f);
card1.SetMargin(Extents(84, 84, 0, 0));
ImageView card1Image = ImageView::New("assets/meal1.jpg");
card1Image.SetRequestedWidth(MATCH_PARENT);
card1Image.SetRequestedHeight(490.0f);
card1Image.SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f);
FlexLayout card1Body = FlexLayout::New();
card1Body.SetDirection(FlexDirection::COLUMN);
card1Body.SetRequestedWidth(MATCH_PARENT);
card1Body.SetPadding(Extents(63, 63, 49, 56));
FlexLayout card1TitleRow = FlexLayout::New();
card1TitleRow.SetDirection(FlexDirection::ROW);
card1TitleRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
card1TitleRow.SetAlignItems(FlexAlign::CENTER);
card1TitleRow.SetRequestedWidth(MATCH_PARENT);
Label card1Name = Label::New("Bella Vista Trattoria");
card1Name.SetFontSize(70);
card1Name.SetTextColor(UiColor(0x1a1a1a));
Label card1Heart = Label::New("♥");
card1Heart.SetFontSize(70);
card1Heart.SetTextColor(UiColor(0xff3b30));
card1TitleRow.AddChildren({
    card1Name,
    card1Heart,
});
Label card1Subtitle = Label::New("Italian  ·  $$  ·  1.2 mi");
card1Subtitle.SetFontSize(49);
card1Subtitle.SetTextColor(UiColor(0x8a8a8a));
card1Subtitle.SetMargin(Extents(0, 0, 28, 0));
FlexLayout card1Tags = FlexLayout::New();
card1Tags.SetDirection(FlexDirection::ROW);
card1Tags.SetAlignItems(FlexAlign::CENTER);
card1Tags.SetMargin(Extents(0, 0, 35, 0));
FlexLayout card1TagRating = FlexLayout::New();
card1TagRating.SetDirection(FlexDirection::ROW);
card1TagRating.SetJustifyContent(FlexJustify::CENTER);
card1TagRating.SetAlignItems(FlexAlign::CENTER);
card1TagRating.SetBackgroundColor(UiColor(0xecfaf1));
card1TagRating.SetCornerRadius(38.5f);
card1TagRating.SetPadding(Extents(35, 35, 14, 14));
card1TagRating.SetMargin(Extents(0, 28, 0, 0));
Label card1TagRatingLabel = Label::New("★ 4.8");
card1TagRatingLabel.SetFontSize(39);
card1TagRatingLabel.SetTextColor(UiColor(0x1f8a4c));
card1TagRating.AddChildren({
    card1TagRatingLabel,
});
FlexLayout card1TagTime = FlexLayout::New();
card1TagTime.SetDirection(FlexDirection::ROW);
card1TagTime.SetJustifyContent(FlexJustify::CENTER);
card1TagTime.SetAlignItems(FlexAlign::CENTER);
card1TagTime.SetBackgroundColor(UiColor(0xfff5ed));
card1TagTime.SetCornerRadius(38.5f);
card1TagTime.SetPadding(Extents(35, 35, 14, 14));
card1TagTime.SetMargin(Extents(0, 28, 0, 0));
Label card1TagTimeLabel = Label::New("25–35 min");
card1TagTimeLabel.SetFontSize(39);
card1TagTimeLabel.SetTextColor(UiColor(0xff5a1f));
card1TagTime.AddChildren({
    card1TagTimeLabel,
});
FlexLayout card1TagDelivery = FlexLayout::New();
card1TagDelivery.SetDirection(FlexDirection::ROW);
card1TagDelivery.SetJustifyContent(FlexJustify::CENTER);
card1TagDelivery.SetAlignItems(FlexAlign::CENTER);
card1TagDelivery.SetBackgroundColor(UiColor(0xf2f2f2));
card1TagDelivery.SetCornerRadius(38.5f);
card1TagDelivery.SetPadding(Extents(35, 35, 14, 14));
Label card1TagDeliveryLabel = Label::New("Free delivery");
card1TagDeliveryLabel.SetFontSize(39);
card1TagDeliveryLabel.SetTextColor(UiColor(0x1a1a1a));
card1TagDelivery.AddChildren({
    card1TagDeliveryLabel,
});
card1Tags.AddChildren({
    card1TagRating,
    card1TagTime,
    card1TagDelivery,
});
card1Body.AddChildren({
    card1TitleRow,
    card1Subtitle,
    card1Tags,
});
card1.AddChildren({
    card1Image,
    card1Body,
});

View spacer5 = View::New();
spacer5.SetRequestedHeight(63.7f);

// ========== RESTAURANT CARD 2 ==========
FlexLayout card2 = FlexLayout::New();
card2.SetDirection(FlexDirection::COLUMN);
card2.SetRequestedWidth(MATCH_PARENT);
card2.SetBackgroundColor(UiColor(0xffffff));
card2.SetCornerRadius(70.0f);
card2.SetMargin(Extents(84, 84, 0, 0));
ImageView card2Image = ImageView::New("assets/meal2.jpg");
card2Image.SetRequestedWidth(MATCH_PARENT);
card2Image.SetRequestedHeight(490.0f);
card2Image.SetCornerRadius(70.0f, 70.0f, 0.0f, 0.0f);
FlexLayout card2Body = FlexLayout::New();
card2Body.SetDirection(FlexDirection::COLUMN);
card2Body.SetRequestedWidth(MATCH_PARENT);
card2Body.SetPadding(Extents(63, 63, 49, 56));
FlexLayout card2TitleRow = FlexLayout::New();
card2TitleRow.SetDirection(FlexDirection::ROW);
card2TitleRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
card2TitleRow.SetAlignItems(FlexAlign::CENTER);
card2TitleRow.SetRequestedWidth(MATCH_PARENT);
Label card2Name = Label::New("Sakura Sushi Bar");
card2Name.SetFontSize(70);
card2Name.SetTextColor(UiColor(0x1a1a1a));
Label card2Heart = Label::New("♡");
card2Heart.SetFontSize(70);
card2Heart.SetTextColor(UiColor(0x8a8a8a));
card2TitleRow.AddChildren({
    card2Name,
    card2Heart,
});
Label card2Subtitle = Label::New("Japanese  ·  $$$  ·  0.8 mi");
card2Subtitle.SetFontSize(49);
card2Subtitle.SetTextColor(UiColor(0x8a8a8a));
card2Subtitle.SetMargin(Extents(0, 0, 28, 0));
FlexLayout card2Tags = FlexLayout::New();
card2Tags.SetDirection(FlexDirection::ROW);
card2Tags.SetAlignItems(FlexAlign::CENTER);
card2Tags.SetMargin(Extents(0, 0, 35, 0));
FlexLayout card2TagRating = FlexLayout::New();
card2TagRating.SetDirection(FlexDirection::ROW);
card2TagRating.SetJustifyContent(FlexJustify::CENTER);
card2TagRating.SetAlignItems(FlexAlign::CENTER);
card2TagRating.SetBackgroundColor(UiColor(0xecfaf1));
card2TagRating.SetCornerRadius(38.5f);
card2TagRating.SetPadding(Extents(35, 35, 14, 14));
card2TagRating.SetMargin(Extents(0, 28, 0, 0));
Label card2TagRatingLabel = Label::New("★ 4.9");
card2TagRatingLabel.SetFontSize(39);
card2TagRatingLabel.SetTextColor(UiColor(0x1f8a4c));
card2TagRating.AddChildren({
    card2TagRatingLabel,
});
FlexLayout card2TagTime = FlexLayout::New();
card2TagTime.SetDirection(FlexDirection::ROW);
card2TagTime.SetJustifyContent(FlexJustify::CENTER);
card2TagTime.SetAlignItems(FlexAlign::CENTER);
card2TagTime.SetBackgroundColor(UiColor(0xfff5ed));
card2TagTime.SetCornerRadius(38.5f);
card2TagTime.SetPadding(Extents(35, 35, 14, 14));
card2TagTime.SetMargin(Extents(0, 28, 0, 0));
Label card2TagTimeLabel = Label::New("15–25 min");
card2TagTimeLabel.SetFontSize(39);
card2TagTimeLabel.SetTextColor(UiColor(0xff5a1f));
card2TagTime.AddChildren({
    card2TagTimeLabel,
});
FlexLayout card2TagDelivery = FlexLayout::New();
card2TagDelivery.SetDirection(FlexDirection::ROW);
card2TagDelivery.SetJustifyContent(FlexJustify::CENTER);
card2TagDelivery.SetAlignItems(FlexAlign::CENTER);
card2TagDelivery.SetBackgroundColor(UiColor(0xfef3f3));
card2TagDelivery.SetCornerRadius(38.5f);
card2TagDelivery.SetPadding(Extents(35, 35, 14, 14));
Label card2TagDeliveryLabel = Label::New("$2.99 deliv");
card2TagDeliveryLabel.SetFontSize(39);
card2TagDeliveryLabel.SetTextColor(UiColor(0xdc2626));
card2TagDelivery.AddChildren({
    card2TagDeliveryLabel,
});
card2Tags.AddChildren({
    card2TagRating,
    card2TagTime,
    card2TagDelivery,
});
card2Body.AddChildren({
    card2TitleRow,
    card2Subtitle,
    card2Tags,
});
card2.AddChildren({
    card2Image,
    card2Body,
});

View spacerFlex = View::New();
StackLayoutParams spacerFlexParams = StackLayoutParams::New();
spacerFlexParams.SetWeight(1.0f);
spacerFlex.SetLayoutParams(spacerFlexParams);

// ========== BOTTOM TAB BAR ==========
FlexLayout tabBar = FlexLayout::New();
tabBar.SetDirection(FlexDirection::ROW);
tabBar.SetJustifyContent(FlexJustify::SPACE_EVENLY);
tabBar.SetAlignItems(FlexAlign::CENTER);
tabBar.SetRequestedWidth(MATCH_PARENT);
tabBar.SetRequestedHeight(252.0f);
tabBar.SetBackgroundColor(UiColor(0xffffff));

FlexLayout tabHome = FlexLayout::New();
tabHome.SetDirection(FlexDirection::COLUMN);
tabHome.SetAlignItems(FlexAlign::CENTER);
Label tabHomeIcon = Label::New("⌂");
tabHomeIcon.SetFontSize(77);
tabHomeIcon.SetTextColor(UiColor(0xff5a1f));
Label tabHomeLabel = Label::New("Home");
tabHomeLabel.SetFontSize(35);
tabHomeLabel.SetTextColor(UiColor(0xff5a1f));
tabHomeLabel.SetMargin(Extents(0, 0, 14, 0));
tabHome.AddChildren({
    tabHomeIcon,
    tabHomeLabel,
});

FlexLayout tabSearch = FlexLayout::New();
tabSearch.SetDirection(FlexDirection::COLUMN);
tabSearch.SetAlignItems(FlexAlign::CENTER);
Label tabSearchIcon = Label::New("⌕");
tabSearchIcon.SetFontSize(77);
tabSearchIcon.SetTextColor(UiColor(0x8a8a8a));
Label tabSearchLabel = Label::New("Search");
tabSearchLabel.SetFontSize(35);
tabSearchLabel.SetTextColor(UiColor(0x8a8a8a));
tabSearchLabel.SetMargin(Extents(0, 0, 14, 0));
tabSearch.AddChildren({
    tabSearchIcon,
    tabSearchLabel,
});

FlexLayout tabOrders = FlexLayout::New();
tabOrders.SetDirection(FlexDirection::COLUMN);
tabOrders.SetAlignItems(FlexAlign::CENTER);
Label tabOrdersIcon = Label::New("☰");
tabOrdersIcon.SetFontSize(77);
tabOrdersIcon.SetTextColor(UiColor(0x8a8a8a));
Label tabOrdersLabel = Label::New("Orders");
tabOrdersLabel.SetFontSize(35);
tabOrdersLabel.SetTextColor(UiColor(0x8a8a8a));
tabOrdersLabel.SetMargin(Extents(0, 0, 14, 0));
tabOrders.AddChildren({
    tabOrdersIcon,
    tabOrdersLabel,
});

FlexLayout tabProfile = FlexLayout::New();
tabProfile.SetDirection(FlexDirection::COLUMN);
tabProfile.SetAlignItems(FlexAlign::CENTER);
Label tabProfileIcon = Label::New("◉");
tabProfileIcon.SetFontSize(77);
tabProfileIcon.SetTextColor(UiColor(0x8a8a8a));
Label tabProfileLabel = Label::New("Profile");
tabProfileLabel.SetFontSize(35);
tabProfileLabel.SetTextColor(UiColor(0x8a8a8a));
tabProfileLabel.SetMargin(Extents(0, 0, 14, 0));
tabProfile.AddChildren({
    tabProfileIcon,
    tabProfileLabel,
});

tabBar.AddChildren({
    tabHome,
    tabSearch,
    tabOrders,
    tabProfile,
});

root.AddChildren({

    // ========== STATUS BAR ==========
    statusBar,

    // ========== HEADER ==========
    header,

    // ========== SEARCH BAR ==========
    searchBar,

    spacer1,

    // ========== CATEGORIES ROW ==========
    categoriesRow,

    spacer2,

    // ========== HERO PROMO BANNER ==========
    heroBanner,

    spacer3,

    // ========== POPULAR NEAR YOU HEADER ==========
    popularHeader,

    spacer4,

    // ========== RESTAURANT CARD 1 ==========
    card1,

    spacer5,

    // ========== RESTAURANT CARD 2 ==========
    card2,

    spacerFlex,

    // ========== BOTTOM TAB BAR ==========
    tabBar,
});
return root;
