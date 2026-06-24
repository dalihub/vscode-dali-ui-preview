// @broken-image
// @render-only
// WU-M5.1 — broken-image placeholder (harness SetBrokenImageUrl).
//
// An ImageView whose remote URL is unreachable must NOT collapse to an empty box:
// with UiConfig::SetBrokenImageUrl pointing at the bundled gray placeholder, DALi
// shows that placeholder at the ImageView's REQUESTED size (200x200), so the
// layout box is preserved.
//
// `// @broken-image` tells the golden runner to chain SetBrokenImageUrl for this
// sample only (every other golden keeps the slot empty and stays byte-identical).
// `// @render-only` keeps it out of the pixel golden: the remote load FAILS
// asynchronously, so the timing of the placeholder swap vs. the capture is not
// statically reproducible (the placeholder bitmap itself is fixed/local, but
// WHEN DALi decides the load failed is async). It is verified by compiling +
// rendering (the chain is valid + the box is built) plus the host-side
// `image-placeholder` provenance badge and a visual ✋. If the orchestrator finds
// the swap IS deterministic on the runtime, drop `@render-only` and seed a golden.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetBackgroundColor(UiColor(0x101418));
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);

ImageView poster = ImageView::New("https://unreachable.invalid/poster.jpg");
poster.SetRequestedWidth(200.0f);
poster.SetRequestedHeight(200.0f);
root.AddChildren({ poster });
return root;
