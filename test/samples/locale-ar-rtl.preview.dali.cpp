// @preview-config: name="RTL", locale=ar
// F3.4 (WU-M3.5) — locale=ar mirrors a rendered ROW. An RTL locale (ar/he/fa/ur)
// makes the build set the root view's LAYOUT_DIRECTION to RIGHT_TO_LEFT after the
// tree is built (Dali::LayoutDirection::RIGHT_TO_LEFT; children inherit it). So
// this ROW's main-axis order mirrors: the FIRST child (red "1", left-most in LTR)
// renders on the RIGHT, and the LAST child (blue "3") on the LEFT. The labels and
// colors are unchanged — this is LAYOUT mirroring only, NOT translation (no
// catalog is loaded; the tool never fabricates a translated string). Compare with
// the same ROW at the default LTR locale: red-green-blue left→right becomes
// blue-green-red left→right under locale=ar.
return FlexLayout::New()
    .SetDirection(FlexDirection::ROW)
    .SetAlignItems(FlexAlign::CENTER)
    .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .SetBackgroundColor(UiColor(0x1e1e2e))
    .Children({
        View::New()
            .SetBackgroundColor(UiColor(0xE05050))
            .SetRequestedWidth(120.0f)
            .SetRequestedHeight(120.0f)
            .Children({
                Label::New("1")
                    .SetFontSize(40.0f)
                    .SetTextColor(UiColor(0xFFFFFF)),
            }),
        View::New()
            .SetBackgroundColor(UiColor(0x50E050))
            .SetRequestedWidth(120.0f)
            .SetRequestedHeight(120.0f)
            .Children({
                Label::New("2")
                    .SetFontSize(40.0f)
                    .SetTextColor(UiColor(0xFFFFFF)),
            }),
        View::New()
            .SetBackgroundColor(UiColor(0x5070E0))
            .SetRequestedWidth(120.0f)
            .SetRequestedHeight(120.0f)
            .Children({
                Label::New("3")
                    .SetFontSize(40.0f)
                    .SetTextColor(UiColor(0xFFFFFF)),
            }),
    });
