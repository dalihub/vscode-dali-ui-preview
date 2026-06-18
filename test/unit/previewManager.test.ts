import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PreviewManager } from '../../src/previewManager';
import { MultiPreviewResult } from '../../src/previewConfig';

// ---------------------------------------------------------------------------
// Minimal stub for the VS Code API used by PreviewManager
// ---------------------------------------------------------------------------

function makeManagerWithSpy() {
    const postedMessages: Array<{ command: string; [key: string]: unknown }> = [];

    const webview = {
        html: '',
        cspSource: 'vscode-resource:',
        postMessage: (msg: unknown) => { postedMessages.push(msg as { command: string }); },
        onDidReceiveMessage: (handler: (msg: unknown) => void) => {
            // Expose the handler so tests can simulate incoming messages
            (webview as any)._handler = handler;
            return { dispose: () => {} };
        },
        asWebviewUri: (uri: any) => uri,
    };

    const panel = {
        webview,
        reveal: () => {},
        onDidDispose: (_cb: () => void) => ({ dispose: () => {} }),
        dispose: () => {},
        visible: true,
    };

    const vscode = require('vscode');
    const savedCreate = vscode.window.createWebviewPanel;
    vscode.window.createWebviewPanel = () => panel;

    const ctx = {
        extensionPath: __dirname,
        subscriptions: [],
        workspaceState: { get: () => undefined, update: () => {} },
    } as any;

    const mgr = new PreviewManager(ctx);
    // Trigger show() BEFORE restoring the mock so our spy panel is used
    mgr.show();

    vscode.window.createWebviewPanel = savedCreate;

    function simulate(msg: { command: string; [key: string]: unknown }) {
        (webview as any)._handler?.(msg);
    }

    return { mgr, postedMessages, simulate };
}

// ---------------------------------------------------------------------------
// setBackgroundColor
// ---------------------------------------------------------------------------

describe('PreviewManager — setBackgroundColor()', () => {
    it('sends setBackgroundColor postMessage with the given color', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.setBackgroundColor('#ff0000');
        const msg = postedMessages.find(m => m.command === 'setBackgroundColor');
        expect(msg).to.exist;
        expect(msg!.color).to.equal('#ff0000');
    });
});

// ---------------------------------------------------------------------------
// onBackgroundChange
// ---------------------------------------------------------------------------

describe('PreviewManager — onBackgroundChange()', () => {
    it('fires registered callback when changeBackground message is received', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: string[] = [];
        mgr.onBackgroundChange((color) => received.push(color));

        simulate({ command: 'changeBackground', color: '#aabbcc' });

        expect(received).to.deep.equal(['#aabbcc']);
    });

    it('fires multiple registered callbacks', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const a: string[] = [];
        const b: string[] = [];
        mgr.onBackgroundChange(c => a.push(c));
        mgr.onBackgroundChange(c => b.push(c));

        simulate({ command: 'changeBackground', color: '#112233' });

        expect(a).to.deep.equal(['#112233']);
        expect(b).to.deep.equal(['#112233']);
    });

    it('does not fire callback after dispose', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: string[] = [];
        const disposable = mgr.onBackgroundChange(c => received.push(c));
        disposable.dispose();

        simulate({ command: 'changeBackground', color: '#ffffff' });

        expect(received).to.have.length(0);
    });

    it('does not call callback when changeBackground message has no color', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: string[] = [];
        mgr.onBackgroundChange(c => received.push(c));

        simulate({ command: 'changeBackground' });

        expect(received).to.have.length(0);
    });
});

// ---------------------------------------------------------------------------
// clearError
// ---------------------------------------------------------------------------

describe('PreviewManager — clearError()', () => {
    it('sends clearError postMessage', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.clearError();
        const msg = postedMessages.find(m => m.command === 'clearError');
        expect(msg).to.exist;
    });

    it('does nothing when panel is not open', () => {
        const ctx = {
            extensionPath: __dirname,
            subscriptions: [],
            workspaceState: { get: () => undefined, update: () => {} },
        } as any;
        const mgr = new PreviewManager(ctx);
        expect(() => mgr.clearError()).to.not.throw();
    });
});

// ---------------------------------------------------------------------------
// show(preserveFocus)
// ---------------------------------------------------------------------------

function makeManagerWithRevealSpy() {
    const revealCalls: Array<{ col: unknown; preserveFocus: boolean | undefined }> = [];
    const postedMessages: Array<{ command: string; [key: string]: unknown }> = [];

    const webview = {
        html: '',
        cspSource: 'vscode-resource:',
        postMessage: (msg: unknown) => { postedMessages.push(msg as { command: string }); },
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        asWebviewUri: (uri: any) => uri,
    };

    const panel = {
        webview,
        reveal: (col: unknown, preserveFocus?: boolean) => {
            revealCalls.push({ col, preserveFocus });
        },
        onDidDispose: (_cb: () => void) => ({ dispose: () => {} }),
        dispose: () => {},
        visible: true,
    };

    const vscode = require('vscode');
    const savedCreate = vscode.window.createWebviewPanel;
    vscode.window.createWebviewPanel = () => panel;

    const ctx = {
        extensionPath: __dirname,
        subscriptions: [],
        workspaceState: { get: () => undefined, update: () => {} },
    } as any;

    const mgr = new PreviewManager(ctx);
    mgr.show(); // Creates the panel (first call does not trigger reveal)

    vscode.window.createWebviewPanel = savedCreate;

    return { mgr, revealCalls, postedMessages };
}

describe('PreviewManager — show(preserveFocus)', () => {
    it('passes preserveFocus=true to panel.reveal() when called with true', () => {
        const { mgr, revealCalls } = makeManagerWithRevealSpy();
        mgr.show(true);
        expect(revealCalls).to.have.length(1);
        expect(revealCalls[0].preserveFocus).to.equal(true);
    });

    it('passes preserveFocus=false to panel.reveal() by default', () => {
        const { mgr, revealCalls } = makeManagerWithRevealSpy();
        mgr.show();
        expect(revealCalls).to.have.length(1);
        expect(revealCalls[0].preserveFocus).to.equal(false);
    });
});

// ---------------------------------------------------------------------------
// updateMultiImage — gallery message contract (WU-M3.8)
// ---------------------------------------------------------------------------

describe('PreviewManager — updateMultiImage() gallery contract', () => {
    function writeMeta(dir: string, name: string, obj: object): string {
        const p = path.join(dir, `${name}.json`);
        fs.writeFileSync(p, JSON.stringify(obj));
        return p;
    }

    it('posts updateMultiImage with one {name, uri, metadata} item per config variant', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-'));
        const meta = writeMeta(tmp, 'dark', { root: { name: 'RootLayer' }, provenance: [{ kind: 'untranslated', detail: 'x' }] });
        const pngPath = path.join(tmp, 'dark.png');
        fs.writeFileSync(pngPath, 'PNG');

        const { mgr, postedMessages } = makeManagerWithSpy();
        const results: MultiPreviewResult[] = [
            { config: { name: 'Light', theme: 'light' }, success: true, pngPath, metadataPath: undefined, buildTimeMs: 12 },
            { config: { name: 'Dark', theme: 'dark' }, success: true, pngPath, metadataPath: meta, buildTimeMs: 34 },
        ];
        mgr.updateMultiImage(results);

        const msg = postedMessages.find(m => m.command === 'updateMultiImage') as any;
        expect(msg, 'updateMultiImage posted').to.exist;
        expect(msg.images).to.have.length(2);
        // Per-config name is carried into the grid header.
        expect(msg.images[0].name).to.equal('Light');
        expect(msg.images[1].name).to.equal('Dark');
        // Successful variants carry a webview uri.
        expect(msg.images[0].uri).to.be.a('string');
        // The Dark variant's metadata (with its provenance) is threaded per-config.
        expect(msg.images[1].metadata).to.deep.include({ provenance: [{ kind: 'untranslated', detail: 'x' }] });

        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('carries the error (not a uri) for a failed config variant', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        const results: MultiPreviewResult[] = [
            { config: { name: 'Broken' }, success: false, buildTimeMs: 5, error: 'compile failed: foo' },
        ];
        mgr.updateMultiImage(results);

        const msg = postedMessages.find(m => m.command === 'updateMultiImage') as any;
        expect(msg.images).to.have.length(1);
        expect(msg.images[0].success).to.equal(false);
        expect(msg.images[0].error).to.equal('compile failed: foo');
        expect(msg.images[0].uri).to.equal(undefined);
    });

    // WU-M5.5: host-side provenance (e.g. focus-multiconfig) on a result must be
    // MERGED into the per-variant metadata the webview receives (ADR-007 host-
    // merge), so the badge (WU-M5.3) shows it. This holds even when the build
    // emitted no metadata at all (a fresh object is created).
    it('merges host-side result.provenance into the variant metadata (focus-multiconfig)', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-prov-'));
        const meta = writeMeta(tmp, 'dark', { root: { name: 'RootLayer' } });
        const pngPath = path.join(tmp, 'dark.png');
        fs.writeFileSync(pngPath, 'PNG');

        const { mgr, postedMessages } = makeManagerWithSpy();
        const focusProv = [{ kind: 'focus-multiconfig' as const, detail: 'focus=card not applied in multi-config preview' }];
        const results: MultiPreviewResult[] = [
            // Has metadata on disk → provenance appended to it.
            { config: { name: 'Dark' }, success: true, pngPath, metadataPath: meta, buildTimeMs: 1, provenance: focusProv },
            // No metadataPath → a fresh metadata object is created carrying provenance.
            { config: { name: 'Light' }, success: true, pngPath, metadataPath: undefined, buildTimeMs: 1, provenance: focusProv },
        ];
        mgr.updateMultiImage(results);

        const msg = postedMessages.find(m => m.command === 'updateMultiImage') as any;
        expect(msg.images[0].metadata.root.name, 'existing metadata preserved').to.equal('RootLayer');
        expect(msg.images[0].metadata.provenance, 'provenance merged onto existing metadata')
            .to.deep.equal(focusProv);
        expect(msg.images[1].metadata.provenance, 'fresh metadata created for provenance-only variant')
            .to.deep.equal(focusProv);

        fs.rmSync(tmp, { recursive: true, force: true });
    });
});

// ---------------------------------------------------------------------------
// updateImage — provenance message contract (WU-M5.3 / ADR-007)
// ---------------------------------------------------------------------------

describe('PreviewManager — updateImage() provenance contract (WU-M5.3)', () => {
    function writeMetaFile(obj: object): string {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'um-prov-'));
        const p = path.join(tmp, 'meta.json');
        fs.writeFileSync(p, JSON.stringify(obj));
        return p;
    }

    // The badge backbone depends on the channel staying intact: when metadata
    // carries `provenance`, the host must post it to the webview UNCHANGED so the
    // chip renderer can consume it. (The chip RENDERING itself is visual / ✋.)
    it('posts updateImage with metadata.provenance carried through verbatim', () => {
        const provenance = [
            { kind: 'untranslated', detail: 'IDS_TITLE shown as key (no ar catalog)' },
            { kind: 'image-placeholder', detail: 'http://x/p.jpg unreachable — showing gray placeholder' },
        ];
        const metadata = { root: { name: 'RootLayer' }, provenance };

        const pngPath = path.join(os.tmpdir(), 'prov-preview.png');
        fs.writeFileSync(pngPath, 'PNG');

        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.updateImage(pngPath, 42, metadata, false, 7);

        const msg = postedMessages.find(m => m.command === 'updateImage') as any;
        expect(msg, 'updateImage posted').to.exist;
        // The whole metadata object (incl. provenance) reaches the webview intact.
        expect(msg.metadata).to.deep.equal(metadata);
        expect(msg.metadata.provenance).to.deep.equal(provenance);
        // Sanity: the normal fields are still present.
        expect(msg.epoch).to.equal(7);
        expect(msg.isScrub).to.equal(false);
    });

    it('posts updateImage with no provenance field when metadata has none (clean preview)', () => {
        const metadata = { root: { name: 'RootLayer' } };
        const pngPath = path.join(os.tmpdir(), 'noprov-preview.png');
        fs.writeFileSync(pngPath, 'PNG');

        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.updateImage(pngPath, 1, metadata, false, 1);

        const msg = postedMessages.find(m => m.command === 'updateImage') as any;
        expect(msg.metadata).to.deep.equal(metadata);
        expect((msg.metadata as any).provenance).to.equal(undefined);
    });
});
