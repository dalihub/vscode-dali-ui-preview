// P5 fixture — class member function with a struct member field (the dominant
// real-world shape). Build() is defined out-of-class (qualified Card::Build), and
// references this->mProfile, whose type Profile is a project-local struct.
// SliceBuilder must: stub mProfile with its exact type, collect the Profile def,
// and recognise the qualified member-function as the preview target.
#include <dali-ui-foundation/dali-ui-foundation.h>
#include <string>
using namespace Dali::Ui;

struct Profile {
    std::string name;
    unsigned int color;
};

class Card {
    Profile mProfile;
public:
    View Build();
};

// @preview
View Card::Build() {
    return FlexLayout::New()
        .SetDirection(FlexDirection::COLUMN)
        .SetPadding(Extents(40, 40, 40, 40))
        .Children({
            Label::New(mProfile.name.c_str())
                .SetFontSize(48)
                .SetTextColor(UiColor(mProfile.color)),
        });
}
