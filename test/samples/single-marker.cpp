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
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::COLUMN);
    root.SetAlignItems(FlexAlign::CENTER);
    root.SetJustifyContent(FlexJustify::CENTER);
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(MATCH_PARENT);
    root.SetBackgroundColor(UiColor(0x1B1B2F));

    Label title = Label::New("Hello, DALi!");
    title.SetFontSize(32);
    title.SetTextColor(UiColor(0x00FF88));

    View divider = View::New();
    divider.SetBackgroundColor(UiColor(0x4a90d9));
    divider.SetRequestedWidth(200.0f);
    divider.SetRequestedHeight(2.0f);
    divider.SetMargin(Extents(0, 0, 16, 16));

    Label caption = Label::New("Single @preview marker — no end marker needed.");
    caption.SetFontSize(14);
    caption.SetTextColor(UiColor(0x888888));

    root.AddChildren({ title, divider, caption });
    return root;
}

// This function has no @preview marker; no CodeLens unless workspace is a DALi project.
View AnotherView()
{
    View root = View::New();
    root.SetBackgroundColor(UiColor(0xFF6584));
    root.SetRequestedWidth(100.0f);
    root.SetRequestedHeight(100.0f);
    return root;
}
