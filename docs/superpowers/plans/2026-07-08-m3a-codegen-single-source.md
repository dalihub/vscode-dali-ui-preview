# M3a — Codegen Single-Source (kill the standaloneBuildRunner drift)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. This is a **behavior-preserving refactor** — the golden suite is the oracle.

**Goal:** Make the harness C++ slot-filler codegen live in ONE `vscode`-free module that both the production `BuildRunner` and the e2e `standaloneBuildRunner` consume — eliminating the duplicated, already-drifted copies (`BuildRunner.buildPreBuildInstall` is `(theme, fontScale, bool, locale)` while `standaloneBuildRunner`'s is `(theme, locale)` — proof they have diverged).

**Architecture:** Extract the pure slot-filler logic from `src/buildRunner.ts` (the `BuildRunner` static methods + their private helpers) into a new `src/harnessCodegen.ts` that imports NO `vscode`. `BuildRunner`'s public static methods become thin delegations (so existing unit tests and `renderHarness` are unchanged). `test/e2e/standaloneBuildRunner.ts` deletes its duplicate functions and imports them from `../../src/harnessCodegen`. **The canonical version is always the production `BuildRunner` one** — never the standalone copy.

**Tech Stack:** TypeScript (strict). Verified by the existing unit suite + the docker golden render suite.

**Spec:** [../specs/2026-07-08-dali-ui-code-sync-automation-design.md](../specs/2026-07-08-dali-ui-code-sync-automation-design.md) — Phase 2 (M3), the TS-consolidation slice.

## Global Constraints

- **Behavior-preserving:** the generated C++ MUST be byte-identical for every sample. The docker golden suite (`npm run test:e2e`) currently passes **26/0** — it MUST still pass 26/0 after the refactor. Do NOT regenerate goldens.
- **`src/harnessCodegen.ts` must import NO `vscode`** — that is the whole point (so `test/e2e/` and, later, the CLI can consume it). Verify with `grep -n vscode src/harnessCodegen.ts` → no matches.
- **Canonical = production.** Where `BuildRunner`'s static method and `standaloneBuildRunner`'s function have drifted, the moved version is `BuildRunner`'s. If adopting the canonical version changes golden output, STOP and report DONE_WITH_CONCERNS with the diff — do NOT regenerate goldens or "fix" the mismatch without sign-off.
- TypeScript strict; single quotes; `const` over `let`; never `var`. TDD not applicable (pure refactor) — the safety net is the existing unit + golden suites, which must stay green.

## File Structure

**Created:** `src/harnessCodegen.ts` — the single source of harness slot-filler codegen.
**Modified:** `src/buildRunner.ts` — `BuildRunner` static slot-fillers delegate to `harnessCodegen`. `test/e2e/standaloneBuildRunner.ts` — delete duplicate slot-fillers, import from `harnessCodegen`.

---

### Task 1: Extract the codegen into `src/harnessCodegen.ts` and delegate from `BuildRunner`

**Files:**
- Create: `src/harnessCodegen.ts`
- Modify: `src/buildRunner.ts`

**Interfaces (must be exported from `harnessCodegen.ts`, signatures copied VERBATIM from the current `BuildRunner` static methods — do not change them):**
- `buildPaletteDefs(theme?: 'light'|'dark', locale?: string): string`
- `buildUiConfigSetup(fontScale?: number, brokenImagePath?: string): string`
- `buildPreBuildInstall(theme: 'light'|'dark'|undefined, fontScale: number|undefined, <the 3rd param exactly as in BuildRunner>, locale?: string): string` — copy the exact current signature and body
- `buildPostBuildLayoutDir(locale?: string): string`
- `buildPostBuildFocus(focusId?: string): string`
- `buildPostBuild(locale?: string, focusId?: string): string`
- `injectFocusName(userCode: string, focusId?: string): string`
- `instrumentAnimations(userCode: string): string`
- plus the private helpers they depend on (`darkPaletteFreeFunction`, `localeOverrideFreeFunction`, `formatFloat`, `findStatementEnd`, `resolveBgColorVec`) and the `DARK_PALETTE_TOKENS` const — moved as module-level functions/consts (exported only if a consumer needs them; otherwise module-private).

- [ ] **Step 1: Read the current definitions**

Read `src/buildRunner.ts` and note the EXACT bodies of every `static`/`private static` slot-filler method and helper listed above, plus `DARK_PALETTE_TOKENS`. These move verbatim.

- [ ] **Step 2: Create `src/harnessCodegen.ts`**

Move each function body verbatim into module-level functions. Keep the leading doc-comments. `export` the ones in the interface list; keep the helpers module-private unless a public function needs them cross-module (they are all used only by the codegen functions, so private). Add a file header:

```typescript
// Single source of the harness/plugin C++ slot-filler codegen (ADR-004/006).
// vscode-free ON PURPOSE: both the production BuildRunner (src/buildRunner.ts)
// and the e2e standaloneBuildRunner (test/e2e/) import from here, so the two can
// never drift again (they previously did — buildPreBuildInstall signatures diverged).
// Emits literal dali-ui C++, so a dali-ui API rename is a change HERE (one place).
```

Confirm no `import ... vscode`.

- [ ] **Step 3: Delegate from `BuildRunner`**

In `src/buildRunner.ts`, add `import * as codegen from './harnessCodegen';` and replace each moved static method body with a one-line delegation, e.g.:

```typescript
    static buildPaletteDefs(theme?: 'light' | 'dark', locale?: string): string {
        return codegen.buildPaletteDefs(theme, locale);
    }
```

Do this for every moved static method (so the `BuildRunner.xxx` public API and every `renderHarness` call site are unchanged). Remove the now-dead private helpers/`DARK_PALETTE_TOKENS` from `BuildRunner` (they live in `harnessCodegen` now). Keep methods that were NOT pure codegen (e.g. `stageBrokenImagePlaceholder`, `buildFontSetup`, `renderHarness`, `resolveBgColorVec` if it touches instance state) in `BuildRunner` — move only the pure, static, `vscode`-free ones. If a helper is used by both a moved function and a retained one, export it from `harnessCodegen` and have `BuildRunner` import it.

- [ ] **Step 4: Compile + run the unit suite**

Run: `npm run compile && npm run test:unit:no-coverage`
Expected: zero compile errors; all unit tests pass (the same count as before — the `BuildRunner.buildX` API is unchanged, so `buildRunner`/codegen unit tests still resolve).

- [ ] **Step 5: Commit**

```bash
git add src/harnessCodegen.ts src/buildRunner.ts
git commit -m "refactor(codegen): extract harness slot-fillers into vscode-free src/harnessCodegen.ts; BuildRunner delegates"
```

---

### Task 2: Rewire `standaloneBuildRunner` to the single source

**Files:**
- Modify: `test/e2e/standaloneBuildRunner.ts`

- [ ] **Step 1: Replace the duplicate functions with imports**

In `test/e2e/standaloneBuildRunner.ts`, add `import * as codegen from '../../src/harnessCodegen';` and DELETE its local `export function buildPaletteDefs / buildUiConfigSetup / buildPreBuildInstall / buildPostBuildLayoutDir / buildPostBuildFocus / buildPostBuild / injectFocusName` and the local `DARK_PALETTE_TOKENS`. Update every call site inside `buildAndCapture`/`buildAndCaptureDocker`/`renderHarness`-equivalent to call `codegen.xxx(...)`.

**Signature drift note:** `standaloneBuildRunner.buildPreBuildInstall` was `(theme, locale)` but the canonical `codegen.buildPreBuildInstall` is `(theme, fontScale, <bool>, locale)`. Update the call site to pass the canonical arguments **exactly as `BuildRunner.renderHarness` does** (read that call site in `src/buildRunner.ts` and mirror it). If `standaloneBuildRunner` was calling with fewer args, supply the same values `renderHarness` supplies.

If `standaloneBuildRunner` re-exports any of these for other test files (e.g. `previewCompileSweep.js` or golden runners import them), keep the names available by re-exporting: `export { buildPaletteDefs, ... } from '../../src/harnessCodegen';`. Grep first: `grep -rn "from './standaloneBuildRunner'\|require.*standaloneBuildRunner" test/` and preserve any imported symbol.

- [ ] **Step 2: Compile + unit suite**

Run: `npm run compile && npm run test:unit:no-coverage`
Expected: zero errors; unit tests green.

- [ ] **Step 3: THE ORACLE — docker golden render suite must stay 26/0**

Run: `npm run test:e2e`
Expected: **26 passed, 0 failed** (identical to pre-refactor). This proves the generated C++ is byte-identical — the drift was immaterial for the samples, and the single source produces the same render.

**If any sample fails:** the drifted standalone version was materially different. STOP. Do NOT regenerate goldens. Report DONE_WITH_CONCERNS with which sample(s) changed and the generated-C++ diff, so the controller can decide whether the canonical version is a correctness fix (needs golden regen + sign-off) or a regression.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/standaloneBuildRunner.ts
git commit -m "refactor(e2e): standaloneBuildRunner imports harness codegen from the single source (kills drift)"
```

---

## Self-Review

**Spec coverage:** M3's "extract the pure slot-filling codegen out of the vscode-coupled buildRunner.ts into an importable module so the e2e runners consume it → kills standaloneBuildRunner drift." (The CLI's `harnessTemplater` consuming the shared source, the baked `preview_server.cpp` sharing, the ABI/handshake, and the sed migration are the REST of M3 — deferred past this checkpoint.)

**Placeholder scan:** the function bodies are "moved verbatim" (they exist in the repo — the implementer reads and moves them; not a placeholder, a move). Every step names exact files + commands + expected output.

**Risk:** the golden suite (Task 2 Step 3) is the hard gate. A behavior change surfaces as a golden failure and halts the task rather than silently regenerating goldens.

> **Order:** Task 1 before Task 2 (Task 2 imports the module Task 1 creates).
