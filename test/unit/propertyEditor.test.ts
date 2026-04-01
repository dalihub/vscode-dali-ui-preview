import { expect } from 'chai';
import { PropertyEditor, EDITABLE_PROPS } from '../../src/propertyEditor';
import { createMockDocument } from '../helpers/mockDocument';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a PropertyEditor with a controllable applyEdit mock.
 * Returns captured WorkspaceEdit ops so tests can inspect what was replaced.
 * `restore` MUST be called in afterEach to avoid mock leakage across tests (H7).
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
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('returns failure for an unrecognised property name', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.DoSomething();');
        const result = await editor.applyEdit(doc, 0, 'unknownProp', '42');
        expect(result.success).to.equal(false);
        if (!result.success) {
            expect(result.reason).to.include('unknownProp');
        }
    });
});

// ---------------------------------------------------------------------------
// Input validation (H1, H8)
// ---------------------------------------------------------------------------

describe('PropertyEditor — input validation', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('returns failure for empty newValue (H8)', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetProperty(Actor::Property::OPACITY, 1.0f);');
        const result = await editor.applyEdit(doc, 0, 'opacity', '');
        expect(result.success).to.equal(false);
    });

    it('returns failure for non-numeric x value', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetPosition(0.0f, 0.0f);');
        const result = await editor.applyEdit(doc, 0, 'x', 'rm -rf /');
        expect(result.success).to.equal(false);
    });

    it('returns failure for non-boolean visible value', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetVisible(true);');
        const result = await editor.applyEdit(doc, 0, 'visible', 'yes');
        expect(result.success).to.equal(false);
    });

    it('returns failure for malformed color value', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetBackgroundColor(Color::RED);');
        const result = await editor.applyEdit(doc, 0, 'color', 'invalid_color');
        expect(result.success).to.equal(false);
    });
});

// ---------------------------------------------------------------------------
// sourceLine clamping (H9)
// ---------------------------------------------------------------------------

describe('PropertyEditor — sourceLine clamping', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('clamps negative sourceLine to 0 and still finds the setter (H9)', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetProperty(Actor::Property::OPACITY, 1.0f);');
        const result = await editor.applyEdit(doc, -1, 'opacity', '0.5f');
        expect(result.success).to.equal(true);
        expect(ops).to.have.lengthOf(1);
    });
});

// ---------------------------------------------------------------------------
// doc.save() must NOT be called (H2 / H10)
// ---------------------------------------------------------------------------

describe('PropertyEditor — no doc.save() after edit', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('does not call doc.save() on success — avoids double build (H2/H10)', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetProperty(Actor::Property::OPACITY, 1.0f);') as any;
        let saveCalled = false;
        doc.save = () => { saveCalled = true; return Promise.resolve(true); };
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f');
        expect(result.success).to.equal(true);
        expect(saveCalled).to.equal(false);
    });
});

// ---------------------------------------------------------------------------
// Setter not found
// ---------------------------------------------------------------------------

describe('PropertyEditor — setter not found', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('returns failure when no matching setter exists within search radius', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc([
            'auto box = Actor::New();',
            '// no SetProperty OPACITY call here',
        ].join('\n'));
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f');
        expect(result.success).to.equal(false);
    });

    it('returns failure when setter is outside search radius', async () => {
        const { editor, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        // Put the setter 30 lines away (beyond default radius of 20)
        const lines = Array(30).fill('// pad');
        lines.push('actor.SetProperty(Actor::Property::OPACITY, 1.0f);');
        const doc = makeDoc(lines.join('\n'));
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f', 20);
        expect(result.success).to.equal(false);
    });
});

// ---------------------------------------------------------------------------
// opacity — SetProperty(Actor::Property::OPACITY, v) primary (C1)
// ---------------------------------------------------------------------------

describe('PropertyEditor — opacity', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('replaces SetProperty(Actor::Property::OPACITY, ...) on the same line', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc([
            'auto box = Actor::New(); // __L0',
            'box.SetProperty(Actor::Property::OPACITY, 1.0f);',
        ].join('\n'));
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f');
        expect(result.success).to.equal(true);
        expect(ops).to.have.lengthOf(1);
        expect(ops[0].newText).to.equal('.SetProperty(Actor::Property::OPACITY, 0.5f)');
    });

    it('falls back to .SetOpacity() when SetProperty not present', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('box.SetOpacity(1.0f);');
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.8f');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetOpacity(0.8f)');
    });

    it('finds SetProperty OPACITY within default search radius', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const lines = ['auto box = Actor::New();'];
        for (let i = 0; i < 10; i++) {
            lines.push('// comment ' + i);
        }
        lines.push('box.SetProperty(Actor::Property::OPACITY, 1.0f);');
        const doc = makeDoc(lines.join('\n'));
        const result = await editor.applyEdit(doc, 0, 'opacity', '0.8f');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetProperty(Actor::Property::OPACITY, 0.8f)');
    });

    it('replaces first occurrence found', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc([
            'box.SetProperty(Actor::Property::OPACITY, 0.9f);',
            'auto box = Actor::New();',
            'box.SetProperty(Actor::Property::OPACITY, 1.0f);',
        ].join('\n'));
        const result = await editor.applyEdit(doc, 1, 'opacity', '0.5f', 1);
        expect(result.success).to.equal(true);
        expect(ops).to.have.lengthOf(1);
    });
});

// ---------------------------------------------------------------------------
// visible
// ---------------------------------------------------------------------------

describe('PropertyEditor — visible', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('replaces .SetVisible() with new boolean value', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('box.SetVisible(true);');
        const result = await editor.applyEdit(doc, 0, 'visible', 'false');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetVisible(false)');
    });
});

// ---------------------------------------------------------------------------
// color — SetBackgroundColor with nested parentheses (C1, C2)
// ---------------------------------------------------------------------------

describe('PropertyEditor — color', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('replaces .SetBackgroundColor() with new Vector4 value', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('box.SetBackgroundColor(Color::RED);');
        const result = await editor.applyEdit(doc, 0, 'color', 'Vector4(0, 1, 0, 1)');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetBackgroundColor(Vector4(0, 1, 0, 1))');
    });

    it('replaces .SetBackgroundColor() when value uses UiColor nested parens (C2)', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('box.SetBackgroundColor(UiColor(0x6C63FFFF));');
        const result = await editor.applyEdit(doc, 0, 'color', 'Vector4(0.4235f, 0.3882f, 1.0000f, 1.0000f)');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.include('.SetBackgroundColor(Vector4(');
    });

    it('replaces .SetBackgroundColor() when value uses Vector4 nested parens (C2)', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('box.SetBackgroundColor(Vector4(0.42f, 0.39f, 1.0f, 1.0f));');
        const result = await editor.applyEdit(doc, 0, 'color', 'Vector4(1.0000f, 0.0000f, 0.0000f, 1.0000f)');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetBackgroundColor(Vector4(1.0000f, 0.0000f, 0.0000f, 1.0000f))');
    });
});

// ---------------------------------------------------------------------------
// x, y — SetPosition(x, y) editing preserves the other arg (C1)
// ---------------------------------------------------------------------------

describe('PropertyEditor — x / y via SetPosition', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('replaces x in .SetPosition(x, y) while preserving y', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetPosition(0.0f, 100.0f);');
        const result = await editor.applyEdit(doc, 0, 'x', '50');
        expect(result.success).to.equal(true);
        expect(ops).to.have.lengthOf(1);
        expect(ops[0].newText).to.equal('.SetPosition(50, 100.0f)');
    });

    it('replaces y in .SetPosition(x, y) while preserving x', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetPosition(10.0f, 50.0f);');
        const result = await editor.applyEdit(doc, 0, 'y', '200');
        expect(result.success).to.equal(true);
        expect(ops).to.have.lengthOf(1);
        expect(ops[0].newText).to.equal('.SetPosition(10.0f, 200)');
    });
});

// ---------------------------------------------------------------------------
// w, h — SetRequestedWidth / SetRequestedHeight and SetSize fallback (C1)
// ---------------------------------------------------------------------------

describe('PropertyEditor — w / h', () => {
    let restoreFn: (() => void) | undefined;
    afterEach(() => { restoreFn?.(); restoreFn = undefined; });

    it('replaces .SetRequestedWidth()', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('view.SetRequestedWidth(720.0f);');
        const result = await editor.applyEdit(doc, 0, 'w', '1280');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetRequestedWidth(1280)');
    });

    it('replaces .SetRequestedHeight()', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('view.SetRequestedHeight(100.0f);');
        const result = await editor.applyEdit(doc, 0, 'h', '200');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetRequestedHeight(200)');
    });

    it('falls back to .SetSize(w, h) for w — preserves h', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetSize(720.0f, 100.0f);');
        const result = await editor.applyEdit(doc, 0, 'w', '1280');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetSize(1280, 100.0f)');
    });

    it('falls back to .SetSize(w, h) for h — preserves w', async () => {
        const { editor, ops, makeDoc, restore } = makeEditor();
        restoreFn = restore;
        const doc = makeDoc('actor.SetSize(720.0f, 100.0f);');
        const result = await editor.applyEdit(doc, 0, 'h', '200');
        expect(result.success).to.equal(true);
        expect(ops[0].newText).to.equal('.SetSize(720.0f, 200)');
    });
});

// ---------------------------------------------------------------------------
// applyEdit returns false
// ---------------------------------------------------------------------------

describe('PropertyEditor — applyEdit returns false', () => {
    let originalApply: any;
    afterEach(() => {
        if (originalApply) {
            require('vscode').workspace.applyEdit = originalApply;
            originalApply = undefined;
        }
    });

    it('returns failure when vscode.workspace.applyEdit returns false', async () => {
        const vscode = require('vscode');
        originalApply = vscode.workspace.applyEdit;
        vscode.workspace.applyEdit = (_edit: any) => Promise.resolve(false);

        const editor = new PropertyEditor();
        const doc = createMockDocument('test.cpp', 'actor.SetProperty(Actor::Property::OPACITY, 1.0f);') as any;
        doc.save = () => Promise.resolve(true);

        const result = await editor.applyEdit(doc, 0, 'opacity', '0.5f');
        expect(result.success).to.equal(false);
        if (!result.success) {
            expect(result.reason).to.include('applyEdit');
        }
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
