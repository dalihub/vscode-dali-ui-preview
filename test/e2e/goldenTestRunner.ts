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
// WU-M5.1: bundled gray broken-image placeholder. Passed to the build ONLY for
// samples carrying a `// @broken-image` marker, so SetBrokenImageUrl is chained
// just for them and every other golden stays byte-identical.
const BROKEN_IMAGE_ASSET = path.join(REPO_ROOT, 'media', 'broken-image-placeholder.png');
const BROKEN_IMAGE_RE = /^\/\/\s*@broken-image\s*$/m;

const PREVIEW_WIDTH = 480;
const PREVIEW_HEIGHT = 320;

const MARKER_BEGIN = '// @dali-preview-begin';
const MARKER_END = '// @dali-preview-end';
const PREVIEW_CONFIG_RE = /^\/\/\s*@preview-config:/;

// Zero-arg factory entry marker (ADR-001). EXACT-match line so it never collides
// with `// @dali-preview-begin` (region marker, has a suffix). The body of the
// factory below it becomes the preview code.
const DALI_PREVIEW_MARKER = '// @dali-preview';

// `// @preview-state:` directive — mirrored EXACTLY from codeExtractor.ts so the
// golden runner (which can't import codeExtractor: vscode dep) parses focus
// identically. Drift is locked by codeExtractor's unit tests + this e2e golden.
const PREVIEW_STATE_RE = /^\/\/\s*@preview-state:\s*(.+)$/;
const STATE_FOCUS_RE = /(?:^|,)\s*focus\s*=\s*(?:"([^"]*)"|([A-Za-z_]\w*))/;
// NB (WU-M5.4): there is no STATE_PROGRESS_RE here on purpose. progress is applied
// ONLY on the server/dlopen scrubber path (RENDER_AT / __SetPreviewProgress), which
// this harness golden runner does not exercise — so it neither parses nor applies
// progress. `@preview-state` lines are comments and never leak into the rendered
// code regardless. progress routing is covered by previewOrchestrator.progress.test.

// Same leading-var-declaration matcher codeExtractor uses to rewrite
// `View card = ...` → `return ...`.
const VAR_DECL_RE = /^\s*(?:auto|[\w:]+(?:<[^>]*>)?)\s+\w+\s*=\s*/;

// Mirror codeExtractor.hasStatementReturn: a non-fluent dali-ui body is
// multi-statement and ends in an explicit `return root;` while starting with
// `FlexLayout root = ...`. The leading-var-decl→return rewrite below must be
// skipped for such bodies (rewriting the first decl to a `return` drops the
// declaration, leaving the following setter statements referencing an
// undeclared local — `'root' was not declared in this scope`). This runner
// re-implements extraction (it cannot import codeExtractor, which depends on
// `vscode`), so this guard must be kept in sync with codeExtractor's.
function hasStatementReturn(code: string): boolean {
    return /(^|\n)\s*return\b/.test(code);
}

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
 * Extract a zero-arg `// @dali-preview` factory body (ADR-001 Mode 2), mirroring
 * codeExtractor.extractPreviewCode's single-marker path. Inlined because the
 * golden runner can't import codeExtractor (vscode dep) — same reason
 * `sanitizeEmoji` is inlined. Returns the factory body (leading `View x = ...`
 * rewritten to `return ...`), or null when no exact `// @dali-preview` marker is
 * present. Handles inline / single-line bodies (`Foo() { ... }`).
 */
function extractDaliPreviewMarker(filePath: string): string | null {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== DALI_PREVIEW_MARKER) {
            continue;
        }
        // Scan forward (bounded) for the factory's opening brace.
        let braceLineStart = -1;
        for (let j = i + 1; j < lines.length && j < i + 20; j++) {
            if (lines[j].includes('{')) { braceLineStart = j; break; }
        }
        if (braceLineStart < 0) { return null; }

        // Balance braces from the opening `{`, tracking columns for inline bodies.
        const braceColStart = lines[braceLineStart].indexOf('{');
        let depth = 0;
        let foundOpen = false;
        let braceLineEnd = -1;
        let braceColEnd = -1;
        for (let j = braceLineStart; j < lines.length; j++) {
            const text = lines[j];
            for (let c = 0; c < text.length; c++) {
                if (text[c] === '{') { depth++; foundOpen = true; }
                else if (text[c] === '}') { depth--; }
                if (foundOpen && depth === 0) { braceLineEnd = j; braceColEnd = c; break; }
            }
            if (braceLineEnd >= 0) { break; }
        }
        if (braceLineEnd < 0) { return null; }

        const codeLines: string[] = [];
        if (braceLineStart === braceLineEnd) {
            codeLines.push(lines[braceLineStart].slice(braceColStart + 1, braceColEnd));
        } else {
            const head = lines[braceLineStart].slice(braceColStart + 1);
            if (head.trim()) { codeLines.push(head); }
            for (let j = braceLineStart + 1; j < braceLineEnd; j++) {
                if (PREVIEW_STATE_RE.test(lines[j].trim())) { continue; }
                codeLines.push(lines[j]);
            }
            const tail = lines[braceLineEnd].slice(0, braceColEnd);
            if (tail.trim()) { codeLines.push(tail); }
        }

        let code = codeLines.join('\n');
        if (!code.trim()) { return null; }

        const trimmed = code.trimStart();
        if (!hasStatementReturn(code)) {
            const match = trimmed.match(VAR_DECL_RE);
            if (match) { code = 'return ' + trimmed.slice(match[0].length); }
        }
        return code;
    }
    return null;
}

/**
 * Parse `// @preview-state: focus=<id>` (ADR-006) → focus id, mirroring
 * codeExtractor's PREVIEW_STATE_RE / STATE_FOCUS_RE exactly. Last valid focus
 * line wins. A focus value containing whitespace is rejected (IPC-injection
 * safety, matching codeExtractor). Returns undefined when absent.
 */
function parseFocusId(filePath: string): string | undefined {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    let focus: string | undefined;
    for (const line of lines) {
        const m = PREVIEW_STATE_RE.exec(line.trim());
        if (!m) { continue; }
        const fm = STATE_FOCUS_RE.exec(m[1]);
        if (!fm) { continue; }
        const value = fm[1] !== undefined ? fm[1] : fm[2];
        if (value && !/[\s\n]/.test(value)) { focus = value; } // last valid wins
    }
    return focus;
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

// fontScale validation range, mirrored from codeExtractor.ts (FONTSCALE_MIN/MAX).
const FONTSCALE_MIN = 0.5;
const FONTSCALE_MAX = 2.0;

/**
 * Read theme / fontScale / locale from the sample's first `@preview-config:`
 * line and thread them into the harness build (ADR-004 install knobs). Mirrors
 * codeExtractor's CONFIG_THEME_RE / CONFIG_FONTSCALE_RE / CONFIG_LOCALE_RE — the
 * golden runner can't import codeExtractor (vscode dep), so it parses inline,
 * exactly like parseConfigSize / parseFocusId. Only the FIRST (single-config)
 * line is read; multi-config gallery rendering is a separate path (not golden).
 */
function parseConfigKnobs(filePath: string): { theme?: 'light' | 'dark'; fontScale?: number; locale?: string } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const configLines = content.split('\n').filter(l => PREVIEW_CONFIG_RE.test(l.trim()));
    const knobs: { theme?: 'light' | 'dark'; fontScale?: number; locale?: string } = {};
    // Only single-config samples get their knobs threaded into the golden render.
    // A MULTI-config file is a gallery sample (rendered side-by-side by the
    // orchestrator, verified by visual sign-off — not by this 1-image-per-sample
    // golden runner). Threading e.g. its first `theme=light` would change the
    // existing golden, so multi-config samples keep the runner's dark default.
    if (configLines.length !== 1) { return knobs; }
    const line = configLines[0];
    if (!line) { return knobs; }
    const t = line.match(/theme\s*=\s*(light|dark)/);
    if (t) { knobs.theme = t[1] as 'light' | 'dark'; }
    const fs2 = line.match(/fontScale\s*=\s*([\d.]+)/);
    if (fs2) {
        const v = parseFloat(fs2[1]);
        if (v >= FONTSCALE_MIN && v <= FONTSCALE_MAX) { knobs.fontScale = v; }
    }
    const l = line.match(/locale\s*=\s*([a-zA-Z][a-zA-Z0-9_\-]+)/);
    if (l) { knobs.locale = l[1]; }
    return knobs;
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
        // A zero-arg `// @dali-preview` factory wins over whole-file mode so a
        // `.preview.dali.cpp` can host a named factory (mirrors codeExtractor's
        // Mode 2 taking precedence). Otherwise the whole file is the code.
        code = extractDaliPreviewMarker(filePath) ?? extractPreviewFileCode(filePath);
    } else if (filePath.endsWith('.cpp') || filePath.endsWith('.h')) {
        // Zero-arg factory marker first, then the @dali-preview-begin/end region.
        code = extractDaliPreviewMarker(filePath) ?? extractMarkerCode(filePath);
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
    const focusId = parseFocusId(filePath);
    const { theme, fontScale, locale } = parseConfigKnobs(filePath);
    // WU-M5.1: only `// @broken-image` samples chain SetBrokenImageUrl (so the
    // unreachable-URL sample renders the bundled placeholder); all others keep the
    // slot empty and stay byte-identical. Read against the raw file (the marker is
    // a comment, stripped from `code`).
    const wantsBrokenImage = BROKEN_IMAGE_RE.test(fs.readFileSync(filePath, 'utf-8'));
    const opts = {
        userCode: code,
        width,
        height,
        outputPngPath: actualPng,
        metadataPath,
        templatePath: TEMPLATE_PATH,
        daliPrefix,
        display,
        focusId,
        theme,
        fontScale,
        locale,
        brokenImagePath: wantsBrokenImage ? BROKEN_IMAGE_ASSET : undefined,
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

    // `// @render-only` samples carry async / non-deterministic content (e.g. an
    // ImageView whose remote URL fails to load → DALi swaps in the broken-image
    // placeholder, but the timing of that swap vs. the capture is not statically
    // reproducible). They are verified by the fact that they compile + render to a
    // PNG (the SetBrokenImageUrl chain is valid + the layout box is built), not by
    // a flaky pixel golden. Mirrors serverGoldenRunner's @render-only handling.
    if (/\/\/\s*@render-only/m.test(fs.readFileSync(filePath, 'utf-8'))) {
        console.log('  [RENDER-ONLY] compiled + rendered (async content; no pixel golden)');
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
