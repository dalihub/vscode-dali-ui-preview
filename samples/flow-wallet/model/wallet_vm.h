#pragma once
// Flow Wallet — view model (P6: MVVM model object passed to the view builder).
// The screen builder reads from this; in the real app it's populated from a
// repository/network, in preview it must be auto-stubbed with sample data.
#include <string>
#include <vector>

namespace wallet {

struct Transaction {
    std::string merchant;
    std::string amount;    // pre-formatted, e.g. "-$5.40"
    std::string category;  // "food" | "shopping" | "income" ...
};

struct WalletViewModel {
    std::string balance;                 // e.g. "$3,500"
    std::string cardLast4;               // e.g. "2847"
    std::vector<Transaction> recent;     // drives the P2 for-loop
};

} // namespace wallet
