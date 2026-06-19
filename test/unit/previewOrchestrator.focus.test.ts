import { expect } from 'chai';
import { PreviewOrchestrator, OrchestratorDeps } from '../../src/previewOrchestrator';
import { ExtractionResult } from '../../src/codeExtractor';
import { createMockDocument } from '../helpers/mockDocument';

// IMPL PASS 4 (M2): a `// @preview-state: focus=<id>` directive must drive the
// LIVE extension path, not just the golden test. The orchestrator must (a) route
// a focus-bearing preview to the full-harness build (skipping the parser/T1 and
// dlopen/T2 server paths, which cannot render a focus ring) and (b) thread the
// focus id into buildRunner.buildAndRun so the harness fills {{POST_BUILD_FOCUS}}.
//
// Setup: a fake previewServer with isRunning=true is provided so BOTH server
// strategies' canHandle() return true. That makes the assertions NON-VACUOUS —
// the parser fast path would normally win here; only the focus guard diverts to
// the harness. We spy on buildAndRun (and on the server's render methods) to
// prove exactly which path ran and what focus id it received.

function makeFocusOrch() {
    // Spy: every buildAndRun call captured. focusId is the 9th positional arg
    // (index 8): buildAndRun(code,width,height,theme,bgColor,font,globals,includes,focusId).
    const buildAndRunCalls: any[][] = [];
    // Server render entry points: if either is hit, the parser/dlopen path ran
    // (which must NOT happen for a focus preview).
    const renderJsonCalls: any[][] = [];
    const reloadCalls: any[][] = [];

    const previewManager = {
        updateImage: () => {},
        showLoading: () => {},
        showError: () => {},
        clearError: () => {},
        showAnimationControls: () => {},
        hideAnimationControls: () => {},
    } as any;

    const buildRunner = {
        getTmpDir: () => '/tmp/dali_test',
        getExtensionPath: () => '/ext',
        getPluginTemplateContent: () => '',
        // Capture the call and return a successful build so applySuccessfulBuild runs.
        buildAndRun: (...args: any[]) => {
            buildAndRunCalls.push(args);
            return Promise.resolve({ success: true, pngPath: '/focus.png' });
        },
        // If the harness guard ever leaked to the dlopen path, this would be hit.
        compilePlugin: (...args: any[]) => {
            reloadCalls.push(['compilePlugin', ...args]);
            return Promise.resolve({ success: true, soPath: '/p.so' });
        },
    } as any;

    // isRunning=true → parser + dlopen strategies' canHandle() both return true.
    const previewServer = {
        isRunning: true,
        renderJson: (...args: any[]) => {
            renderJsonCalls.push(args);
            return Promise.resolve({ success: true, pngPath: '/parser.png' });
        },
        reload: (...args: any[]) => {
            reloadCalls.push(args);
            return Promise.resolve({ success: true });
        },
    } as any;

    const deps: OrchestratorDeps = {
        buildRunner,
        previewManager,
        previewServer,
        xvfbManager: undefined,
        statusBar: undefined,
        outputChannel: { appendLine: () => {} } as any,
        diagnosticCollection: { delete: () => {}, set: () => {} } as any,
    };
    const orch = new PreviewOrchestrator(deps, { width: 1024, height: 600, theme: 'dark' });
    return { orch, buildAndRunCalls, renderJsonCalls, reloadCalls };
}

describe('PreviewOrchestrator — focus directive routing (M2 IMPL PASS 4)', () => {
    // Self-contained body (no unresolved refs) → buildSlice yields rung
    // 'single-fn', so WITHOUT a focus directive this routes to the parser fast
    // path. The focus id is carried in extraction.state, independent of the code,
    // exactly as the live extractor delivers a `// @preview-state: focus=` line.
    const FOCUS_CODE = 'return View::New();';

    function focusExtraction(focus: string | undefined): ExtractionResult {
        return {
            code: FOCUS_CODE,
            startLine: 0,
            mode: 'preview-file',
            state: focus ? { focus } : undefined,
        };
    }

    it('routes a focus-bearing preview to the harness build and threads focusId=card2', async () => {
        const { orch, buildAndRunCalls, renderJsonCalls, reloadCalls } = makeFocusOrch();
        const doc = createMockDocument('/proj/cards.preview.dali.cpp', FOCUS_CODE) as any;

        await orch.runPreview(doc, false, focusExtraction('card2'));

        // (i) The parser/dlopen server fast paths were NOT taken, even though the
        // server is running and would otherwise have served this preview.
        expect(renderJsonCalls.length, 'parser renderJson must not be called for a focus preview').to.equal(0);
        expect(reloadCalls.length, 'dlopen compile/reload must not be called for a focus preview').to.equal(0);

        // (ii) The full-harness build ran exactly once and received focusId='card2'
        // as its 9th positional arg.
        expect(buildAndRunCalls.length, 'buildAndRun (full harness) must run once').to.equal(1);
        expect(buildAndRunCalls[0][8], 'focusId must reach buildAndRun (arg index 8)').to.equal('card2');
    });

    it('control: WITHOUT a focus directive the same code takes the parser fast path (no harness)', async () => {
        // Proves the prior assertions are non-vacuous: with focus removed and the
        // server running, this code routes to the parser path and never calls
        // buildAndRun. So it is the focus directive — not the test scaffold — that
        // forces the harness route above.
        const { orch, buildAndRunCalls, renderJsonCalls } = makeFocusOrch();
        const doc = createMockDocument('/proj/cards.preview.dali.cpp', FOCUS_CODE) as any;

        await orch.runPreview(doc, false, focusExtraction(undefined));

        expect(renderJsonCalls.length, 'no-focus code should take the parser path').to.equal(1);
        expect(buildAndRunCalls.length, 'no-focus code should NOT hit the harness').to.equal(0);
    });
});

// WU-M5.5 — multi-config × focus → focus-multiconfig provenance. focus only
// renders on the single-config harness path, so a focus directive in a gallery is
// dropped. The orchestrator must promote that silent-drop to a `focus-multiconfig`
// provenance on EACH successful variant so the webview badge (WU-M5.3) shows it.

function makeMultiFocusOrch() {
    // Capture the results array the manager would render so we can assert the
    // per-variant provenance the host attached.
    const updateMultiCalls: any[][] = [];
    const previewManager = {
        updateImage: () => {},
        updateMultiImage: (results: any[]) => { updateMultiCalls.push(results); },
        showLoading: () => {},
        showError: () => {},
        clearError: () => {},
        showAnimationControls: () => {},
        hideAnimationControls: () => {},
        notifyScrubDropped: () => {},
    } as any;

    const buildRunner = {
        getTmpDir: () => '/tmp/dali_test',
        getExtensionPath: () => '/ext',
        getPluginTemplateContent: () => '',
        // Multi-config harness fallback path (no server): each variant succeeds.
        buildAndRun: () => Promise.resolve({ success: true, pngPath: '/v.png', metadataPath: undefined }),
        compilePlugin: () => Promise.resolve({ success: true, soPath: '/p.so' }),
    } as any;

    const deps: OrchestratorDeps = {
        buildRunner,
        previewManager,
        // No resident server → multi-config goes through the harness fallback, which
        // still attaches the host-side provenance (the path under test).
        previewServer: undefined,
        xvfbManager: undefined,
        statusBar: undefined,
        outputChannel: { appendLine: () => {} } as any,
        diagnosticCollection: { delete: () => {}, set: () => {} } as any,
    };
    const orch = new PreviewOrchestrator(deps, { width: 480, height: 320, theme: 'dark' });
    return { orch, updateMultiCalls };
}

describe('PreviewOrchestrator — multi-config × focus → focus-multiconfig (WU-M5.5)', () => {
    const CODE = 'return View::New();';
    function multiFocusExtraction(focus: string | undefined): ExtractionResult {
        return {
            code: CODE,
            startLine: 0,
            mode: 'preview-file',
            configs: [
                { name: 'Light', theme: 'light' },
                { name: 'Dark', theme: 'dark' },
            ],
            state: focus ? { focus } : undefined,
        };
    }

    it('attaches focus-multiconfig provenance to every successful variant', async () => {
        const { orch, updateMultiCalls } = makeMultiFocusOrch();
        const doc = createMockDocument('/proj/gallery.preview.dali.cpp', CODE) as any;

        await orch.runPreview(doc, false, multiFocusExtraction('card'));

        expect(updateMultiCalls.length, 'updateMultiImage called once').to.equal(1);
        const results = updateMultiCalls[0];
        expect(results).to.have.length(2);
        for (const r of results) {
            expect(r.success).to.equal(true);
            expect(r.provenance, `${r.config.name} carries provenance`).to.have.length(1);
            expect(r.provenance[0].kind).to.equal('focus-multiconfig');
            expect(r.provenance[0].detail).to.include('card');
        }
    });

    it('control: WITHOUT focus the variants carry NO focus-multiconfig provenance', async () => {
        const { orch, updateMultiCalls } = makeMultiFocusOrch();
        const doc = createMockDocument('/proj/gallery.preview.dali.cpp', CODE) as any;

        await orch.runPreview(doc, false, multiFocusExtraction(undefined));

        const results = updateMultiCalls[0];
        for (const r of results) {
            expect(r.provenance, `${r.config.name} has no provenance`).to.equal(undefined);
        }
    });
});
