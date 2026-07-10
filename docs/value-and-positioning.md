# Value & positioning — DALi UI Preview (VS Code extension) in the AI-agent era

## TL;DR

This extension is the **human-facing half** of DALi's preview story: edit C++ → headless render →
screenshot in a webview, with **click-to-code**. In the AI-agent era "preview" splits by audience —
**humans eyeball a live render; agents render + inspect a structured scene tree** (that's the sibling
CLI). Both are a **fast first-pass filter, not a replacement for on-device validation.** The value is
highest for **Tizen TV / embedded**, where deploying to a real device is slow and hardware is scarce.

---

## 1. Is a preview still worth it when running on a device is more accurate?

The real device is ground truth — but *render-and-inspect* and *run-on-device* are **complementary
stages**, not competitors. The preview wins the **tight iteration loop** (a screen in ~0.1–1.8s vs a
Tizen cross-build + deploy that costs minutes), wins **edge-state coverage** (error/empty/loading,
locales, sizes on demand), and gives **click-to-code** to jump from a rendered region straight to the
source. The device wins **final fidelity and integration** (real GPU/fonts/platform/data, real
navigation and services). You use both, at different points.

This is not a fading pattern: Apple's Xcode 27 (in beta as of mid-2026) hands coding agents *both* a
preview and the simulator as **co-equal** tools. Preview is evolving from a human convenience into a
verification surface for humans **and** agents — not being displaced.

## 2. How the three surfaces fit together

| Surface | Audience | Role |
|---|---|---|
| **This extension** (live preview + click-to-code) | **human** | the eyeball loop — fast visual iteration while you edit. Table stakes, but essential |
| **`dali-ui-preview-cli`** (PNG + JSON scene tree + verify loop) | **AI agent** | the agent's verification channel: render → inspect a source-mapped tree → compare → rewrite. An agent invokes the CLI directly — **no MCP server required** |
| **Real device / Tizen emulator** | both | final fidelity + integration. The preview does **not** replace this |

The extension and the CLI **share one runtime** (same container image, same warm caches), so a team using
the extension already has everything the agent CLI needs.

## 3. Where the value is highest

Preview value scales with how expensive the *real run* is. For **web**, the real run is a browser tab
(~1s), so a preview is a nice-to-have. For **Tizen TV / embedded / cross-compiled** targets, a real run
means a cross-build + flash to scarce hardware — Samsung's own docs note the QEMU TV emulator exists "to
reduce the inconvenience of testing on a real device," yet is slower than a real TV and diverges at the
hardware level. That is exactly where a fast host-side preview pays off most — **DALi's domain.**

## 4. Honest limits (do not oversell)

- The render is a **headless software raster** (Xvfb + Mesa `llvmpipe`) of the **extracted region** you
  `return` — not the real Tizen runtime, not the whole app. **"Preview looks right" ≠ "correct on
  device."** Treat it as a fast filter and validate final builds on a real device or the Tizen emulator.
- It renders the extracted region, not full app navigation/state/real data — those belong to the device
  run by design.

## See also
- `README.md` / `README.ko.md` — Features, Requirements, Writing previews.
- `CLAUDE.md` — *Three-component sync* (extension · CLI · runtime-release).
- The sibling CLI's `docs/value-and-positioning.md` mirrors this framing for the agent side.
