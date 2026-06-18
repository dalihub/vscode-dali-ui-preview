# M2 — exec validation

## Gate A (static)
- `npm run compile`: exit 0
- full unit suite: **588 passing** (583 + 5 new sliceBuilder) — no regression

## Gate B (execution-based) — the decisive proof: slice → docker compile

The M0 red baseline pinned "current pipeline cannot preview these three fixtures".
M2 turns each into a self-contained TU and compiles it in the real runtime image:

- Pipeline: `buildSlice(fixture)` → fill `{{USER_INCLUDES}}`/`{{USER_GLOBALS}}`/`{{USER_CODE}}`
  in `preview_plugin.cpp.template` → `docker run ... g++ -std=c++17 -fsyntax-only -fPIC`
- Results:
  - `helper_same_file.cpp` → globals = collected `MakeChip` def → **exit 0**
  - `theme_const.cpp` → globals = collected `namespace theme` → **exit 0**
  - `member_field.cpp` → globals = weak bodied stubs for `mName`/`mAccent` → **exit 0**

**Red → Green transition demonstrated**: what M0 proved un-previewable now compiles.

## Inv audit
- Inv-2 (every external symbol has a stub BODY): UPHELD — member_field's stubs are
  `__attribute__((weak)) std::string mName = "Sample";` etc. (bodied, not bare decls),
  asserted by the unit test's negative regex. Compiles + would survive RTLD_NOW.
- Inv-4 (no regression): UPHELD (588 pass).
- Inv-5 (server/*.cpp unchanged): UPHELD — SliceBuilder is host-side TS only.

## Scope note (deferred, recorded)
- F2.3 (orchestrator integration: wire SliceBuilder into runPreview + errorParser
  #line/dynamic-sources) moved to **M3**, where it's exercised against the real
  flow-wallet app end-to-end. M2 delivers the SliceBuilder module + proof it
  produces compilable slices. Rationale: integration value is only observable
  with a real render (M3), and bundling avoids a throwaway half-wiring in M2.

## Known boundary (for M3 matrix)
- Rung 2 resolves SAME-FILE defs only. flow-wallet's factories live in cards.cpp
  (different TU) → they will become weak stubs, not real collected defs. That's
  the Rung1(clangd) boundary the M3 matrix must record honestly.

## Verdict: M2 PASS (Gate A green, Gate B = red→green docker proof)

## External-review response (CONCERN → addressed)
Independent reviewer (docs/autoplan/m2/external-review.md) ran the slicer on the
REAL app and found:
1. **Local-var leak bug (FIXED):** body-local `auto txList` and range-for `tx`
   were emitted as bogus global stubs. Fixed `scanRefs` to exclude `auto`-declared
   locals. flow-wallet now reports only genuine cross-file refs
   (`theme, mVm, MakeTransactionRow, MakeSectionHeader, MakeStatCard`) — txList/tx gone.
2. **Cross-file boundary (BY DESIGN, → M3 matrix):** flow-wallet's deps all live
   in OTHER files (theme/tokens.h, model/wallet_vm.h, widgets/cards.cpp), so Rung2
   (same-file) correctly cannot collect them → weak stubs that are imprecise
   (`theme` stubbed as int but used as `theme::BG` namespace). This is the exact
   Rung1(clangd) boundary plan.md predicted. The honest verdict: **Rung2 fully
   handles same-file (fixtures); the real app needs Rung1.** M3 records this in the
   reach matrix and the ROADMAP.
3. **Wiring safety (→ M3):** reviewer warned that wiring a `rung:'heuristic'` slice
   that fails to compile would replace today's honest "can't preview" with a
   confusing build error. **M3 integration MUST compile-probe the Rung2 slice and
   fall back to Rung3 (current behavior) on failure** — never surface a slice
   build error pointing at code the user didn't write.

## Verdict: M2 PASS (fixtures: red→green proven; local-var bug fixed; cross-file
boundary + wiring-safety carried into M3 honestly)
