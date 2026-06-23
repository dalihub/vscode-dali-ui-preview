// @preview-config: name="Progress", width=720, height=260

// Determinate progress bar that fills left → right, then stops (NON-looping).
// The fill grows via SCALE_X (a transform channel, so the layout never resets
// it), anchored at its left edge so it expands rightward. Scrub the bar to see
// any fill level; play to watch it fill once.

auto fill = View::New();
fill.SetBackgroundColor(UiColor(0x00d4a8));
fill.SetRequestedWidth(600.0f);
fill.SetRequestedHeight(24.0f);
fill.SetCornerRadius(12.0f);
fill.SetProperty(Actor::Property::PARENT_ORIGIN, ParentOrigin::TOP_LEFT);
fill.SetProperty(Actor::Property::PIVOT, Vector3(0.0f, 0.5f, 0.5f)); // anchor at left edge
fill.SetProperty(Actor::Property::SCALE_X, 0.0f);                    // start empty

auto track = View::New();
track.SetBackgroundColor(UiColor(0x242842));
track.SetRequestedWidth(600.0f);
track.SetRequestedHeight(24.0f);
track.SetCornerRadius(12.0f);
track.AddChildren({ fill });

auto root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0b0d16));
Label title = Label::New("Downloading update");
title.SetFontSize(34);
title.SetTextColor(UiColor(0xffffff));
title.SetMargin(Extents(0, 0, 0, 28));
root.AddChildren({
    title,
    track,
});

Animation progress = Animation::New(1.6f);
progress.AnimateTo(Property(fill, Actor::Property::SCALE_X), 1.0f, AlphaFunction::EASE_IN_OUT);
progress.Play();

return root;
