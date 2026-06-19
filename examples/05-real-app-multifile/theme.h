#pragma once
// Design tokens — constexpr theme constants shared across the screen and widgets.
// The preview must resolve these (e.g. theme::ACCENT → 0x00d4a8) when it slices
// home_screen.cpp, even though they live in a different file. Sized for the TV
// FHD canvas (1920×1080) — the default preview profile.
#include <cstdint>

namespace home {
namespace theme {

// Colour tokens (0xRRGGBB)
constexpr uint32_t BG      = 0x0d1117;  // app background
constexpr uint32_t SURFACE = 0x1b2433;  // card / hero surface
constexpr uint32_t ACCENT  = 0x00d4a8;  // brand teal
constexpr uint32_t TEXT    = 0xffffff;  // primary text
constexpr uint32_t MUTED   = 0x8a93a3;  // secondary text

// Dimension tokens (generous, so the 1920×1080 TV canvas is filled)
constexpr float RADIUS_CARD = 20.0f;
constexpr float PAD_SCREEN  = 72.0f;
constexpr float GAP_CARD    = 36.0f;
constexpr float CARD_W      = 360.0f;   // media tile width
constexpr float THUMB_H     = 220.0f;   // poster height

} // namespace theme
} // namespace home
