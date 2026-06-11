// P13 demo — a std::vector<View> built in a loop, passed to .Children().
// View::Children only accepts an { initializer-list }, so the preview rewrites
// `.Children(items)` into an .Add() loop automatically (no code change needed).
#include <dali-ui-foundation/dali-ui-foundation.h>
#include <vector>

using namespace Dali::Ui;

// @preview
View Build() {
    std::vector<View> items;
    for (int i = 0; i < 5; i++) {
        items.push_back(
            Label::New("Item")
                .SetFontSize(44)
                .SetTextColor(UiColor(0x00d4a8)));
    }
    return StackLayout::New(StackOrientation::VERTICAL)
        .SetSpacing(24)
        .SetRequestedWidth(MATCH_PARENT)
        .Children(items);   // vector → P13 transform → renders 5 rows
}
