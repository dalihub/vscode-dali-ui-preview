import { expect } from 'chai';
import { PreviewOrchestrator, OrchestratorDeps } from '../../src/previewOrchestrator';
import { ExtractionResult } from '../../src/codeExtractor';
import { createMockDocument } from '../helpers/mockDocument';

// Characterization tests for PreviewOrchestrator's concurrency guards — the
// `building` flag, the `buildGeneration` stale-result guard, and the
// `pendingRebuildDoc` replay queue. This is the riskiest logic in the app and
// previously had 0% coverage: the existing "Build generation guard" tests in
// integration.test.ts only *simulate* the pattern in isolation (a local
// `let buildGeneration` counter); they never exercise the real orchestrator.
//
// Setup trick: with `previewServer = undefined`, both server strategies'
// canHandle() return false, so runPreview always routes to harnessStrategy —
// which we replace with a controllable stub. That lets us hold a build "in
// flight", overlap a second request, and assert exactly when (or whether)
// previewManager.updateImage is called.

interface Deferred {
    promise: Promise<any>;
    resolve: (value: any) => void;
}
function defer(): Deferred {
    let resolve!: (value: any) => void;
    const promise = new Promise<any>((r) => { resolve = r; });
    return { promise, resolve };
}

function makeExtraction(code: string): ExtractionResult {
    return { code, startLine: 0, mode: 'preview-file' };
}

function makeOrch() {
    const updateImageCalls: any[][] = [];
    const previewManager = {
        updateImage: (...args: any[]) => { updateImageCalls.push(args); },
        showLoading: () => {},
        showError: () => {},
        clearError: () => {},
    } as any;
    const buildRunner = {
        getTmpDir: () => '/tmp/dali_test',
        getExtensionPath: () => '/ext',
        getPluginTemplateContent: () => '',
        // Identity passthrough: staging is exercised in buildRunner.test.ts; here
        // we only need prepareSlice to keep flowing the code through unchanged.
        stageImageAssets: (code: string) => code,
    } as any;
    const deps: OrchestratorDeps = {
        buildRunner,
        previewManager,
        previewServer: undefined,
        xvfbManager: undefined,
        statusBar: undefined,
        outputChannel: { appendLine: () => {} } as any,
        diagnosticCollection: { delete: () => {}, set: () => {} } as any,
    };
    const orch = new PreviewOrchestrator(deps, { width: 1024, height: 600, theme: 'dark' });
    return { orch, updateImageCalls };
}

// Replace the (private) harness strategy with a controllable stub. Each
// execute() call pushes a Deferred the test resolves on demand, mimicking a
// build that finishes at a chosen moment.
function stubHarness(orch: PreviewOrchestrator): Deferred[] {
    const calls: Deferred[] = [];
    (orch as any).harnessStrategy = {
        execute: () => {
            const d = defer();
            calls.push(d);
            return d.promise.then((result) => ({ result }));
        },
    };
    return calls;
}

describe('PreviewOrchestrator — concurrency guards (characterization)', () => {
    it('drops a save-triggered runPreview while a build is already in progress', async () => {
        const { orch, updateImageCalls } = makeOrch();
        const calls = stubHarness(orch);

        const docA = createMockDocument('/proj/a.preview.dali.cpp', 'return View::New();') as any;
        const docB = createMockDocument('/proj/b.preview.dali.cpp', 'return Button::New();') as any;

        // p1 runs synchronously up to the first await (harnessStrategy.execute):
        const p1 = orch.runPreview(docA, false, makeExtraction('return View::New();'));
        expect(calls.length).to.equal(1);

        // A second SAVE-triggered build while one is in flight is dropped, not
        // even queued (only live-preview keystrokes queue).
        await orch.runPreview(docB, false, makeExtraction('return Button::New();'));
        expect(calls.length).to.equal(1); // docB build never started

        calls[0].resolve({ success: true, pngPath: '/a.png' });
        await p1;
        expect(updateImageCalls.length).to.equal(1); // only docA was applied
    });

    it('queues a live-preview request during a build and drains it when the build finishes', async () => {
        const { orch } = makeOrch();
        const calls = stubHarness(orch);

        const docA = createMockDocument('/proj/a.preview.dali.cpp', 'return View::New();') as any;
        // docB has no preview markers, so the replayed runPreview extracts nothing
        // and returns early — the test leaves no dangling in-flight build.
        const docB = createMockDocument('/proj/plain.cpp', 'int main() { return 0; }') as any;

        const p1 = orch.runPreview(docA, true, makeExtraction('return View::New();'));
        expect(calls.length).to.equal(1);

        // A LIVE request while building is queued (not dropped).
        await orch.runPreview(docB, true, makeExtraction('return View::New();'));
        expect((orch as any).pendingRebuildDoc).to.equal(docB);

        calls[0].resolve({ success: true, pngPath: '/a.png' });
        await p1;
        // The finally block drains the queue.
        expect((orch as any).pendingRebuildDoc).to.equal(undefined);
    });

    it('discards a build whose generation was superseded mid-flight (stale guard)', async () => {
        const { orch, updateImageCalls } = makeOrch();
        const calls = stubHarness(orch);

        const docA = createMockDocument('/proj/a.preview.dali.cpp', 'return View::New();') as any;
        const p1 = orch.runPreview(docA, false, makeExtraction('return View::New();'));
        expect(calls.length).to.equal(1);

        // Simulate another entry point (device/vnc/replayed-live build) advancing
        // the generation while this build is still awaiting its result.
        (orch as any).buildGeneration = 99;

        calls[0].resolve({ success: true, pngPath: '/a.png' });
        await p1;
        // myGeneration (1) !== buildGeneration (99) → the stale result is dropped.
        expect(updateImageCalls.length).to.equal(0);
    });

    it('applies the build result on the normal (non-overlapping) path', async () => {
        // Baseline: with no interference, a single build updates the preview.
        const { orch, updateImageCalls } = makeOrch();
        const calls = stubHarness(orch);

        const docA = createMockDocument('/proj/a.preview.dali.cpp', 'return View::New();') as any;
        const p1 = orch.runPreview(docA, false, makeExtraction('return View::New();'));
        expect(calls.length).to.equal(1);

        calls[0].resolve({ success: true, pngPath: '/a.png', metadataPath: undefined });
        await p1;
        expect(updateImageCalls.length).to.equal(1);
        expect(updateImageCalls[0][0]).to.equal('/a.png');
    });
});

// ---------------------------------------------------------------------------
// scrubAnimation epoch guard — prevents a previous preview's in-flight/background
// frames from leaking into the current one (the two reported animation bugs).
// ---------------------------------------------------------------------------

describe('PreviewOrchestrator — scrubAnimation epoch guard', () => {
    function makeScrubOrch() {
        const updateImageCalls: any[][] = [];
        const renderAtCalls: any[][] = [];
        const previewManager = {
            updateImage: (...args: any[]) => { updateImageCalls.push(args); },
            showLoading: () => {}, showError: () => {}, clearError: () => {},
            showAnimationControls: () => {}, hideAnimationControls: () => {},
            notifyScrubDropped: () => {},
        } as any;
        const previewServer = {
            isRunning: true,
            renderAt: (...args: any[]) => {
                renderAtCalls.push(args);
                return Promise.resolve({ success: true, pngPath: '/tmp/scrub.png' });
            },
        } as any;
        const buildRunner = { getTmpDir: () => '/tmp/dali_test', stageImageAssets: (code: string) => code } as any;
        const deps: OrchestratorDeps = {
            buildRunner, previewManager, previewServer,
            xvfbManager: undefined, statusBar: undefined,
            outputChannel: { appendLine: () => {} } as any,
            diagnosticCollection: { delete: () => {}, set: () => {} } as any,
        };
        const orch = new PreviewOrchestrator(deps, { width: 360, height: 360, theme: 'dark' });
        return { orch, updateImageCalls, renderAtCalls };
    }

    it('renders + updates the image when the scrub epoch matches the active preview', async () => {
        const { orch, updateImageCalls, renderAtCalls } = makeScrubOrch();
        (orch as any).activeEpoch_ = 7;
        (orch as any).building = false;
        await orch.scrubAnimation(0.5, 7);
        expect(renderAtCalls.length).to.equal(1);
        expect(updateImageCalls.length).to.equal(1);
        // updateImage(pngPath, 0, metadata, isScrub=true, epoch=7)
        expect(updateImageCalls[0][3]).to.equal(true);
        expect(updateImageCalls[0][4]).to.equal(7);
    });

    it('ignores a scrub for a stale epoch (previous preview) — no render, no update', async () => {
        const { orch, updateImageCalls, renderAtCalls } = makeScrubOrch();
        (orch as any).activeEpoch_ = 7;
        (orch as any).building = false;
        await orch.scrubAnimation(0.5, 3); // stale epoch
        expect(renderAtCalls.length).to.equal(0);
        expect(updateImageCalls.length).to.equal(0);
    });

    it('ignores a scrub while a fresh render is in progress (building)', async () => {
        const { orch, updateImageCalls, renderAtCalls } = makeScrubOrch();
        (orch as any).activeEpoch_ = 7;
        (orch as any).building = true;
        await orch.scrubAnimation(0.5, 7);
        expect(renderAtCalls.length).to.equal(0);
        expect(updateImageCalls.length).to.equal(0);
    });

    // Scrub PNGs are written to a FIXED-grid filename so a long scrubbing session
    // (many durations/frame counts) reuses a BOUNDED set of files instead of
    // leaking a fresh PNG per distinct progress until dispose().
    it('writes scrub frames to a bounded, quantized filename (no per-progress leak)', async () => {
        const { orch, renderAtCalls } = makeScrubOrch();
        (orch as any).activeEpoch_ = 7;
        (orch as any).building = false;

        // renderAt(progress, pngPath, metadataPath, ...) — pngPath is arg[1].
        await orch.scrubAnimation(0.999, 7);
        const png = renderAtCalls[0][1] as string;
        const bucket = Number(png.match(/preview_scrub_(\d+)\.png$/)![1]);
        // Bucket stays on the fixed 0..200 grid — never the old progress*100000 blow-up.
        expect(bucket).to.be.at.most(200);
    });

    it('gives the same progress a stable file and distinct frames distinct files', async () => {
        const { orch, renderAtCalls } = makeScrubOrch();
        (orch as any).activeEpoch_ = 7;
        (orch as any).building = false;

        await orch.scrubAnimation(0.25, 7);   // first frame
        await orch.scrubAnimation(0.25, 7);   // same progress again
        await orch.scrubAnimation(0.75, 7);   // a different frame
        const f1 = renderAtCalls[0][1] as string;
        const f2 = renderAtCalls[1][1] as string;
        const f3 = renderAtCalls[2][1] as string;
        expect(f1).to.equal(f2);              // stable: same progress -> same backing file
        expect(f3).to.not.equal(f1);          // anti-alias: distinct frame -> distinct file
    });
});
