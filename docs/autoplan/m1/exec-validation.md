# M1 — exec validation

## Gate A (static)
- `npm run compile`: exit 0
- full unit suite: **583 passing** — no regression

## Gate B (execution-based) — byte-identical invariant (Inv-1)
- harnessGeneration goldens (`red-box.harness.cpp`, `animation.harness.cpp`): PASS after updating the test's own substitution helper to empty the new slots.
- Direct proof (node): both templates, empty-slot substitution === pre-3-slot version with `{{USER_CODE}}` mapped:
  - `preview_plugin`: empty-slot byte-identical = **true**
  - `preview_harness`: empty-slot byte-identical = **true**
- Verdict: PASS — empty INCLUDES/GLOBALS slots restore the original blank lines exactly.

## Bug caught by Gate B
- `harnessGeneration.test.ts` carries its OWN copy of the template substitution
  (`substituteTemplate`), separate from `buildRunner`'s. Adding slots to the
  template broke it because the test helper didn't know the new tokens. Fixed by
  adding the empty-slot replaces there too. **This duplication is a drift risk**
  (test logic ≠ production logic) → flagged for M2 to unify via a shared
  `applySlots()`.
