/**
 * Multi-file E2E Golden Screenshot Test Runner (WU-M4.1, headline 1).
 *
 * Proves the cross-file path end-to-end: a REAL multi-file dali-ui app
 * (`samples/flow-wallet/`) whose preview target is a MEMBER function
 * (`WalletScreen::Build()`) — referencing theme constants, three cross-`.cpp`
 * factories, and an injected view-model member (`mVm`) — is sliced, compiled,
 * and rendered to a PNG WITHOUT the app being rewritten and WITHOUT any `-I`
 * workspace-header injection (the slice inlines every collected def; ADR-006).
 *
 * Pipeline (per fixture):
 *   1. Pure-fs BFS from the entry .cpp → cross-file source set (the 6 flow-wallet
 *      sources). Ported from previewOrchestrator.resolveProjectIncludes to PLAIN
 *      fs — this runner must NOT import vscode (it runs under bare node, like
 *      goldenTestRunner which inlines codeExtractor's logic for the same reason).
 *   2. findPreviewFunction(entry) → preview body. buildSlice(entrySrc, entryPath,
 *      body, sources, params) → slice (expect rung='heuristic', unresolvedStubs=[]).
 *   3. standaloneBuildRunner.buildAndCapture fills the harness 3-slot template
 *      (includes/globals/code) and compiles + captures the PNG.
 *   4. compareImages against test/golden/multifile-screenshots/<name>.png.
 *
 * Usage:
 *   node out/test/e2e/multiFileGoldenRunner.js                 # compare (pixel golden)
 *   UPDATE_GOLDENS=1 node out/test/e2e/multiFileGoldenRunner.js  # (re)create goldens
 *   SMOKE=1 node out/test/e2e/multiFileGoldenRunner.js          # T2 fallback: compile +
 *       non-empty PNG + node-count metadata, NO pixel compare (font-flakiness escape
 *       hatch, M4 spec §4). Default is pixel golden — the orchestrator decides.
 *
 * Render backend (mirrors goldenTestRunner): docker by default; GOLDEN_NATIVE=1
 * uses native g++/Xvfb. PREVIEW_IMAGE overrides the docker image.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAndCapture, buildAndCaptureDocker, detectDaliPrefix, StandaloneBuildOptions } from './standaloneBuildRunner';
import { compareImages } from './imageComparator';
import { buildSlice, findPreviewFunction, SourceFile } from '../../src/sliceBuilder';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SAMPLES_DIR = path.join(REPO_ROOT, 'samples');
const GOLDEN_DIR = path.join(REPO_ROOT, 'test', 'golden', 'multifile-screenshots');
const ACTUAL_DIR = path.join(REPO_ROOT, 'test', 'e2e', 'actual-multifile');
const DIFF_DIR = path.join(REPO_ROOT, 'test', 'e2e', 'diff-multifile');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'server', 'preview_harness.cpp.template');

/** BFS hop limit — kept at 4 to match previewOrchestrator.resolveProjectIncludes
 *  (workspace-boundary + perf; M4 spec keeps this invariant). */
const MAX_HOPS = 4;

/** A multi-file fixture: an entry .cpp whose preview target's body is sliced, plus
 *  the sample root that BFS/containment is scoped to. Height is chosen large enough
 *  to show the whole screen (320px clips the cards — M4 spec §2 honesty note). */
interface MultiFileFixture {
    /** Stable golden name → test/golden/multifile-screenshots/<name>.png. */
    name: string;
    /** Entry .cpp holding the member-function preview target (`// @preview`). */
    entryPath: string;
    /** Sample root: BFS containment boundary (an include escaping it is skipped). */
    sampleRoot: string;
    width: number;
    height: number;
}

// 480px wide (matches the single-file golden runner) × 800px tall so the rendered
// wallet shows header + balance + the stat-card row + "Recent" + transaction rows
// (the 320px default clips everything below the balance — M4 spec §2/§3 honesty).
const FIXTURES: MultiFileFixture[] = [
    {
        name: 'flow-wallet-wallet-screen',
        entryPath: path.join(SAMPLES_DIR, 'flow-wallet', 'screens', 'wallet_screen.cpp'),
        sampleRoot: path.join(SAMPLES_DIR, 'flow-wallet'),
        width: 480,
        height: 800,
    },
];

interface TestResult {
    name: string;
    passed: boolean;
    skipped?: boolean;
    diffPercent?: number;
    nodeCount?: number;
    error?: string;
}

/**
 * Pure-fs port of previewOrchestrator.resolveProjectIncludes (~:384). Reads the
 * project sources the entry #include's by relative path ("..."), each header AND
 * its same-stem .cpp (definitions live in the .cpp — that's how cards.h → cards.cpp
 * gets pulled), followed TRANSITIVELY (BFS) up to MAX_HOPS. Only quoted includes
 * are followed (system <...> arrive via the harness template); every resolved path
 * is contained to `root` (an include escaping it — "../../etc/passwd" — is skipped);
 * missing/unreadable files are skipped. NO vscode: reads with fs, so this runs
 * under bare node.
 */
function resolveProjectIncludesFs(entryPath: string, entryText: string, root: string): SourceFile[] {
    const sources: SourceFile[] = [];
    const seen = new Set<string>();
    let frontier: { dir: string; text: string }[] = [{ dir: path.dirname(entryPath), text: entryText }];
    for (let hop = 0; hop < MAX_HOPS && frontier.length > 0; hop++) {
        const next: { dir: string; text: string }[] = [];
        for (const cur of frontier) {
            const includeRe = /^[ \t]*#include\s+"([^"]+)"/gm;
            let m: RegExpExecArray | null;
            while ((m = includeRe.exec(cur.text)) !== null) {
                const hdr = path.resolve(cur.dir, m[1]);
                // header + its same-stem .cpp (definitions often live in the .cpp)
                for (const p of [hdr, hdr.replace(/\.(h|hpp)$/, '.cpp')]) {
                    if (seen.has(p)) { continue; }
                    seen.add(p);
                    if (!(p === root || p.startsWith(root + path.sep))) { continue; } // containment guard
                    try {
                        if (fs.existsSync(p)) {
                            const text = fs.readFileSync(p, 'utf8');
                            sources.push({ path: p, text });
                            next.push({ dir: path.dirname(p), text }); // recurse into ITS includes
                        }
                    } catch { /* unreadable include — skip */ }
                }
            }
        }
        frontier = next;
    }
    return sources;
}

/** Count actor nodes in the harness's exported scene metadata JSON tree (used by
 *  the SMOKE fallback to assert the render isn't an empty scene). Walks the
 *  `children` arrays of `{ root: { ..., children: [...] } }`. Returns 0 if the
 *  metadata is missing/unparseable. */
function countSceneNodes(metadataPath: string): number {
    try {
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as { root?: SceneNode };
        if (!meta.root) { return 0; }
        let count = 0;
        const walk = (n: SceneNode): void => {
            count++;
            for (const c of n.children ?? []) { walk(c); }
        };
        walk(meta.root);
        return count;
    } catch {
        return 0;
    }
}

interface SceneNode { children?: SceneNode[] }

function ensureDirs(): void {
    for (const dir of [GOLDEN_DIR, ACTUAL_DIR, DIFF_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

async function runFixture(
    fixture: MultiFileFixture,
    daliPrefix: string,
    display: string,
    updateGoldens: boolean,
    smoke: boolean,
    useDocker: boolean,
    image: string,
): Promise<TestResult> {
    const { name } = fixture;

    if (!fs.existsSync(fixture.entryPath)) {
        return { name, passed: false, skipped: true, error: `Entry not found: ${fixture.entryPath}` };
    }
    const entrySrc = fs.readFileSync(fixture.entryPath, 'utf8');

    // 1) cross-file source set via pure-fs BFS.
    const extraSources = resolveProjectIncludesFs(fixture.entryPath, entrySrc, fixture.sampleRoot);

    // 2) preview body + slice. findPreviewFunction follows the `// @preview` marker
    //    to the member-function body; buildSlice inlines the cross-file defs.
    const fn = findPreviewFunction(entrySrc);
    if (!fn) {
        return { name, passed: false, error: 'No preview function found (missing // @preview marker / View-returning fn?)' };
    }
    const slice = buildSlice(entrySrc, fixture.entryPath, fn.body, extraSources, fn.params);
    if (slice.rung !== 'heuristic' || slice.unresolvedStubs.length > 0) {
        // Honest loud failure: the cross-file collection regressed (the whole point
        // of this golden is that flow-wallet resolves with unresolvedStubs=[]).
        return {
            name,
            passed: false,
            error: `Slice regressed: rung=${slice.rung}, unresolvedStubs=[${slice.unresolvedStubs.join(', ')}] (expected heuristic / []). helpers=[${slice.helpers.join(', ')}]`,
        };
    }

    const actualPng = path.join(ACTUAL_DIR, `${name}.png`);
    const goldenPng = path.join(GOLDEN_DIR, `${name}.png`);
    const diffPng = path.join(DIFF_DIR, `${name}.diff.png`);
    const metadataPath = path.join(ACTUAL_DIR, `${name}.metadata.json`);

    // 3) fill the harness 3-slot template (includes / globals / code) and capture.
    const opts: StandaloneBuildOptions = {
        userCode: slice.body,
        userIncludes: slice.includes,
        userGlobals: slice.globals,
        width: fixture.width,
        height: fixture.height,
        outputPngPath: actualPng,
        metadataPath,
        templatePath: TEMPLATE_PATH,
        daliPrefix,
        display,
    };
    const buildResult = useDocker
        ? await buildAndCaptureDocker(opts, image)
        : await buildAndCapture(opts);

    if (!buildResult.success) {
        return { name, passed: false, error: buildResult.error };
    }
    if (!fs.existsSync(actualPng)) {
        return { name, passed: false, error: 'Binary ran but produced no PNG' };
    }

    // SMOKE fallback (M4 spec §4): don't pixel-compare — assert the render is real
    // (non-empty PNG + a populated scene tree). Locks multi-file slice→build→render
    // when docker/native font diffs make the pixel golden flaky, without claiming a
    // visual match. Headline 1's PROOF is still the slice+compile+populated render.
    if (smoke) {
        const bytes = fs.statSync(actualPng).size;
        const nodeCount = countSceneNodes(metadataPath);
        // A blank scene = camera + (maybe) an empty root; a real wallet render has
        // the header/balance/cards/rows → many nodes. >5 distinguishes the two.
        const ok = bytes > 1024 && nodeCount > 5;
        return {
            name,
            passed: ok,
            nodeCount,
            error: ok ? undefined : `SMOKE failed: png=${bytes}B, nodeCount=${nodeCount} (need png>1024B && nodeCount>5)`,
        };
    }

    if (updateGoldens) {
        fs.copyFileSync(actualPng, goldenPng);
        console.log(`  [UPDATED] ${name}.png (${fixture.width}x${fixture.height}, ${countSceneNodes(metadataPath)} nodes)`);
        return { name, passed: true };
    }

    if (!fs.existsSync(goldenPng)) {
        return { name, passed: false, error: `No golden at ${goldenPng}. Run UPDATE_GOLDENS=1 to create it.` };
    }

    const cmp = compareImages(goldenPng, actualPng, diffPng);
    if (cmp.sizeMismatch) {
        return { name, passed: false, error: `Size mismatch: golden ${cmp.sizeMismatch.golden} vs actual ${cmp.sizeMismatch.actual}` };
    }
    return {
        name,
        passed: cmp.match,
        diffPercent: cmp.diffPercent,
        error: cmp.match
            ? undefined
            : `${(cmp.diffPercent * 100).toFixed(2)}% pixels differ (${cmp.diffPixels}/${cmp.totalPixels}). Diff: ${diffPng}`,
    };
}

async function main(): Promise<void> {
    const updateGoldens = process.env.UPDATE_GOLDENS === '1';
    const smoke = process.env.SMOKE === '1';
    const display = process.env.DISPLAY || ':99';
    // Default: render in the SAME docker image the live preview uses (font parity).
    // GOLDEN_NATIVE=1 → native g++/Xvfb (faster; native fonts differ).
    const useDocker = process.env.GOLDEN_NATIVE !== '1';
    const image = process.env.PREVIEW_IMAGE || 'ghcr.io/lwc0917/dali-preview-runtime:latest';

    const daliPrefix = detectDaliPrefix();
    if (!useDocker && !daliPrefix) {
        console.error('ERROR: native mode (GOLDEN_NATIVE=1) but no DALi prefix. Set DALI_PREFIX.');
        process.exit(1);
    }

    ensureDirs();

    const mode = smoke ? 'SMOKE (compile + non-empty PNG + node-count)' : updateGoldens ? 'UPDATE GOLDENS' : 'PIXEL GOLDEN';
    console.log(`=== MULTI-FILE GOLDEN TESTS — ${mode} ===`);
    console.log(useDocker ? `Render: docker (${image})` : `Render: native (${daliPrefix})`);
    console.log(`Display: ${display}`);
    console.log(`Fixtures: ${FIXTURES.length}\n`);

    const results: TestResult[] = [];
    for (const fixture of FIXTURES) {
        process.stdout.write(`  Running: ${fixture.name} ... `);
        const result = await runFixture(fixture, daliPrefix ?? '', display, updateGoldens, smoke, useDocker, image);
        results.push(result);
        if (result.skipped) {
            console.log('SKIP');
        } else if (result.passed) {
            const extra = result.nodeCount !== undefined ? ` (${result.nodeCount} nodes)` : '';
            console.log(`PASS${extra}`);
        } else {
            console.log(`FAIL\n    ${result.error}`);
        }
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);

    if (failed > 0 || passed === 0) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
