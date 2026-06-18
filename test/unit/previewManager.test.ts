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
});
