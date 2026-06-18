// @preview-state: focus=card2
// Three focusable cards in a row. `focus=card2` targets the MIDDLE card, so a
// mis-resolution (ring on card1 or card3, or no ring) is immediately obvious in
// the golden diff. The build NAME-tags `card2` so FindChildByName("card2")
// resolves it; SetAlwaysShowFocus(true) + SetCurrentFocusView draws dali-ui's
// default focus indicator (ADR-006). Distinct colors per card.
View card1 = View::New()
    .SetBackgroundColor(UiColor(0x3a6df0))
    .SetCornerRadius(20.0f)
    .SetFocusable(true)
    .SetRequestedWidth(150.0f)
    .SetRequestedHeight(150.0f);

View card2 = View::New()
    .SetBackgroundColor(UiColor(0xe05a3a))
    .SetCornerRadius(20.0f)
    .SetFocusable(true)
    .SetRequestedWidth(150.0f)
    .SetRequestedHeight(150.0f);

View card3 = View::New()
    .SetBackgroundColor(UiColor(0x3ad07a))
    .SetCornerRadius(20.0f)
    .SetFocusable(true)
    .SetRequestedWidth(150.0f)
    .SetRequestedHeight(150.0f);

return FlexLayout::New()
    .SetDirection(FlexDirection::ROW)
    .SetJustifyContent(FlexJustify::SPACE_EVENLY)
    .SetAlignItems(FlexAlign::CENTER)
    .SetBackgroundColor(UiColor(0x101418))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({ card1, card2, card3 });
