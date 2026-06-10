// Rung2 fixture — helper defined in the SAME file as the preview target.
// SliceBuilder should collect MakeChip() into the globals slot so the slice
// compiles. Today's parser returns null (a bare helper call is not a builder
// chain it can resolve), forcing the whole thing off the fast path.
#include <dali-ui-foundation/dali-ui-foundation.h>
using namespace Dali::Ui;

// helper — same translation unit (collectable by Rung2 regex scan)
static View MakeChip(const char* label) {
    return Label::New(label).SetFontSize(36).SetTextColor(UiColor(0x00d4a8));
}

// @preview
static View BuildNavBar() {
    return FlexLayout::New()
        .SetDirection(FlexDirection::ROW)
        .SetJustifyContent(FlexJustify::SPACE_EVENLY)
        .SetRequestedWidth(MATCH_PARENT)
        .Children({
            MakeChip("Home"),
            MakeChip("Wallet"),
            MakeChip("Settings"),
        });
}
