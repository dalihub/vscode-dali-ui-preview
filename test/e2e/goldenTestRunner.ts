/**
 * E2E Golden Screenshot Test Runner
 *
 * Usage:
 *   node out/test/e2e/goldenTestRunner.js              # compare against goldens
 *   UPDATE_GOLDENS=1 node out/test/e2e/goldenTestRunner.js  # update goldens
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAndCapture, buildAndCaptureDocker, detectDaliPrefix } from './standaloneBuildRunner';
import { compareImages } from './imageComparator';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SAMPLES_DIR = path.join(REPO_ROOT, 'test', 'samples');
const GOLDEN_DIR = path.join(REPO_ROOT, 'test', 'golden', 'screenshots');
const ACTUAL_DIR = path.join(REPO_ROOT, 'test', 'e2e', 'actual');
const DIFF_DIR = path.join(REPO_ROOT, 'test', 'e2e', 'diff');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'server', 'preview_harness.cpp.template');

const PREVIEW_WIDTH = 480;
const PREVIEW_HEIGHT = 320;

const MARKER_BEGIN = '// @dali-preview-begin';
const MARKER_END = '// @dali-preview-end';
const PREVIEW_CONFIG_RE = /^\/\/\s*@preview-config:/;

interface TestResult {
    name: string;
    passed: boolean;
    skipped?: boolean;
    diffPercent?: number;
    error?: string;
}

/**
 * Extract preview code from a .preview.dali.cpp file.
 * Strips @preview-config lines; uses full file as code.
 */
function extractPreviewFileCode(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
        .split('\n')
        .filter(line => !PREVIEW_CONFIG_RE.test(line.trim()))
        .join('\n');
}

/**
 * Extract code from marker-delimited region in a .cpp file.
 * Returns null if no valid marker pair found.
 */
function extractMarkerCode(filePath: string): string | null {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    let begin = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t === MARKER_BEGIN) {
            begin = i;
        } else if (t === MARKER_END && begin >= 0) {
            end = i;
            break;
        }
    }
    if (begin < 0 || end < 0 || end <= begin + 1) {
        return null;
    }
    return lines
        .slice(begin + 1, end)
        .filter(l => !PREVIEW_CONFIG_RE.test(l.trim()))
        .join('\n');
}

/**
 * Read width/height from a `// @preview-config: ... width=W, height=H` line.
 * Falls back to the default preview size when absent — so a 2520×4480 design
 * (weather-forecast) renders at its real size instead of being clipped at 480×320.
 */
function parseConfigSize(filePath: string): { width: number; height: number } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const line = content.split('\n').find(l => PREVIEW_CONFIG_RE.test(l.trim()));
    if (line) {
        const w = line.match(/width\s*=\s*(\d+)/);
        const h = line.match(/height\s*=\s*(\d+)/);
        if (w && h) { return { width: parseInt(w[1], 10), height: parseInt(h[1], 10) }; }
    }
    return { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT };
}

// Mirror the live preview's font sanitize (codeExtractor.sanitizeUnsupportedGlyphs)
// so docker goldens behave like real preview: emoji with no glyph in the runtime
// font become □ instead of aborting DALi (free(): invalid pointer). Inlined here
// because codeExtractor pulls in the vscode module, which this node runner can't load.
function sanitizeEmoji(code: string): string {
    return code.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (full, inner) => {
        const fixed = inner.replace(/[\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu, '□');
        return fixed !== inner ? '"' + fixed + '"' : full;
    });
}

function extractCode(filePath: string): string | null {
    let code: string | null = null;
    if (filePath.endsWith('.preview.dali.cpp')) {
        code = extractPreviewFileCode(filePath);
    } else if (filePath.endsWith('.cpp') || filePath.endsWith('.h')) {
        code = extractMarkerCode(filePath);
    }
    return code === null ? null : sanitizeEmoji(code);
}

function sampleName(filePath: string): string {
    return path.basename(filePath).replace(/\.preview\.dali\.cpp$/, '').replace(/\.cpp$/, '');
}

function ensureDirs(): void {
    for (const dir of [GOLDEN_DIR, ACTUAL_DIR, DIFF_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

async function runSample(
    filePath: string,
    daliPrefix: string,
    display: string,
    updateGoldens: boolean,
    useDocker: boolean,
    image: string
): Promise<TestResult> {
    const name = sampleName(filePath);
    const code = extractCode(filePath);

    if (!code) {
        return { name, passed: false, skipped: true, error: 'No preview code found' };
    }

    const actualPng = path.join(ACTUAL_DIR, `${name}.png`);
    const goldenPng = path.join(GOLDEN_DIR, `${name}.png`);
    const diffPng = path.join(DIFF_DIR, `${name}.diff.png`);
    const metadataPath = path.join(ACTUAL_DIR, `${name}.metadata.json`);

    const { width, height } = parseConfigSize(filePath);
    const opts = {
        userCode: code,
        width,
        height,
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

    const cmpResult = compareImages(goldenPng, actualPng, diffPng);

    if (cmpResult.sizeMismatch) {
        return {
            name,
            passed: false,
            error: `Size mismatch: golden ${cmpResult.sizeMismatch.golden} vs actual ${cmpResult.sizeMismatch.actual}`,
        };
    }

    return {
        name,
        passed: cmpResult.match,
        diffPercent: cmpResult.diffPercent,
        error: cmpResult.match
            ? undefined
            : `${(cmpResult.diffPercent * 100).toFixed(2)}% pixels differ (${cmpResult.diffPixels}/${cmpResult.totalPixels}). Diff: ${diffPng}`,
    };
}

async function main(): Promise<void> {
    const updateGoldens = process.env.UPDATE_GOLDENS === '1';
    const display = process.env.DISPLAY || ':99';
    // Default: render in the SAME docker image the live preview uses, so goldens
    // match real preview exactly (DALi 2.0.0 + DejaVu-only fonts → emoji = □).
    // GOLDEN_NATIVE=1 falls back to native g++/Xvfb (faster, but native fonts differ).
    const useDocker = process.env.GOLDEN_NATIVE !== '1';
    const image = process.env.PREVIEW_IMAGE || 'ghcr.io/lwc0917/dali-preview-runtime:latest';

    const daliPrefix = detectDaliPrefix();
    if (!useDocker && !daliPrefix) {
        console.error('ERROR: native mode (GOLDEN_NATIVE=1) but no DALi prefix. Set DALI_PREFIX.');
        process.exit(1);
    }

    ensureDirs();

    const samples = fs
        .readdirSync(SAMPLES_DIR)
        .filter(f => f.endsWith('.preview.dali.cpp'))
        .map(f => path.join(SAMPLES_DIR, f));

    if (samples.length === 0) {
        console.error(`No .preview.dali.cpp samples found in ${SAMPLES_DIR}`);
        process.exit(1);
    }

    console.log(updateGoldens ? '=== UPDATE GOLDENS ===' : '=== GOLDEN SCREENSHOT TESTS ===');
    console.log(useDocker ? `Render: docker (${image})` : `Render: native (${daliPrefix})`);
    console.log(`Display: ${display}`);
    console.log(`Samples: ${samples.length}\n`);

    const results: TestResult[] = [];

    for (const sample of samples) {
        const name = sampleName(sample);
        process.stdout.write(`  Running: ${name} ... `);
        const result = await runSample(sample, daliPrefix ?? '', display, updateGoldens, useDocker, image);
        results.push(result);

        if (result.skipped) {
            console.log('SKIP');
        } else if (result.passed) {
            console.log('PASS');
        } else {
            console.log(`FAIL\n    ${result.error}`);
        }
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
