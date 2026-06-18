// M1/F1.2 server-path sample: SetOpacity + SetBorderlineWidth + SetBorderlineColor.
// A half-opaque white-bordered box centered over a dark bg. Before M1 the server
// ignored opacity/borderline → the box rendered fully-opaque with no border.
FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetBackgroundColor(UiColor(0x101418))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        View::New()
            .SetBackgroundColor(UiColor(0x00d4a8))
            .SetOpacity(0.5f)
            .SetBorderlineWidth(6.0f)
            .SetBorderlineColor(UiColor(0xffffff))
            .SetRequestedWidth(220.0f)
            .SetRequestedHeight(220.0f),
    });
