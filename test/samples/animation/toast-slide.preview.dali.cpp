// @preview-config: name="Toast", width=640, height=420

// A toast that slides UP into place and fades in, then stops (NON-looping).
// The card is a child of a plain View root and marked STANDALONE so its
// POSITION is driven by us, not by a layout. Animates POSITION_Y + COLOR_ALPHA.

auto card = FlexLayout::New()
    .SetLayoutMode(LayoutMode::STANDALONE)
    .SetDirection(FlexDirection::ROW)
    .SetAlignItems(FlexAlign::CENTER)
    .SetRequestedWidth(520.0f)
    .SetRequestedHeight(120.0f)
    .SetBackgroundColor(UiColor(0x1b2138))
    .SetCornerRadius(28.0f)
    .SetPadding(Extents(32, 32, 0, 0))
    .Children({
        FlexLayout::New()
            .SetJustifyContent(FlexJustify::CENTER).SetAlignItems(FlexAlign::CENTER)
            .SetRequestedWidth(72.0f).SetRequestedHeight(72.0f)
            .SetBackgroundColor(UiColor(0x00d4a8)).SetCornerRadius(36.0f)
            .Children({ Label::New("OK").SetFontSize(30).SetTextColor(UiColor(0x07271f)) }),
        Label::New("Saved to your library")
            .SetFontSize(32).SetTextColor(UiColor(0xffffff))
            .SetMargin(Extents(26, 0, 0, 0)),
    });
card.SetProperty(Actor::Property::PARENT_ORIGIN, ParentOrigin::TOP_LEFT);
card.SetProperty(Actor::Property::PIVOT, Vector3(0.0f, 0.0f, 0.5f));
card.SetProperty(Actor::Property::POSITION, Vector2(60.0f, 250.0f)); // start lower
card.SetProperty(Actor::Property::COLOR_ALPHA, 0.0f);

auto root = View::New()
    .SetBackgroundColor(UiColor(0x0e1225))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({ card });

Animation toastIn = Animation::New(0.8f);
toastIn.AnimateTo(Property(card, Actor::Property::POSITION_Y), 150.0f, AlphaFunction::EASE_OUT);
toastIn.AnimateTo(Property(card, Actor::Property::COLOR_ALPHA), 1.0f, AlphaFunction::EASE_OUT);
toastIn.Play();

return root;
