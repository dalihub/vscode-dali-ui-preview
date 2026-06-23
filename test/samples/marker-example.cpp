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
            FlexLayout root = FlexLayout::New();
            root.SetDirection(FlexDirection::COLUMN);
            root.SetAlignItems(FlexAlign::CENTER);
            root.SetJustifyContent(FlexJustify::CENTER);
            root.SetRequestedWidth(MATCH_PARENT);
            root.SetRequestedHeight(MATCH_PARENT);
            root.SetPadding(Extents(20, 20, 20, 20));
            root.SetBackgroundColor(UiColor(0x2d2d3f));

            Label title = Label::New("Marker");
            title.SetFontSize(32);
            title.SetTextColor(UiColor(0xFFFFFF));

            View divider = View::New();
            divider.SetBackgroundColor(UiColor(0x4a90d9));
            divider.SetRequestedWidth(MATCH_PARENT);
            divider.SetRequestedHeight(2.0f);

            FlexLayout row = FlexLayout::New();
            row.SetDirection(FlexDirection::ROW);
            row.SetJustifyContent(FlexJustify::CENTER);
            row.SetRequestedWidth(MATCH_PARENT);

            View leftButton = View::New();
            leftButton.SetBackgroundColor(UiColor(0x555555));
            leftButton.SetRequestedWidth(240.0f);
            leftButton.SetRequestedHeight(48.0f);

            View rightButton = View::New();
            rightButton.SetBackgroundColor(UiColor(0x4488ff));
            rightButton.SetRequestedWidth(120.0f);
            rightButton.SetRequestedHeight(48.0f);

            row.AddChildren({ leftButton, rightButton });

            root.AddChildren({ title, divider, row });
            return root;
        }

        window.Add(BuildCard());
    }
};
