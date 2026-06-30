// 06 · Images — load a local image file with ImageView.
//
// Give a path RELATIVE to THIS preview file. The extension stages the asset into
// the runtime for you (in docker it is copied into the container), so there is
// nothing to mount by hand. A remote URL (https://…) or a path that can't be
// resolved falls back to a gray broken-image placeholder, so the layout box is
// preserved either way.
FlexLayout root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetJustifyContent(FlexJustify::CENTER);
root.SetAlignItems(FlexAlign::CENTER);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetBackgroundColor(UiColor(0x0f1117));

FlexLayout card = FlexLayout::New();
card.SetDirection(FlexDirection::COLUMN);
card.SetBackgroundColor(UiColor(0x1b2030));
card.SetCornerRadius(20.0f);
card.SetPadding(Extents(24, 24, 24, 28));

ImageView hero = ImageView::New("assets/banner.jpg");
hero.SetRequestedWidth(520.0f);
hero.SetRequestedHeight(260.0f);
hero.SetCornerRadius(14.0f);

Label title = Label::New("Sunset Ridge");
title.SetFontSize(40);
title.SetTextColor(UiColor(0xffffff));
title.SetMargin(Extents(0, 0, 22, 6));

Label sub = Label::New("3-night trip  -  from $420");
sub.SetFontSize(26);
sub.SetTextColor(UiColor(0x9aa4bf));

card.AddChildren({ hero, title, sub });
root.AddChildren({ card });
return root;
