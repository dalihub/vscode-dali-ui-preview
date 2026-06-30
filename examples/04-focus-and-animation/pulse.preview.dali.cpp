// @preview-config: name="Pulse", width=420, height=420
//
// Animation — a looping pulse. When your preview code creates an Animation and
// calls .Play(), the panel shows a PLAYBACK SCRUBBER: drag the bar to scrub to any
// frame, or press play to watch it loop. (To freeze ONE frame without the scrubber,
// use `// @preview-state: progress=0.4` instead — see focus-grid's note.)
//
// Here a circular button PULSES on the SCALE channel (safe to scrub — the layout
// pass doesn't touch transform).

FlexLayout button = FlexLayout::New();
button.SetJustifyContent(FlexJustify::CENTER);
button.SetAlignItems(FlexAlign::CENTER);
button.SetRequestedWidth(180.0f);
button.SetRequestedHeight(180.0f);
button.SetBackgroundColor(UiColor(0x3d7bff));
button.SetCornerRadius(90.0f);

Label plus = Label::New("+");
plus.SetFontSize(96);
plus.SetTextColor(UiColor(0xffffff));
button.AddChildren({ plus });

FlexLayout root = FlexLayout::New();
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0e1225));
root.AddChildren({ button });

Animation pulse = Animation::New(0.9f);
pulse.AnimateTo(Property(button, Actor::Property::SCALE), Vector3(1.45f, 1.45f, 1.0f), AlphaFunction::EASE_IN_OUT);
pulse.SetLooping(true);
pulse.SetLoopingMode(Animation::AUTO_REVERSE);
pulse.Play();

return root;
