// @preview-config: width=480, height=320
// Regression sample for CJK font rendering in the docker preview runtime.
// Before fonts-noto-cjk was baked into the image, Hangul rendered as tofu (□)
// because the image shipped only DejaVu (no CJK glyphs). This golden proves the
// preview font now resolves Korean codepoints. See docker/Dockerfile.runtime.
return FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetAlignItems(FlexAlign::CENTER)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x1e1e2e))
    .Children({
        Label::New("안녕하세요 DALi")
            .SetFontSize(44)
            .SetTextColor(UiColor(0xFFFFFF)),
        Label::New("한글 미리보기 테스트")
            .SetFontSize(28)
            .SetTextColor(UiColor(0xA6E3A1)),
    });
