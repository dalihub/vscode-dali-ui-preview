// @preview-config: name="Loader", width=640, height=200

// Indeterminate loading bar: a segment slides back and forth inside a track
// forever (looping, AUTO_REVERSE). The segment is STANDALONE so its POSITION_X
// is driven by us. Scrub to move the segment; play to watch it loop.

auto seg = View::New()
    .SetLayoutMode(LayoutMode::STANDALONE)
    .SetBackgroundColor(UiColor(0x3d7bff))
    .SetRequestedWidth(180.0f)
    .SetRequestedHeight(12.0f)
    .SetCornerRadius(6.0f);
seg.SetProperty(Actor::Property::PARENT_ORIGIN, ParentOrigin::TOP_LEFT);
seg.SetProperty(Actor::Property::PIVOT, Vector3(0.0f, 0.5f, 0.5f));
seg.SetProperty(Actor::Property::POSITION, Vector2(0.0f, 0.0f));

auto track = FlexLayout::New()
    .SetLayoutMode(LayoutMode::STANDALONE)
    .SetBackgroundColor(UiColor(0x222640))
    .SetRequestedWidth(540.0f)
    .SetRequestedHeight(12.0f)
    .SetCornerRadius(6.0f)
    .Children({ seg });

auto root = FlexLayout::New()
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x0a0a14))
    .Children({ track });

Animation loop = Animation::New(1.2f);
loop.AnimateTo(Property(seg, Actor::Property::POSITION_X), 360.0f, AlphaFunction::EASE_IN_OUT); // 540 - 180
loop.SetLooping(true);
loop.SetLoopingMode(Animation::AUTO_REVERSE);
loop.Play();

return root;
