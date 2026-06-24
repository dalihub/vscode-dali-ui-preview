// M0 characterization sample for the SERVER scene-builder path.
// At M0 the server ignores SetCornerRadius → this teal box renders with SQUARE
// corners (on purpose). M1/F1.1 adds SetCornerRadius to the server, after which
// the box renders ROUNDED and this golden is updated (red→green proof).
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);

View box = View::New();
box.SetBackgroundColor(UiColor(0x00d4a8));
box.SetCornerRadius(64.0f);
box.SetRequestedWidth(220.0f);
box.SetRequestedHeight(220.0f);
root.AddChildren({ box });
return root;
