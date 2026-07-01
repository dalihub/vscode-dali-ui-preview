import { expect } from 'chai';
import { PreviewOrchestrator, OrchestratorDeps } from '../../src/previewOrchestrator';
import { ExtractionResult } from '../../src/codeExtractor';
import { createMockDocument } from '../helpers/mockDocument';

// Regression guard for the parser fast path dropping image asset URLs.
//
// stageImageAssets rewrites a relative `ImageView("assets/x.jpg")` URL to a
// resolvable (staged) path so the renderer can load it. But the warm-server
// parser strategy parsed the RAW `extraction.code`, so the scene it handed the
// server still carried the un-staged relative URL — which the server (a separate
// process, different CWD) can't find → a BLANK image on the fast path. (The
// harness/dlopen paths were fine: they compile the instrumented, staged code.)
//
// The fix feeds the parser the STAGED code. This asserts the scene passed to
// server.renderJson carries the rewritten URL, not the raw relative one.

const RAW_URL = 'assets/pic.jpg';
const STAGED_URL = '/STAGED/pic.jpg';

// Flat, self-contained (single-fn slice) + no animation/focus → takes the parser path.
const IMAGE_CODE = [
    'FlexLayout root = FlexLayout::New();',
    `ImageView img = ImageView::New("${RAW_URL}");`,
    'img.SetRequestedWidth(100.0f);',
    'img.SetRequestedHeight(100.0f);',
    'root.AddChildren({ img });',
    'return root;',
].join('\n');

function makeOrch() {
    const renderedScenes: any[] = [];
    const previewManager = {
        updateImage: () => {}, updateMultiImage: () => {}, showLoading: () => {},
        showError: () => {}, clearError: () => {}, showAnimationControls: () => {},
        hideAnimationControls: () => {}, notifyScrubDropped: () => {},
    } as any;
    const buildRunner = {
        getTmpDir: () => '/tmp/dali_test',
        // Mirror the real stageImageAssets: rewrite the relative URL to a staged path.
        stageImageAssets: (code: string) => code.split(RAW_URL).join(STAGED_URL),
        getExtensionPath: () => '/ext',
        getPluginTemplateContent: () => '',
        buildAndRun: () => Promise.resolve({ success: true, pngPath: '/harness.png' }),
        compilePlugin: () => Promise.resolve({ success: true, soPath: '/p.so' }),
    } as any;
    const previewServer = {
        isRunning: true,
        renderJson: (scene: any) => {
            renderedScenes.push(scene);
            return Promise.resolve({ success: true, pngPath: '/parser.png' });
        },
        reload: () => Promise.resolve({ success: true, pngPath: '/s.png' }),
        renderAt: () => Promise.resolve({ success: true, pngPath: '/scrub.png' }),
    } as any;
    const deps: OrchestratorDeps = {
        buildRunner, previewManager, previewServer,
        xvfbManager: undefined, statusBar: undefined,
        outputChannel: { appendLine: () => {} } as any,
        diagnosticCollection: { delete: () => {}, set: () => {} } as any,
    };
    const orch = new PreviewOrchestrator(deps, { width: 200, height: 200, theme: 'dark' });
    return { orch, renderedScenes };
}

describe('PreviewOrchestrator — parser path uses STAGED image URLs', () => {
    it('hands the warm server a scene with the rewritten (staged) ImageView URL, not the raw relative one', async () => {
        const { orch, renderedScenes } = makeOrch();
        const doc = createMockDocument('/proj/img.preview.dali.cpp', IMAGE_CODE) as any;

        await orch.runPreview(doc, false, {
            code: IMAGE_CODE, startLine: 0, mode: 'preview-file',
        } as ExtractionResult);

        expect(renderedScenes.length, 'the parser path (renderJson) must have run').to.equal(1);
        const sceneJson = JSON.stringify(renderedScenes[0]);
        expect(sceneJson, 'scene must carry the STAGED (resolvable) url').to.contain(STAGED_URL);
        expect(sceneJson, 'scene must NOT carry the raw relative url').to.not.contain(RAW_URL);
    });
});
