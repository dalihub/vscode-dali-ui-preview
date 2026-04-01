import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { PreviewManager } from '../../src/previewManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManagerWithSpy() {
    const postedMessages: Array<{ command: string; [key: string]: unknown }> = [];

    const webview = {
        html: '',
        cspSource: 'vscode-resource:',
        postMessage: (msg: unknown) => { postedMessages.push(msg as { command: string }); },
        onDidReceiveMessage: (handler: (msg: unknown) => void) => {
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
    mgr.show();

    vscode.window.createWebviewPanel = savedCreate;

    function simulate(msg: { command: string; [key: string]: unknown }) {
        (webview as any)._handler?.(msg);
    }

    return { mgr, postedMessages, simulate };
}

// ---------------------------------------------------------------------------
// Harness template: Inspector-related JSON fields
// ---------------------------------------------------------------------------

describe('Inspector — harness template JSON structure', () => {
    const TEMPLATE_PATH = path.resolve(__dirname, '../../../server/preview_harness.cpp.template');
    let template: string;

    before(() => {
        template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    });

    it('template includes #include <string> for helper functions', () => {
        expect(template).to.include('#include <string>');
    });

    it('template contains JsonEscapeStr helper', () => {
        expect(template).to.include('JsonEscapeStr');
    });

    it('template contains ShortTypeName helper', () => {
        expect(template).to.include('ShortTypeName');
    });

    it('CollectActorMetadata emits "type" field', () => {
        // Template contains C++ escaped string literals: \"type\":\"
        expect(template).to.include('\\"type\\":\\"');
    });

    it('CollectActorMetadata emits "visible" field', () => {
        expect(template).to.include('\\"visible\\":');
    });

    it('CollectActorMetadata emits "opacity" field', () => {
        expect(template).to.include('\\"opacity\\":');
    });

    it('CollectActorMetadata emits "properties" object', () => {
        expect(template).to.include('\\"properties\\":{');
    });

    it('CollectActorMetadata emits "color" as JSON array inside properties', () => {
        expect(template).to.include('\\"color\\":[');
    });

    it('CollectActorMetadata uses Actor::Property::VISIBLE', () => {
        expect(template).to.include('Actor::Property::VISIBLE');
    });

    it('CollectActorMetadata uses Actor::Property::OPACITY', () => {
        expect(template).to.include('Actor::Property::OPACITY');
    });

    it('CollectActorMetadata uses Actor::Property::COLOR', () => {
        expect(template).to.include('Actor::Property::COLOR');
    });

    it('CollectActorMetadata calls actor.GetTypeName()', () => {
        expect(template).to.include('GetTypeName()');
    });
});

// ---------------------------------------------------------------------------
// PreviewManager — highlightElement()
// ---------------------------------------------------------------------------

describe('PreviewManager — highlightElement()', () => {
    it('sends highlightElement postMessage with correct line number', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.highlightElement(42);
        const msg = postedMessages.find(m => m.command === 'highlightElement');
        expect(msg).to.exist;
        expect(msg!.line).to.equal(42);
    });

    it('sends highlightElement for line 0', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.highlightElement(0);
        const msg = postedMessages.find(m => m.command === 'highlightElement');
        expect(msg).to.exist;
        expect(msg!.line).to.equal(0);
    });

    it('does nothing when panel is not open', () => {
        const ctx = {
            extensionPath: __dirname,
            subscriptions: [],
            workspaceState: { get: () => undefined, update: () => {} },
        } as any;
        const mgr = new PreviewManager(ctx);
        expect(() => mgr.highlightElement(5)).to.not.throw();
    });
});

// ---------------------------------------------------------------------------
// PreviewManager — setInspectorVisible()
// ---------------------------------------------------------------------------

describe('PreviewManager — setInspectorVisible()', () => {
    it('sends setInspectorVisible with visible=true', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.setInspectorVisible(true);
        const msg = postedMessages.find(m => m.command === 'setInspectorVisible');
        expect(msg).to.exist;
        expect(msg!.visible).to.equal(true);
    });

    it('sends setInspectorVisible with visible=false', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.setInspectorVisible(false);
        const msg = postedMessages.find(m => m.command === 'setInspectorVisible');
        expect(msg).to.exist;
        expect(msg!.visible).to.equal(false);
    });
});

// ---------------------------------------------------------------------------
// PreviewManager — onInspectorToggle()
// ---------------------------------------------------------------------------

describe('PreviewManager — onInspectorToggle()', () => {
    it('fires registered callback when inspectorToggle message is received with visible=true', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: boolean[] = [];
        mgr.onInspectorToggle(v => received.push(v));

        simulate({ command: 'inspectorToggle', visible: true });

        expect(received).to.deep.equal([true]);
    });

    it('fires registered callback with visible=false', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: boolean[] = [];
        mgr.onInspectorToggle(v => received.push(v));

        simulate({ command: 'inspectorToggle', visible: false });

        expect(received).to.deep.equal([false]);
    });

    it('fires multiple registered callbacks', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const a: boolean[] = [];
        const b: boolean[] = [];
        mgr.onInspectorToggle(v => a.push(v));
        mgr.onInspectorToggle(v => b.push(v));

        simulate({ command: 'inspectorToggle', visible: true });

        expect(a).to.deep.equal([true]);
        expect(b).to.deep.equal([true]);
    });

    it('does not fire callback after dispose', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: boolean[] = [];
        const disposable = mgr.onInspectorToggle(v => received.push(v));
        disposable.dispose();

        simulate({ command: 'inspectorToggle', visible: true });

        expect(received).to.have.length(0);
    });

    it('does not fire callback when inspectorToggle has non-boolean visible', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: boolean[] = [];
        mgr.onInspectorToggle(v => received.push(v));

        simulate({ command: 'inspectorToggle', visible: 'yes' });

        expect(received).to.have.length(0);
    });
});
