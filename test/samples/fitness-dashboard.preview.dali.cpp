// @preview-config: name="Fitness Dashboard", width=2520, height=4480
StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0b0d16));
root.SetPadding(Extents(112, 112, 196, 112));

// ========== HEADER ==========
FlexLayout header = FlexLayout::New();
header.SetDirection(FlexDirection::ROW);
header.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
header.SetAlignItems(FlexAlign::CENTER);
header.SetRequestedWidth(MATCH_PARENT);

FlexLayout headerText = FlexLayout::New();
headerText.SetDirection(FlexDirection::COLUMN);
headerText.SetAlignItems(FlexAlign::FLEX_START);

Label greeting = Label::New("Good morning,");
greeting.SetFontSize(56);
greeting.SetTextColor(UiColor(0x8087a6));

Label userName = Label::New("Alex");
userName.SetFontSize(119);
userName.SetTextColor(UiColor(0xffffff));
userName.SetMargin(Extents(0, 0, 14, 0));

headerText.AddChildren({ greeting, userName });

ImageView portrait = ImageView::New("assets/portrait1.jpg");
portrait.SetRequestedWidth(238.0f);
portrait.SetRequestedHeight(238.0f);
portrait.SetCornerRadius(119.0f);

header.AddChildren({ headerText, portrait });

View headerSpacer = View::New();
headerSpacer.SetRequestedHeight(127.4f);

// ========== ACTIVITY SUMMARY CARD ==========
FlexLayout activityCard = FlexLayout::New();
activityCard.SetDirection(FlexDirection::COLUMN);
activityCard.SetRequestedWidth(MATCH_PARENT);
activityCard.SetBackgroundColor(UiColor(0x15182a));
activityCard.SetCornerRadius(84.0f);
activityCard.SetPadding(Extents(91, 91, 84, 84));

FlexLayout activityHeader = FlexLayout::New();
activityHeader.SetDirection(FlexDirection::ROW);
activityHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
activityHeader.SetAlignItems(FlexAlign::CENTER);
activityHeader.SetRequestedWidth(MATCH_PARENT);

Label activityTitle = Label::New("TODAY'S ACTIVITY");
activityTitle.SetFontSize(39);
activityTitle.SetTextColor(UiColor(0x7a82a5));

Label activityDate = Label::New("Apr 14");
activityDate.SetFontSize(39);
activityDate.SetTextColor(UiColor(0x7a82a5));

activityHeader.AddChildren({ activityTitle, activityDate });

View activitySpacer1 = View::New();
activitySpacer1.SetRequestedHeight(63.7f);

Label stepsLabel = Label::New("<font size='217'>8,412</font><font size='84'>  / 10,000 steps</font>");
stepsLabel.SetMarkupEnabled(true);
stepsLabel.SetTextColor(UiColor(0xffffff));

View activitySpacer2 = View::New();
activitySpacer2.SetRequestedHeight(63.7f);

// Progress bar
FlexLayout progressTrack = FlexLayout::New();
progressTrack.SetDirection(FlexDirection::ROW);
progressTrack.SetRequestedWidth(MATCH_PARENT);
progressTrack.SetRequestedHeight(28.0f);
progressTrack.SetBackgroundColor(UiColor(0x242842));
progressTrack.SetCornerRadius(14.0f);

View progressFill = View::New();
progressFill.SetBackgroundColor(UiColor(0x00d4a8));
progressFill.SetRequestedWidth(1764.0f);
progressFill.SetRequestedHeight(28.0f);
progressFill.SetCornerRadius(14.0f);

progressTrack.AddChildren({ progressFill });

View activitySpacer3 = View::New();
activitySpacer3.SetRequestedHeight(100.1f);

// Stat pills row
FlexLayout statPills = FlexLayout::New();
statPills.SetDirection(FlexDirection::ROW);
statPills.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
statPills.SetRequestedWidth(MATCH_PARENT);

FlexLayout caloriesPill = FlexLayout::New();
caloriesPill.SetDirection(FlexDirection::COLUMN);
caloriesPill.SetAlignItems(FlexAlign::FLEX_START);
Label caloriesLabel = Label::New("Calories");
caloriesLabel.SetFontSize(42);
caloriesLabel.SetTextColor(UiColor(0x7a82a5));
Label caloriesValue = Label::New("<color value='#ff8a5c'>⧫ </color><color value='#ffffff'>482</color>");
caloriesValue.SetMarkupEnabled(true);
caloriesValue.SetFontSize(77);
caloriesValue.SetMargin(Extents(0, 0, 14, 0));
Label caloriesUnit = Label::New("kcal");
caloriesUnit.SetFontSize(39);
caloriesUnit.SetTextColor(UiColor(0x7a82a5));
caloriesPill.AddChildren({ caloriesLabel, caloriesValue, caloriesUnit });

FlexLayout distancePill = FlexLayout::New();
distancePill.SetDirection(FlexDirection::COLUMN);
distancePill.SetAlignItems(FlexAlign::FLEX_START);
Label distanceLabel = Label::New("Distance");
distanceLabel.SetFontSize(42);
distanceLabel.SetTextColor(UiColor(0x7a82a5));
Label distanceValue = Label::New("<color value='#5cb2ff'>◉ </color><color value='#ffffff'>6.2</color>");
distanceValue.SetMarkupEnabled(true);
distanceValue.SetFontSize(77);
distanceValue.SetMargin(Extents(0, 0, 14, 0));
Label distanceUnit = Label::New("km");
distanceUnit.SetFontSize(39);
distanceUnit.SetTextColor(UiColor(0x7a82a5));
distancePill.AddChildren({ distanceLabel, distanceValue, distanceUnit });

FlexLayout activePill = FlexLayout::New();
activePill.SetDirection(FlexDirection::COLUMN);
activePill.SetAlignItems(FlexAlign::FLEX_START);
Label activeLabel = Label::New("Active");
activeLabel.SetFontSize(42);
activeLabel.SetTextColor(UiColor(0x7a82a5));
Label activeValue = Label::New("<color value='#c879ff'>◆ </color><color value='#ffffff'>54</color>");
activeValue.SetMarkupEnabled(true);
activeValue.SetFontSize(77);
activeValue.SetMargin(Extents(0, 0, 14, 0));
Label activeUnit = Label::New("min");
activeUnit.SetFontSize(39);
activeUnit.SetTextColor(UiColor(0x7a82a5));
activePill.AddChildren({ activeLabel, activeValue, activeUnit });

statPills.AddChildren({ caloriesPill, distancePill, activePill });

activityCard.AddChildren({ activityHeader, activitySpacer1, stepsLabel, activitySpacer2, progressTrack, activitySpacer3, statPills });

View cardSpacer = View::New();
cardSpacer.SetRequestedHeight(81.9f);

// ========== HEART RATE CARD ==========
FlexLayout heartCard = FlexLayout::New();
heartCard.SetDirection(FlexDirection::COLUMN);
heartCard.SetRequestedWidth(MATCH_PARENT);
heartCard.SetBackgroundColor(UiColor(0x15182a));
heartCard.SetCornerRadius(84.0f);
heartCard.SetPadding(Extents(91, 91, 77, 77));

FlexLayout heartHeader = FlexLayout::New();
heartHeader.SetDirection(FlexDirection::ROW);
heartHeader.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
heartHeader.SetAlignItems(FlexAlign::CENTER);
heartHeader.SetRequestedWidth(MATCH_PARENT);

FlexLayout heartRateCol = FlexLayout::New();
heartRateCol.SetDirection(FlexDirection::COLUMN);
heartRateCol.SetAlignItems(FlexAlign::FLEX_START);
Label heartRateLabel = Label::New("HEART RATE");
heartRateLabel.SetFontSize(39);
heartRateLabel.SetTextColor(UiColor(0x7a82a5));
Label heartRateValue = Label::New("<color value='#ff4d7a'>♥ </color><color value='#ffffff'><font size='140'>72</font></color><color value='#7a82a5'><font size='63'> bpm</font></color>");
heartRateValue.SetMarkupEnabled(true);
heartRateValue.SetMargin(Extents(0, 0, 21, 0));
heartRateCol.AddChildren({ heartRateLabel, heartRateValue });

FlexLayout restingCol = FlexLayout::New();
restingCol.SetDirection(FlexDirection::COLUMN);
restingCol.SetAlignItems(FlexAlign::FLEX_END);
Label restingLabel = Label::New("RESTING");
restingLabel.SetFontSize(35);
restingLabel.SetTextColor(UiColor(0x7a82a5));
Label restingValue = Label::New("62");
restingValue.SetFontSize(77);
restingValue.SetTextColor(UiColor(0xd7ddf5));
restingValue.SetMargin(Extents(0, 0, 14, 0));
restingCol.AddChildren({ restingLabel, restingValue });

heartHeader.AddChildren({ heartRateCol, restingCol });

View heartSpacer1 = View::New();
heartSpacer1.SetRequestedHeight(72.8f);

// Fake heart-rate sparkline using bars of varying height
FlexLayout sparkline = FlexLayout::New();
sparkline.SetDirection(FlexDirection::ROW);
sparkline.SetAlignItems(FlexAlign::FLEX_END);
sparkline.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
sparkline.SetRequestedWidth(MATCH_PARENT);
sparkline.SetRequestedHeight(280.0f);

View bar1 = View::New();
bar1.SetBackgroundColor(UiColor(0xff4d7a));
bar1.SetRequestedWidth(21.0f);
bar1.SetRequestedHeight(91.0f);
bar1.SetCornerRadius(10.5f);
View bar2 = View::New();
bar2.SetBackgroundColor(UiColor(0xff4d7a));
bar2.SetRequestedWidth(21.0f);
bar2.SetRequestedHeight(119.0f);
bar2.SetCornerRadius(10.5f);
View bar3 = View::New();
bar3.SetBackgroundColor(UiColor(0xff4d7a));
bar3.SetRequestedWidth(21.0f);
bar3.SetRequestedHeight(77.0f);
bar3.SetCornerRadius(10.5f);
View bar4 = View::New();
bar4.SetBackgroundColor(UiColor(0xff4d7a));
bar4.SetRequestedWidth(21.0f);
bar4.SetRequestedHeight(161.0f);
bar4.SetCornerRadius(10.5f);
View bar5 = View::New();
bar5.SetBackgroundColor(UiColor(0xff4d7a));
bar5.SetRequestedWidth(21.0f);
bar5.SetRequestedHeight(203.0f);
bar5.SetCornerRadius(10.5f);
View bar6 = View::New();
bar6.SetBackgroundColor(UiColor(0xff4d7a));
bar6.SetRequestedWidth(21.0f);
bar6.SetRequestedHeight(245.0f);
bar6.SetCornerRadius(10.5f);
View bar7 = View::New();
bar7.SetBackgroundColor(UiColor(0xff4d7a));
bar7.SetRequestedWidth(21.0f);
bar7.SetRequestedHeight(224.0f);
bar7.SetCornerRadius(10.5f);
View bar8 = View::New();
bar8.SetBackgroundColor(UiColor(0xff4d7a));
bar8.SetRequestedWidth(21.0f);
bar8.SetRequestedHeight(182.0f);
bar8.SetCornerRadius(10.5f);
View bar9 = View::New();
bar9.SetBackgroundColor(UiColor(0xff4d7a));
bar9.SetRequestedWidth(21.0f);
bar9.SetRequestedHeight(140.0f);
bar9.SetCornerRadius(10.5f);
View bar10 = View::New();
bar10.SetBackgroundColor(UiColor(0xff4d7a));
bar10.SetRequestedWidth(21.0f);
bar10.SetRequestedHeight(168.0f);
bar10.SetCornerRadius(10.5f);
View bar11 = View::New();
bar11.SetBackgroundColor(UiColor(0xff4d7a));
bar11.SetRequestedWidth(21.0f);
bar11.SetRequestedHeight(217.0f);
bar11.SetCornerRadius(10.5f);
View bar12 = View::New();
bar12.SetBackgroundColor(UiColor(0xff4d7a));
bar12.SetRequestedWidth(21.0f);
bar12.SetRequestedHeight(196.0f);
bar12.SetCornerRadius(10.5f);
View bar13 = View::New();
bar13.SetBackgroundColor(UiColor(0xff4d7a));
bar13.SetRequestedWidth(21.0f);
bar13.SetRequestedHeight(154.0f);
bar13.SetCornerRadius(10.5f);
View bar14 = View::New();
bar14.SetBackgroundColor(UiColor(0xff4d7a));
bar14.SetRequestedWidth(21.0f);
bar14.SetRequestedHeight(133.0f);
bar14.SetCornerRadius(10.5f);
View bar15 = View::New();
bar15.SetBackgroundColor(UiColor(0xff4d7a));
bar15.SetRequestedWidth(21.0f);
bar15.SetRequestedHeight(175.0f);
bar15.SetCornerRadius(10.5f);
View bar16 = View::New();
bar16.SetBackgroundColor(UiColor(0xff4d7a));
bar16.SetRequestedWidth(21.0f);
bar16.SetRequestedHeight(231.0f);
bar16.SetCornerRadius(10.5f);
View bar17 = View::New();
bar17.SetBackgroundColor(UiColor(0xff4d7a));
bar17.SetRequestedWidth(21.0f);
bar17.SetRequestedHeight(147.0f);
bar17.SetCornerRadius(10.5f);
View bar18 = View::New();
bar18.SetBackgroundColor(UiColor(0xff4d7a));
bar18.SetRequestedWidth(21.0f);
bar18.SetRequestedHeight(105.0f);
bar18.SetCornerRadius(10.5f);
View bar19 = View::New();
bar19.SetBackgroundColor(UiColor(0xff4d7a));
bar19.SetRequestedWidth(21.0f);
bar19.SetRequestedHeight(126.0f);
bar19.SetCornerRadius(10.5f);
View bar20 = View::New();
bar20.SetBackgroundColor(UiColor(0xff4d7a));
bar20.SetRequestedWidth(21.0f);
bar20.SetRequestedHeight(98.0f);
bar20.SetCornerRadius(10.5f);
sparkline.AddChildren({ bar1, bar2, bar3, bar4, bar5, bar6, bar7, bar8, bar9, bar10, bar11, bar12, bar13, bar14, bar15, bar16, bar17, bar18, bar19, bar20 });

View heartSpacer2 = View::New();
heartSpacer2.SetRequestedHeight(45.5f);

FlexLayout heartAxis = FlexLayout::New();
heartAxis.SetDirection(FlexDirection::ROW);
heartAxis.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
heartAxis.SetRequestedWidth(MATCH_PARENT);
Label axis6am = Label::New("6AM");
axis6am.SetFontSize(39);
axis6am.SetTextColor(UiColor(0x7a82a5));
Label axis9am = Label::New("9AM");
axis9am.SetFontSize(39);
axis9am.SetTextColor(UiColor(0x7a82a5));
Label axis12pm = Label::New("12PM");
axis12pm.SetFontSize(39);
axis12pm.SetTextColor(UiColor(0x7a82a5));
Label axis3pm = Label::New("3PM");
axis3pm.SetFontSize(39);
axis3pm.SetTextColor(UiColor(0x7a82a5));
Label axisNow = Label::New("Now");
axisNow.SetFontSize(39);
axisNow.SetTextColor(UiColor(0xffffff));
heartAxis.AddChildren({ axis6am, axis9am, axis12pm, axis3pm, axisNow });

heartCard.AddChildren({ heartHeader, heartSpacer1, sparkline, heartSpacer2, heartAxis });

View flexSpacer = View::New();
flexSpacer.SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f));

// ========== WORKOUTS ROW ==========
Label workoutsTitle = Label::New("Recent Workouts");
workoutsTitle.SetFontSize(63);
workoutsTitle.SetTextColor(UiColor(0xffffff));

View workoutsSpacer = View::New();
workoutsSpacer.SetRequestedHeight(63.7f);

FlexLayout workoutsRow = FlexLayout::New();
workoutsRow.SetDirection(FlexDirection::ROW);
workoutsRow.SetRequestedWidth(MATCH_PARENT);

FlexLayout runningCard = FlexLayout::New();
runningCard.SetDirection(FlexDirection::COLUMN);
runningCard.SetRequestedWidth(686.0f);
runningCard.SetBackgroundColor(UiColor(0x15182a));
runningCard.SetCornerRadius(70.0f);
runningCard.SetPadding(Extents(63, 63, 63, 63));
runningCard.SetMargin(Extents(0, 49, 0, 0));
Label runningIcon = Label::New("◉");
runningIcon.SetFontSize(98);
runningIcon.SetTextColor(UiColor(0x00d4a8));
Label runningName = Label::New("Running");
runningName.SetFontSize(53);
runningName.SetTextColor(UiColor(0xffffff));
runningName.SetMargin(Extents(0, 0, 49, 0));
Label runningDist = Label::New("5.2 km");
runningDist.SetFontSize(46);
runningDist.SetTextColor(UiColor(0x7a82a5));
runningDist.SetMargin(Extents(0, 0, 14, 0));
Label runningTime = Label::New("32 min");
runningTime.SetFontSize(46);
runningTime.SetTextColor(UiColor(0x7a82a5));
runningCard.AddChildren({ runningIcon, runningName, runningDist, runningTime });

FlexLayout yogaCard = FlexLayout::New();
yogaCard.SetDirection(FlexDirection::COLUMN);
yogaCard.SetRequestedWidth(686.0f);
yogaCard.SetBackgroundColor(UiColor(0x15182a));
yogaCard.SetCornerRadius(70.0f);
yogaCard.SetPadding(Extents(63, 63, 63, 63));
yogaCard.SetMargin(Extents(0, 49, 0, 0));
Label yogaIcon = Label::New("◆");
yogaIcon.SetFontSize(98);
yogaIcon.SetTextColor(UiColor(0xc879ff));
Label yogaName = Label::New("Yoga");
yogaName.SetFontSize(53);
yogaName.SetTextColor(UiColor(0xffffff));
yogaName.SetMargin(Extents(0, 0, 49, 0));
Label yogaDesc = Label::New("Flow class");
yogaDesc.SetFontSize(46);
yogaDesc.SetTextColor(UiColor(0x7a82a5));
yogaDesc.SetMargin(Extents(0, 0, 14, 0));
Label yogaTime = Label::New("45 min");
yogaTime.SetFontSize(46);
yogaTime.SetTextColor(UiColor(0x7a82a5));
yogaCard.AddChildren({ yogaIcon, yogaName, yogaDesc, yogaTime });

FlexLayout cyclingCard = FlexLayout::New();
cyclingCard.SetDirection(FlexDirection::COLUMN);
cyclingCard.SetRequestedWidth(686.0f);
cyclingCard.SetBackgroundColor(UiColor(0x15182a));
cyclingCard.SetCornerRadius(70.0f);
cyclingCard.SetPadding(Extents(63, 63, 63, 63));
Label cyclingIcon = Label::New("⧫");
cyclingIcon.SetFontSize(98);
cyclingIcon.SetTextColor(UiColor(0xff8a5c));
Label cyclingName = Label::New("Cycling");
cyclingName.SetFontSize(53);
cyclingName.SetTextColor(UiColor(0xffffff));
cyclingName.SetMargin(Extents(0, 0, 49, 0));
Label cyclingDist = Label::New("18.4 km");
cyclingDist.SetFontSize(46);
cyclingDist.SetTextColor(UiColor(0x7a82a5));
cyclingDist.SetMargin(Extents(0, 0, 14, 0));
Label cyclingTime = Label::New("52 min");
cyclingTime.SetFontSize(46);
cyclingTime.SetTextColor(UiColor(0x7a82a5));
cyclingCard.AddChildren({ cyclingIcon, cyclingName, cyclingDist, cyclingTime });

workoutsRow.AddChildren({ runningCard, yogaCard, cyclingCard });

root.AddChildren({ header, headerSpacer, activityCard, cardSpacer, heartCard, flexSpacer, workoutsTitle, workoutsSpacer, workoutsRow });
return root;
