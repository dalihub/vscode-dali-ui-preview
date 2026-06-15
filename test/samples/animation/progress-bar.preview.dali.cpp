// @preview-config: name="Progress", width=720, height=260

// Determinate progress bar that fills left → right, then stops (NON-looping).
// The fill grows via SCALE_X (a transform channel, so the layout never resets
// it), anchored at its left edge so it expands rightward. Scrub the bar to see
// any fill level; play to watch it fill once.

auto fill = View::New()
    .SetBackgroundColor(UiColor(0x00d4a8))
    .SetRequestedWidth(600.0f)
    .SetRequestedHeight(24.0f)
    .SetCornerRadius(12.0f);
fill.SetProperty(Actor::Property::PARENT_ORIGIN, ParentOrigin::TOP_LEFT);
fill.SetProperty(Actor::Property::PIVOT, Vector3(0.0f, 0.5f, 0.5f)); // anchor at left edge
fill.SetProperty(Actor::Property::SCALE_X, 0.0f);                    // start empty

auto track = View::New()
    .SetBackgroundColor(UiColor(0x242842))
    .SetRequestedWidth(600.0f)
    .SetRequestedHeight(24.0f)
    .SetCornerRadius(12.0f)
    .Children({ fill });

auto root = FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0b0d16))
    .Children({
        Label::New("Downloading update")
            .SetFontSize(34).SetTextColor(UiColor(0xffffff))
            .SetMargin(Extents(0, 0, 0, 28)),
        track,
    });

Animation progress = Animation::New(1.6f);
progress.AnimateTo(Property(fill, Actor::Property::SCALE_X), 1.0f, AlphaFunction::EASE_IN_OUT);
progress.Play();

return root;
