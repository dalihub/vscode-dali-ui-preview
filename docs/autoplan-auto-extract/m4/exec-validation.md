# M4 — exec validation (orchestrator integration)

## What M4 did
Wired SliceBuilder into the live preview flow (`runPreview` → DlopenStrategy):
- self-contained (rung `single-fn`) → unchanged path, byte-identical
- non-self-contained (rung `heuristic`) → inject collected globals into the plugin,
  with **compile-probe → Rung3 fallback** (retry without globals on failure, so the
  user sees the honest current-path error, not a confusing error in generated stubs).

## Gate A (static)
- `npm run compile`: exit 0
- full suite: **592 passing** (588 + 3 integration + 1 sample-sweep regression)

## Gate B (execution)
- **Instrumented-body path (what runPreview actually uses)**: the 3 fixtures sliced
  from `instrumentCode(body)` → 3-slot template → docker `g++ -fsyntax-only` = PASS.
  (codeExtractor needs the mocha vscode-mock, so this runs in the integration test +
  an out-of-band docker compile.)
- **Single-fn byte-identical**: `compilePlugin(code, undefined, '', '')` ≡ old
  `compilePlugin(code)` (empty slots, M1 proof). Sample-sweep test asserts every
  shipped `*.preview.dali.cpp` stays `single-fn`.

## External-review (CONCERN → addressed)
Independent reviewer ran buildSlice over all 25 samples and found a real regression:
1. **path2-dlopen flipped to heuristic (FIXED):** `scanRefs` only excluded `auto`
   locals, so `uint32_t colors[]` / `const char* names[]` / `for (int i …)` leaked as
   junk stubs (harmless only by C++ shadowing). Extended `scanRefs` local detection to
   primitive/std type decls + for-loop vars → path2-dlopen back to `single-fn`. Added
   a **sample-sweep regression test** so no sample silently flips again.
2. **compile-probe fallback: CONFIRMED correct** — bounded (1 retry), second compile
   is the true old behavior, double-failure surfaces the user-code error.
3. **generation stale-check: CONFIRMED** correct across the added second await.
4. **HarnessStrategy (T3) / multi-config / device paths don't get the slice (GAP,
   recorded — NOT a regression):** heuristic code on those paths falls back to current
   behavior (no globals → current "can't preview"), never worse than today. dlopen (T2,
   the warm-server primary path) is where slicing applies. Extending to T3/multi-config
   is a follow-up, not a correctness bug.

## Inv audit
- Inv-1 (single-fn byte-identical): UPHELD — sample-sweep green + path2-dlopen fixed.
- Inv-2 (bodied stubs): UPHELD.
- Inv-4 (no regression): 592 pass.
- Inv-5 (server/image unchanged): UPHELD.

## Verdict: M4 PASS — SliceBuilder wired into live preview; self-contained path
byte-identical (proven by sample-sweep); heuristic path compile-probes with honest
Rung3 fallback. T3/multi-config slicing is a recorded follow-up.
