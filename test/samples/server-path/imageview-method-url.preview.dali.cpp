// @render-only
// F1.3 server-path sample: method-form ImageView URL.
// The ImageView gets its URL via .SetResourceUrl() (not the constructor) and an
// explicit 200x200 requested size. Before M1 the method-form URL was ignored and
// the node fell back to a bare empty View; now it builds as a sized ImageView.
// Marked @render-only: the URL has no asset, so DALi shows an async broken-image
// placeholder whose pixels are non-deterministic (form L) — verified by render,
// not a flaky pixel golden. Real poster pixels / placeholder are M5's concern.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
ImageView poster = ImageView::New();
poster.SetResourceUrl("poster.jpg");
poster.SetRequestedWidth(200.0f);
poster.SetRequestedHeight(200.0f);
root.AddChildren({ poster });
return root;
