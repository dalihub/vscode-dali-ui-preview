# M3 — exec validation

## Gate A (static)
- `npm run compile`: exit 0; full suite 588 passing (no regression).

## Gate B (execution-based) — the whole pipeline, in the real runtime image

### F3.1 — slice → .so → preview_server → PNG (the decisive end-to-end proof)
- `helper_same_file`: buildSlice → 3-slot template → `g++ -shared` (.so 17995-byte) →
  `preview_server` dlopen + render → **PNG written** → visually verified:
  "Home / Wallet / Settings" chips, teal, ROW SPACE_EVENLY. **Real preview, zero annotations.**
- `member_field` (auto-stub): rendered too — `mName` weak-stub "Sample" shows as a label.

### F3.2 — Rung reach matrix (docker measured)
| input | dep location | rung | stubs | compile | render |
|---|---|---|---|---|---|
| helper_same_file | same file | heuristic | — | PASS | **rendered** |
| theme_const | same file | heuristic | — | PASS | (isomorphic) |
| member_field | member (no def) | heuristic | mName,mAccent | PASS | **rendered** |
| flow-wallet (real) | other files | heuristic | theme,mVm,Make×3 | **FAIL(14)** | — |

Same-file → fully works incl. render. Real app (cross-file) → needs Rung1. Honest boundary measured, not estimated.

### F3.3 — report
- `Docs/auto_extract_validation_0610.md` written with matrix + PNG evidence + honest limits + next steps.

## Inv audit
- Inv-2 (bodied stubs / RTLD_NOW): UPHELD — member_field .so dlopen'd + rendered (would have crashed if stubs were bare decls).
- Inv-4 (no regression): 588 pass.
- Inv-5 (server/*.cpp + image unchanged): UPHELD — rendered with the stock image's `/opt/dali/bin/preview_server`.

## Scope decision (orchestrator integration F2.3/M3b)
- DEFERRED to a future cycle, recorded as the #1 next step in the report. Rationale:
  the milestone's question — "how far can auto-extract preview a real app?" — is
  answered by the matrix + PNG (validation goal). Wiring SliceBuilder into the live
  runPreview flow is a production change requiring the compile-probe→Rung3 fallback
  (external-review's safety requirement) + errorParser #line/dynamic-sources, and is
  only meaningfully testable inside VS Code. Doing it autonomously without the user
  risks regressing the live preview path. The design is specified in the report §5.

## Verdict: M3 PASS — auto-extract preview proven real (same-file, with render);
cross-file boundary measured; production wiring scoped as next step.
