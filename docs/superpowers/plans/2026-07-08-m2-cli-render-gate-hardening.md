# M2 — CLI Render-Gate Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the `dali-ui-preview-cli` (a separate, vendored repo) to parity with M1 on the two gaps it has: (1) **no dali-ui runtime-skew detector at all**, and (2) **no on-screen bounds check** over its rich semantic tree. (The CLI already has strong image-vs-placeholder render checks in `tests/e2e/render-modes.sh` — those stay.)

**Architecture:** Follow the CLI's existing **vendored-copy** convention (ADR-007): copy the parent's `skewSignature.ts` into the CLI (it must not import across repos), add `detectRuntimeApiSkew` + a hint to the CLI's `errorParser.ts`, and add a `vscode`-free `onScreenCheck.ts` that validates the CLI tree's `bounds` are on-screen — wired into the existing `tests/e2e/assert-render.js` so every rendered sample is checked. Pure functions get mocha unit tests (run in CI via `npm run test:unit`); the render wiring runs in `render-modes.sh` (needs runtime, on the agent-hub runner at M4).

**Tech Stack:** TypeScript (strict), Node.js, mocha + **chai** (the CLI's unit tests use `chai`'s `expect`, NOT node `assert` — match that), `pngjs`.

**Repo:** All CODE changes commit INSIDE the nested repo `/home/woochan/tizen/paperclip/dali-ui-preview-cli` on branch `m2/cli-render-gate-hardening` (local only — do NOT push; the CLI releases via main-push but the user asked to stay local). This plan doc lives in the PARENT repo.

**Spec:** [../specs/2026-07-08-dali-ui-code-sync-automation-design.md](../specs/2026-07-08-dali-ui-code-sync-automation-design.md) — Phase 1 (CLI half, milestone M2).

## Global Constraints

- 철칙 2 — green ≠ correct: checks assert correctness (on-screen bounds; skew signature fires on real g++ output), not absence-of-error.
- **Curly-quote rule:** the skew regex MUST accept Unicode U+2018 ‘ / U+2019 ’ AND ASCII; fixtures MUST use real curly quotes.
- **CLI tree shape:** nodes nest geometry under `bounds:{x,y,w,h}` (NOT flat `x,y,w,h` like the extension), plus `visible`, `opacity`, `children`. The root is under `{"root":{…}}`.
- CLI unit tests use **chai** `expect` (`import { expect } from 'chai';`), compiled to `out/test/unit/**` and run with `npm run test:unit` (= `c8 mocha out/test/unit/**/*.test.js --timeout 10000`).
- Do NOT add a top-level `build` script to the CLI `package.json` (load-bearing `//` note: breaks `npm i -g github:`). Use `compile`.
- TypeScript strict; single quotes; `const` over `let`; never `var`. TDD; commit per task.
- Stay on branch `m2/cli-render-gate-hardening`; do NOT push; do NOT touch `main`.

## File Structure

**Created (in the CLI repo):**
- `src/skewSignature.ts` — vendored copy of the parent's (VENDORED header, ADR-007).
- `src/onScreenCheck.ts` — `vscode`-free on-screen bounds check over the CLI rich tree.
- `src/test/unit/skewSignature.test.ts`, `src/test/unit/onScreenCheck.test.ts`.

**Modified (in the CLI repo):**
- `src/errorParser.ts` — add `detectRuntimeApiSkew`, `RUNTIME_API_SKEW_HINT`, and append the hint in `formatRawError` on skew.
- `tests/e2e/assert-render.js` — call the compiled on-screen check on the parsed tree; non-zero exit on off-screen bounds.

---

### Task 1: Vendor the skew signature + wire a CLI skew detector

**Files:**
- Create: `src/skewSignature.ts`
- Modify: `src/errorParser.ts`
- Test: `src/test/unit/skewSignature.test.ts`

**Interfaces:**
- Produces: `RUNTIME_API_SKEW_RE: RegExp`, `isRuntimeApiSkew(stderr: string): boolean` (in `skewSignature.ts`); `detectRuntimeApiSkew(stderr: string): boolean`, `RUNTIME_API_SKEW_HINT: string` (in `errorParser.ts`); `formatRawError` now appends the hint when skew is detected.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/skewSignature.test.ts` (fixtures use REAL curly quotes):

```typescript
import { expect } from 'chai';
import { isRuntimeApiSkew } from '../../skewSignature';

describe('isRuntimeApiSkew', () => {
    it('flags the AddChildren rename (curly quotes, as g++ emits)', () => {
        expect(isRuntimeApiSkew('‘class Dali::Ui::FlexLayout’ has no member named ‘AddChildren’; did you mean ‘Children’?')).to.equal(true);
    });
    it('flags the removed focus API', () => {
        expect(isRuntimeApiSkew("‘class Dali::Ui::UiConfig’ has no member named ‘SetAlwaysShowFocus’")).to.equal(true);
    });
    it('flags a FUTURE rename with no hardcoded name', () => {
        expect(isRuntimeApiSkew("‘class Dali::Ui::View’ has no member named ‘SomeNewApi2027’")).to.equal(true);
    });
    it('accepts ASCII quotes too', () => {
        expect(isRuntimeApiSkew("'class Dali::Ui::View' has no member named 'AddChildren'")).to.equal(true);
    });
    it('does NOT flag an unrelated compile error', () => {
        expect(isRuntimeApiSkew('error: expected ‘;’ before ‘}’ token')).to.equal(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/woochan/tizen/paperclip/dali-ui-preview-cli && npm run compile && npx mocha out/test/unit/skewSignature.test.js --timeout 10000`
Expected: FAIL — cannot find module `../../skewSignature`.

- [ ] **Step 3: Create `src/skewSignature.ts` (vendored)**

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// VENDORED from paperclip src/skewSignature.ts (ADR-007) — the CLI must not import
// across repos. Keep byte-identical to the parent's regex; the shared-library
// consolidation is M3.
// ─────────────────────────────────────────────────────────────────────────────
// Shared dali-ui runtime-API-skew signature. When a dali-ui release renames or
// removes a member, g++ emits: `'class Dali::Ui::X' has no member named 'Y'`.
// g++ uses Unicode curly quotes (U+2018/U+2019), NOT ASCII — the char class must
// accept both. Matches ANY missing member on a `Dali::Ui::` type (future-proof).
export const RUNTIME_API_SKEW_RE =
    /Dali::Ui::\w+['‘’]?\s+has no member named\s+['‘’]?\w+/;

export function isRuntimeApiSkew(stderr: string): boolean {
    return RUNTIME_API_SKEW_RE.test(String(stderr ?? ''));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/skewSignature.test.js --timeout 10000`
Expected: PASS (5 passing).

- [ ] **Step 5: Wire the detector + hint into `errorParser.ts`**

Add at the top of `src/errorParser.ts` (after the existing header comment, with the other imports):

```typescript
import { isRuntimeApiSkew } from './skewSignature';
```

Add near the top-level exports (e.g. after the `ParsedError` interface):

```typescript
/**
 * Actionable hint appended when the compile failure looks like a dali-ui
 * runtime-API skew (a member the runtime image no longer has). The fix is to
 * refresh the runtime image (`dali-ui-preview --pull` / a newer tag), NOT to
 * change the preview code. Mirrors the extension's RUNTIME_API_SKEW_HINT.
 */
export const RUNTIME_API_SKEW_HINT =
    '\n\nThis looks like a stale DALi runtime: the image is missing a dali-ui ' +
    'API this build uses. Refresh the runtime image (pull the latest / matching ' +
    'tag) rather than changing the preview code.';

/** True when g++ stderr carries the dali-ui runtime-API-skew signature. */
export function detectRuntimeApiSkew(stderr: string): boolean {
    return isRuntimeApiSkew(stderr);
}
```

In `formatRawError`, append the hint when the raw output is a skew — change the final `return` so it appends the hint (keep the length trim BEFORE appending so the hint is never truncated):

```typescript
    // Trim to a reasonable display length
    const trimmed = mapped.length > 200 ? mapped.slice(0, 197) + '…' : mapped;
    return detectRuntimeApiSkew(raw) ? trimmed + RUNTIME_API_SKEW_HINT : trimmed;
```

(Replace the existing final `return mapped.length > 200 ? mapped.slice(0, 197) + '…' : mapped;` line.)

- [ ] **Step 6: Add an errorParser test for the hint**

Append to `src/test/unit/errorParser.test.ts` a new `describe` (inside the top-level `describe('errorParser', …)` block, or as a sibling — match the file's structure):

```typescript
    describe('detectRuntimeApiSkew / formatRawError hint', () => {
        const skew = '/tmp/x/preview_harness.cpp:5:3: error: ‘class Dali::Ui::UiConfig’ has no member named ‘SetAlwaysShowFocus’';
        it('detects a runtime-API skew', () => {
            expect(detectRuntimeApiSkew(skew)).to.equal(true);
        });
        it('appends the stale-runtime hint in formatRawError', () => {
            expect(formatRawError(skew)).to.contain('stale DALi runtime');
        });
        it('does not append the hint to an ordinary error', () => {
            expect(formatRawError('/tmp/x/preview_harness.cpp:5:3: error: expected ; before }')).to.not.contain('stale DALi runtime');
        });
    });
```

Update that file's import to add `detectRuntimeApiSkew` and `formatRawError` if not already imported (the head already imports `formatRawError`; add `detectRuntimeApiSkew`).

- [ ] **Step 7: Run tests + commit**

Run: `npm run compile && npx mocha out/test/unit/skewSignature.test.js out/test/unit/errorParser.test.js --timeout 10000`
Expected: PASS (all skew + errorParser cases).

```bash
git add src/skewSignature.ts src/errorParser.ts src/test/unit/skewSignature.test.ts src/test/unit/errorParser.test.ts
git commit -m "feat(cli): dali-ui runtime-skew detector + stale-runtime hint (vendored skewSignature)"
```

---

### Task 2: On-screen bounds check over the CLI rich tree

**Files:**
- Create: `src/onScreenCheck.ts`
- Modify: `tests/e2e/assert-render.js`
- Test: `src/test/unit/onScreenCheck.test.ts`

**Interfaces:**
- Produces: `interface TreeNode { bounds?: {x?:number;y?:number;w?:number;h?:number}; visible?:boolean; opacity?:number; type?:string; name?:string; children?:TreeNode[] }`; `checkTreeOnScreen(tree: {root?:TreeNode}|TreeNode, windowWidth:number, windowHeight:number): string | null`.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/onScreenCheck.test.ts`:

```typescript
import { expect } from 'chai';
import { checkTreeOnScreen, TreeNode } from '../../onScreenCheck';

// CLI rich-tree shape: geometry nested under `bounds`.
const onScreen: { root: TreeNode } = {
    root: {
        type: 'Layer', name: 'root', bounds: { x: 0, y: 0, w: 480, h: 320 }, visible: true, opacity: 1,
        children: [
            { type: 'ViewImpl', name: 'card', bounds: { x: 10, y: 10, w: 100, h: 100 }, visible: true, opacity: 1 },
        ],
    },
};

describe('checkTreeOnScreen', () => {
    it('passes when all drawn nodes are on-screen', () => {
        expect(checkTreeOnScreen(onScreen, 480, 320)).to.equal(null);
    });
    it('fails when a drawn node sits at a negative screen position', () => {
        const bad: { root: TreeNode } = { root: { ...onScreen.root,
            children: [{ type: 'ViewImpl', name: 'off', bounds: { x: -960, y: -540, w: 100, h: 100 }, visible: true, opacity: 1 }] } };
        const err = checkTreeOnScreen(bad, 480, 320);
        expect(err).to.be.a('string');
        expect(err).to.contain('off');
    });
    it('ignores invisible / zero-opacity / zero-size nodes', () => {
        const hidden: { root: TreeNode } = { root: { ...onScreen.root,
            children: [{ type: 'ViewImpl', name: 'hidden', bounds: { x: -960, y: -540, w: 100, h: 100 }, visible: false, opacity: 1 }] } };
        expect(checkTreeOnScreen(hidden, 480, 320)).to.equal(null);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npx mocha out/test/unit/onScreenCheck.test.js --timeout 10000`
Expected: FAIL — cannot find module `../../onScreenCheck`.

- [ ] **Step 3: Implement `src/onScreenCheck.ts`**

Mirrors the extension's `checkMetadataOnScreen` invariant (negative / off-left-top only; off-right/bottom allowed for scroll content), adapted to the CLI's `bounds` shape.

```typescript
// On-screen bounds check for the CLI's rich semantic tree — the invariant
// behind click-to-code overlays. dali-ui coordinate-convention regressions
// leave the render correct but push exported bounds off-screen (a class the
// non-blank-PNG check cannot see). vscode-free so the e2e harness can require it.
export interface TreeNode {
    bounds?: { x?: number; y?: number; w?: number; h?: number };
    visible?: boolean;
    opacity?: number;
    type?: string;
    name?: string;
    children?: TreeNode[];
}

export function checkTreeOnScreen(
    tree: { root?: TreeNode } | TreeNode,
    windowWidth: number,
    windowHeight: number,
): string | null {
    const root: TreeNode | undefined = (tree as { root?: TreeNode }).root ?? (tree as TreeNode);
    if (!root) {
        return 'tree has no root node';
    }
    const NEG_TOL = 2;
    const EDGE_TOL = 1;
    const offenders: string[] = [];

    const walk = (n: TreeNode | undefined): void => {
        if (!n) { return; }
        const b = n.bounds ?? {};
        const w = b.w ?? 0;
        const h = b.h ?? 0;
        const visible = n.visible !== false;
        const opacity = typeof n.opacity === 'number' ? n.opacity : 1;
        // Only drawn (visible, non-transparent, sized) nodes must be on-screen.
        // Off the RIGHT/BOTTOM is allowed (scroll content); a NEGATIVE position or
        // being entirely off the LEFT/TOP is the coordinate-bug signature.
        if (visible && opacity > 0.01 && w > 1 && h > 1) {
            const x = b.x ?? 0;
            const y = b.y ?? 0;
            const negative = x < -NEG_TOL || y < -NEG_TOL;
            const offLeftTop = x + w <= EDGE_TOL || y + h <= EDGE_TOL;
            if (negative || offLeftTop) {
                offenders.push(`${n.type ?? 'Actor'} "${n.name ?? ''}" @ (${x},${y},${w}x${h})`);
            }
        }
        (n.children ?? []).forEach(walk);
    };
    walk(root);

    if (offenders.length > 0) {
        return (
            `${offenders.length} visible node(s) at negative/off-screen bounds — click-to-code ` +
            `overlays will not match the render (window ${windowWidth}x${windowHeight}): ` +
            offenders.slice(0, 5).join('; ')
        );
    }
    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/onScreenCheck.test.js --timeout 10000`
Expected: PASS (3 passing).

- [ ] **Step 5: Wire the check into `tests/e2e/assert-render.js`**

`assert-render.js` already parses `tree` and knows the render window is the CLI default. Add the on-screen check after the node-count check (before the final success `console.log`). The compiled module is at `out/src/onScreenCheck.js`. The CLI's default render size is 1920×1080 (confirm from the CLI's default; if the tree's root bounds give the window, prefer `root.bounds.w/h`). Insert:

```javascript
// 3) All drawn nodes are on-screen (click-to-code bounds correctness). Use the
//    root's own bounds as the window rect — the exporter reports the window at
//    root, so this is self-describing regardless of the configured size.
const { checkTreeOnScreen } = require('../../out/src/onScreenCheck.js');
const root = tree.root || tree;
const W = (root.bounds && root.bounds.w) || width;
const H = (root.bounds && root.bounds.h) || height;
const onScreenErr = checkTreeOnScreen(tree, W, H);
if (onScreenErr) {
  console.error(onScreenErr);
  process.exit(9);
}
```

(`width`/`height` are already in scope from the PNG read.)

- [ ] **Step 6: Verify compile + JS syntax + commit**

Run: `npm run compile && node -c tests/e2e/assert-render.js && node -e "require('./out/src/onScreenCheck.js').checkTreeOnScreen({root:{bounds:{x:0,y:0,w:10,h:10},visible:true,opacity:1}},10,10)===null||process.exit(1)"`
Expected: exits 0 (compiles, JS valid, module callable, on-screen root passes).

Then run the full unit suite (no regressions):
Run: `npm run test:unit`
Expected: all CLI unit tests pass (existing + new skew + onScreen).

```bash
git add src/onScreenCheck.ts tests/e2e/assert-render.js src/test/unit/onScreenCheck.test.ts
git commit -m "test(cli): on-screen bounds check over the rich tree; wired into render e2e"
```

---

## Self-Review

**Spec coverage (M2):** CLI skew detector (Task 1) + CLI on-screen/click-to-code correctness (Task 2). Image-vs-placeholder already exists in `render-modes.sh` (red≥1000/gray≥1000) — kept, not duplicated. Focus/theme/animation/RTL are **not implemented in the CLI** (N/A per recon) — correctly out of M2 scope. The CLI render e2e remaining manual (not in hosted CI) is by design — the unattended CLI gate is the agent-hub runner (M4); noted, not fixed here.

**Placeholder scan:** none — complete code in every step.

**Type consistency:** `isRuntimeApiSkew` (skewSignature) consumed by `detectRuntimeApiSkew` (errorParser); `TreeNode`/`checkTreeOnScreen` names identical across `onScreenCheck.ts`, its test, and the `assert-render.js` require. CLI tests use chai `expect` throughout (matches the existing suite).

> **No cross-task dependency** — Task 1 and Task 2 are independent; either order works.
