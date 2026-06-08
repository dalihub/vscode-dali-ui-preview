#include <dali-ui-foundation/dali-ui-foundation.h>
using namespace Dali;
using namespace Dali::Ui;
using Dali::Ui::View;

// ▶ Preview CodeLens should appear above each View-returning function.
// Click it to preview that function.

View CreateMainUI()
{
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetAlignItems(FlexAlign::STRETCH)
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(MATCH_PARENT)
        .SetPadding(Extents(20, 20, 24, 20))
        .SetBackgroundColor(UiColor(0x1B1B2F))
        .Children({
            Label::New("Main Page")
                .SetFontSize(28)
                .SetTextColor(UiColor(0x00FF88)),
            View::New()
                .SetBackgroundColor(UiColor(0x333355))
                .SetRequestedWidth(MATCH_PARENT)
                .SetRequestedHeight(2.0f),
            FlexLayout::New()
                .SetDirection(FlexDirection::ROW)
                .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                .SetRequestedWidth(MATCH_PARENT)
                .Children({
                    View::New().SetBackgroundColor(UiColor(0x6C63FF)).SetRequestedWidth(100.0f).SetRequestedHeight(80.0f),
                    View::New().SetBackgroundColor(UiColor(0xFF6584)).SetRequestedWidth(100.0f).SetRequestedHeight(80.0f),
                    View::New().SetBackgroundColor(UiColor(0x43E97B)).SetRequestedWidth(100.0f).SetRequestedHeight(80.0f),
                }),
        });
}

View CreateSettings()
{
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetAlignItems(FlexAlign::CENTER)
        .SetJustifyContent(FlexJustify::CENTER)
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(MATCH_PARENT)
        .SetBackgroundColor(UiColor(0x2D2D3F))
        .Children({
            Label::New("Settings")
                .SetFontSize(28)
                .SetTextColor(UiColor(0xFF8800)),
            View::New()
                .SetBackgroundColor(UiColor(0x4a90d9))
                .SetRequestedWidth(200.0f)
                .SetRequestedHeight(4.0f)
                .SetMargin(Extents(0, 0, 12, 12)),
            Label::New("Toggle dark mode, adjust font size, etc.")
                .SetFontSize(14)
                .SetTextColor(UiColor(0x888888)),
        });
}

void DoSomethingElse()
{
    // This function does NOT return a View.
    // No CodeLens should appear here.
}
