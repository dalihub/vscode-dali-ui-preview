#include <dali-ui-foundation/dali-ui-foundation.h>

using namespace Dali;
using namespace Dali::Ui;
using Dali::Ui::View;

/**
 * Example demonstrating single-marker preview extraction.
 * Place // @preview above a function and the extension will extract its body.
 *
 * For reference, the old marker style also works:
 *   // @dali-preview-begin
 *   ...code...
 *   // @dali-preview-end
 */
class MarkerExampleView : public ConnectionTracker
{
public:
    void Initialize(Application& application)
    {
        Window window = application.GetWindow();

        View BuildCard()
        {
            return FlexLayout::New()
                .Direction(FlexDirection::COLUMN)
                .AlignItems(FlexAlign::CENTER)
                .JustifyContent(FlexJustify::CENTER)
                .SetRequestedWidth(MATCH_PARENT)
                .SetRequestedHeight(MATCH_PARENT)
                .SetViewPadding(Extents(20, 20, 20, 20))
                .SetBackgroundColor(UiColor(0x2d2d3f))
                .Children({
                    Label::New("Marker")
                        .SetFontSize(32)
                        .SetTextColor(UiColor(0xFFFFFF)),
                    View::New()
                        .SetBackgroundColor(UiColor(0x4a90d9))
                        .SetRequestedWidth(MATCH_PARENT)
                        .SetRequestedHeight(2.0f),
                    FlexLayout::New()
                        .Direction(FlexDirection::ROW)
                        .JustifyContent(FlexJustify::CENTER)
                        .SetRequestedWidth(MATCH_PARENT)
                        .Children({
                            View::New()
                                .SetBackgroundColor(UiColor(0x555555))
                                .SetRequestedWidth(240.0f)
                                .SetRequestedHeight(48.0f),
                            View::New()
                                .SetBackgroundColor(UiColor(0x4488ff))
                                .SetRequestedWidth(120.0f)
                                .SetRequestedHeight(48.0f),
                        }),
                });
        }

        window.Add(BuildCard());
    }
};
