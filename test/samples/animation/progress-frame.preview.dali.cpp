// @preview-state: progress=0.4
//
// WU-M5.4 — `// @preview-state: progress=<f>` renders a single frame at the given
// timeline position WITHOUT touching the interactive scrubber. This is the pulse
// FAB from animation-scrub, but the directive above asks the preview to open
// already at 40% of the animation (the button shown at its 40%-grown size).
//
// How it works: progress forces the SERVER/dlopen path (the scrubber
// __SetPreviewProgress / RENDER_AT lives only in the resident plugin — the OPPOSITE
// routing from focus, which forces the harness). After the plugin loads, the host
// scrubs once to 0.4. Remove the directive and the preview opens at frame 0.
//
// Verified by Tier-3 smoke (live: open with the resident server up; the first
// frame is the 40% state) + the orchestrator routing unit test. Not a pixel golden
// (the scrubber is a server-only path; the harness golden runner can't drive it).

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
fab.AddChildren({
    plus,
});

FlexLayout root = FlexLayout::New();
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0e1225));
root.AddChildren({ fab });

Animation pulse = Animation::New(3.0f);
pulse.AnimateTo(Property(fab, Actor::Property::SCALE), Vector3(1.45f, 1.45f, 1.0f), AlphaFunction::EASE_IN_OUT);
pulse.SetLooping(true);
pulse.SetLoopingMode(Animation::AUTO_REVERSE);
pulse.Play();

return root;
