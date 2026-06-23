StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
root.SetSpacing(0.0f);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x1a1a2e));
root.SetPadding(Extents(32, 32, 24, 16));

// ── Header ──
Label header = Label::New("Settings");
header.SetFontSize(36);
header.SetTextColor(UiColor(0xFFFFFF));
header.SetRequestedHeight(48.0f);

// ── Divider ──
View divider = View::New();
divider.SetBackgroundColor(UiColor(0x6c63ff));
divider.SetRequestedWidth(MATCH_PARENT);
divider.SetRequestedHeight(2.0f);
divider.SetMargin(Extents(0, 0, 8, 16));

// ── Display Section ──
Label displayLabel = Label::New("Display");
displayLabel.SetFontSize(14);
displayLabel.SetTextColor(UiColor(0x6c63ff));
displayLabel.SetRequestedHeight(22.0f);

// Brightness row
View brightnessIcon = View::New();
brightnessIcon.SetBackgroundColor(UiColor(0xf9a825));
brightnessIcon.SetRequestedWidth(24.0f);
brightnessIcon.SetRequestedHeight(24.0f);
Label brightnessText = Label::New("Brightness");
brightnessText.SetFontSize(18);
brightnessText.SetTextColor(UiColor(0xe0e0e0));
brightnessText.SetMargin(Extents(12, 0, 0, 0));
FlexLayout brightnessLeft = FlexLayout::New();
brightnessLeft.SetDirection(FlexDirection::ROW);
brightnessLeft.SetAlignItems(FlexAlign::CENTER);
brightnessLeft.AddChildren({
    brightnessIcon,
    brightnessText,
});
View brightnessToggle = View::New();
brightnessToggle.SetBackgroundColor(UiColor(0x4caf50));
brightnessToggle.SetRequestedWidth(48.0f);
brightnessToggle.SetRequestedHeight(22.0f);
FlexLayout brightnessRow = FlexLayout::New();
brightnessRow.SetDirection(FlexDirection::ROW);
brightnessRow.SetAlignItems(FlexAlign::CENTER);
brightnessRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
brightnessRow.SetRequestedWidth(MATCH_PARENT);
brightnessRow.SetRequestedHeight(44.0f);
brightnessRow.SetBackgroundColor(UiColor(0x22223a));
brightnessRow.SetPadding(Extents(16, 16, 0, 0));
brightnessRow.AddChildren({
    brightnessLeft,
    brightnessToggle,
});

View displaySeparator = View::New();
displaySeparator.SetBackgroundColor(UiColor(0x2a2a48));
displaySeparator.SetRequestedWidth(MATCH_PARENT);
displaySeparator.SetRequestedHeight(1.0f);

// Dark Mode row
View darkModeIcon = View::New();
darkModeIcon.SetBackgroundColor(UiColor(0x7c4dff));
darkModeIcon.SetRequestedWidth(24.0f);
darkModeIcon.SetRequestedHeight(24.0f);
Label darkModeText = Label::New("Dark Mode");
darkModeText.SetFontSize(18);
darkModeText.SetTextColor(UiColor(0xe0e0e0));
darkModeText.SetMargin(Extents(12, 0, 0, 0));
FlexLayout darkModeLeft = FlexLayout::New();
darkModeLeft.SetDirection(FlexDirection::ROW);
darkModeLeft.SetAlignItems(FlexAlign::CENTER);
darkModeLeft.AddChildren({
    darkModeIcon,
    darkModeText,
});
View darkModeToggle = View::New();
darkModeToggle.SetBackgroundColor(UiColor(0x4caf50));
darkModeToggle.SetRequestedWidth(48.0f);
darkModeToggle.SetRequestedHeight(22.0f);
FlexLayout darkModeRow = FlexLayout::New();
darkModeRow.SetDirection(FlexDirection::ROW);
darkModeRow.SetAlignItems(FlexAlign::CENTER);
darkModeRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
darkModeRow.SetRequestedWidth(MATCH_PARENT);
darkModeRow.SetRequestedHeight(44.0f);
darkModeRow.SetBackgroundColor(UiColor(0x22223a));
darkModeRow.SetPadding(Extents(16, 16, 0, 0));
darkModeRow.AddChildren({
    darkModeLeft,
    darkModeToggle,
});

// ── Spacer ──
View displaySpacer = View::New();
displaySpacer.SetRequestedHeight(12.0f);

// ── Sound Section ──
Label soundLabel = Label::New("Sound");
soundLabel.SetFontSize(14);
soundLabel.SetTextColor(UiColor(0x6c63ff));
soundLabel.SetRequestedHeight(22.0f);

// Volume row
View volumeIcon = View::New();
volumeIcon.SetBackgroundColor(UiColor(0xef5350));
volumeIcon.SetRequestedWidth(24.0f);
volumeIcon.SetRequestedHeight(24.0f);
Label volumeText = Label::New("Volume");
volumeText.SetFontSize(18);
volumeText.SetTextColor(UiColor(0xe0e0e0));
volumeText.SetMargin(Extents(12, 0, 0, 0));
FlexLayout volumeLeft = FlexLayout::New();
volumeLeft.SetDirection(FlexDirection::ROW);
volumeLeft.SetAlignItems(FlexAlign::CENTER);
volumeLeft.AddChildren({
    volumeIcon,
    volumeText,
});
View volumeToggle = View::New();
volumeToggle.SetBackgroundColor(UiColor(0x4caf50));
volumeToggle.SetRequestedWidth(48.0f);
volumeToggle.SetRequestedHeight(22.0f);
FlexLayout volumeRow = FlexLayout::New();
volumeRow.SetDirection(FlexDirection::ROW);
volumeRow.SetAlignItems(FlexAlign::CENTER);
volumeRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
volumeRow.SetRequestedWidth(MATCH_PARENT);
volumeRow.SetRequestedHeight(44.0f);
volumeRow.SetBackgroundColor(UiColor(0x1e2038));
volumeRow.SetPadding(Extents(16, 16, 0, 0));
volumeRow.AddChildren({
    volumeLeft,
    volumeToggle,
});

View soundSeparator = View::New();
soundSeparator.SetBackgroundColor(UiColor(0x2a2a48));
soundSeparator.SetRequestedWidth(MATCH_PARENT);
soundSeparator.SetRequestedHeight(1.0f);

// Vibration row
View vibrationIcon = View::New();
vibrationIcon.SetBackgroundColor(UiColor(0xff7043));
vibrationIcon.SetRequestedWidth(24.0f);
vibrationIcon.SetRequestedHeight(24.0f);
Label vibrationText = Label::New("Vibration");
vibrationText.SetFontSize(18);
vibrationText.SetTextColor(UiColor(0xe0e0e0));
vibrationText.SetMargin(Extents(12, 0, 0, 0));
FlexLayout vibrationLeft = FlexLayout::New();
vibrationLeft.SetDirection(FlexDirection::ROW);
vibrationLeft.SetAlignItems(FlexAlign::CENTER);
vibrationLeft.AddChildren({
    vibrationIcon,
    vibrationText,
});
View vibrationToggle = View::New();
vibrationToggle.SetBackgroundColor(UiColor(0x555568));
vibrationToggle.SetRequestedWidth(48.0f);
vibrationToggle.SetRequestedHeight(22.0f);
FlexLayout vibrationRow = FlexLayout::New();
vibrationRow.SetDirection(FlexDirection::ROW);
vibrationRow.SetAlignItems(FlexAlign::CENTER);
vibrationRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
vibrationRow.SetRequestedWidth(MATCH_PARENT);
vibrationRow.SetRequestedHeight(44.0f);
vibrationRow.SetBackgroundColor(UiColor(0x1e2038));
vibrationRow.SetPadding(Extents(16, 16, 0, 0));
vibrationRow.AddChildren({
    vibrationLeft,
    vibrationToggle,
});

// ── Spacer ──
View soundSpacer = View::New();
soundSpacer.SetRequestedHeight(12.0f);

// ── Network Section ──
Label networkLabel = Label::New("Network");
networkLabel.SetFontSize(14);
networkLabel.SetTextColor(UiColor(0x6c63ff));
networkLabel.SetRequestedHeight(22.0f);

// Wi-Fi row
View wifiIcon = View::New();
wifiIcon.SetBackgroundColor(UiColor(0x42a5f5));
wifiIcon.SetRequestedWidth(24.0f);
wifiIcon.SetRequestedHeight(24.0f);
Label wifiText = Label::New("Wi-Fi");
wifiText.SetFontSize(18);
wifiText.SetTextColor(UiColor(0xe0e0e0));
wifiText.SetMargin(Extents(12, 0, 0, 0));
FlexLayout wifiLeft = FlexLayout::New();
wifiLeft.SetDirection(FlexDirection::ROW);
wifiLeft.SetAlignItems(FlexAlign::CENTER);
wifiLeft.AddChildren({
    wifiIcon,
    wifiText,
});
View wifiToggle = View::New();
wifiToggle.SetBackgroundColor(UiColor(0x4caf50));
wifiToggle.SetRequestedWidth(48.0f);
wifiToggle.SetRequestedHeight(22.0f);
FlexLayout wifiRow = FlexLayout::New();
wifiRow.SetDirection(FlexDirection::ROW);
wifiRow.SetAlignItems(FlexAlign::CENTER);
wifiRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
wifiRow.SetRequestedWidth(MATCH_PARENT);
wifiRow.SetRequestedHeight(44.0f);
wifiRow.SetBackgroundColor(UiColor(0x1c1e36));
wifiRow.SetPadding(Extents(16, 16, 0, 0));
wifiRow.AddChildren({
    wifiLeft,
    wifiToggle,
});

View wifiSeparator = View::New();
wifiSeparator.SetBackgroundColor(UiColor(0x2a2a48));
wifiSeparator.SetRequestedWidth(MATCH_PARENT);
wifiSeparator.SetRequestedHeight(1.0f);

// Bluetooth row
View bluetoothIcon = View::New();
bluetoothIcon.SetBackgroundColor(UiColor(0x1565c0));
bluetoothIcon.SetRequestedWidth(24.0f);
bluetoothIcon.SetRequestedHeight(24.0f);
Label bluetoothText = Label::New("Bluetooth");
bluetoothText.SetFontSize(18);
bluetoothText.SetTextColor(UiColor(0xe0e0e0));
bluetoothText.SetMargin(Extents(12, 0, 0, 0));
FlexLayout bluetoothLeft = FlexLayout::New();
bluetoothLeft.SetDirection(FlexDirection::ROW);
bluetoothLeft.SetAlignItems(FlexAlign::CENTER);
bluetoothLeft.AddChildren({
    bluetoothIcon,
    bluetoothText,
});
View bluetoothToggle = View::New();
bluetoothToggle.SetBackgroundColor(UiColor(0x555568));
bluetoothToggle.SetRequestedWidth(48.0f);
bluetoothToggle.SetRequestedHeight(22.0f);
FlexLayout bluetoothRow = FlexLayout::New();
bluetoothRow.SetDirection(FlexDirection::ROW);
bluetoothRow.SetAlignItems(FlexAlign::CENTER);
bluetoothRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
bluetoothRow.SetRequestedWidth(MATCH_PARENT);
bluetoothRow.SetRequestedHeight(44.0f);
bluetoothRow.SetBackgroundColor(UiColor(0x1c1e36));
bluetoothRow.SetPadding(Extents(16, 16, 0, 0));
bluetoothRow.AddChildren({
    bluetoothLeft,
    bluetoothToggle,
});

View bluetoothSeparator = View::New();
bluetoothSeparator.SetBackgroundColor(UiColor(0x2a2a48));
bluetoothSeparator.SetRequestedWidth(MATCH_PARENT);
bluetoothSeparator.SetRequestedHeight(1.0f);

// Airplane Mode row
View airplaneIcon = View::New();
airplaneIcon.SetBackgroundColor(UiColor(0x66bb6a));
airplaneIcon.SetRequestedWidth(24.0f);
airplaneIcon.SetRequestedHeight(24.0f);
Label airplaneText = Label::New("Airplane Mode");
airplaneText.SetFontSize(18);
airplaneText.SetTextColor(UiColor(0xe0e0e0));
airplaneText.SetMargin(Extents(12, 0, 0, 0));
FlexLayout airplaneLeft = FlexLayout::New();
airplaneLeft.SetDirection(FlexDirection::ROW);
airplaneLeft.SetAlignItems(FlexAlign::CENTER);
airplaneLeft.AddChildren({
    airplaneIcon,
    airplaneText,
});
View airplaneToggle = View::New();
airplaneToggle.SetBackgroundColor(UiColor(0x555568));
airplaneToggle.SetRequestedWidth(48.0f);
airplaneToggle.SetRequestedHeight(22.0f);
FlexLayout airplaneRow = FlexLayout::New();
airplaneRow.SetDirection(FlexDirection::ROW);
airplaneRow.SetAlignItems(FlexAlign::CENTER);
airplaneRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
airplaneRow.SetRequestedWidth(MATCH_PARENT);
airplaneRow.SetRequestedHeight(44.0f);
airplaneRow.SetBackgroundColor(UiColor(0x1c1e36));
airplaneRow.SetPadding(Extents(16, 16, 0, 0));
airplaneRow.AddChildren({
    airplaneLeft,
    airplaneToggle,
});

// ── Footer ──
View footerSpacer = View::New();
footerSpacer.SetRequestedHeight(16.0f);
Label versionLabel = Label::New("Version 2.4.1");
versionLabel.SetFontSize(12);
versionLabel.SetTextColor(UiColor(0x555568));
versionLabel.SetRequestedHeight(20.0f);

root.AddChildren({

    // ── Header ──
    header,

    // ── Divider ──
    divider,

    // ── Display Section ──
    displayLabel,

    // Brightness row
    brightnessRow,

    displaySeparator,

    // Dark Mode row
    darkModeRow,

    // ── Spacer ──
    displaySpacer,

    // ── Sound Section ──
    soundLabel,

    // Volume row
    volumeRow,

    soundSeparator,

    // Vibration row
    vibrationRow,

    // ── Spacer ──
    soundSpacer,

    // ── Network Section ──
    networkLabel,

    // Wi-Fi row
    wifiRow,

    wifiSeparator,

    // Bluetooth row
    bluetoothRow,

    bluetoothSeparator,

    // Airplane Mode row
    airplaneRow,

    // ── Footer ──
    footerSpacer,
    versionLabel,
});
return root;
