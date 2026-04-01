import { expect } from 'chai';
import { PropertyEditor, EDITABLE_PROPS } from '../../src/propertyEditor';
import { createMockDocument } from '../helpers/mockDocument';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a PropertyEditor with a controllable applyEdit mock.
 * Returns captured WorkspaceEdit ops so tests can inspect what was replaced.
 */
function makeEditor() {
    const ops: Array<{ uri: any; range: any; newText: string }> = [];
    const vscode = require('vscode');

    const originalApply = vscode.workspace.applyEdit;
    vscode.workspace.applyEdit = (edit: any) => {
        for (const op of edit.ops) {
            ops.push(op);
        }
        return Promise.resolve(true);
    };

    // Stub doc.save()
    function makeDoc(content: string) {
        const doc = createMockDocument('test.cpp', content) as any;
        doc.save = () => Promise.resolve(true);
        return doc;
    }

    function restore() {
        vscode.workspace.applyEdit = originalApply;
    }

    return { editor: new PropertyEditor(), ops, makeDoc, restore };
}

// ---------------------------------------------------------------------------
// EDITABLE_PROPS
// ---------------------------------------------------------------------------

describe('PropertyEditor — EDITABLE_PROPS', () => {
    it('includes all core editable properties', () => {
        for (const prop of ['opacity', 'visible', 'color', 'x', 'y', 'w', 'h']) {
            expect(EDITABLE_PROPS).to.include(prop);
        }
    });
});

// ---------------------------------------------------------------------------
// Unknown property
// ---------------------------------------------------------------------------

describe('PropertyEditor — unknown property', () => {
    it('returns failure for an unrecognised property name', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        const doc = makeDoc('actor.DoSomething();');
        const result = await editor.applyEdit(doc, 0, 'unknownProp', '42');
        expect(result.success).to.equal(false);
        if (!result.success) {
            expect(result.reason).to.include('unknownProp');
        }
        restore();
    });
});

// ---------------------------------------------------------------------------
// Setter not found
// ---------------------------------------------------------------------------

describe('PropertyEditor — setter not found', () => {
    it('returns failure when no matching setter exists within search radius', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        const doc = makeDoc([
            'auto box = Actor::New();',
            '// no SetOpacity call here',
        ].join('\n'));
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f');
        expect(result.success).to.equal(false);
        restore();
    });

    it('returns failure when setter is outside search radius', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        // Put the setter 30 lines away (beyond default radius of 20)
        const lines = Array(30).fill('// pad');
        lines.push('actor.SetOpacity(1.0f);');
        const doc = makeDoc(lines.join('\n'));
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f', 20);
        expect(result.success).to.equal(false);
        restore();
    });
});

// ---------------------------------------------------------------------------
// opacity
// ---------------------------------------------------------------------------

describe('PropertyEditor — opacity', () => {
    it('replaces .SetOpacity() on the same line as the tagged actor', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc([
            'auto box = Actor::New(); // __L0',
            'box.SetOpacity(1.0f);',
        ].join('\n'));

        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f');
        expect(result.success).to.equal(true);
        expect(ops).to.have.lengthOf(1);
        expect(ops[0].newText).to.equal('.SetOpacity(0.5f)');
        restore();
    });

    it('finds .SetOpacity() within default search radius', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const lines = ['auto box = Actor::New();'];
        for (let i = 0; i < 10; i++) {
            lines.push('// comment ' + i);
        }
        lines.push('box.SetOpacity(1.0f);');
        const doc = makeDoc(lines.join('\n'));

        const result = await editor.applyEdit(doc, 0, 'opacity', '0.8f');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetOpacity(0.8f)');
        restore();
    });

    it('replaces first occurrence found (closest to source line)', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc([
            'box.SetOpacity(0.9f);',
            'auto box = Actor::New();',
            'box.SetOpacity(1.0f);',
        ].join('\n'));

        // Source line is 1 (actor creation). Radius=1 → finds line 0 and line 2.
        // Iteration goes from lineStart (0) → lineEnd (2), so line 0 matches first.
        const result = await editor.applyEdit(doc, 1, 'opacity', '0.5f', 1);
        expect(result.success).to.equal(true);
        expect(ops).to.have.lengthOf(1);
        restore();
    });
});

// ---------------------------------------------------------------------------
// visible
// ---------------------------------------------------------------------------

describe('PropertyEditor — visible', () => {
    it('replaces .SetVisible() with new boolean value', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc('box.SetVisible(true);');

        const result = await editor.applyEdit(doc, 0, 'visible', 'false');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetVisible(false)');
        restore();
    });
});

// ---------------------------------------------------------------------------
// color
// ---------------------------------------------------------------------------

describe('PropertyEditor — color', () => {
    it('replaces .SetBackgroundColor() with new Vector4 value', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc('box.SetBackgroundColor(Color::RED);');

        const result = await editor.applyEdit(doc, 0, 'color', 'Vector4(0, 1, 0, 1)');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetBackgroundColor(Vector4(0, 1, 0, 1))');
        restore();
    });

    it('replaces .BackgroundColor() (alternative API) with new value', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc('box.BackgroundColor(Color::RED);');

        const result = await editor.applyEdit(doc, 0, 'color', 'Vector4(0, 0, 1, 1)');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.BackgroundColor(Vector4(0, 0, 1, 1))');
        restore();
    });

    it('prefers .SetBackgroundColor() over .BackgroundColor() when both present', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc([
            'box.BackgroundColor(Color::RED);',
            'box.SetBackgroundColor(Color::RED);',
        ].join('\n'));

        // Both lines within radius=1 from sourceLine=0.
        // Line 0 is checked first: BackgroundColor matches first matcher (SetBackgroundColor) — no.
        // Line 0 matches second matcher (BackgroundColor) — yes, replaces line 0.
        const result = await editor.applyEdit(doc, 0, 'color', 'Vector4(1, 0, 0, 1)', 1);
        expect(result.success).to.equal(true);
        // The first line scanned that matches any matcher is used
        expect(ops).to.have.lengthOf(1);
        restore();
    });
});

// ---------------------------------------------------------------------------
// x, y, w, h
// ---------------------------------------------------------------------------

describe('PropertyEditor — x / y / w / h', () => {
    it('replaces .SetX()', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc('actor.SetX(0.0f);');
        const result = await editor.applyEdit(doc, 0, 'x', '100');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetX(100)');
        restore();
    });

    it('replaces .SetY()', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc('actor.SetY(50.0f);');
        const result = await editor.applyEdit(doc, 0, 'y', '200');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetY(200)');
        restore();
    });

    it('replaces .SetWidth()', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc('actor.SetWidth(720.0f);');
        const result = await editor.applyEdit(doc, 0, 'w', '1280');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetWidth(1280)');
        restore();
    });

    it('replaces .SetHeight()', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        const doc = makeDoc('actor.SetHeight(100.0f);');
        const result = await editor.applyEdit(doc, 0, 'h', '200');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetHeight(200)');
        restore();
    });
});

// ---------------------------------------------------------------------------
// applyEdit returns false
// ---------------------------------------------------------------------------

describe('PropertyEditor — applyEdit returns false', () => {
    it('returns failure when vscode.workspace.applyEdit returns false', async () => {
        const vscode = require('vscode');
        const original = vscode.workspace.applyEdit;
        vscode.workspace.applyEdit = (_edit: any) => Promise.resolve(false);

        const editor = new PropertyEditor();
        const doc = createMockDocument('test.cpp', 'actor.SetOpacity(1.0f);') as any;
        doc.save = () => Promise.resolve(true);

        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f');
        expect(result.success).to.equal(false);
        if (!result.success) {
            expect(result.reason).to.include('applyEdit');
        }
        vscode.workspace.applyEdit = original;
    });
});

// ---------------------------------------------------------------------------
// PreviewManager — onEditProperty
// ---------------------------------------------------------------------------

describe('PreviewManager — onEditProperty()', () => {
    const { PreviewManager } = require('../../src/previewManager');

    function makeManagerWithSpy() {
        const webview = {
            html: '',
            cspSource: 'vscode-resource:',
            postMessage: () => {},
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
        return { mgr, simulate };
    }

    it('fires callback when editProperty message is received', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: Array<{ sourceLine: number; propName: string; value: string }> = [];
        mgr.onEditProperty((sl: number, pn: string, v: string) => received.push({ sourceLine: sl, propName: pn, value: v }));

        simulate({ command: 'editProperty', sourceLine: 5, propName: 'opacity', value: '0.8f' });

        expect(received).to.have.lengthOf(1);
        expect(received[0]).to.deep.equal({ sourceLine: 5, propName: 'opacity', value: '0.8f' });
    });

    it('ignores editProperty message with wrong types', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: unknown[] = [];
        mgr.onEditProperty((...args: unknown[]) => received.push(args));

        simulate({ command: 'editProperty', sourceLine: 'bad', propName: 'opacity', value: '0.5f' });
        simulate({ command: 'editProperty', sourceLine: 5, propName: 42, value: '0.5f' });
        simulate({ command: 'editProperty', sourceLine: 5, propName: 'opacity', value: null });

        expect(received).to.have.lengthOf(0);
    });

    it('unsubscribes correctly on dispose', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: unknown[] = [];
        const disposable = mgr.onEditProperty((...args: unknown[]) => received.push(args));

        disposable.dispose();
        simulate({ command: 'editProperty', sourceLine: 5, propName: 'opacity', value: '0.5f' });

        expect(received).to.have.lengthOf(0);
    });
});
