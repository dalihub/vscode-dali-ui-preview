#include <dali-ui-foundation/dali-ui-foundation.h>

using namespace Dali;
using namespace Dali::Ui;

// @dali-preview
// The OTHER entry shape: a zero-arg factory marked // @dali-preview. The harness
// extracts this body and renders it, like the marker paths. Self-contained /
// same-file — use this when your screen is a free factory function, or a member
// Build() (see home_screen.cpp) when it lives on a class.
View MakeHomePreview()
{
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetJustifyContent(FlexJustify::CENTER)
        .SetAlignItems(FlexAlign::CENTER)
        .SetBackgroundColor(UiColor(0x1b2330))
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(MATCH_PARENT)
        .Children({
            Label::New("Zero-Arg Entry")
                .SetTextColor(UiColor(0xffffff))
                .SetFontSize(44),
        });
}
