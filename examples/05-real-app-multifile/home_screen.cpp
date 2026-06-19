// Home screen builder — the preview target. One member function that exercises
// the real-app patterns at once: member state, a data loop, cross-file
// factories, theme tokens, and project headers. A TV landscape home (1920×1080).
#include "home_screen.h"
#include "theme.h"      // project-local header (theme tokens)
#include "cards.h"      // project-local header (cross-file factories)

using namespace Dali;
using namespace Dali::Ui;

namespace home {

// @preview
// The marker on the DEFINITION makes this .cpp previewable. The slicer collects
// MakeSectionHeader / MakeCard from cards.cpp and stubs mVm with sample data.
View HomeScreen::Build() {
    // The "Continue Watching" rail: loop the view-model's items into the
    // cross-file MakeCard factory (a horizontal row of tiles).
    auto rail = StackLayout::New(StackOrientation::HORIZONTAL)
                    .SetSpacing(theme::GAP_CARD)
                    .SetRequestedWidth(MATCH_PARENT);
    for (const auto& item : mVm.items) {
        rail.Add(MakeCard(item.title, item.subtitle));   // cross-file helper
    }

    return StackLayout::New(StackOrientation::VERTICAL)
        .SetSpacing(theme::GAP_CARD)
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(MATCH_PARENT)
        .SetBackgroundColor(UiColor(theme::BG))                       // theme token
        .SetPadding(Extents(theme::PAD_SCREEN, theme::PAD_SCREEN, 56, 56))
        .Children({
            // top bar
            FlexLayout::New()
                .SetDirection(FlexDirection::ROW)
                .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                .SetAlignItems(FlexAlign::CENTER)
                .SetRequestedWidth(MATCH_PARENT)
                .Children({
                    Label::New("Home").SetFontSize(56).SetTextColor(UiColor(theme::TEXT)),
                    Label::New("9:41").SetFontSize(34).SetTextColor(UiColor(theme::MUTED)),
                }),
            // hero banner — read the featured title from the injected view-model
            FlexLayout::New()
                .SetDirection(FlexDirection::COLUMN)
                .SetJustifyContent(FlexJustify::FLEX_END)
                .SetRequestedWidth(MATCH_PARENT)
                .SetRequestedHeight(420.0f)
                .SetCornerRadius(theme::RADIUS_CARD)
                .SetPadding(Extents(56, 56, 0, 48))
                .SetBackgroundColor(UiColor(theme::SURFACE))
                .Children({
                    Label::New(mVm.featured.c_str()).SetFontSize(72).SetTextColor(UiColor(theme::TEXT)),
                    Label::New("Featured today").SetFontSize(30).SetTextColor(UiColor(theme::ACCENT)).SetMargin(Extents(0, 0, 16, 0)),
                }),
            MakeSectionHeader("Continue Watching"),                   // cross-file helper
            rail,                                                     // loop result
        });
}

} // namespace home
