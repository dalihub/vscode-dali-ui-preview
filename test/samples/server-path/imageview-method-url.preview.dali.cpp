// @render-only
// F1.3 server-path sample: method-form ImageView URL.
// The ImageView gets its URL via .SetResourceUrl() (not the constructor) and an
// explicit 200x200 requested size. Before M1 the method-form URL was ignored and
// the node fell back to a bare empty View; now it builds as a sized ImageView.
// Marked @render-only: the URL has no asset, so DALi shows an async broken-image
// placeholder whose pixels are non-deterministic (form L) — verified by render,
// not a flaky pixel golden. Real poster pixels / placeholder are M5's concern.
FlexLayout::New()
    .SetDirection(FlexDirection::COLUMN)
    .SetJustifyContent(FlexJustify::CENTER)
    .SetAlignItems(FlexAlign::CENTER)
    .SetBackgroundColor(UiColor(0x101418))
    .SetRequestedWidth(MATCH_PARENT)
    .SetRequestedHeight(MATCH_PARENT)
    .Children({
        ImageView::New()
            .SetResourceUrl("poster.jpg")
            .SetRequestedWidth(200.0f)
            .SetRequestedHeight(200.0f),
    });
