// Regression guard: a real local image MUST actually load on the warm-server
// parser path. The server's capture once grabbed the frame before the async image
// load queued, so the image came up BLANK. assets/test-image.png is a solid
// magenta square; if the ImageView loaded it, the golden shows a magenta region,
// and a blank capture diverges far past the 1% golden tolerance → the test fails.
// (NOT @render-only on purpose — this one IS pixel-checked.)
FlexLayout root = FlexLayout::New();
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x101418));
ImageView img = ImageView::New("assets/test-image.png");
img.SetRequestedWidth(200.0f);
img.SetRequestedHeight(200.0f);
root.AddChildren({ img });
return root;
