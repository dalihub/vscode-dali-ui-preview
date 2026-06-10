// Rung2 fixture — member fields with NO definition in the slice.
// SliceBuilder must auto-stub mName/mAccent (type-driven: string="Sample",
// uint32_t=0) so the slice compiles, since RTLD_NOW means an undefined symbol
// would kill dlopen. The member function shape (this->mX) is the dominant
// real-world case and today's parser cannot handle it at all.
#include <dali-ui-foundation/dali-ui-foundation.h>
#include <string>
using namespace Dali::Ui;

class ProfileCard {
    std::string mName;     // unresolved → auto-stub "Sample"
    uint32_t    mAccent;   // unresolved → auto-stub 0
public:
    // @preview
    View Build() {
        return FlexLayout::New()
            .SetDirection(FlexDirection::COLUMN)
            .SetPadding(Extents(40, 40, 40, 40))
            .Children({
                Label::New(mName.c_str()).SetFontSize(48).SetTextColor(UiColor(mAccent)),
            });
    }
};
