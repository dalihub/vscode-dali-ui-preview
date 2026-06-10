// Flow Wallet — widget factory definitions (P1/P14).
#include "cards.h"
#include "../theme/tokens.h"

using namespace Dali;
using namespace Dali::Ui;

namespace wallet {

View MakeSectionHeader(const std::string& title) {
    return Label::New(title.c_str())
        .SetFontSize(46)
        .SetTextColor(UiColor(theme::TEXT));
}

View MakeStatCard(const std::string& label, const std::string& value, uint32_t accent) {
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetBackgroundColor(UiColor(theme::SURFACE))
        .SetCornerRadius(theme::RADIUS_CARD)
        .SetPadding(Extents(49, 49, 42, 42))
        .SetRequestedWidth(553.0f)
        .Children({
            Label::New(label.c_str()).SetFontSize(39).SetTextColor(UiColor(theme::MUTED)),
            Label::New(value.c_str()).SetFontSize(63).SetTextColor(UiColor(accent)),
        });
}

View MakeTransactionRow(const std::string& merchant, const std::string& amount) {
    return FlexLayout::New()
        .SetDirection(FlexDirection::ROW)
        .SetJustifyContent(FlexJustify::SPACE_BETWEEN)
        .SetAlignItems(FlexAlign::CENTER)
        .SetRequestedWidth(MATCH_PARENT)
        .SetRequestedHeight(96.0f)
        .Children({
            Label::New(merchant.c_str()).SetFontSize(42).SetTextColor(UiColor(theme::TEXT)),
            Label::New(amount.c_str()).SetFontSize(42).SetTextColor(UiColor(theme::ACCENT)),
        });
}

} // namespace wallet
