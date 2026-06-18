## Verdict: DRIFT-MINOR

M1 implements the 3-slot template but diverges from ADR-001/ADR-005 in two
deliberate, lower-risk ways. Both are noted here (append-only); neither blocks M2.

## Drift findings
- **D1 (ADR-001):** ADR-001 specified renaming `{{USER_CODE}}` → `{{USER_BODY}}`.
  Implementation KEPT `{{USER_CODE}}` and only added `{{USER_INCLUDES}}` /
  `{{USER_GLOBALS}}`. Rationale: renaming forces synchronized edits to
  errorParser (`includes('{{USER_CODE}}')` offset finder) and several tests for
  zero functional gain; keeping the token minimizes the byte-identical blast
  radius (the M1 make-or-break invariant). Action: ADR-001 amended in spirit —
  body slot is `{{USER_CODE}}`, not `{{USER_BODY}}`. No supersede needed.
- **D2 (ADR-005, #line):** plan.md F1.3 bundled `#line` injection + errorParser
  dynamic-source redesign into M1. Deferred to M2. Rationale: `#line` must only
  appear when the body slot is actually offset by non-empty globals (the slice
  case). Injecting it in M1 — where globals is always empty — would break the
  byte-identical invariant (the template would carry a `#line` the original
  never had). #line + dynamic sourcePaths belong with the SliceBuilder that
  produces those sources. Moved to M2 scope (recorded, not silently dropped).

## Invariant audit
- Inv-1 (empty slots byte-identical): UPHELD — proven by node diff for both
  templates + golden tests green.
- Inv-4 (579→583 tests green): UPHELD.
- Inv-5 (server/*.cpp unchanged): UPHELD — only templates + buildRunner + a test.

## Propagation impact
- Affects M2: SliceBuilder must (a) write into `{{USER_INCLUDES}}` / `{{USER_GLOBALS}}`
  and map body to `{{USER_CODE}}` (not `{{USER_BODY}}`); (b) own the `#line` prefix
  on the body slot; (c) introduce a shared `applySlots()` so test + production
  substitution stop diverging (the M1 duplication bug).
