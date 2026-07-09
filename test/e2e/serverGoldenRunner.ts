/**
 * E2E Server-Path Golden Screenshot Test Runner
 *
 * Renders each `test/samples/server-path/*.preview.dali.cpp` through the
 * RESIDENT SERVER scene-builder path — i.e. cppParser.parseChainExpression()
 * → SceneNode tree → PreviewServer.renderJson() → docker/preview_server.cpp's
 * SBBuildNode (via RENDER_JSON) — and golden-compares the captured PNG.
 *
 * This is DISTINCT from goldenTestRunner.ts, which renders via the harness
 * template (full DALi compile) and never exercises the server scene-builder.
 *
 * The server is compiled+spawned ONCE in LOCAL (native, no-docker) mode and
 * reused for every sample.
 *
 * Usage (run under xvfb):
 *   xvfb-run -a node out/test/e2e/serverGoldenRunner.js              # compare against goldens
 *   UPDATE_GOLDENS=1 xvfb-run -a node out/test/e2e/serverGoldenRunner.js  # create/update goldens
 *
 * DALi prefix: env DALI_PREFIX (falls back to the standard native prefix).
 */

// MUST be first: registers the fake 'vscode' module and initialises the logger
// so that previewServer.ts (which `import * as vscode`) loads in plain Node.
import '../helpers/setup';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PreviewServer } from '../../src/previewServer';
import { parseChainExpression, SceneNode } from '../../src/cppParser';
import { compareImages, checkRegionColor } from './imageComparator';
import { checkMetadataOnScreen, findFirstNode } from './metadataCheck';

// The 'vscode' module is shimmed by '../helpers/setup' (imported above, runs
// first). Resolve it here only for createOutputChannel(); the require runs at
// module-eval time, after the shim is already installed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SAMPLES_DIR = path.join(REPO_ROOT, 'test', 'samples', 'server-path');
const GOLDEN_DIR = path.join(REPO_ROOT, 'test', 'golden', 'server-screenshots');
const ACTUAL_DIR = path.join(REPO_ROOT, 'test', 'e2e', 'server-actual');
const DIFF_DIR = path.join(REPO_ROOT, 'test', 'e2e', 'server-diff');

// Fixed render size for M0. SBBuildNode lays out into this window.
const PREVIEW_WIDTH = 400;
const PREVIEW_HEIGHT = 400;

/** Default native DALi prefix; overridable via env DALI_PREFIX. */
const DEFAULT_DALI_PREFIX = '/home/woochan/tizen/generativeUI/dali-env/opt';

const PREVIEW_CONFIG_RE = /^\/\/\s*@preview-config:/;

interface TestResult {
    name: string;
    passed: boolean;
    skipped?: boolean;
    diffPercent?: number;
    error?: string;
}

/**
 * Read a `.preview.dali.cpp` file, stripping `@preview-config` comment lines so
 * the parser sees only the builder expression.
 */
function readSampleCode(filePath: string): string {
    return fs
        .readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter((line) => !PREVIEW_CONFIG_RE.test(line.trim()))
        .join('\n');
}

/**
 * Resolve relative `ImageView::New("...")` / `SetResourceUrl("...")` asset paths to
 * an absolute path under the sample's directory, so the native server can load
 * them. The runner doesn't stage assets the way the extension's buildRunner does;
 * this keeps a committed real-image sample portable — used by the `image-loads`
 * guard that a real image actually renders instead of capturing a blank frame.
 */
function resolveImageAssetUrls(code: string, sampleDir: string): string {
    return code.replace(
        /((?:ImageView\s*::\s*New|SetResourceUrl)\s*\(\s*)"([^"]+)"/g,
        (full: string, pre: string, url: string) => {
            if (/^[a-zA-Z][\w+.-]*:\/\//.test(url) || path.isAbsolute(url)) { return full; }
            const abs = path.resolve(sampleDir, url);
            return fs.existsSync(abs) ? `${pre}"${abs}"` : full;
        },
    );
}

/**
 * Read `theme=light|dark` from the sample's `@preview-config:` line so the
 * server installs the matching color override before resolving UiColor tokens
 * (F3.3). readSampleCode strips config lines, so theme is parsed separately and
 * passed through renderJson. Defaults to 'dark' (the server/runner default).
 */
function parseTheme(filePath: string): 'light' | 'dark' {
    const line = fs
        .readFileSync(filePath, 'utf-8')
        .split('\n')
        .find((l) => PREVIEW_CONFIG_RE.test(l.trim()));
    const m = line ? line.match(/theme\s*=\s*(light|dark)/) : null;
    return m ? (m[1] as 'light' | 'dark') : 'dark';
}

function sampleName(filePath: string): string {
    return path.basename(filePath).replace(/\.preview\.dali\.cpp$/, '');
}

function ensureDirs(): void {
    for (const dir of [GOLDEN_DIR, ACTUAL_DIR, DIFF_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

async function runSample(
    server: PreviewServer,
    filePath: string,
    updateGoldens: boolean,
): Promise<TestResult> {
    const name = sampleName(filePath);

    const code = resolveImageAssetUrls(readSampleCode(filePath), path.dirname(filePath));
    const tree: SceneNode | null = parseChainExpression(code);
    if (!tree) {
        return {
            name,
            passed: false,
            error:
                'parseChainExpression returned null — this sample is not parseable ' +
                'by the T1 fast path and cannot be rendered via the server scene-builder.',
        };
    }

    const actualPng = path.join(ACTUAL_DIR, `${name}.png`);
    const goldenPng = path.join(GOLDEN_DIR, `${name}.png`);
    const diffPng = path.join(DIFF_DIR, `${name}.diff.png`);
    const metadataPath = path.join(ACTUAL_DIR, `${name}.metadata.json`);

    // Remove any stale PNG so we never compare a previous run's output.
    if (fs.existsSync(actualPng)) {
        fs.unlinkSync(actualPng);
    }

    const result = await server.renderJson(
        tree,
        actualPng,
        metadataPath,
        PREVIEW_WIDTH,
        PREVIEW_HEIGHT,
        parseTheme(filePath),
    );

    if (!result.success) {
        return { name, passed: false, error: result.error };
    }
    if (!fs.existsSync(actualPng)) {
        return { name, passed: false, error: 'Server reported OK but produced no PNG' };
    }

    // Click-to-code guard on the SERVER path (docker/preview_server.cpp's metadata
    // exporter — the exact path dali-ui v2.5.28 broke): the exported screen rects must
    // match where actors are drawn, which the pixel golden cannot verify. Fail on any
    // drawn actor at a negative / off-left-top screen position.
    if (fs.existsSync(metadataPath)) {
        try {
            const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            const coordErr = checkMetadataOnScreen(meta, PREVIEW_WIDTH, PREVIEW_HEIGHT);
            if (coordErr) {
                return { name, passed: false, error: `click-to-code metadata: ${coordErr}` };
            }
        } catch (e: any) {
            return { name, passed: false, error: `metadata unreadable: ${e?.message ?? e}` };
        }
    }

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

    // `// @render-only` samples carry async / non-deterministic content (e.g. an
    // ImageView loading a remote/missing URL → the async broken-image placeholder),
    // whose pixels are NOT statically reproducible (form L). They are verified by
    // the fact that they parse + render to a PNG, not by a flaky pixel golden.
    if (/\/\/\s*@render-only/.test(code)) {
        console.log('  [RENDER-ONLY] parsed + rendered (async content; no pixel golden)');
        return { name, passed: true };
    }

    if (updateGoldens) {
        fs.copyFileSync(actualPng, goldenPng);
        console.log(`  [UPDATED] ${name}.png`);
        return { name, passed: true };
    }

    if (!fs.existsSync(goldenPng)) {
        return {
            name,
            passed: false,
            error: `No golden found at ${goldenPng}. Run UPDATE_GOLDENS=1 to create it.`,
        };
    }

    const cmp = compareImages(goldenPng, actualPng, diffPng);
    if (cmp.sizeMismatch) {
        return {
            name,
            passed: false,
            error: `Size mismatch: golden ${cmp.sizeMismatch.golden} vs actual ${cmp.sizeMismatch.actual}`,
        };
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
    const display = process.env.DISPLAY || ':99';
    const daliPrefix = (process.env.DALI_PREFIX || DEFAULT_DALI_PREFIX).trim();

    if (!fs.existsSync(SAMPLES_DIR)) {
        console.error(`No server-path samples directory at ${SAMPLES_DIR}`);
        process.exit(1);
    }

    const samples = fs
        .readdirSync(SAMPLES_DIR)
        .filter((f) => f.endsWith('.preview.dali.cpp'))
        .sort()
        .map((f) => path.join(SAMPLES_DIR, f));

    if (samples.length === 0) {
        console.error(`No .preview.dali.cpp samples found in ${SAMPLES_DIR}`);
        process.exit(1);
    }

    if (!fs.existsSync(path.join(daliPrefix, 'lib'))) {
        console.error(
            `ERROR: DALi prefix not found at ${daliPrefix}. Set DALI_PREFIX to the native dali-env/opt path.`,
        );
        process.exit(1);
    }

    ensureDirs();

    console.log(updateGoldens ? '=== UPDATE SERVER GOLDENS ===' : '=== SERVER-PATH GOLDEN SCREENSHOT TESTS ===');
    console.log('Render: native resident server (SBBuildNode via RENDER_JSON)');
    console.log(`DALi prefix: ${daliPrefix}`);
    console.log(`Display: ${display}`);
    console.log(`Size: ${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}`);
    console.log(`Samples: ${samples.length}\n`);

    // Build the native server source/binary paths.
    const serverSrcPath = path.join(REPO_ROOT, 'docker', 'preview_server.cpp');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dali_server_golden_'));
    const serverBinPath = path.join(tmpDir, 'preview_server');

    const outputChannel = vscode.window.createOutputChannel('serverGoldenRunner');
    // Local (native, no-docker) mode: pass localConfig and leave all docker*
    // constructor args undefined. This drives PreviewServer to compile
    // docker/preview_server.cpp against `daliPrefix` and spawn the native binary.
    const server = new PreviewServer(
        REPO_ROOT,
        outputChannel,
        tmpDir,
        undefined, // dockerRuntime
        undefined, // dockerImageTag
        [], // dockerExtraMounts
        {
            daliPrefix,
            display,
            serverSrcPath,
            serverBinPath,
        },
    );

    const results: TestResult[] = [];
    try {
        console.log('  Compiling + starting native server (first run can take ~30-60s) ...');
        const started = await server.start();
        if (!started) {
            console.error(
                'FATAL: native preview_server failed to compile or reach READY. ' +
                'See the [PreviewServer]/[Server stderr] lines above for the cause.',
            );
            process.exit(1);
        }
        console.log('  Server ready.\n');

        for (const sample of samples) {
            const name = sampleName(sample);
            process.stdout.write(`  Running: ${name} ... `);
            const result = await runSample(server, sample, updateGoldens);
            results.push(result);

            if (result.skipped) {
                console.log('SKIP');
            } else if (result.passed) {
                console.log('PASS');
            } else {
                console.log(`FAIL\n    ${result.error}`);
            }
        }
    } finally {
        // Stop the resident server and clean its build/tmp dir.
        server.stop();
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            /* best-effort cleanup */
        }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;

    console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
