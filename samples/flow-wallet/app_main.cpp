// Flow Wallet — application entry point.
// NOT a preview target: this is the real Dali::Application boot that proves
// flow-wallet is a runnable app (a ConnectionTracker that builds a screen from
// a view-model on init). The previewer targets WalletScreen::Build(), not this.
#include <dali/dali.h>
#include <dali-ui-foundation/dali-ui-foundation.h>

#include "screens/wallet_screen.h"
#include "model/wallet_vm.h"

using namespace Dali;
using namespace Dali::Ui;

class WalletApp : public ConnectionTracker {
public:
    explicit WalletApp(Application& app) {
        // Lambda, not member-pointer Connect: an upstream signal.h regression
        // breaks member-function Connect in this DALi build.
        app.InitSignal().Connect(this, [this](Application& a) { OnInit(a); });
    }

    void OnInit(Application& app) {
        Window window = app.GetWindow();
        window.SetBackgroundColor(Color::BLACK);

        // In the real app this comes from a repository; here it's seed data.
        wallet::WalletViewModel vm{
            "$3,500", "2847",
            {
                {"Starbucks", "-$5.40",  "food"},
                {"Amazon",    "-$82.10", "shopping"},
                {"Salary",    "+$4,200", "income"},
            }
        };

        wallet::WalletScreen screen(vm);
        window.Add(screen.Build());
    }
};

int main(int argc, char** argv) {
    Application app = Application::New(&argc, &argv);
    WalletApp wallet(app);
    app.MainLoop();
    return 0;
}
