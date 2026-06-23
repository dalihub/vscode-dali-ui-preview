// Flow Wallet — wallet screen builder (the preview target).
// One member function exercising all six real-world patterns at once.
#include "wallet_screen.h"
#include "../theme/tokens.h"     // P11: project-local header (theme constants)
#include "../widgets/cards.h"    // P11: project-local header (factories)

using namespace Dali;
using namespace Dali::Ui;

namespace wallet {

// @preview
// Preview target: the extension slices THIS member function (the marker on the
// definition makes the .cpp itself previewable; the header declaration's marker
// alone leaves the .cpp body unreachable to extraction). See M4 spec §2(d).
View WalletScreen::Build() {
    // P2 + P6: loop over the view-model's data to build transaction rows.
    auto txList = StackLayout::New(StackOrientation::VERTICAL);
    txList.SetSpacing(theme::GAP_ROW);
    txList.SetRequestedWidth(MATCH_PARENT);
    for (const auto& tx : mVm.recent) {
        txList.Add(MakeTransactionRow(tx.merchant, tx.amount));  // P1 cross-file helper
    }

    StackLayout root = StackLayout::New(StackOrientation::VERTICAL);
    root.SetSpacing(theme::GAP_ROW);
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(MATCH_PARENT);
    root.SetBackgroundColor(UiColor(theme::BG));                       // P4 theme constant
    root.SetPadding(Extents(theme::PAD_SCREEN, theme::PAD_SCREEN, 98, 98));
    // P6: read balance from the injected view-model
    Label balance = Label::New(mVm.balance.c_str());
    balance.SetFontSize(98);
    balance.SetTextColor(UiColor(theme::ACCENT));
    // P14: factory cards in a row
    FlexLayout cardRow = FlexLayout::New();
    cardRow.SetDirection(FlexDirection::ROW);
    cardRow.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
    cardRow.SetRequestedWidth(MATCH_PARENT);
    cardRow.AddChildren({
        MakeStatCard("Spent", "$2,148", theme::TEXT),
        MakeStatCard("Left", "$1,352", theme::ACCENT),
    });
    root.AddChildren({
        MakeSectionHeader("My Wallet"),                          // P1 cross-file helper
        balance,
        cardRow,
        MakeSectionHeader("Recent"),
        txList,                                                  // P2 loop result
    });
    return root;
}

} // namespace wallet
