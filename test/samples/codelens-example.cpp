#include <dali-ui-foundation/dali-ui-foundation.h>
using namespace Dali;
using namespace Dali::Ui;
using Dali::Ui::View;

// ▶ Preview CodeLens should appear above each View-returning function.
// Click it to preview that function.

View CreateMainUI()
{
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::COLUMN);
    root.SetAlignItems(FlexAlign::STRETCH);
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(MATCH_PARENT);
    root.SetPadding(Extents(20, 20, 24, 20));
    root.SetBackgroundColor(UiColor(0x1B1B2F));

    Label title = Label::New("Main Page");
    title.SetFontSize(28);
    title.SetTextColor(UiColor(0x00FF88));

    View divider = View::New();
    divider.SetBackgroundColor(UiColor(0x333355));
    divider.SetRequestedWidth(MATCH_PARENT);
    divider.SetRequestedHeight(2.0f);

    FlexLayout row = FlexLayout::New();
    row.SetDirection(FlexDirection::ROW);
    row.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
    row.SetRequestedWidth(MATCH_PARENT);

    View box1 = View::New();
    box1.SetBackgroundColor(UiColor(0x6C63FF));
    box1.SetRequestedWidth(100.0f);
    box1.SetRequestedHeight(80.0f);

    View box2 = View::New();
    box2.SetBackgroundColor(UiColor(0xFF6584));
    box2.SetRequestedWidth(100.0f);
    box2.SetRequestedHeight(80.0f);

    View box3 = View::New();
    box3.SetBackgroundColor(UiColor(0x43E97B));
    box3.SetRequestedWidth(100.0f);
    box3.SetRequestedHeight(80.0f);

    row.AddChildren({ box1, box2, box3 });

    root.AddChildren({ title, divider, row });
    return root;
}

View CreateSettings()
{
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::COLUMN);
    root.SetAlignItems(FlexAlign::CENTER);
    root.SetJustifyContent(FlexJustify::CENTER);
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(MATCH_PARENT);
    root.SetBackgroundColor(UiColor(0x2D2D3F));

    Label title = Label::New("Settings");
    title.SetFontSize(28);
    title.SetTextColor(UiColor(0xFF8800));

    View divider = View::New();
    divider.SetBackgroundColor(UiColor(0x4a90d9));
    divider.SetRequestedWidth(200.0f);
    divider.SetRequestedHeight(4.0f);
    divider.SetMargin(Extents(0, 0, 12, 12));

    Label hint = Label::New("Toggle dark mode, adjust font size, etc.");
    hint.SetFontSize(14);
    hint.SetTextColor(UiColor(0x888888));

    root.AddChildren({ title, divider, hint });
    return root;
}

void DoSomethingElse()
{
    // This function does NOT return a View.
    // No CodeLens should appear here.
}
