// Rung2 fixture — namespace-scoped constants in the SAME file.
// SliceBuilder should collect the `theme` namespace constants into globals so
// UiColor(theme::ACCENT) resolves. Today the parser rejects this: the `constexpr`
// definitions trip FAIL_KEYWORDS, and even with them stripped, theme::ACCENT is
// captured as an opaque string the server can't turn into a colour.
#include <dali-ui-foundation/dali-ui-foundation.h>
using namespace Dali::Ui;

namespace theme {
    constexpr unsigned int ACCENT = 0x00d4a8;
    constexpr unsigned int TEXT   = 0xffffff;
    constexpr float        RADIUS = 56.0f;
}

// @preview
static View BuildBadge() {
    return View::New()
        .SetBackgroundColor(UiColor(theme::ACCENT))
        .SetCornerRadius(theme::RADIUS)
        .SetRequestedWidth(400.0f)
        .SetRequestedHeight(120.0f);
}
