// @preview-state: focus=card2
// Three focusable cards in a row. `focus=card2` targets the MIDDLE card, so a
// mis-resolution (ring on card1 or card3, or no ring) is immediately obvious in
// the golden diff. The build NAME-tags `card2` so FindChildByName("card2")
// resolves it; SetAlwaysShowFocus(true) + SetCurrentFocusView draws dali-ui's
// default focus indicator (ADR-006). Distinct colors per card.
View card1 = View::New();
card1.SetBackgroundColor(UiColor(0x3a6df0));
card1.SetCornerRadius(20.0f);
card1.SetFocusable(true);
card1.SetRequestedWidth(150.0f);
card1.SetRequestedHeight(150.0f);

View card2 = View::New();
card2.SetBackgroundColor(UiColor(0xe05a3a));
card2.SetCornerRadius(20.0f);
card2.SetFocusable(true);
card2.SetRequestedWidth(150.0f);
card2.SetRequestedHeight(150.0f);

View card3 = View::New();
card3.SetBackgroundColor(UiColor(0x3ad07a));
card3.SetCornerRadius(20.0f);
card3.SetFocusable(true);
card3.SetRequestedWidth(150.0f);
card3.SetRequestedHeight(150.0f);

FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::ROW);
root.SetJustifyContent(FlexJustify::SPACE_EVENLY);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.AddChildren({ card1, card2, card3 });
return root;
