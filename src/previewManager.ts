import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MultiPreviewResult } from './previewConfig';

export class PreviewManager {
    private panel: vscode.WebviewPanel | undefined;
    private resizeCallbacks: Array<(width: number, height: number) => void> = [];
    private refreshCallbacks: Array<() => void> = [];
    private selectElementCallbacks: Array<(line: number) => void> = [];
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    show(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
            return;
        }

        const mediaPath = path.join(this.context.extensionPath, 'media');

        this.panel = vscode.window.createWebviewPanel(
            'daliPreview',
            'DALi Preview',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file('/tmp/dali_preview'),
                    vscode.Uri.file(mediaPath),
                ],
            }
        );

        this.panel.webview.html = this.getHtmlContent();

        const messageDisposable = this.panel.webview.onDidReceiveMessage(
            (message) => this.handleMessage(message),
            undefined,
            this.disposables
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            messageDisposable.dispose();
        }, null, this.disposables);

        this.showWelcome();
    }

    get isVisible(): boolean {
        return this.panel !== undefined;
    }

    updateImage(pngPath: string, buildTimeMs: number, metadata?: object | null): void {
        if (!this.panel) {
            return;
        }

        const pngUri = this.panel.webview.asWebviewUri(vscode.Uri.file(pngPath));

        this.panel.webview.postMessage({
            command: 'updateImage',
            uri: pngUri.toString(),
            buildTime: buildTimeMs,
            metadata: metadata || null,
        });
    }

    updateMultiImage(results: MultiPreviewResult[]): void {
        if (!this.panel) {
            return;
        }

        const images = results.map(r => {
            const item: {
                name: string;
                width?: number;
                height?: number;
                buildTime: number;
                success: boolean;
                error?: string;
                uri?: string;
                metadata?: object | null;
            } = {
                name: r.config.name,
                width: r.config.width,
                height: r.config.height,
                buildTime: r.buildTimeMs,
                success: r.success,
            };

            if (!r.success) {
                item.error = r.error;
                return item;
            }

            if (r.pngPath) {
                item.uri = this.panel!.webview.asWebviewUri(vscode.Uri.file(r.pngPath)).toString();
            }

            if (r.metadataPath) {
                try {
                    item.metadata = JSON.parse(fs.readFileSync(r.metadataPath, 'utf-8'));
                } catch { /* metadata is optional */ }
            }

            return item;
        });

        this.panel.webview.postMessage({ command: 'updateMultiImage', images });
    }

    showLoading(): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'showLoading' });
    }

    showError(message: string): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'showError', message });
    }

    showWelcome(): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'showWelcome' });
    }

    onResize(callback: (width: number, height: number) => void): vscode.Disposable {
        this.resizeCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.resizeCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.resizeCallbacks.splice(idx, 1);
            }
        });
    }

    onRefresh(callback: () => void): vscode.Disposable {
        this.refreshCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.refreshCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.refreshCallbacks.splice(idx, 1);
            }
        });
    }

    onSelectElement(callback: (line: number) => void): vscode.Disposable {
        this.selectElementCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.selectElementCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.selectElementCallbacks.splice(idx, 1);
            }
        });
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.resizeCallbacks = [];
        this.refreshCallbacks = [];
        this.selectElementCallbacks = [];
    }

    private handleMessage(message: { command: string; [key: string]: unknown }): void {
        switch (message.command) {
            case 'resize': {
                const width = message.width as number;
                const height = message.height as number;
                if (typeof width === 'number' && typeof height === 'number') {
                    for (const cb of this.resizeCallbacks) {
                        cb(width, height);
                    }
                }
                break;
            }
            case 'refresh': {
                for (const cb of this.refreshCallbacks) {
                    cb();
                }
                break;
            }
            case 'selectElement': {
                const line = message.line as number;
                if (typeof line === 'number') {
                    for (const cb of this.selectElementCallbacks) {
                        cb(line);
                    }
                }
                break;
            }
            case 'changeBackground': {
                // Background changes are handled entirely in the webview.
                // This message is available for extensions that want to persist the preference.
                break;
            }
        }
    }

    private getHtmlContent(): string {
        const htmlPath = path.join(this.context.extensionPath, 'media', 'preview.html');

        let html: string;
        try {
            html = fs.readFileSync(htmlPath, 'utf-8');
        } catch {
            return `<!DOCTYPE html>
<html><body style="background:#1e1e1e;color:#f44747;padding:24px;font-family:sans-serif;">
<h3>Error</h3><p>Could not load preview.html from extension media folder.</p>
</body></html>`;
        }

        if (this.panel) {
            html = html.replace(/\{\{cspSource\}\}/g, this.panel.webview.cspSource);
        }

        return html;
    }
}
