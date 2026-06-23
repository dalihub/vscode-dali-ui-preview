// Widget factory definitions — the cross-file helpers home_screen.cpp calls.
#include "cards.h"
#include "theme.h"

using namespace Dali;
using namespace Dali::Ui;

namespace home {

View MakeSectionHeader(const std::string& title) {
    Label header = Label::New(title.c_str());
    header.SetFontSize(40);
    header.SetTextColor(UiColor(theme::TEXT));
    return header;
}

View MakeCard(const std::string& title, const std::string& subtitle) {
    FlexLayout card = FlexLayout::New();
    card.SetDirection(FlexDirection::COLUMN);
    card.SetRequestedWidth(theme::CARD_W);

    // poster block (a coloured rounded rectangle stands in for artwork)
    FlexLayout poster = FlexLayout::New();
    poster.SetBackgroundColor(UiColor(theme::SURFACE));
    poster.SetCornerRadius(theme::RADIUS_CARD);
    poster.SetRequestedWidth(theme::CARD_W);
    poster.SetRequestedHeight(theme::THUMB_H);

    Label titleLabel = Label::New(title.c_str());
    titleLabel.SetFontSize(34);
    titleLabel.SetTextColor(UiColor(theme::TEXT));
    titleLabel.SetMargin(Extents(0, 0, 18, 0));

    Label subtitleLabel = Label::New(subtitle.c_str());
    subtitleLabel.SetFontSize(26);
    subtitleLabel.SetTextColor(UiColor(theme::MUTED));
    subtitleLabel.SetMargin(Extents(0, 0, 6, 0));

    card.AddChildren({
        poster,
        titleLabel,
        subtitleLabel,
    });
    return card;
}

} // namespace home
