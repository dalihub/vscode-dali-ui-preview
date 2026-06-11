#pragma once
#include <dali-ui-foundation/dali-ui-foundation.h>

// Declaration only — the definition lives in widgets.cpp (the cross-file case
// SliceBuilder's Rung1 pass must reach by scanning the .cpp alongside the header).
Dali::Ui::View MakeBanner(const char* text);
