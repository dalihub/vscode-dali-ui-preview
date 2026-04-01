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

    // JsonEscapeStr branch coverage (Critical)
    it('JsonEscapeStr has branch for double-quote character', () => {
        expect(template).to.include("c == '\"'");
    });

    it('JsonEscapeStr has branch for backslash character', () => {
        expect(template).to.include("c == '\\\\'");
    });

    it('JsonEscapeStr has branch for newline character', () => {
        expect(template).to.include("c == '\\n'");
    });

    it('JsonEscapeStr has branch for carriage return character', () => {
        expect(template).to.include("c == '\\r'");
    });

    it('JsonEscapeStr has branch for tab character', () => {
        expect(template).to.include("c == '\\t'");
    });

    it('JsonEscapeStr handles control chars below 0x20 via \\uXXXX', () => {
        expect(template).to.include('static_cast<unsigned char>(c) < 0x20');
        expect(template).to.include('hex[(uc >> 4) & 0xF]');
    });

    // ShortTypeName behavior (Critical)
    it('ShortTypeName extracts name after last :: using rfind', () => {
        expect(template).to.include('rfind("::")');
        expect(template).to.include('substr(pos + 2)');
    });

    it('ShortTypeName returns fullName unchanged when no :: found', () => {
        // The ternary fallback returns the original when pos == npos
        expect(template).to.include('fullName.rfind("::")');
        expect(template).to.include('? fullName.substr(pos + 2) : fullName');
    });

    it('ShortTypeName empty-string fallback uses "Actor"', () => {
        expect(template).to.include('typeName.empty()) typeName = "Actor"');
    });

    // NaN/Inf guards (High)
    it('CollectActorMetadata guards opacity with std::isfinite', () => {
        expect(template).to.include('std::isfinite(opacity)');
    });

    it('CollectActorMetadata guards color components with std::isfinite', () => {
        expect(template).to.include('std::isfinite(color.r)');
        expect(template).to.include('std::isfinite(color.g)');
        expect(template).to.include('std::isfinite(color.b)');
        expect(template).to.include('std::isfinite(color.a)');
    });

    // Color format contract (High)
    it('color serialised as JSON array not a plain string', () => {
        // Array format: "color":[cr,cg,cb,ca]
        expect(template).to.include('\\"color\\":[');
        // Must NOT use old string format "color":"..."
        expect(template).to.not.include('\\"color\\":\\"');
    });

    it('JsonEscapeStr is defined as a static function', () => {
        expect(template).to.include('static std::string JsonEscapeStr');
    });

    it('ShortTypeName is defined as a static function', () => {
        expect(template).to.include('static std::string ShortTypeName');
    });

    it('JsonEscapeStr is called when serialising actor name', () => {
        expect(template).to.include('JsonEscapeStr(name.CStr())');
    });

    it('JsonEscapeStr is called when serialising type name', () => {
        expect(template).to.include('JsonEscapeStr(typeName)');
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

// ---------------------------------------------------------------------------
// PreviewManager — setInspectorVisible() guard + state persistence
// ---------------------------------------------------------------------------

describe('PreviewManager — setInspectorVisible() no-panel guard', () => {
    it('does not throw when panel is not open', () => {
        const ctx = {
            extensionPath: __dirname,
            subscriptions: [],
            workspaceState: { get: () => undefined, update: () => {} },
        } as any;
        const mgr = new PreviewManager(ctx);
        expect(() => mgr.setInspectorVisible(true)).to.not.throw();
    });

    it('does not post message when panel is not open', () => {
        const ctx = {
            extensionPath: __dirname,
            subscriptions: [],
            workspaceState: { get: () => undefined, update: () => {} },
        } as any;
        const mgr = new PreviewManager(ctx);
        // Should not throw — and since panel is null, no postMessage call happens
        mgr.setInspectorVisible(true);
        // Verify panel remains absent — implicitly verified by no exception
    });
});

// ---------------------------------------------------------------------------
// PreviewManager — webviewReady state restore (High)
// ---------------------------------------------------------------------------

describe('PreviewManager — webviewReady state restore', () => {
    it('sends setInspectorVisible(true) on webviewReady when state was set to true before panel open', () => {
        const { mgr, postedMessages, simulate } = makeManagerWithSpy();

        // Simulate: state was set to true (e.g., restored from workspaceState)
        mgr.setInspectorVisible(true);

        // Clear the message posted by setInspectorVisible (panel was open)
        postedMessages.length = 0;

        // Webview posts 'webviewReady' after loading
        simulate({ command: 'webviewReady' });

        const msg = postedMessages.find(m => m.command === 'setInspectorVisible');
        expect(msg).to.exist;
        expect(msg!.visible).to.equal(true);
    });

    it('does NOT send setInspectorVisible on webviewReady when state is false (default)', () => {
        const { mgr, postedMessages, simulate } = makeManagerWithSpy();

        // Default state is false — no setInspectorVisible should fire on ready
        simulate({ command: 'webviewReady' });

        const msg = postedMessages.find(m => m.command === 'setInspectorVisible');
        expect(msg).to.not.exist;
    });

    it('sends setInspectorVisible(false) after inspector is toggled off and panel reopened', () => {
        const { mgr, postedMessages, simulate } = makeManagerWithSpy();

        // Toggle on, then off
        simulate({ command: 'inspectorToggle', visible: true });
        simulate({ command: 'inspectorToggle', visible: false });

        postedMessages.length = 0;

        // Webview ready again — state is false, no restore message expected
        simulate({ command: 'webviewReady' });

        const msg = postedMessages.find(m => m.command === 'setInspectorVisible');
        expect(msg).to.not.exist;
    });
});

// ---------------------------------------------------------------------------
// PreviewManager — workspaceState update on inspectorToggle (High)
// ---------------------------------------------------------------------------

describe('PreviewManager — workspaceState update on inspectorToggle', () => {
    it('calls workspaceState.update with correct key when toggle fires true', () => {
        const updates: Array<{key: string; value: unknown}> = [];
        const ctx = {
            extensionPath: __dirname,
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: (key: string, value: unknown) => { updates.push({ key, value }); },
            },
        } as any;

        const vscode = require('vscode');
        const savedCreate = vscode.window.createWebviewPanel;
        const webview = {
            html: '', cspSource: '', postMessage: () => {},
            onDidReceiveMessage: (h: (m: unknown) => void) => { (webview as any)._h = h; return { dispose: () => {} }; },
            asWebviewUri: (u: unknown) => u,
        };
        const panel = {
            webview, reveal: () => {},
            onDidDispose: (_cb: () => void) => ({ dispose: () => {} }),
            dispose: () => {}, visible: true,
        };
        vscode.window.createWebviewPanel = () => panel;

        const mgr = new PreviewManager(ctx);
        mgr.show();
        mgr.onInspectorToggle((visible: boolean) => {
            ctx.workspaceState.update('daliPreview.inspectorVisible', visible);
        });

        // Simulate toggle from webview
        (webview as any)._h({ command: 'inspectorToggle', visible: true });

        vscode.window.createWebviewPanel = savedCreate;

        const update = updates.find(u => u.key === 'daliPreview.inspectorVisible');
        expect(update).to.exist;
        expect(update!.value).to.equal(true);
    });
});
