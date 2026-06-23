// P13 demo — a std::vector<View> built in a loop, passed to .AddChildren().
// View::AddChildren only accepts an { initializer-list }, so the preview rewrites
// `.AddChildren(items)` into an .Add() loop automatically (no code change needed).
#include <dali-ui-foundation/dali-ui-foundation.h>
#include <vector>

using namespace Dali::Ui;

// @preview
View Build() {
    std::vector<View> items;
    for (int i = 0; i < 5; i++) {
        Label item = Label::New("Item");
        item.SetFontSize(44);
        item.SetTextColor(UiColor(0x00d4a8));
        items.push_back(item);
    }
    StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
    root.SetSpacing(24);
    root.SetRequestedWidth(MATCH_PARENT);
    root.AddChildren(items);   // vector → P13 transform → renders 5 rows
    return root;
}
