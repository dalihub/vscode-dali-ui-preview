// @preview-config: name="Phone Light", width=720, height=1280, theme=light
// @preview-config: name="Phone Dark", width=720, height=1280, theme=dark
// @preview-config: name="Watch", width=360, height=360
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.AddChildren({
    Label::New("Multi Preview Demo"),
    ImageView::New(),
});
return root;
