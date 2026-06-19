// @preview-state: focus=card2
// Three focusable cards in a row. `focus=card2` targets the MIDDLE card, so the
// focus ring lands on it. The build name-tags each card by its variable name, so
// `focus=card2` resolves to the `card2` view below; SetAlwaysShowFocus(true) +
// SetCurrentFocusView draws dali-ui's default focus indicator. Distinct colours
// per card make the ring's position obvious.
//
// You can also drive an animation statically with `progress=`. Try replacing the
// line above with:  // @preview-state: progress=0.5
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
