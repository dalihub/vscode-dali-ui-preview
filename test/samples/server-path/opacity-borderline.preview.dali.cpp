// M1/F1.2 server-path sample: SetOpacity + SetBorderlineWidth + SetBorderlineColor.
// A half-opaque white-bordered box centered over a dark bg. Before M1 the server
// ignored opacity/borderline → the box rendered fully-opaque with no border.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);

View box = View::New();
box.SetBackgroundColor(UiColor(0x00d4a8));
box.SetOpacity(0.5f);
box.SetBorderlineWidth(6.0f);
box.SetBorderlineColor(UiColor(0xffffff));
box.SetRequestedWidth(220.0f);
box.SetRequestedHeight(220.0f);
root.AddChildren({ box });
return root;
