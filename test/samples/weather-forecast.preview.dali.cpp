// @preview-config: name="Weather Forecast", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0e1225));
root.SetPadding(Extents(126, 126, 210, 126));

// ========== STATUS BAR ==========
FlexLayout statusBar = FlexLayout::New();
statusBar.SetDirection(FlexDirection::ROW);
statusBar.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
statusBar.SetAlignItems(FlexAlign::CENTER);
statusBar.SetRequestedWidth(MATCH_PARENT);
statusBar.SetRequestedHeight(98.0f);
Label statusTime = Label::New("9:41");
statusTime.SetFontSize(49);
statusTime.SetTextColor(UiColor(0xffffff));
Label statusSignal = Label::New("●●●  5G  ▮▮▮▮");
statusSignal.SetFontSize(39);
statusSignal.SetTextColor(UiColor(0xffffff));
statusBar.AddChildren({
    statusTime,
    statusSignal,
});

// Spacer
View spacer1 = View::New();
spacer1.SetRequestedHeight(91.0f);

// ========== LOCATION HEADER ==========
FlexLayout locationHeader = FlexLayout::New();
locationHeader.SetDirection(FlexDirection::COLUMN);
locationHeader.SetAlignItems(FlexAlign::CENTER);
locationHeader.SetRequestedWidth(MATCH_PARENT);
Label locationName = Label::New("San Francisco");
locationName.SetFontSize(105);
locationName.SetTextColor(UiColor(0xffffff));
Label locationDate = Label::New("Tuesday, April 14");
locationDate.SetFontSize(49);
locationDate.SetTextColor(UiColor(0x8d95b8));
locationDate.SetMargin(Extents(0, 0, 21, 0));
locationHeader.AddChildren({
    locationName,
    locationDate,
});

// Spacer
View spacer2 = View::New();
spacer2.SetRequestedHeight(127.4f);

// ========== HERO TEMPERATURE ==========
FlexLayout hero = FlexLayout::New();
hero.SetDirection(FlexDirection::COLUMN);
hero.SetAlignItems(FlexAlign::CENTER);
hero.SetRequestedWidth(MATCH_PARENT);
Label heroIcon = Label::New("☀");
heroIcon.SetFontSize(308);
heroIcon.SetTextColor(UiColor(0xffce4a));
Label heroTemp = Label::New("<font size='420'>68</font><font size='168'>°</font>");
heroTemp.SetMarkupEnabled(true);
heroTemp.SetTextColor(UiColor(0xffffff));
heroTemp.SetMargin(Extents(0, 0, 49, 0));
Label heroDesc = Label::New("Partly Sunny");
heroDesc.SetFontSize(70);
heroDesc.SetTextColor(UiColor(0xd7ddf5));
heroDesc.SetMargin(Extents(0, 0, 35, 0));
Label heroRange = Label::New("<color value='#ff7a7a'>H 73°</color>   <color value='#7aaeff'>L 58°</color>");
heroRange.SetMarkupEnabled(true);
heroRange.SetFontSize(56);
heroRange.SetMargin(Extents(0, 0, 28, 0));
hero.AddChildren({
    heroIcon,
    heroTemp,
    heroDesc,
    heroRange,
});

// Spacer
View spacer3 = View::New();
spacer3.SetRequestedHeight(182.0f);

// ========== HOURLY FORECAST CARD ==========
FlexLayout hourlyCard = FlexLayout::New();
hourlyCard.SetDirection(FlexDirection::COLUMN);
hourlyCard.SetRequestedWidth(MATCH_PARENT);
hourlyCard.SetBackgroundColor(UiColor(0x1a1f3a));
hourlyCard.SetCornerRadius(77.0f);
hourlyCard.SetPadding(Extents(70, 70, 63, 63));
Label hourlyTitle = Label::New("HOURLY FORECAST");
hourlyTitle.SetFontSize(39);
hourlyTitle.SetTextColor(UiColor(0x7a82a5));
View hourlyDivider = View::New();
hourlyDivider.SetBackgroundColor(UiColor(0x262c4e));
hourlyDivider.SetRequestedWidth(MATCH_PARENT);
hourlyDivider.SetRequestedHeight(3.5f);
hourlyDivider.SetMargin(Extents(0, 0, 35, 49));

FlexLayout hourlyRow = FlexLayout::New();
hourlyRow.SetDirection(FlexDirection::ROW);
hourlyRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
hourlyRow.SetAlignItems(FlexAlign::CENTER);
hourlyRow.SetRequestedWidth(MATCH_PARENT);

FlexLayout hour0 = FlexLayout::New();
hour0.SetDirection(FlexDirection::COLUMN);
hour0.SetAlignItems(FlexAlign::CENTER);
Label hour0Time = Label::New("Now");
hour0Time.SetFontSize(46);
hour0Time.SetTextColor(UiColor(0xffffff));
Label hour0Icon = Label::New("☀");
hour0Icon.SetFontSize(91);
hour0Icon.SetTextColor(UiColor(0xffce4a));
hour0Icon.SetMargin(Extents(0, 0, 28, 28));
Label hour0Temp = Label::New("68°");
hour0Temp.SetFontSize(60);
hour0Temp.SetTextColor(UiColor(0xffffff));
hour0.AddChildren({
    hour0Time,
    hour0Icon,
    hour0Temp,
});

FlexLayout hour1 = FlexLayout::New();
hour1.SetDirection(FlexDirection::COLUMN);
hour1.SetAlignItems(FlexAlign::CENTER);
Label hour1Time = Label::New("11AM");
hour1Time.SetFontSize(46);
hour1Time.SetTextColor(UiColor(0xd7ddf5));
Label hour1Icon = Label::New("☀");
hour1Icon.SetFontSize(91);
hour1Icon.SetTextColor(UiColor(0xffce4a));
hour1Icon.SetMargin(Extents(0, 0, 28, 28));
Label hour1Temp = Label::New("70°");
hour1Temp.SetFontSize(60);
hour1Temp.SetTextColor(UiColor(0xd7ddf5));
hour1.AddChildren({
    hour1Time,
    hour1Icon,
    hour1Temp,
});

FlexLayout hour2 = FlexLayout::New();
hour2.SetDirection(FlexDirection::COLUMN);
hour2.SetAlignItems(FlexAlign::CENTER);
Label hour2Time = Label::New("12PM");
hour2Time.SetFontSize(46);
hour2Time.SetTextColor(UiColor(0xd7ddf5));
Label hour2Icon = Label::New("⛅");
hour2Icon.SetFontSize(91);
hour2Icon.SetTextColor(UiColor(0xfff0a0));
hour2Icon.SetMargin(Extents(0, 0, 28, 28));
Label hour2Temp = Label::New("72°");
hour2Temp.SetFontSize(60);
hour2Temp.SetTextColor(UiColor(0xd7ddf5));
hour2.AddChildren({
    hour2Time,
    hour2Icon,
    hour2Temp,
});

FlexLayout hour3 = FlexLayout::New();
hour3.SetDirection(FlexDirection::COLUMN);
hour3.SetAlignItems(FlexAlign::CENTER);
Label hour3Time = Label::New("1PM");
hour3Time.SetFontSize(46);
hour3Time.SetTextColor(UiColor(0xd7ddf5));
Label hour3Icon = Label::New("☁");
hour3Icon.SetFontSize(91);
hour3Icon.SetTextColor(UiColor(0xcfd8ea));
hour3Icon.SetMargin(Extents(0, 0, 28, 28));
Label hour3Temp = Label::New("71°");
hour3Temp.SetFontSize(60);
hour3Temp.SetTextColor(UiColor(0xd7ddf5));
hour3.AddChildren({
    hour3Time,
    hour3Icon,
    hour3Temp,
});

FlexLayout hour4 = FlexLayout::New();
hour4.SetDirection(FlexDirection::COLUMN);
hour4.SetAlignItems(FlexAlign::CENTER);
Label hour4Time = Label::New("2PM");
hour4Time.SetFontSize(46);
hour4Time.SetTextColor(UiColor(0xd7ddf5));
Label hour4Icon = Label::New("☁");
hour4Icon.SetFontSize(91);
hour4Icon.SetTextColor(UiColor(0xcfd8ea));
hour4Icon.SetMargin(Extents(0, 0, 28, 28));
Label hour4Temp = Label::New("69°");
hour4Temp.SetFontSize(60);
hour4Temp.SetTextColor(UiColor(0xd7ddf5));
hour4.AddChildren({
    hour4Time,
    hour4Icon,
    hour4Temp,
});

FlexLayout hour5 = FlexLayout::New();
hour5.SetDirection(FlexDirection::COLUMN);
hour5.SetAlignItems(FlexAlign::CENTER);
Label hour5Time = Label::New("3PM");
hour5Time.SetFontSize(46);
hour5Time.SetTextColor(UiColor(0xd7ddf5));
Label hour5Icon = Label::New("☂");
hour5Icon.SetFontSize(91);
hour5Icon.SetTextColor(UiColor(0x7aaeff));
hour5Icon.SetMargin(Extents(0, 0, 28, 28));
Label hour5Temp = Label::New("66°");
hour5Temp.SetFontSize(60);
hour5Temp.SetTextColor(UiColor(0xd7ddf5));
hour5.AddChildren({
    hour5Time,
    hour5Icon,
    hour5Temp,
});

hourlyRow.AddChildren({
    hour0,
    hour1,
    hour2,
    hour3,
    hour4,
    hour5,
});

hourlyCard.AddChildren({
    hourlyTitle,
    hourlyDivider,
    hourlyRow,
});

// Spacer
View spacer4 = View::New();
spacer4.SetRequestedHeight(81.9f);

// ========== 5-DAY FORECAST CARD ==========
FlexLayout dailyCard = FlexLayout::New();
dailyCard.SetDirection(FlexDirection::COLUMN);
dailyCard.SetRequestedWidth(MATCH_PARENT);
dailyCard.SetBackgroundColor(UiColor(0x1a1f3a));
dailyCard.SetCornerRadius(77.0f);
dailyCard.SetPadding(Extents(70, 70, 63, 63));
Label dailyTitle = Label::New("5-DAY FORECAST");
dailyTitle.SetFontSize(39);
dailyTitle.SetTextColor(UiColor(0x7a82a5));
View dailyDivider = View::New();
dailyDivider.SetBackgroundColor(UiColor(0x262c4e));
dailyDivider.SetRequestedWidth(MATCH_PARENT);
dailyDivider.SetRequestedHeight(3.5f);
dailyDivider.SetMargin(Extents(0, 0, 35, 21));

// Day row: Wednesday
FlexLayout dayWed = FlexLayout::New();
dayWed.SetDirection(FlexDirection::ROW);
dayWed.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
dayWed.SetAlignItems(FlexAlign::CENTER);
dayWed.SetRequestedWidth(MATCH_PARENT);
dayWed.SetRequestedHeight(154.0f);
Label dayWedName = Label::New("Wed");
dayWedName.SetFontSize(56);
dayWedName.SetTextColor(UiColor(0xffffff));
Label dayWedIcon = Label::New("☁");
dayWedIcon.SetFontSize(77);
dayWedIcon.SetTextColor(UiColor(0xcfd8ea));
Label dayWedRange = Label::New("<color value='#7aaeff'>55°</color> ━━━━━━ <color value='#ff7a7a'>70°</color>");
dayWedRange.SetMarkupEnabled(true);
dayWedRange.SetFontSize(49);
dayWed.AddChildren({
    dayWedName,
    dayWedIcon,
    dayWedRange,
});

// Day row: Thursday
FlexLayout dayThu = FlexLayout::New();
dayThu.SetDirection(FlexDirection::ROW);
dayThu.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
dayThu.SetAlignItems(FlexAlign::CENTER);
dayThu.SetRequestedWidth(MATCH_PARENT);
dayThu.SetRequestedHeight(154.0f);
Label dayThuName = Label::New("Thu");
dayThuName.SetFontSize(56);
dayThuName.SetTextColor(UiColor(0xffffff));
Label dayThuIcon = Label::New("☂");
dayThuIcon.SetFontSize(77);
dayThuIcon.SetTextColor(UiColor(0x7aaeff));
Label dayThuRange = Label::New("<color value='#7aaeff'>52°</color> ━━━━━ <color value='#ff7a7a'>64°</color>");
dayThuRange.SetMarkupEnabled(true);
dayThuRange.SetFontSize(49);
dayThu.AddChildren({
    dayThuName,
    dayThuIcon,
    dayThuRange,
});

// Day row: Friday
FlexLayout dayFri = FlexLayout::New();
dayFri.SetDirection(FlexDirection::ROW);
dayFri.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
dayFri.SetAlignItems(FlexAlign::CENTER);
dayFri.SetRequestedWidth(MATCH_PARENT);
dayFri.SetRequestedHeight(154.0f);
Label dayFriName = Label::New("Fri");
dayFriName.SetFontSize(56);
dayFriName.SetTextColor(UiColor(0xffffff));
Label dayFriIcon = Label::New("⛅");
dayFriIcon.SetFontSize(77);
dayFriIcon.SetTextColor(UiColor(0xfff0a0));
Label dayFriRange = Label::New("<color value='#7aaeff'>58°</color> ━━━━━━━ <color value='#ff7a7a'>76°</color>");
dayFriRange.SetMarkupEnabled(true);
dayFriRange.SetFontSize(49);
dayFri.AddChildren({
    dayFriName,
    dayFriIcon,
    dayFriRange,
});

// Day row: Saturday
FlexLayout daySat = FlexLayout::New();
daySat.SetDirection(FlexDirection::ROW);
daySat.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
daySat.SetAlignItems(FlexAlign::CENTER);
daySat.SetRequestedWidth(MATCH_PARENT);
daySat.SetRequestedHeight(154.0f);
Label daySatName = Label::New("Sat");
daySatName.SetFontSize(56);
daySatName.SetTextColor(UiColor(0xffffff));
Label daySatIcon = Label::New("☀");
daySatIcon.SetFontSize(77);
daySatIcon.SetTextColor(UiColor(0xffce4a));
Label daySatRange = Label::New("<color value='#7aaeff'>60°</color> ━━━━━━━━ <color value='#ff7a7a'>79°</color>");
daySatRange.SetMarkupEnabled(true);
daySatRange.SetFontSize(49);
daySat.AddChildren({
    daySatName,
    daySatIcon,
    daySatRange,
});

// Day row: Sunday
FlexLayout daySun = FlexLayout::New();
daySun.SetDirection(FlexDirection::ROW);
daySun.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
daySun.SetAlignItems(FlexAlign::CENTER);
daySun.SetRequestedWidth(MATCH_PARENT);
daySun.SetRequestedHeight(154.0f);
Label daySunName = Label::New("Sun");
daySunName.SetFontSize(56);
daySunName.SetTextColor(UiColor(0xffffff));
Label daySunIcon = Label::New("☀");
daySunIcon.SetFontSize(77);
daySunIcon.SetTextColor(UiColor(0xffce4a));
Label daySunRange = Label::New("<color value='#7aaeff'>62°</color> ━━━━━━━━ <color value='#ff7a7a'>82°</color>");
daySunRange.SetMarkupEnabled(true);
daySunRange.SetFontSize(49);
daySun.AddChildren({
    daySunName,
    daySunIcon,
    daySunRange,
});

dailyCard.AddChildren({
    dailyTitle,
    dailyDivider,
    dayWed,
    dayThu,
    dayFri,
    daySat,
    daySun,
});

root.AddChildren({
    statusBar,
    spacer1,
    locationHeader,
    spacer2,
    hero,
    spacer3,
    hourlyCard,
    spacer4,
    dailyCard,
});
return root;
