// Flow Wallet — wallet screen builder (the preview target).
// One member function exercising all six real-world patterns at once.
#include "wallet_screen.h"
#include "../theme/tokens.h"     // P11: project-local header (theme constants)
#include "../widgets/cards.h"    // P11: project-local header (factories)

using namespace Dali;
using namespace Dali::Ui;

namespace wallet {

View WalletScreen::Build() {
    // P2 + P6: loop over the view-model's data to build transaction rows.
    auto txList = StackLayout::New(StackOrientation::VERTICAL).SetSpacing(theme::GAP_ROW);
    for (const auto& tx : mVm.recent) {
        txList.Add(MakeTransactionRow(tx.merchant, tx.amount));  // P1 cross-file helper
    }

    return StackLayout::New(StackOrientation::VERTICAL)
        .SetSpacing(theme::GAP_ROW)
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(MATCH_PARENT)
        .SetBackgroundColor(UiColor(theme::BG))                       // P4 theme constant
        .SetPadding(Extents(theme::PAD_SCREEN, theme::PAD_SCREEN, 98, 98))
        .Children({
            MakeSectionHeader("My Wallet"),                          // P1 cross-file helper
            // P6: read balance from the injected view-model
            Label::New(mVm.balance.c_str()).SetFontSize(98).SetTextColor(UiColor(theme::ACCENT)),
            // P14: factory cards in a row
            FlexLayout::New()
                .SetDirection(FlexDirection::ROW)
                .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
                .SetRequestedWidth(MATCH_PARENT)
                .Children({
                    MakeStatCard("Spent", "$2,148", theme::TEXT),
                    MakeStatCard("Left", "$1,352", theme::ACCENT),
                }),
            MakeSectionHeader("Recent"),
            txList,                                                  // P2 loop result
        });
}

} // namespace wallet
