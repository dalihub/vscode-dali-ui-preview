// ⚡ dlopen path test (~400ms)
// Uses auto, for, if/else — parser fails → compiles .so → dlopen.
// Expected log: parse: 0ms (null), compilePlugin: ~350ms, server.reload: ~80ms

auto root = FlexLayout::New();
root.SetDirection(FlexDirection::COLUMN);
root.SetAlignItems(FlexAlign::STRETCH);
root.SetRequestedWidth(MATCH_PARENT);
root.SetRequestedHeight(MATCH_PARENT);
root.SetPadding(Extents(20, 20, 24, 20));
root.SetBackgroundColor(UiColor(0x1B1B2F));

auto title = Label::New("dlopen Path");
title.SetFontSize(28);
title.SetTextColor(UiColor(0xFF8800));
root.Add(title);

auto divider = View::New();
divider.SetBackgroundColor(UiColor(0x333355));
divider.SetRequestedWidth(MATCH_PARENT);
divider.SetRequestedHeight(2.0f);
divider.SetMargin(Extents(0, 0, 12, 12));
root.Add(divider);

uint32_t colors[] = { 0x6C63FF, 0xFF6584, 0x43E97B, 0xF7971E, 0x38F9D7 };
const char* names[] = { "Alpha", "Beta", "Gamma", "Delta", "Test" };

for (int i = 0; i < 5; i++)
{
    auto row = FlexLayout::New();
    row.SetDirection(FlexDirection::ROW);
    row.SetAlignItems(FlexAlign::CENTER);
    row.SetRequestedWidth(MATCH_PARENT);
    row.SetRequestedHeight(44.0f);
    row.SetPadding(Extents(12, 12, 6, 6));
    row.SetMargin(Extents(0, 0, 0, 4));

    if (i % 2 == 0)
        row.SetBackgroundColor(UiColor(0x16213E));
    else
        row.SetBackgroundColor(UiColor(0x0F3460));

    auto dot = View::New();
    dot.SetBackgroundColor(UiColor(colors[i]));
    dot.SetRequestedWidth(20.0f);
    dot.SetRequestedHeight(20.0f);
    dot.SetMargin(Extents(0, 12, 0, 0));
    row.Add(dot);

    auto label = Label::New(names[i]);
    label.SetFontSize(16);
    label.SetTextColor(UiColor(0xFFFFFF));
    row.Add(label);

    root.Add(row);
}

auto footer = Label::New("for loop + if/else + auto");
footer.SetFontSize(12);
footer.SetTextColor(UiColor(0x888888));
footer.SetMargin(Extents(0, 0, 16, 0));
root.Add(footer);

return root;
