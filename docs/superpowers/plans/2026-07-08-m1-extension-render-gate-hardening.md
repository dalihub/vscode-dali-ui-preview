# M1 — Extension Render-Gate Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each fragile preview feature (image-renders, click-to-code, focus) a *positive-semantic* check that deterministically fails when the feature silently breaks, plus a shared future-proof runtime-skew signature and a seeded Graduation Registry — the foundation the code-sync automation (M4–M6) gates auto-merge on.

**Architecture:** Add small, `vscode`-free **pure check functions** (unit-tested in cloud CI with generated/inline fixtures — no binary fixtures) and **wire them into the existing e2e golden runners** (run on a machine with the DALi runtime). The pure functions are the durable root-verify logic; the runner wiring is where they execute against live render output. Nothing here enables auto-merge — it makes the failures *visible* first (Direction B).

**Tech Stack:** TypeScript (strict), Node.js, mocha + `assert`, `pngjs` (already a dep, used by `imageComparator.ts`), `pixelmatch`.

**Spec:** [docs/superpowers/specs/2026-07-08-dali-ui-code-sync-automation-design.md](../specs/2026-07-08-dali-ui-code-sync-automation-design.md) — Phase 1 + Graduation Registry.

## Global Constraints

- **철칙 2 — `green ≠ correct`:** every check added here must *positively assert the feature rendered correctly*, never merely "no error / frame differs from a golden". A blank frame vs a blank golden must FAIL.
- **철칙 1 — `auto-merge ≠ auto-release`:** M1 enables **no** auto-merge and **no** auto-release. `autoMergeEligible` stays `false` for every registry row.
- **Curly-quote rule:** g++ quotes identifiers with **Unicode** curly quotes (U+2018 `‘` / U+2019 `’`), not ASCII. Any regex over g++ output MUST accept both, and tests MUST use real curly-quote fixtures — an ASCII-only regex silently never fires.
- **Byte-identical goldens:** do NOT modify existing `test/samples/*.preview.dali.cpp` or their committed goldens in `test/golden/screenshots/`. New checks read existing output; they must not perturb any existing golden.
- TypeScript strict mode; single quotes; `const` over `let`; never `var`. Production paths log to `outputChannel`, not `console.log` (test runners may use `console`).
- TDD: for every pure function, write the failing test first, watch it fail, implement minimally, watch it pass, commit. Frequent commits — one logical change per commit.
- Unit tests run in cloud CI (`test:unit`); e2e golden runners require the local DALi docker runtime and do NOT run in cloud CI (they run in the pre-push hook and, from M4, on the agent-hub runner).

## File Structure

**Created:**
- `src/skewSignature.ts` — shared, `vscode`-free dali-ui runtime-API-skew regex + `isRuntimeApiSkew()`.
- `src/graduationRegistry.ts` — registry types + loader + invariant validator.
- `graduation-registry.json` (repo root) — the seeded Graduation Registry data.
- `test/e2e/expectedRects.ts` — per-sample expected screen-rect manifest for click-to-code correctness.
- `test/unit/regionColor.test.ts`, `test/unit/expectedRects.test.ts`, `test/unit/focusIndicator.test.ts`, `test/unit/skewSignature.test.ts`, `test/unit/graduationRegistry.test.ts`.

**Modified:**
- `test/e2e/imageComparator.ts` — add `Rect`, `Rgb`, `countRegionColor()`, `checkRegionColor()` (reuse local `readPng`).
- `test/e2e/metadataCheck.ts` — add `ExpectedRect`, `findFirstNode()`, `checkExpectedRects()`, `checkFocusIndicator()`.
- `test/e2e/serverGoldenRunner.ts` — wire the positive-semantic image-render check for `image-loads`.
- `test/e2e/goldenTestRunner.ts` — wire `checkExpectedRects` + `checkFocusIndicator` in `runSample`.
- `test/e2e/previewCompileSweep.js` — use the shared skew signature.
- `.githooks/pre-push` — add `verify:previews:docker` to the gate.

---

### Task 1: Positive-semantic image-render check (`region-color`)

The extension's harness golden path has **no** test that distinguishes a real image from a blank/placeholder frame (the "이미지 preview 안 뜸" class). Add a region-color counter and wire it to `image-loads` (which already stages a solid **magenta** asset), asserting the ImageView rect actually painted magenta.

**Files:**
- Modify: `test/e2e/imageComparator.ts`
- Modify: `test/e2e/serverGoldenRunner.ts:120-221` (in `runSample`)
- Test: `test/unit/regionColor.test.ts`

**Interfaces:**
- Produces: `countRegionColor(pngPath: string, region: Rect, color: Rgb, tol?: number): number`; `checkRegionColor(pngPath: string, region: Rect, color: Rgb, minCount: number, tol?: number): string | null`; `interface Rect { x:number; y:number; w:number; h:number }`; `interface Rgb { r:number; g:number; b:number }`.
- Consumes: `findFirstNode` from Task 2 (`metadataCheck.ts`) for the runner wiring — implement Task 2 first, or import it once it exists.

- [ ] **Step 1: Write the failing test**

Create `test/unit/regionColor.test.ts`:

```typescript
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PNG } = require('pngjs');
import { countRegionColor, checkRegionColor } from '../e2e/imageComparator';

function writeRegionPng(
    file: string, w: number, h: number,
    region: { x: number; y: number; w: number; h: number },
    rgb: { r: number; g: number; b: number },
): void {
    const png = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const inRegion = x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h;
            png.data[i] = inRegion ? rgb.r : 0;
            png.data[i + 1] = inRegion ? rgb.g : 0;
            png.data[i + 2] = inRegion ? rgb.b : 0;
            png.data[i + 3] = 255;
        }
    }
    fs.writeFileSync(file, PNG.sync.write(png));
}

describe('countRegionColor / checkRegionColor', () => {
    const tmp = path.join(os.tmpdir(), 'region-color-test');
    const magenta = { r: 255, g: 0, b: 255 };
    const region = { x: 10, y: 10, w: 20, h: 20 };
    before(() => fs.mkdirSync(tmp, { recursive: true }));

    it('counts pixels of the target color inside the region', () => {
        const f = path.join(tmp, 'magenta.png');
        writeRegionPng(f, 40, 40, region, magenta);
        assert.strictEqual(countRegionColor(f, region, magenta), 400);
    });

    it('passes when the region actually painted', () => {
        const f = path.join(tmp, 'ok.png');
        writeRegionPng(f, 40, 40, region, magenta);
        assert.strictEqual(checkRegionColor(f, region, magenta, 300), null);
    });

    it('fails on a blank frame (image did not render)', () => {
        const f = path.join(tmp, 'blank.png');
        writeRegionPng(f, 40, 40, { x: 0, y: 0, w: 0, h: 0 }, magenta);
        const err = checkRegionColor(f, region, magenta, 300);
        assert.ok(err && /did not render/.test(err), `expected failure, got: ${err}`);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npx mocha out/test/unit/regionColor.test.js --timeout 10000`
Expected: FAIL — `countRegionColor is not a function` (or a TS compile error that the export is missing).

- [ ] **Step 3: Implement `countRegionColor` + `checkRegionColor`**

Append to `test/e2e/imageComparator.ts` (reuses the file's existing local `readPng`):

```typescript
export interface Rect { x: number; y: number; w: number; h: number; }
export interface Rgb { r: number; g: number; b: number; }

/**
 * Count pixels within `tol` (per channel, 0-255) of `color` inside `region`.
 * Region is clamped to the image bounds. Used for positive-semantic render
 * assertions ("the image region actually painted this color"), not a
 * full-frame golden diff which a blank frame + blank golden would both pass.
 */
export function countRegionColor(pngPath: string, region: Rect, color: Rgb, tol = 24): number {
    const img = readPng(pngPath);
    const x0 = Math.max(0, Math.floor(region.x));
    const y0 = Math.max(0, Math.floor(region.y));
    const x1 = Math.min(img.width, Math.floor(region.x + region.w));
    const y1 = Math.min(img.height, Math.floor(region.y + region.h));
    let count = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * img.width + x) * 4;
            if (
                Math.abs(img.data[i] - color.r) <= tol &&
                Math.abs(img.data[i + 1] - color.g) <= tol &&
                Math.abs(img.data[i + 2] - color.b) <= tol
            ) {
                count++;
            }
        }
    }
    return count;
}

/**
 * Positive-semantic assertion: at least `minCount` pixels in `region` match
 * `color`. Returns an error string (for a runner TestResult) or null on pass.
 */
export function checkRegionColor(
    pngPath: string, region: Rect, color: Rgb, minCount: number, tol = 24,
): string | null {
    const n = countRegionColor(pngPath, region, color, tol);
    if (n < minCount) {
        return `region (${region.x},${region.y},${region.w}x${region.h}) has only ${n} px ` +
            `near rgb(${color.r},${color.g},${color.b}) (need >= ${minCount}) — image did not render`;
    }
    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/regionColor.test.js --timeout 10000`
Expected: PASS (3 passing).

- [ ] **Step 5: Wire the check into `serverGoldenRunner.ts`**

Add to the imports at the top of `test/e2e/serverGoldenRunner.ts`:

```typescript
import { compareImages, checkRegionColor } from './imageComparator';
import { checkMetadataOnScreen, findFirstNode } from './metadataCheck';
```

(Replace the existing `import { compareImages } from './imageComparator';` and `import { checkMetadataOnScreen } from './metadataCheck';` lines. `findFirstNode` is added in Task 2 — implement Task 2 first.)

In `runSample`, immediately AFTER the `checkMetadataOnScreen` block (currently ending at line 179) and BEFORE the `@render-only` block (line 181), insert:

```typescript
    // Positive-semantic image-render assertion (철칙 2): `image-loads` stages a
    // solid magenta asset. Assert the ImageView's exported screen rect actually
    // painted magenta — a blank capture (the async-load-before-capture bug) would
    // leave ~0 magenta px and FAIL, where a full-frame golden diff might not.
    if (name === 'image-loads' && fs.existsSync(metadataPath)) {
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const iv = findFirstNode(meta, (n) => (n.type ?? '').includes('Image') && (n.w ?? 0) > 1);
        if (!iv) {
            return { name, passed: false, error: 'image-loads: no ImageView in metadata' };
        }
        const region = { x: iv.x ?? 0, y: iv.y ?? 0, w: iv.w ?? 0, h: iv.h ?? 0 };
        const minCount = Math.floor(region.w * region.h * 0.5);
        const err = checkRegionColor(actualPng, region, { r: 255, g: 0, b: 255 }, minCount);
        if (err) {
            return { name, passed: false, error: `image-loads: ${err}` };
        }
    }
```

- [ ] **Step 6: Verify the wiring compiles + (if a DALi runtime is present) the gate runs**

Run: `npm run compile`
Expected: zero errors.

If a native DALi prefix is available: `DALI_PREFIX=/path/to/dali-env/opt npm run test:e2e:server`
Expected: `image-loads` PASS with the new magenta assertion active. (No runtime → verified by compile + review; the full render runs in pre-push / on the agent-hub runner at M4.)

- [ ] **Step 7: Commit**

```bash
git add test/e2e/imageComparator.ts test/e2e/serverGoldenRunner.ts test/unit/regionColor.test.ts
git commit -m "test(e2e): positive-semantic image-render check (region color) for image-loads"
```

---

### Task 2: Click-to-code rect-correctness check (`expected-rects`)

`checkMetadataOnScreen` only rejects negative / off-left-top coords — a wrong-but-on-screen coordinate drift passes (the "클릭투코드 고장" class). Add a check that pins a known sample's actor geometry, and wire it into the harness golden runner.

**Files:**
- Modify: `test/e2e/metadataCheck.ts`
- Create: `test/e2e/expectedRects.ts`
- Modify: `test/e2e/goldenTestRunner.ts:346-356` (in `runSample`)
- Test: `test/unit/expectedRects.test.ts`

**Interfaces:**
- Produces: `interface ExpectedRect { name:string; x:number; y:number; w:number; h:number }`; `findFirstNode(metadata, predicate: (n: MetaNode) => boolean): MetaNode | undefined`; `checkExpectedRects(metadata, expected: ExpectedRect[], tol?: number): string | null`; `EXPECTED_RECTS: Record<string, ExpectedRect[]>`.
- Consumes: `MetaNode` (existing, `metadataCheck.ts`).

- [ ] **Step 1: Write the failing test**

Create `test/unit/expectedRects.test.ts`:

```typescript
import * as assert from 'assert';
import { checkExpectedRects, findFirstNode, MetaNode } from '../e2e/metadataCheck';

// Subset of a real focus-grid metadata export (test/e2e/actual/focus-grid.metadata.json).
const focusGrid: { root: MetaNode } = {
    root: {
        name: 'RootLayer', x: 0, y: 0, w: 480, h: 320, children: [
            {
                name: '', type: 'FlexLayoutImpl', x: 0, y: 0, w: 480, h: 320, visible: true, opacity: 1, children: [
                    { name: '', type: 'ViewImpl', x: 7.5, y: 85, w: 150, h: 150, visible: true, opacity: 1 },
                    { name: 'card2', type: 'ViewImpl', x: 165, y: 85, w: 150, h: 150, visible: true, opacity: 1 },
                    { name: '', type: 'ViewImpl', x: 322.5, y: 85, w: 150, h: 150, visible: true, opacity: 1 },
                ],
            },
        ],
    },
};

describe('checkExpectedRects', () => {
    it('finds a node by name', () => {
        const n = findFirstNode(focusGrid, (m) => m.name === 'card2');
        assert.ok(n && n.x === 165);
    });

    it('passes when the actor sits at its expected rect', () => {
        const err = checkExpectedRects(focusGrid, [{ name: 'card2', x: 165, y: 85, w: 150, h: 150 }]);
        assert.strictEqual(err, null);
    });

    it('fails when the actor drifts on-screen (checkMetadataOnScreen would miss this)', () => {
        const err = checkExpectedRects(focusGrid, [{ name: 'card2', x: 215, y: 85, w: 150, h: 150 }]);
        assert.ok(err && /rect drift/.test(err), `expected drift failure, got: ${err}`);
    });

    it('fails when the named actor is absent', () => {
        const err = checkExpectedRects(focusGrid, [{ name: 'nope', x: 0, y: 0, w: 1, h: 1 }]);
        assert.ok(err && /not found/.test(err));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npx mocha out/test/unit/expectedRects.test.js --timeout 10000`
Expected: FAIL — `checkExpectedRects is not a function` / `findFirstNode is not a function`.

- [ ] **Step 3: Implement `findFirstNode` + `checkExpectedRects`**

Append to `test/e2e/metadataCheck.ts`:

```typescript
export interface ExpectedRect { name: string; x: number; y: number; w: number; h: number; }

/** Depth-first search for the first node matching `predicate`. */
export function findFirstNode(
    metadata: { root?: MetaNode } | MetaNode,
    predicate: (n: MetaNode) => boolean,
): MetaNode | undefined {
    const root: MetaNode | undefined = (metadata as { root?: MetaNode }).root ?? (metadata as MetaNode);
    const stack: MetaNode[] = root ? [root] : [];
    while (stack.length) {
        const n = stack.pop()!;
        if (predicate(n)) { return n; }
        (n.children ?? []).forEach((c) => stack.push(c));
    }
    return undefined;
}

/**
 * Positive-semantic click-to-code correctness: each named actor's exported
 * screen rect must equal its EXPECTED rect within `tol` px. Unlike
 * checkMetadataOnScreen (which only rejects negative/off-left-top coords and so
 * passes a wrong-but-on-screen drift), this pins the actual geometry — the
 * coordinate-regression class that must never silently ship.
 */
export function checkExpectedRects(
    metadata: { root?: MetaNode } | MetaNode,
    expected: ExpectedRect[],
    tol = 4,
): string | null {
    const offenders: string[] = [];
    for (const e of expected) {
        const node = findFirstNode(metadata, (n) => n.name === e.name);
        if (!node) {
            offenders.push(`"${e.name}" not found in metadata`);
            continue;
        }
        const dx = Math.abs((node.x ?? 0) - e.x);
        const dy = Math.abs((node.y ?? 0) - e.y);
        const dw = Math.abs((node.w ?? 0) - e.w);
        const dh = Math.abs((node.h ?? 0) - e.h);
        if (dx > tol || dy > tol || dw > tol || dh > tol) {
            offenders.push(
                `"${e.name}" @ (${node.x},${node.y},${node.w}x${node.h}) ` +
                `!= expected (${e.x},${e.y},${e.w}x${e.h}) [tol ${tol}px]`,
            );
        }
    }
    return offenders.length ? `click-to-code rect drift: ${offenders.join('; ')}` : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/expectedRects.test.js --timeout 10000`
Expected: PASS (4 passing).

- [ ] **Step 5: Create the expected-rect manifest**

Create `test/e2e/expectedRects.ts`:

```typescript
import { ExpectedRect } from './metadataCheck';

// Expected screen rects for click-to-code correctness (positive-semantic).
// Values are the known, fixed geometry of a sample rendered at the default
// 480x320 preview size. A coordinate regression that keeps actors on-screen
// but moves them (the class checkMetadataOnScreen cannot see) fails here.
// focus-grid: three 150x150 cards, SPACE_EVENLY in a 480-wide row; the middle
// card 'card2' sits at x=165,y=85 (see test/e2e/actual/focus-grid.metadata.json).
export const EXPECTED_RECTS: Record<string, ExpectedRect[]> = {
    'focus-grid': [
        { name: 'card2', x: 165, y: 85, w: 150, h: 150 },
    ],
};
```

- [ ] **Step 6: Wire into `goldenTestRunner.ts`**

Add to imports (replace the existing `import { checkMetadataOnScreen } from './metadataCheck';`):

```typescript
import { checkMetadataOnScreen, checkExpectedRects } from './metadataCheck';
import { EXPECTED_RECTS } from './expectedRects';
```

In `runSample`, replace the existing metadata block (lines 346-356) with:

```typescript
    if (fs.existsSync(metadataPath)) {
        try {
            const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            const coordErr = checkMetadataOnScreen(meta, width, height);
            if (coordErr) {
                return { name, passed: false, error: `click-to-code metadata: ${coordErr}` };
            }
            const expected = EXPECTED_RECTS[name];
            if (expected) {
                const rectErr = checkExpectedRects(meta, expected);
                if (rectErr) {
                    return { name, passed: false, error: rectErr };
                }
            }
        } catch (e: any) {
            return { name, passed: false, error: `metadata unreadable: ${e?.message ?? e}` };
        }
    }
```

- [ ] **Step 7: Verify compile + commit**

Run: `npm run compile`
Expected: zero errors.

```bash
git add test/e2e/metadataCheck.ts test/e2e/expectedRects.ts test/e2e/goldenTestRunner.ts test/unit/expectedRects.test.ts
git commit -m "test(e2e): click-to-code rect-correctness check (checkExpectedRects) for focus-grid"
```

---

### Task 3: Focus-indicator presence check (`focus-child`)

The focus ring is drawn as an `ImageView` **child** of the focused view (verified in `focus-grid.metadata.json`: `card2` has one `ImageViewImpl` child; unfocused cards have none). Assert that invariant so a compile-clean run where the ring silently fails to draw FAILS.

**Files:**
- Modify: `test/e2e/metadataCheck.ts`
- Modify: `test/e2e/goldenTestRunner.ts` (in `runSample`, using `focusId`)
- Test: `test/unit/focusIndicator.test.ts`

**Interfaces:**
- Produces: `checkFocusIndicator(metadata, focusedName: string): string | null`.
- Consumes: `findFirstNode`, `MetaNode` (Task 2); `focusId` (already computed in `runSample` via `parseFocusId`).

- [ ] **Step 1: Write the failing test**

Create `test/unit/focusIndicator.test.ts`:

```typescript
import * as assert from 'assert';
import { checkFocusIndicator, MetaNode } from '../e2e/metadataCheck';

const focused: MetaNode = {
    name: 'card2', type: 'ViewImpl', x: 165, y: 85, w: 150, h: 150, visible: true, opacity: 1,
    children: [{ name: '', type: 'ImageViewImpl', x: 165, y: 85, w: 150, h: 150, visible: true, opacity: 1 }],
};
const notFocused: MetaNode = { ...focused, children: [] };

describe('checkFocusIndicator', () => {
    it('passes when the focused view owns a focus-ring (ImageView child)', () => {
        assert.strictEqual(checkFocusIndicator({ root: { name: 'r', children: [focused] } }, 'card2'), null);
    });

    it('fails when the focused view has no ring child (indicator not drawn)', () => {
        const err = checkFocusIndicator({ root: { name: 'r', children: [notFocused] } }, 'card2');
        assert.ok(err && /no focus-ring child/.test(err), `expected failure, got: ${err}`);
    });

    it('fails when the focus target is absent', () => {
        const err = checkFocusIndicator({ root: { name: 'r', children: [] } }, 'card2');
        assert.ok(err && /not found/.test(err));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npx mocha out/test/unit/focusIndicator.test.js --timeout 10000`
Expected: FAIL — `checkFocusIndicator is not a function`.

- [ ] **Step 3: Implement `checkFocusIndicator`**

Append to `test/e2e/metadataCheck.ts`:

```typescript
/**
 * Positive-semantic focus assertion: the focused actor must own a focus-ring
 * child. dali-ui draws the indicator as an ImageView child of the focused view
 * (focus-grid: focused card gains one ImageViewImpl child; unfocused cards have
 * none). A compile-clean run where the ring silently fails to draw leaves the
 * focused node childless — this catches that ("focus child 0->1" invariant).
 */
export function checkFocusIndicator(
    metadata: { root?: MetaNode } | MetaNode,
    focusedName: string,
): string | null {
    const node = findFirstNode(metadata, (n) => n.name === focusedName);
    if (!node) {
        return `focus target "${focusedName}" not found in metadata`;
    }
    const hasRing = (node.children ?? []).some((c) => (c.type ?? '').includes('Image'));
    if (!hasRing) {
        return `focus target "${focusedName}" has no focus-ring child (indicator not drawn)`;
    }
    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/focusIndicator.test.js --timeout 10000`
Expected: PASS (3 passing).

- [ ] **Step 5: Wire into `goldenTestRunner.ts`**

Update the import added in Task 2 to also pull `checkFocusIndicator`:

```typescript
import { checkMetadataOnScreen, checkExpectedRects, checkFocusIndicator } from './metadataCheck';
```

In `runSample`, inside the `try` block from Task 2 (after the `checkExpectedRects` call, still inside `if (fs.existsSync(metadataPath))`), add:

```typescript
            if (focusId) {
                const focusErr = checkFocusIndicator(meta, focusId);
                if (focusErr) {
                    return { name, passed: false, error: focusErr };
                }
            }
```

(`focusId` is already defined earlier in `runSample` as `const focusId = parseFocusId(filePath);`.)

- [ ] **Step 6: Verify compile + commit**

Run: `npm run compile`
Expected: zero errors.

```bash
git add test/e2e/metadataCheck.ts test/e2e/goldenTestRunner.ts test/unit/focusIndicator.test.ts
git commit -m "test(e2e): focus-indicator presence check (checkFocusIndicator) for focus-grid"
```

---

### Task 4: Shared runtime-skew signature + historical fixtures + promote the sweep

Centralize the dali-ui skew regex into one `vscode`-free, future-proof, curly-quote-safe module; pin it against the real historical g++ outputs; and add the compile sweep to the pre-push gate so rename/removed-member breaks (5 of 6 historical events) are caught.

**Files:**
- Create: `src/skewSignature.ts`
- Modify: `test/e2e/previewCompileSweep.js:42-44,103`
- Modify: `.githooks/pre-push`
- Test: `test/unit/skewSignature.test.ts`

**Interfaces:**
- Produces: `RUNTIME_API_SKEW_RE: RegExp`; `isRuntimeApiSkew(stderr: string): boolean`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/skewSignature.test.ts` (fixtures use REAL U+2018/U+2019 curly quotes):

```typescript
import * as assert from 'assert';
import { isRuntimeApiSkew } from '../../src/skewSignature';

describe('isRuntimeApiSkew', () => {
    it('flags the AddChildren rename (curly quotes, as g++ emits)', () => {
        assert.ok(isRuntimeApiSkew(
            '‘class Dali::Ui::FlexLayout’ has no member named ‘AddChildren’; did you mean ‘Children’?'));
    });

    it('flags the removed focus API (SetAlwaysShowFocus)', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Ui::UiConfig’ has no member named ‘SetAlwaysShowFocus’"));
    });

    it('flags SetDefaultFocusIndicatorEnabled skew', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Ui::UiConfig’ has no member named ‘SetDefaultFocusIndicatorEnabled’"));
    });

    it('flags a FUTURE rename with no hardcoded name (any missing member on a Dali::Ui type)', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Ui::View’ has no member named ‘SomeNewApi2027’"));
    });

    it('accepts ASCII quotes too', () => {
        assert.ok(isRuntimeApiSkew("'class Dali::Ui::View' has no member named 'AddChildren'"));
    });

    it('does NOT flag an unrelated compile error', () => {
        assert.strictEqual(isRuntimeApiSkew('error: expected ‘;’ before ‘}’ token'), false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npx mocha out/test/unit/skewSignature.test.js --timeout 10000`
Expected: FAIL — cannot find module `../../src/skewSignature`.

- [ ] **Step 3: Implement `src/skewSignature.ts`**

```typescript
// Shared dali-ui runtime-API-skew signature. When a dali-ui release renames or
// removes a member, g++ emits: `'class Dali::Ui::X' has no member named 'Y'`.
// TWO hazards this regex is built around:
//  1. g++ quotes identifiers with Unicode curly quotes (U+2018/U+2019), NOT
//     ASCII — an ASCII-only class silently never matches real output.
//  2. Hardcoding the renamed member names (AddChildren, SetAlwaysShowFocus, ...)
//     means a NEW rename is missed until someone edits the list. So we match ANY
//     missing member on a `Dali::Ui::` type — the general skew signature.
export const RUNTIME_API_SKEW_RE =
    /Dali::Ui::\w+['‘’]?\s+has no member named\s+['‘’]?\w+/;

export function isRuntimeApiSkew(stderr: string): boolean {
    return RUNTIME_API_SKEW_RE.test(String(stderr ?? ''));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/skewSignature.test.js --timeout 10000`
Expected: PASS (6 passing).

- [ ] **Step 5: Use the shared signature in the sweep**

In `test/e2e/previewCompileSweep.js`, after the `const SBR = require(...)` line (line 33), add:

```javascript
const { isRuntimeApiSkew } = require(path.join(REPO, 'out/src/skewSignature.js'));
```

Delete the inline `SKEW_RE` definition (lines 42-44). Replace line 103:

```javascript
    const skew = !r.success && isRuntimeApiSkew(r.error);
```

- [ ] **Step 6: Add the sweep to the pre-push gate**

In `.githooks/pre-push`, replace the `else` branch of the `SKIP_E2E` block with:

```bash
else
  echo "[pre-push] golden screenshot suite (docker render)…  (set SKIP_E2E=1 to skip)"
  npm run test:e2e
  echo "[pre-push] preview compile sweep (docker)…"
  npm run verify:previews:docker
fi
```

- [ ] **Step 7: Verify + commit**

Run: `npm run compile && node -e "require('./out/src/skewSignature.js').isRuntimeApiSkew('x') === false || process.exit(1)"`
Expected: exits 0 (module loads, callable).

```bash
git add src/skewSignature.ts test/e2e/previewCompileSweep.js .githooks/pre-push test/unit/skewSignature.test.ts
git commit -m "test: shared curly-quote-safe runtime-skew signature + add compile sweep to pre-push"
```

---

### Task 5: Seed the Graduation Registry + invariant validator

Create the machine-readable registry the M6 merge policy reads, and a validator enforcing the core invariant `autoMergeEligible === (unattended && positiveSemantic)`. Seed it reflecting M1's new checks — with **every** row `autoMergeEligible: false` (철칙 1: M1 enables no auto-merge).

**Files:**
- Create: `src/graduationRegistry.ts`
- Create: `graduation-registry.json` (repo root)
- Test: `test/unit/graduationRegistry.test.ts`

**Interfaces:**
- Produces: `interface GraduationRow { feature:string; codeRegions:string[]; rootVerifyCheck:string; unattended:boolean; positiveSemantic:boolean; autoMergeEligible:boolean }`; `interface GraduationRegistry { schemaVersion:number; features: GraduationRow[] }`; `loadRegistry(jsonPath: string): GraduationRegistry`; `validateRegistry(reg: GraduationRegistry): string[]`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/graduationRegistry.test.ts`:

```typescript
import * as assert from 'assert';
import * as path from 'path';
import { loadRegistry, validateRegistry } from '../../src/graduationRegistry';

const REGISTRY = path.resolve(__dirname, '..', '..', '..', 'graduation-registry.json');
const FEATURES = [
    'render-at-all', 'image', 'click-to-code', 'focus', 'theme',
    'animation', 'layout', 'CJK', 'RTL', 'multifile',
];

describe('graduation registry', () => {
    it('loads and covers all 10 features', () => {
        const reg = loadRegistry(REGISTRY);
        const names = reg.features.map((f) => f.feature).sort();
        assert.deepStrictEqual(names, [...FEATURES].sort());
    });

    it('satisfies the invariant autoMergeEligible === unattended && positiveSemantic', () => {
        assert.deepStrictEqual(validateRegistry(loadRegistry(REGISTRY)), []);
    });

    it('enables NO auto-merge in M1 (철칙 1)', () => {
        assert.ok(loadRegistry(REGISTRY).features.every((f) => f.autoMergeEligible === false));
    });

    it('validateRegistry reports a violated invariant', () => {
        const bad = { schemaVersion: 1, features: [
            { feature: 'x', codeRegions: [], rootVerifyCheck: '', unattended: true, positiveSemantic: true, autoMergeEligible: false },
        ]};
        assert.ok(validateRegistry(bad).length > 0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile && npx mocha out/test/unit/graduationRegistry.test.js --timeout 10000`
Expected: FAIL — cannot find module `../../src/graduationRegistry`.

- [ ] **Step 3: Implement `src/graduationRegistry.ts`**

```typescript
import * as fs from 'fs';

export interface GraduationRow {
    feature: string;
    codeRegions: string[];
    rootVerifyCheck: string;
    /** Does the check run in an unattended gate (cloud CI / required status)? */
    unattended: boolean;
    /** Does the check assert correctness, not just absence-of-error? (철칙 2) */
    positiveSemantic: boolean;
    /** Derived and stored: must equal unattended && positiveSemantic. */
    autoMergeEligible: boolean;
}

export interface GraduationRegistry {
    schemaVersion: number;
    features: GraduationRow[];
}

export function loadRegistry(jsonPath: string): GraduationRegistry {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as GraduationRegistry;
}

/**
 * Returns a list of invariant violations (empty = valid). The core invariant:
 * a feature is auto-merge-eligible IFF its check is both unattended AND
 * positive-semantic. This is the machine-checkable form of 철칙 1 + 철칙 2.
 */
export function validateRegistry(reg: GraduationRegistry): string[] {
    const problems: string[] = [];
    for (const f of reg.features) {
        const expected = f.unattended && f.positiveSemantic;
        if (f.autoMergeEligible !== expected) {
            problems.push(
                `${f.feature}: autoMergeEligible=${f.autoMergeEligible} but ` +
                `unattended && positiveSemantic=${expected}`,
            );
        }
    }
    return problems;
}
```

- [ ] **Step 4: Create `graduation-registry.json`**

At the repo root. `unattended: false` everywhere (render gates run on the runner / pre-push, not cloud CI, until M4+); `positiveSemantic: true` for the features M1 gave a real assertion (image, click-to-code, focus) and render-at-all; `autoMergeEligible: false` for all (철칙 1).

```json
{
  "schemaVersion": 1,
  "features": [
    { "feature": "render-at-all", "codeRegions": ["server/preview_harness.cpp.template", "docker/preview_server.cpp"], "rootVerifyCheck": "goldenTestRunner: no-PNG fails; pixel-diff vs golden", "unattended": false, "positiveSemantic": true, "autoMergeEligible": false },
    { "feature": "image", "codeRegions": ["docker/preview_server.cpp", "server/preview_harness.cpp.template"], "rootVerifyCheck": "serverGoldenRunner: checkRegionColor(image-loads magenta)", "unattended": false, "positiveSemantic": true, "autoMergeEligible": false },
    { "feature": "click-to-code", "codeRegions": ["docker/preview_server.cpp", "server/preview_harness.cpp.template"], "rootVerifyCheck": "checkMetadataOnScreen + checkExpectedRects(focus-grid)", "unattended": false, "positiveSemantic": true, "autoMergeEligible": false },
    { "feature": "focus", "codeRegions": ["src/buildRunner.ts", "server/preview_harness.cpp.template"], "rootVerifyCheck": "checkFocusIndicator(focus-grid)", "unattended": false, "positiveSemantic": true, "autoMergeEligible": false },
    { "feature": "theme", "codeRegions": ["src/buildRunner.ts", "docker/preview_server.cpp"], "rootVerifyCheck": "goldenTestRunner: theme-dark-tokens pixel-diff (not yet semantic)", "unattended": false, "positiveSemantic": false, "autoMergeEligible": false },
    { "feature": "animation", "codeRegions": ["server/preview_plugin.cpp.template", "docker/preview_server.cpp"], "rootVerifyCheck": "none (animation/ not scanned by golden runner)", "unattended": false, "positiveSemantic": false, "autoMergeEligible": false },
    { "feature": "layout", "codeRegions": ["docker/preview_server.cpp", "server/preview_harness.cpp.template"], "rootVerifyCheck": "checkExpectedRects (extend coverage) + pixel-diff", "unattended": false, "positiveSemantic": false, "autoMergeEligible": false },
    { "feature": "CJK", "codeRegions": ["docker/Dockerfile.runtime"], "rootVerifyCheck": "korean-label pixel-diff (flaky; not yet semantic)", "unattended": false, "positiveSemantic": false, "autoMergeEligible": false },
    { "feature": "RTL", "codeRegions": ["src/buildRunner.ts"], "rootVerifyCheck": "buildRunner.locale.test (codegen, CI) + pixel-diff", "unattended": false, "positiveSemantic": false, "autoMergeEligible": false },
    { "feature": "multifile", "codeRegions": ["src/sliceBuilder.ts", "src/cppParser.ts"], "rootVerifyCheck": "multiFileGoldenRunner (manual) + crossFile.test (CI)", "unattended": false, "positiveSemantic": false, "autoMergeEligible": false }
  ]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/graduationRegistry.test.js --timeout 10000`
Expected: PASS (4 passing).

- [ ] **Step 6: Run the full unit suite (no regressions)**

Run: `npm run compile && npm run test:unit:no-coverage`
Expected: all existing unit tests + the 5 new files PASS.

- [ ] **Step 7: Commit**

```bash
git add src/graduationRegistry.ts graduation-registry.json test/unit/graduationRegistry.test.ts
git commit -m "feat: seed Graduation Registry + invariant validator (autoMergeEligible = unattended && positiveSemantic)"
```

---

## Self-Review

**Spec coverage (Phase 1 items):**
- "Promote verify:previews to a required check" → Task 4 (pre-push now; the agent-hub required-status wiring is M4, noted).
- "extension image-vs-placeholder pixel assertion" → Task 1.
- "click-to-code expected-rect correctness" → Task 2.
- "focus child-count 0→1 semantic assertion" → Task 3.
- "encode the 6 historical breaks as fixtures" → Task 4 (compile-skew events 1-4,6 as `skewSignature` fixtures); event 5 (coordinate) as the `checkExpectedRects`/`checkMetadataOnScreen` regressions in Task 2; the image class in Task 1; focus in Task 3.
- "Graduation Registry" → Task 5.
- **Deferred (noted, not M1):** convert text/CJK goldens to semantic + auto-regen goldens on rebuild (registry marks CJK/theme `positiveSemantic:false` — closes in a later M1 pass or M3); native-prefix provisioning + required-status wiring (M4); CLI parity (M2).

**Placeholder scan:** no TBD/TODO; every code step has complete code; every command has an expected result.

**Type consistency:** `MetaNode`, `ExpectedRect`, `Rect`, `Rgb` used consistently; `findFirstNode` defined in Task 2 and consumed in Task 1's runner wiring (Task 2 must land first — flagged in Task 1 Interfaces); `checkRegionColor`/`checkExpectedRects`/`checkFocusIndicator`/`isRuntimeApiSkew`/`validateRegistry` names identical across definition, tests, and wiring.

> **Task ordering:** implement **Task 2 before Task 1** (Task 1's runner wiring imports `findFirstNode` from Task 2). All other tasks are independent.
