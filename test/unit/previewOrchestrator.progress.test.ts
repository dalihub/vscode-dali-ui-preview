import { expect } from 'chai';
import { PreviewOrchestrator, OrchestratorDeps } from '../../src/previewOrchestrator';
import { ExtractionResult } from '../../src/codeExtractor';
import { createMockDocument } from '../helpers/mockDocument';

// WU-M5.4 — a `// @preview-state: progress=<f>` directive must drive the LIVE
// extension path. progress is the OPPOSITE routing of focus: it forces the
// SERVER/dlopen path (the scrubber __SetPreviewProgress / RENDER_AT lives only in
// the resident plugin) and, after the build, scrubs the resident plugin to that
// position ONCE via server.renderAt.
//
// Setup: a fake previewServer with isRunning=true; the code contains an animation
// (.Play()) so the parser fast path is skipped and the dlopen path is taken (as
// in real life). reload returns animationCount=1 so the post-build progress apply
// fires. We spy on compilePlugin/reload/renderAt/buildAndRun to prove exactly
// which path ran and that the scrubber was driven to the right progress.

function makeProgressOrch() {
    const buildAndRunCalls: any[][] = [];
    const compilePluginCalls: any[][] = [];
    const reloadCalls: any[][] = [];
    const renderAtCalls: any[][] = [];

    const previewManager = {
        updateImage: () => {},
        updateMultiImage: () => {},
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
        buildAndRun: (...args: any[]) => {
            buildAndRunCalls.push(args);
            return Promise.resolve({ success: true, pngPath: '/harness.png' });
        },
        compilePlugin: (...args: any[]) => {
            compilePluginCalls.push(args);
            return Promise.resolve({ success: true, soPath: '/p.so' });
        },
    } as any;

    const previewServer = {
        isRunning: true,
        renderJson: (...args: any[]) => Promise.resolve({ success: true, pngPath: '/parser.png' }),
        // reload reports a registered animation so the progress apply path runs.
        reload: (...args: any[]) => {
            reloadCalls.push(args);
            return Promise.resolve({
                success: true, pngPath: '/server.png', metadataPath: undefined,
                animationCount: 1, animationDurationMs: 3000,
            });
        },
        // The scrubber entry point: this is what `progress` must drive.
        renderAt: (...args: any[]) => {
            renderAtCalls.push(args);
            return Promise.resolve({ success: true, pngPath: '/scrub.png', metadataPath: undefined });
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
    const orch = new PreviewOrchestrator(deps, { width: 420, height: 420, theme: 'dark' });
    return { orch, buildAndRunCalls, compilePluginCalls, reloadCalls, renderAtCalls };
}

// A self-contained animated body: the .Play() makes hasAnimation true (so the
// parser path is skipped) and registers an animation for the scrubber.
const ANIM_CODE = [
    'auto root = View::New();',
    'Animation a = Animation::New(3.0f);',
    'a.AnimateTo(Property(root, Actor::Property::SCALE), Vector3(1.5f,1.5f,1.0f));',
    'a.Play();',
    'return root;',
].join('\n');

function progressExtraction(progress?: number, focus?: string): ExtractionResult {
    const state: any = {};
    if (typeof progress === 'number') { state.progress = progress; }
    if (focus) { state.focus = focus; }
    return {
        code: ANIM_CODE,
        startLine: 0,
        mode: 'preview-file',
        state: Object.keys(state).length ? state : undefined,
    };
}

describe('PreviewOrchestrator — progress directive routing (WU-M5.4)', () => {
    it('routes a progress preview to the server/dlopen path and scrubs once to the clamped value', async () => {
        const { orch, buildAndRunCalls, reloadCalls, renderAtCalls } = makeProgressOrch();
        const doc = createMockDocument('/proj/anim.preview.dali.cpp', ANIM_CODE) as any;

        await orch.runPreview(doc, false, progressExtraction(0.4));

        // (i) The dlopen/server path produced the preview (NOT the harness).
        expect(reloadCalls.length, 'dlopen reload must run for a progress preview').to.equal(1);
        expect(buildAndRunCalls.length, 'harness must NOT run when the server is up').to.equal(0);

        // (ii) The scrubber was driven exactly once to progress=0.4 (renderAt's
        // first positional arg is the progress).
        expect(renderAtCalls.length, 'server.renderAt (scrubber) must be called once').to.equal(1);
        expect(renderAtCalls[0][0], 'progress must reach renderAt').to.equal(0.4);
    });

    it('clamps an out-of-range progress to [0,1] before scrubbing', async () => {
        const { orch, renderAtCalls } = makeProgressOrch();
        const doc = createMockDocument('/proj/anim.preview.dali.cpp', ANIM_CODE) as any;

        await orch.runPreview(doc, false, progressExtraction(1.8));

        expect(renderAtCalls.length).to.equal(1);
        expect(renderAtCalls[0][0], 'progress 1.8 clamps to 1').to.equal(1);
    });

    it('control: WITHOUT progress the same animated code does NOT scrub after build', async () => {
        // Proves the scrub is driven by the directive, not the scaffold. The dlopen
        // path still runs (animation → skip parser), but no post-build renderAt.
        const { orch, reloadCalls, renderAtCalls } = makeProgressOrch();
        const doc = createMockDocument('/proj/anim.preview.dali.cpp', ANIM_CODE) as any;

        await orch.runPreview(doc, false, progressExtraction(undefined));

        expect(reloadCalls.length, 'dlopen path still runs for an animation').to.equal(1);
        expect(renderAtCalls.length, 'no progress directive → no auto-scrub').to.equal(0);
    });

    it('conflict: focus + progress → progress WINS the server path (harness not forced)', async () => {
        // focus alone forces the harness; progress alone forces the server. When
        // both are set, progress wins routing so the scrubber exists. The harness
        // must NOT run, the dlopen path must, and the scrubber is driven to 0.6.
        const { orch, buildAndRunCalls, reloadCalls, renderAtCalls } = makeProgressOrch();
        const doc = createMockDocument('/proj/anim.preview.dali.cpp', ANIM_CODE) as any;

        await orch.runPreview(doc, false, progressExtraction(0.6, 'card'));

        expect(buildAndRunCalls.length, 'focus must NOT force the harness when progress is also set').to.equal(0);
        expect(reloadCalls.length, 'progress wins → dlopen/server path runs').to.equal(1);
        expect(renderAtCalls.length, 'progress is applied').to.equal(1);
        expect(renderAtCalls[0][0]).to.equal(0.6);
    });
});
