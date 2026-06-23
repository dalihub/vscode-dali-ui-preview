// @preview-config: name="Toast", width=640, height=420

// A toast that slides UP into place and fades in, then stops (NON-looping).
// The card is a child of a plain View root and marked STANDALONE so its
// POSITION is driven by us, not by a layout. Animates POSITION_Y + COLOR_ALPHA.

FlexLayout card = FlexLayout::New();
card.SetLayoutMode(LayoutMode::STANDALONE);
card.SetDirection(FlexDirection::ROW);
card.SetAlignItems(FlexAlign::CENTER);
card.SetRequestedWidth(520.0f);
card.SetRequestedHeight(120.0f);
card.SetBackgroundColor(UiColor(0x1b2138));
card.SetCornerRadius(28.0f);
card.SetPadding(Extents(32, 32, 0, 0));
FlexLayout icon = FlexLayout::New();
icon.SetJustifyContent(FlexJustify::CENTER);
icon.SetAlignItems(FlexAlign::CENTER);
icon.SetRequestedWidth(72.0f);
icon.SetRequestedHeight(72.0f);
icon.SetBackgroundColor(UiColor(0x00d4a8));
icon.SetCornerRadius(36.0f);
Label iconLabel = Label::New("OK");
iconLabel.SetFontSize(30);
iconLabel.SetTextColor(UiColor(0x07271f));
icon.AddChildren({ iconLabel });
Label message = Label::New("Saved to your library");
message.SetFontSize(32);
message.SetTextColor(UiColor(0xffffff));
message.SetMargin(Extents(26, 0, 0, 0));
card.AddChildren({
    icon,
    message,
});
card.SetProperty(Actor::Property::PARENT_ORIGIN, ParentOrigin::TOP_LEFT);
card.SetProperty(Actor::Property::PIVOT, Vector3(0.0f, 0.0f, 0.5f));
card.SetProperty(Actor::Property::POSITION, Vector2(60.0f, 250.0f)); // start lower
card.SetProperty(Actor::Property::COLOR_ALPHA, 0.0f);

View root = View::New();
root.SetBackgroundColor(UiColor(0x0e1225));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.AddChildren({ card });

Animation toastIn = Animation::New(0.8f);
toastIn.AnimateTo(Property(card, Actor::Property::POSITION_Y), 150.0f, AlphaFunction::EASE_OUT);
toastIn.AnimateTo(Property(card, Actor::Property::COLOR_ALPHA), 1.0f, AlphaFunction::EASE_OUT);
toastIn.Play();

return root;
