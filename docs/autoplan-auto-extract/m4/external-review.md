# M4 SliceBuilder integration — external (adversarial) review

Reviewer stance: independent, regression- and silent-failure-focused. Read the
working-tree code (not the summary). Empirically ran `buildSlice` over all 25
shipped samples, compiled a shadowing probe with g++, and ran the full unit suite.

## Verdict: CONCERN

Rendered output is preserved for every sample and the compile-probe→fallback is
correct and bounded, so this is **safe to ship**. But the central claim — "the
existing 24 self-contained samples are byte-identical / take the unchanged path"
— is **factually wrong for 2 of 25 samples**, one of which (`path2-dlopen`) is a
live dlopen-path sample that now takes the new heuristic branch on every render.
It survives only because C++ local-shadowing makes the wrongly-injected stubs
dead. That is a latent fragility plus a misleading diagnostic, not a broken
preview — hence CONCERN, not FAIL.

## Findings

- **Finding 1 (the headline): `scanRefs` mis-classifies non-`auto` locals as
  external refs → 2/25 samples flip to `heuristic` and get junk globals.**
  `src/sliceBuilder.ts:137-138` only strips `auto`-declared locals
  (`/\bauto\b[\s&*]+([A-Za-z_]\w*)/`). It does NOT strip C-style locals
  (`uint32_t colors[]`, `const char* names[]`) or `for (int i …)` loop vars.
  Empirically, running the orchestrator's exact call `buildSlice(doc.getText(),
  fileName, instrumented)` over every sample:
  - `test/samples/path2-dlopen.preview.dali.cpp` → **rung `heuristic`**, stubs
    `["colors","names","i"]`. Injected file-scope globals:
    `__attribute__((weak)) unsigned int colors = 0x888888;`,
    `std::string names = "Sample";`, `unsigned int i = 0;`
  - `test/samples/animation.preview.dali.cpp` → heuristic, stubs
    `["Animation","anim","AlphaFunction"]` (see Finding 4 — unreachable).
  All three `path2-dlopen` "stubs" are actually locals declared inside the body
  (lines 25, 26, 28). **What the user sees:** the preview still renders correctly
  (the locals shadow the dead globals — I compiled a `-Wshadow` probe with g++
  11.4: exit 0, locals win at runtime, and `compileShared` passes no
  `-Wshadow`/`-Werror` so not even a warning surfaces). BUT the output channel
  prints `[Slice] Rung2 heuristic: globals collected, 3 stub(s) [colors, names,
  i]` — falsely telling the user their working sample has 3 unresolved symbols.
  And the compile is now a *different* translation unit on the probe path, so the
  "byte-identical" guarantee for this sample is simply untrue.

- **Finding 2 (regression containment / why it's not FAIL): the shadow is dead,
  and the compile-probe→Rung3 fallback is the real safety net.**
  Even if a future heuristic sample injected a stub whose *type* broke usage (not
  just a harmless shadow), `DlopenStrategy.execute` (`previewOrchestrator.ts:149-153`)
  retries `compilePlugin(code)` with no globals — exactly the old path. So the
  worst realistic outcome of the Finding-1 bug is a wasted first compile + a
  misleading log line, never a broken or wrong preview. Confirmed: 591/591 unit
  tests pass (M3 baseline was 588; +3 new sliceIntegration tests).

- **Finding 3 (HarnessStrategy / multi-config silently drop the slice — a real
  but lower-stakes gap).** When the dlopen server is NOT running, control reaches
  `HarnessStrategy.execute` (`previewOrchestrator.ts:200-217`), whose signature
  has no `slice` param; `buildAndRun`/`buildAndRunOnDevice` hardcode
  `{{USER_GLOBALS}}` → `''` (`buildRunner.ts:302, 388, 854`). `runMultiPreview`
  likewise calls `compilePlugin(instrumented, config.name)` with no slice args
  (`previewOrchestrator.ts:838`). **Consequence:** a genuinely non-self-contained
  file (helper calls / members) that *needs* the slice will fail to compile on the
  harness/multi-config/device paths exactly as before this change — i.e. the new
  capability is silently absent there. This is honest "no improvement", not a
  regression, and matches the "single-config dlopen only" scope. Worth stating as
  a known boundary so nobody assumes multi-config gained slice support.

- **Finding 4 (animation flip is unreachable — verified, not assumed).**
  `animation.preview.dali.cpp` flips to heuristic in isolation, but the animation
  config (`animation=true`) makes `runPreview` branch into `runAnimationPreview`
  at `previewOrchestrator.ts:529-535` and `return` *before* line 554's
  `buildSlice` ever runs. So animation never touches the slice. Same for the
  multi-config early-return at 538-543. Scope claim (#4) holds for these two.

## Regression assessment (single-fn path)

- **Mechanically byte-identical when globals/includes are empty — proven.** Old:
  `.replace(/{{USER_INCLUDES}}/g,'').replace(/{{USER_GLOBALS}}/g,'')`. New:
  same replaces with `sliceIncludes`/`sliceGlobals`, which default to `''` and
  are passed `''` whenever `slice.rung !== 'heuristic'` (`previewOrchestrator.ts:143-148`).
  `String.replace(re,'')` ≡ `String.replace(re, sliceX)` when `sliceX===''`. So
  `compilePlugin(code, undefined, '', '')` produces a character-for-character
  identical `pluginCode` to the old `compilePlugin(code)`. The plugin template
  (`server/preview_plugin.cpp.template`) is unchanged on disk.
- **But "all 24 samples take that path" is FALSE.** 23/25 stay `single-fn`
  (byte-identical); `path2-dlopen` and `animation` go `heuristic`. The correct
  statement is "23/25 byte-identical; 1 reachable sample (path2-dlopen) takes the
  probe path but renders identically via local-shadowing + fallback."
- Strategy ordering is sound: M0 baseline tests (`sliceBaseline.test.ts`) prove
  `parseChainExpression` returns null for every heuristic fixture, so heuristic
  bodies cannot "wrongly succeed" in the parser path — they fall through to
  Dlopen with the slice as intended. A stub therefore can never override a symbol
  the parser would have rendered (the parser already declined).
- Generation guard after the added second await is correct: the retry at
  `:152` is *inside* `dlopenStrategy.execute`, and the stale-check at
  `:603` runs after the whole call resolves, covering both compiles. No new
  staleness window. Retry is a single `if` — bounded, no loop. On double-failure
  the surfaced error is the second (no-globals) compile parsed against the plain
  template (`:611-624`) — the honest user-code error, never the stub error.

## Could-be-stronger (even though shippable)

1. **Fix `scanRefs` local detection (one-line-ish, removes the whole CONCERN).**
   Also collect C-style/`for`-init locals before the ref scan, e.g. match
   `\bfor\s*\(\s*[\w:<>,&*\s]+?\b(\w+)\s*[=:;]` and a general
   `^[ \t]*[\w:<>,&*]+\s+([A-Za-z_]\w*)\s*(?:\[|=|;)` declaration pass, adding
   captures to `locals`. This drops `path2-dlopen` back to `single-fn`, restores
   the true byte-identical guarantee for it, and kills the false "3 stubs" log.
   There is zero orchestrator test for this (coverage report: `previewOrchestrator.ts`
   = **0%**), so this class of mis-slice can only be caught by a sample sweep like
   the one in this review — add one as a regression test:
   "every shipped non-animation/non-multi sample yields `rung==='single-fn'`."

2. **Make the heuristic log honest about confidence.** `[Slice] Rung2 heuristic:
   … stub(s) [colors, names, i]` will alarm users whose sample is fine. Either
   suppress the diagnostic when the slice ends up shadowed/unused, or label it
   "best-effort stubs (may be locals)" so it doesn't read as "your code is broken."

3. **State the harness/multi-config slice gap (Finding 3) in user-facing docs.**
   Right now slice help only lands on the single-config dlopen path; a non-self-
   contained file previewed via multi-config or device will fail exactly as
   before with no hint that single-config would have sliced it.

---
### Evidence appendix
- `buildSlice` over all 25 samples: 23 single-fn, 2 heuristic (`path2-dlopen`,
  `animation`); stubs as quoted above.
- g++ 11.4 `-Wshadow` probe: file-scope weak globals + same-named body locals →
  compiles exit 0, runtime locals win. `compileShared` (`buildRunner.ts:439-447`)
  uses neither `-Wshadow` nor `-Werror`, so silent.
- `npm run compile` exit 0; `npm run test:unit` → 591 passing, 0 failing.
- Reachability: `runPreview` animation/multi early-returns at
  `previewOrchestrator.ts:529-543` precede `buildSlice` at `:554`.
