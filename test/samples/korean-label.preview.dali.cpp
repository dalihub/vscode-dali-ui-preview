// @preview-config: width=480, height=320
// Regression sample for CJK font rendering in the docker preview runtime.
// Before fonts-noto-cjk was baked into the image, Hangul rendered as tofu (□)
// because the image shipped only DejaVu (no CJK glyphs). This golden proves the
// preview font now resolves Korean codepoints. See docker/Dockerfile.runtime.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x1e1e2e));
Label title = Label::New("안녕하세요 DALi");
title.SetFontSize(44);
title.SetTextColor(UiColor(0xFFFFFF));
Label subtitle = Label::New("한글 미리보기 테스트");
subtitle.SetFontSize(28);
subtitle.SetTextColor(UiColor(0xA6E3A1));
root.AddChildren({
    title,
    subtitle,
});
return root;
