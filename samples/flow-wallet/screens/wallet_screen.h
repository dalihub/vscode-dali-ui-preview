#pragma once
// Flow Wallet — wallet screen (P5: class member function builds the UI).
// Build() is the PREVIEW TARGET: it reads this->mVm (P6), loops over data (P2),
// calls cross-file factories (P1/P14), uses theme constants (P4), and pulls in
// project headers (P11). This is the dominant real-world shape — a member
// function on a screen/controller class, not a free function.
#include <dali-ui-foundation/dali-ui-foundation.h>
#include "../model/wallet_vm.h"

namespace wallet {

using Dali::Ui::View;

class WalletScreen {
public:
    explicit WalletScreen(const WalletViewModel& vm) : mVm(vm) {}

    // @preview
    // The extension should be able to preview THIS member function.
    View Build();

private:
    WalletViewModel mVm;
};

} // namespace wallet
