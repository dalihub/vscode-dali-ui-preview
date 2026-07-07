import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { PreviewManager } from '../../src/previewManager';

/*
 * Task 3: the preview ("DALi review") webview shows the installed extension version in
 * its footer. The version is injected by substituting the {{extensionVersion}} placeholder
 * in media/preview.html with context.extension.packageJSON.version. These guard both ends:
 * the placeholder must exist in the HTML, and PreviewManager must fill it (never leave the
 * literal token visible to the user).
 */
const REPO_ROOT = path.join(__dirname, '..', '..', '..'); // out/test/unit → repo root

function showWithVersion(version: string): string {
    const webview = {
        html: '',
        cspSource: 'vscode-resource:',
        postMessage: () => {},
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        asWebviewUri: (u: any) => u,
    };
    const panel = {
        webview,
        reveal: () => {},
        onDidDispose: () => ({ dispose: () => {} }),
        dispose: () => {},
        visible: true,
    };
    const vscode = require('vscode');
    const saved = vscode.window.createWebviewPanel;
    vscode.window.createWebviewPanel = () => panel;
    const ctx = {
        extensionPath: REPO_ROOT,
        subscriptions: [],
        workspaceState: { get: () => undefined, update: () => {} },
        extension: { packageJSON: { version } },
    } as any;
    try {
        new PreviewManager(ctx).show();
    } finally {
        vscode.window.createWebviewPanel = saved;
    }
    return webview.html;
}

describe('PreviewManager — webview version footer (task 3)', () => {
    it('media/preview.html carries the {{extensionVersion}} placeholder', () => {
        const html = fs.readFileSync(path.join(REPO_ROOT, 'media', 'preview.html'), 'utf-8');
        expect(html).to.contain('{{extensionVersion}}');
    });

    it('substitutes the running extension version into the footer', () => {
        const html = showWithVersion('9.9.9-test');
        expect(html).to.contain('DALi Preview v9.9.9-test');
    });

    it('never leaves the literal {{extensionVersion}} token in the rendered HTML', () => {
        const html = showWithVersion('1.2.3');
        expect(html).to.not.contain('{{extensionVersion}}');
    });
});
