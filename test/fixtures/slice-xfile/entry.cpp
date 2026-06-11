// Rung1 cross-file fixture — the helper is defined in ANOTHER file (widgets.cpp),
// reached via #include "widgets.h". SliceBuilder must collect MakeBanner across
// the include boundary (same-file Rung2 alone cannot — this is the realistic case).
#include "widgets.h"
using namespace Dali::Ui;

// @preview
static View BuildScreen() {
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetJustifyContent(FlexJustify::CENTER)
        .SetRequestedWidth(MATCH_PARENT)
        .Children({
            MakeBanner("Welcome"),
        });
}
