#include "widgets.h"
using namespace Dali;
using namespace Dali::Ui;

View MakeBanner(const char* text) {
    return Label::New(text)
        .SetFontSize(56)
        .SetTextColor(UiColor(0x00d4a8));
}
