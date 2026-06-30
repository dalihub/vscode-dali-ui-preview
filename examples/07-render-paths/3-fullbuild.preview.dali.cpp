// Full harness build (~1100ms)
// Same chain as 1-parser; this file exists to measure the slow path.
// Status bar: 🔨 Compile
//
// The full build is normally only a fallback. To force it:
//   1. Open VS Code Settings (Ctrl+,)
//   2. Search for "daliPreview.disablePreviewServer"
//   3. Set it to true (workspace recommended)
//   4. Reload Window (Ctrl+Shift+P -> "Developer: Reload Window")
//   5. Open this file and save / re-trigger preview
//
// Expected output channel log (DALi Preview):
//   [PreviewServer] Skipped (daliPreview.disablePreviewServer is true) ...
//   [Perf]    previewServer: null
//   Preview updated in ~1.1s [compile]
//
// To restore the fast paths: flip disablePreviewServer back to false and reload.

FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::CENTER);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x1B1B2F));

Label title = Label::New("Full Build Path");
title.SetFontSize(28);
title.SetTextColor(UiColor(0xFF4444));

Label subtitle = Label::New("g++ full harness compile");
subtitle.SetFontSize(14);
subtitle.SetTextColor(UiColor(0x888888));
subtitle.SetMargin(Extents(0, 0, 16, 0));

root.AddChildren({ title, subtitle });
return root;
