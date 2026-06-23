#include <dali-toolkit/dali-toolkit.h>

// A zero-arg factory marked with the `// @dali-preview` entry marker. The
// preview extracts MakeHomePreview()'s body and rewrites the leading variable
// declaration (`View card = ...`) into a `return`.

// @dali-preview
View MakeHomePreview() {
    View card = View::New();
    card.SetBackgroundColor(UiColor(0x1b2330));
    card.SetCornerRadius(24.0f);
    card.SetRequestedWidth(220.0f);
    card.SetRequestedHeight(220.0f);
    return card;
}
