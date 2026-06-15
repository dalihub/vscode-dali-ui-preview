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

auto fab = FlexLayout::New()
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetRequestedWidth(180.0f)
    .SetRequestedHeight(180.0f)
    .SetBackgroundColor(UiColor(0x3d7bff))
    .SetCornerRadius(90.0f)
    .Children({
        Label::New("+").SetFontSize(96).SetTextColor(UiColor(0xffffff)),
    });

auto root = FlexLayout::New()
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0e1225))
    .Children({ fab });

Animation pulse = Animation::New(0.9f);
pulse.AnimateTo(Property(fab, Actor::Property::SCALE), Vector3(1.45f, 1.45f, 1.0f), AlphaFunction::EASE_IN_OUT);
pulse.SetLooping(true);
pulse.SetLoopingMode(Animation::AUTO_REVERSE);
pulse.Play();

return root;
