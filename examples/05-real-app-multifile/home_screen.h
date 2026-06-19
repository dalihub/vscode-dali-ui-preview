#pragma once
// Home screen — a class whose member function builds the UI. This is the dominant
// real-app shape: a Build() method on a screen/controller that reads member state,
// loops over data, and calls cross-file factories — NOT a free function returning
// a self-contained expression. Targets the TV (1920×1080 landscape).
//
// Build() is the preview target (marked // @preview). The previewer slices it,
// auto-collects the cross-file factories (MakeCard etc.), and synthesises sample
// data for the HomeViewModel member — so there is nothing to rewrite.
#include <dali-ui-foundation/dali-ui-foundation.h>
#include <string>
#include <vector>

namespace home {

using Dali::Ui::View;

// One tile on a TV rail. In the real app these come from a catalog/network; in
// preview each field is auto-stubbed with a sample value named after the field.
struct MediaItem {
    std::string title;
    std::string subtitle;
};

// View model — in the real app this comes from a repository/network; in preview
// it is auto-stubbed with sample data (a hero title + a few rail items).
struct HomeViewModel {
    std::string featured;            // hero banner title
    std::vector<MediaItem> items;    // drives the rail for-loop in Build()
};

class HomeScreen {
public:
    explicit HomeScreen(const HomeViewModel& vm) : mVm(vm) {}

    // @preview
    // Preview THIS member function.
    View Build();

private:
    HomeViewModel mVm;
};

} // namespace home
