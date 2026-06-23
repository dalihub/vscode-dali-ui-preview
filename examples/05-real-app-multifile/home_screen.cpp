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
    StackLayout rail = StackLayout::New(StackOrientation::HORIZONTAL);
    rail.SetSpacing(theme::GAP_CARD);
    rail.SetRequestedWidth(MATCH_PARENT);
    for (const auto& item : mVm.items) {
        rail.Add(MakeCard(item.title, item.subtitle));   // cross-file helper
    }

    // top bar
    Label topLeft = Label::New("Home");
    topLeft.SetFontSize(56);
    topLeft.SetTextColor(UiColor(theme::TEXT));
    Label topRight = Label::New("9:41");
    topRight.SetFontSize(34);
    topRight.SetTextColor(UiColor(theme::MUTED));
    FlexLayout topBar = FlexLayout::New();
    topBar.SetDirection(FlexDirection::ROW);
    topBar.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
    topBar.SetAlignItems(FlexAlign::CENTER);
    topBar.SetRequestedWidth(MATCH_PARENT);
    topBar.AddChildren({
        topLeft,
        topRight,
    });

    // hero banner — read the featured title from the injected view-model
    Label heroTitle = Label::New(mVm.featured.c_str());
    heroTitle.SetFontSize(72);
    heroTitle.SetTextColor(UiColor(theme::TEXT));
    Label heroSub = Label::New("Featured today");
    heroSub.SetFontSize(30);
    heroSub.SetTextColor(UiColor(theme::ACCENT));
    heroSub.SetMargin(Extents(0, 0, 16, 0));
    FlexLayout hero = FlexLayout::New();
    hero.SetDirection(FlexDirection::COLUMN);
    hero.SetJustifyContent(FlexJustify::FLEX_END);
    hero.SetRequestedWidth(MATCH_PARENT);
    hero.SetRequestedHeight(420.0f);
    hero.SetCornerRadius(theme::RADIUS_CARD);
    hero.SetPadding(Extents(56, 56, 0, 48));
    hero.SetBackgroundColor(UiColor(theme::SURFACE));
    hero.AddChildren({
        heroTitle,
        heroSub,
    });

    StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
    root.SetSpacing(theme::GAP_CARD);
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(MATCH_PARENT);
    root.SetBackgroundColor(UiColor(theme::BG));                       // theme token
    root.SetPadding(Extents(theme::PAD_SCREEN, theme::PAD_SCREEN, 56, 56));
    root.AddChildren({
        topBar,
        hero,
        MakeSectionHeader("Continue Watching"),                   // cross-file helper
        rail,                                                     // loop result
    });
    return root;
}

} // namespace home
