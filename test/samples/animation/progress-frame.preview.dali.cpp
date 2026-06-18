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

Animation pulse = Animation::New(3.0f);
pulse.AnimateTo(Property(fab, Actor::Property::SCALE), Vector3(1.45f, 1.45f, 1.0f), AlphaFunction::EASE_IN_OUT);
pulse.SetLooping(true);
pulse.SetLoopingMode(Animation::AUTO_REVERSE);
pulse.Play();

return root;
