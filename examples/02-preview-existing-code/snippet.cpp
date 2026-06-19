#include <dali-ui-foundation/dali-ui-foundation.h>

using namespace Dali;
using namespace Dali::Ui;

/**
 * Preview a function INSIDE a normal .cpp — no dedicated preview file.
 * Place // @preview above any function that returns a DALi view type.
 * No closing marker is needed — the function's closing brace is the end.
 * A "▶ Preview" CodeLens also appears above each view-returning function;
 * click it to preview that one directly.
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

// No @preview marker here — but the ▶ Preview CodeLens still appears,
// so you can preview this one with a click. Move the marker, or click the lens.
View AnotherView()
{
    return View::New()
        .SetBackgroundColor(UiColor(0xFF6584))
        .SetRequestedWidth(100.0f)
        .SetRequestedHeight(100.0f);
}
