#pragma once
// Flow Wallet — reusable widget factories (P1 helpers / P14 factory functions).
// Declarations live here; definitions in cards.cpp — so a screen that calls
// MakeStatCard() depends on a symbol defined in ANOTHER translation unit.
// (This is the realistic cross-file case that needs Rung1 clangd resolution.)
#include <dali-ui-foundation/dali-ui-foundation.h>
#include <string>

namespace wallet {

using Dali::Ui::View;

// Section title label.
View MakeSectionHeader(const std::string& title);

// Stat card: small label on top, big accent-coloured value below.
View MakeStatCard(const std::string& label, const std::string& value, uint32_t accent);

// One transaction row: merchant on the left, amount on the right.
View MakeTransactionRow(const std::string& merchant, const std::string& amount);

} // namespace wallet
