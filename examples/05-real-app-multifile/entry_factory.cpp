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
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::COLUMN);
    root.SetJustifyContent(FlexJustify::CENTER);
    root.SetAlignItems(FlexAlign::CENTER);
    root.SetBackgroundColor(UiColor(0x1b2330));
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(MATCH_PARENT);
    Label label = Label::New("Zero-Arg Entry");
    label.SetTextColor(UiColor(0xffffff));
    label.SetFontSize(44);
    root.AddChildren({
        label,
    });
    return root;
}
