// @preview-config: name="Loader", width=640, height=200

// Indeterminate loading bar: a segment slides back and forth inside a track
// forever (looping, AUTO_REVERSE). The segment is STANDALONE so its POSITION_X
// is driven by us. Scrub to move the segment; play to watch it loop.

View seg = View::New();
seg.SetLayoutMode(LayoutMode::STANDALONE);
seg.SetBackgroundColor(UiColor(0x3d7bff));
seg.SetRequestedWidth(180.0f);
seg.SetRequestedHeight(12.0f);
seg.SetCornerRadius(6.0f);
seg.SetProperty(Actor::Property::PARENT_ORIGIN, ParentOrigin::TOP_LEFT);
seg.SetProperty(Actor::Property::PIVOT, Vector3(0.0f, 0.5f, 0.5f));
seg.SetProperty(Actor::Property::POSITION, Vector2(0.0f, 0.0f));

FlexLayout track = FlexLayout::New();
track.SetLayoutMode(LayoutMode::STANDALONE);
track.SetBackgroundColor(UiColor(0x222640));
track.SetRequestedWidth(540.0f);
track.SetRequestedHeight(12.0f);
track.SetCornerRadius(6.0f);
track.AddChildren({ seg });

FlexLayout root = FlexLayout::New();
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0a0a14));
root.AddChildren({ track });

Animation loop = Animation::New(1.2f);
loop.AnimateTo(Property(seg, Actor::Property::POSITION_X), 360.0f, AlphaFunction::EASE_IN_OUT); // 540 - 180
loop.SetLooping(true);
loop.SetLoopingMode(Animation::AUTO_REVERSE);
loop.Play();

return root;
