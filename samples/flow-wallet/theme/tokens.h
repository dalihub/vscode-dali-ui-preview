#pragma once
// Flow Wallet — design tokens (P4: constexpr theme constants).
// Shared across screens/widgets so colours/dimensions stay consistent.
#include <cstdint>

namespace wallet {
namespace theme {

// Colour tokens (0xRRGGBB)
constexpr uint32_t BG       = 0x0d1117;  // app background
constexpr uint32_t SURFACE  = 0x161c24;  // card surface
constexpr uint32_t ACCENT   = 0x00d4a8;  // brand teal
constexpr uint32_t TEXT     = 0xffffff;  // primary text
constexpr uint32_t MUTED    = 0x5e6673;  // secondary text

// Dimension tokens
constexpr float RADIUS_CARD = 70.0f;
constexpr float PAD_SCREEN  = 70.0f;
constexpr float GAP_ROW     = 28.0f;

} // namespace theme
} // namespace wallet
