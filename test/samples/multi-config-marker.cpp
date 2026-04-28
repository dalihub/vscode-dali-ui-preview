#include <dali-ui-foundation/dali-ui-foundation.h>
using namespace Dali;
using namespace Dali::Ui;

// @dali-preview-begin
// @preview-config: name="Phone Light", width=720, height=1280, theme=light
// @preview-config: name="Tablet", width=1920, height=1080
return FlexLayout::New()
    .Children({
        Label::New("Hello from marker mode"),
    });
// @dali-preview-end
