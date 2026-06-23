// Flow Wallet — widget factory definitions (P1/P14).
#include "cards.h"
#include "../theme/tokens.h"

using namespace Dali;
using namespace Dali::Ui;

namespace wallet {

View MakeSectionHeader(const std::string& title) {
    Label header = Label::New(title.c_str());
    header.SetFontSize(46);
    header.SetTextColor(UiColor(theme::TEXT));
    return header;
}

View MakeStatCard(const std::string& label, const std::string& value, uint32_t accent) {
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::COLUMN);
    root.SetBackgroundColor(UiColor(theme::SURFACE));
    root.SetCornerRadius(theme::RADIUS_CARD);
    root.SetPadding(Extents(49, 49, 42, 42));
    root.SetRequestedWidth(553.0f);
    Label labelText = Label::New(label.c_str());
    labelText.SetFontSize(39);
    labelText.SetTextColor(UiColor(theme::MUTED));
    Label valueText = Label::New(value.c_str());
    valueText.SetFontSize(63);
    valueText.SetTextColor(UiColor(accent));
    root.AddChildren({
        labelText,
        valueText,
    });
    return root;
}

View MakeTransactionRow(const std::string& merchant, const std::string& amount) {
    FlexLayout root = FlexLayout::New();
    root.SetDirection(FlexDirection::ROW);
    root.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
    root.SetAlignItems(FlexAlign::CENTER);
    root.SetRequestedWidth(MATCH_PARENT);
    root.SetRequestedHeight(96.0f);
    Label merchantText = Label::New(merchant.c_str());
    merchantText.SetFontSize(42);
    merchantText.SetTextColor(UiColor(theme::TEXT));
    Label amountText = Label::New(amount.c_str());
    amountText.SetFontSize(42);
    amountText.SetTextColor(UiColor(theme::ACCENT));
    root.AddChildren({
        merchantText,
        amountText,
    });
    return root;
}

} // namespace wallet
