// @preview-config: name="Phone Light", width=720, height=1280, theme=light
// @preview-config: name="Phone Dark", width=720, height=1280, theme=dark
// @preview-config: name="Watch", width=360, height=360
return FlexLayout::New()
    .SetDirection(FlexLayout::COLUMN)
    .Children({
        TextLabel::New("Multi Preview Demo"),
        ImageView::New(),
    });
