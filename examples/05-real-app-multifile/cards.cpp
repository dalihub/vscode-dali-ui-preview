// Widget factory definitions — the cross-file helpers home_screen.cpp calls.
#include "cards.h"
#include "theme.h"

using namespace Dali;
using namespace Dali::Ui;

namespace home {

View MakeSectionHeader(const std::string& title) {
    return Label::New(title.c_str())
        .SetFontSize(40)
        .SetTextColor(UiColor(theme::TEXT));
}

View MakeCard(const std::string& title, const std::string& subtitle) {
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetRequestedWidth(theme::CARD_W)
        .Children({
            // poster block (a coloured rounded rectangle stands in for artwork)
            FlexLayout::New()
                .SetBackgroundColor(UiColor(theme::SURFACE))
                .SetCornerRadius(theme::RADIUS_CARD)
                .SetRequestedWidth(theme::CARD_W)
                .SetRequestedHeight(theme::THUMB_H),
            Label::New(title.c_str())
                .SetFontSize(34)
                .SetTextColor(UiColor(theme::TEXT))
                .SetMargin(Extents(0, 0, 18, 0)),
            Label::New(subtitle.c_str())
                .SetFontSize(26)
                .SetTextColor(UiColor(theme::MUTED))
                .SetMargin(Extents(0, 0, 6, 0)),
        });
}

} // namespace home
