// @preview-config: name="Pulse", width=420, height=420

// Realistic dali-ui animation: a floating action button (FAB) that PULSES to
// draw attention — a looping scale animation that grows then shrinks
// (AUTO_REVERSE). The motion is visible across the WHOLE timeline, so the
// scrubber and play button are obvious:
//   • drag the bar  → the button grows/shrinks smoothly at any point
//   • press play     → it pulses continuously
//
// Built with the normal FlexLayout / View / Label / UiColor idiom; the button
// is a named handle animated on the SCALE channel (safe to scrub — the layout
// pass doesn't touch transform).

FlexLayout fab = FlexLayout::New();
fab.SetJustifyContent(FlexJustify::CENTER);
fab.SetAlignItems(FlexAlign::CENTER);
fab.SetRequestedWidth(180.0f);
fab.SetRequestedHeight(180.0f);
fab.SetBackgroundColor(UiColor(0x3d7bff));
fab.SetCornerRadius(90.0f);

Label plus = Label::New("+");
plus.SetFontSize(96);
plus.SetTextColor(UiColor(0xffffff));
fab.AddChildren({ plus });

FlexLayout root = FlexLayout::New();
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0e1225));
root.AddChildren({ fab });

Animation pulse = Animation::New(0.9f);
pulse.AnimateTo(Property(fab, Actor::Property::SCALE), Vector3(1.45f, 1.45f, 1.0f), AlphaFunction::EASE_IN_OUT);
pulse.SetLooping(true);
pulse.SetLoopingMode(Animation::AUTO_REVERSE);
pulse.Play();

return root;
