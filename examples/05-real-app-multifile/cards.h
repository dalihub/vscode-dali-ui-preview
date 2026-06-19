#pragma once
// Reusable widget factories — declared here, DEFINED in cards.cpp.
// home_screen.cpp calls these, so it depends on symbols that live in ANOTHER
// file. The preview's slicer collects them automatically — nothing to rewrite.
#include <dali-ui-foundation/dali-ui-foundation.h>
#include <string>

namespace home {

using Dali::Ui::View;

// Rail / section title label.
View MakeSectionHeader(const std::string& title);

// A TV media tile: a poster block with a title and a subtitle beneath it.
View MakeCard(const std::string& title, const std::string& subtitle);

} // namespace home
