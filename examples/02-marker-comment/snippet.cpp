#include <dali-ui-foundation/dali-ui-foundation.h>

using namespace Dali;
using namespace Dali::Ui;

/**
 * Single-marker preview example.
 * Place // @preview above any function returning a DALi view type.
 * No closing marker is needed — the function's closing brace is the end.
 */

// @preview
View CreateUI()
{
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetAlignItems(FlexAlign::CENTER)
        .SetJustifyContent(FlexJustify::CENTER)
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(MATCH_PARENT)
        .SetBackgroundColor(UiColor(0x1B1B2F))
        .Children({
            Label::New("Hello, DALi!")
                .SetFontSize(32)
                .SetTextColor(UiColor(0x00FF88)),
            View::New()
                .SetBackgroundColor(UiColor(0x4a90d9))
                .SetRequestedWidth(200.0f)
                .SetRequestedHeight(2.0f)
                .SetMargin(Extents(0, 0, 16, 16)),
            Label::New("Single @preview marker — no end marker needed.")
                .SetFontSize(14)
                .SetTextColor(UiColor(0x888888)),
        });
}

// This function has no @preview marker; no CodeLens unless workspace is a DALi project.
View AnotherView()
{
    return View::New()
        .SetBackgroundColor(UiColor(0xFF6584))
        .SetRequestedWidth(100.0f)
        .SetRequestedHeight(100.0f);
}
