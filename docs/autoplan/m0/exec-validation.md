# M0 — exec validation

## Gate A (static)
- `npm run compile`: exit 0 (0 errors)
- `npx mocha out/test/unit/**/*.test.js`: **583 passing** (579 baseline + 4 new sliceBaseline) — no regression

## Gate B (execution-based)

### F0.1 — flow-wallet app compiles (real dali-ui code, Tier 1 in-container)
- Command: `docker run ... g++ -std=c++17 -fsyntax-only -I/app <CFLAGS> <TU>`
- `widgets/cards.cpp` → exit 0
- `screens/wallet_screen.cpp` (preview target) → exit 0
- `app_main.cpp` → exit 0 (after lambda-Connect fix)
- Verdict: **PASS** — the app is genuinely compilable dali-ui, not pseudo-code.

### F0.2 — slice fixtures exist + non-self-contained (Tier 3)
- `test/fixtures/slice/{helper_same_file,member_field,theme_const}.cpp` present, each `// @preview` marked.
- Verdict: PASS.

### F0.3 — red baseline (Tier 3 smoke)
- Command: `npx mocha out/test/unit/sliceBaseline.test.js`
- Result: 4 passing — all three fixtures return `null` from `parseChainExpression` (current pipeline cannot preview them). This pins the "before" state for M2.
- Verdict: PASS.

## Bugs caught by Gate B (would have been silent failures)
1. `Label::New(std::string)` does not convert to `const Dali::String&` — real apps pass `std::string` from the model, so `.c_str()` is required. Fixed in cards.cpp / wallet_screen.cpp / member_field.cpp. (This is exactly the idealized-sample vs real-code gap we're testing.)
2. Member-pointer `InitSignal().Connect(this, &WalletApp::OnInit)` fails (upstream signal.h regression) — switched to lambda Connect.

## Inv audit
- Inv-3 (dali-ui boundary): PASS — grep shows zero dali-toolkit / Tizen capi includes.

## Verdict: M0 PASS (Gate A green, Gate B green, demonstration met)
