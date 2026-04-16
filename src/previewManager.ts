import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MultiPreviewResult } from './previewConfig';
import { EDITABLE_PROPS } from './propertyEditor';
import { getLogger } from './logger';

export class PreviewManager {
    private panel: vscode.WebviewPanel | undefined;
    private resizeCallbacks: Array<(width: number, height: number) => void> = [];
    private refreshCallbacks: Array<() => void> = [];
    private selectElementCallbacks: Array<(line: number) => void> = [];
    private themeToggleCallbacks: Array<() => void> = [];
    private bgChangeCallbacks: Array<(color: string) => void> = [];
    private inspectorToggleCallbacks: Array<(visible: boolean) => void> = [];
    private editPropertyCallbacks: Array<(sourceLine: number, propName: string, value: string) => void> = [];
    private startVncCallbacks: Array<() => void> = [];
    private stopVncCallbacks: Array<() => void> = [];
    private vncConnectedCallbacks: Array<() => void> = [];
    private vncDisconnectedCallbacks: Array<(reason: string) => void> = [];
    private animationSpeedChangeCallbacks: Array<(speed: number) => void> = [];
    private _inspectorVisible = false;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext, private tmpDir: string = '/tmp/dali_preview') {}

    show(preserveFocus = false): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two, preserveFocus);
            return;
        }

        const mediaPath = path.join(this.context.extensionPath, 'media');

        this.panel = vscode.window.createWebviewPanel(
            'daliPreview',
            'DALi Preview',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(this.tmpDir),
                    vscode.Uri.file(mediaPath),
                    vscode.Uri.file(path.join(mediaPath, 'vendor', 'noVNC')),
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

    updateAnimation(
        gifOrPngPath: string,
        buildTimeMs: number,
        frameCount: number,
        metadata?: object | null
    ): void {
        if (!this.panel) {
            return;
        }

        const isGif = gifOrPngPath.endsWith('.gif');
        const uri = this.panel.webview.asWebviewUri(vscode.Uri.file(gifOrPngPath));

        this.panel.webview.postMessage({
            command: 'updateAnimation',
            uri: uri.toString(),
            buildTime: buildTimeMs,
            frameCount,
            isGif,
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
                } catch (err) { getLogger().trace('Webview', 'multi-preview metadata read skipped', { error: String(err) }); }
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

    clearError(): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'clearError' });
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

    setTheme(theme: 'light' | 'dark'): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'setTheme', theme });
    }

    setBackgroundColor(color: string): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'setBackgroundColor', color });
    }

    highlightElement(line: number): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'highlightElement', line });
    }

    /** Show the VNC toggle button in the webview toolbar. */
    notifyVncAvailable(): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'vncAvailable' });
    }

    /** Tell webview to switch to VNC mode and connect to wsUrl. */
    startVncMode(wsUrl: string): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'startVnc', wsUrl });
    }

    /** Tell webview to switch back to static PNG mode. */
    stopVncMode(): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'stopVnc' });
    }

    /** Tell webview that the DALi app is reloading (hot reload). */
    notifyVncReloading(): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'vncReloading' });
    }

    /** Tell webview that hot reload is done — reconnect VNC. */
    notifyVncReloaded(wsUrl: string): void {
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'vncReloaded', wsUrl });
    }

    onStartVnc(callback: () => void): vscode.Disposable {
        this.startVncCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.startVncCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.startVncCallbacks.splice(idx, 1);
            }
        });
    }

    onStopVnc(callback: () => void): vscode.Disposable {
        this.stopVncCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.stopVncCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.stopVncCallbacks.splice(idx, 1);
            }
        });
    }

    onVncConnected(callback: () => void): vscode.Disposable {
        this.vncConnectedCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.vncConnectedCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.vncConnectedCallbacks.splice(idx, 1);
            }
        });
    }

    onVncDisconnected(callback: (reason: string) => void): vscode.Disposable {
        this.vncDisconnectedCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.vncDisconnectedCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.vncDisconnectedCallbacks.splice(idx, 1);
            }
        });
    }

    onAnimationSpeedChange(callback: (speed: number) => void): vscode.Disposable {
        this.animationSpeedChangeCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.animationSpeedChangeCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.animationSpeedChangeCallbacks.splice(idx, 1);
            }
        });
    }

    setInspectorVisible(visible: boolean): void {
        this._inspectorVisible = visible;
        if (!this.panel) {
            return;
        }
        this.panel.webview.postMessage({ command: 'setInspectorVisible', visible });
    }

    onBackgroundChange(callback: (color: string) => void): vscode.Disposable {
        this.bgChangeCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.bgChangeCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.bgChangeCallbacks.splice(idx, 1);
            }
        });
    }

    onThemeToggle(callback: () => void): vscode.Disposable {
        this.themeToggleCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.themeToggleCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.themeToggleCallbacks.splice(idx, 1);
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

    onEditProperty(callback: (sourceLine: number, propName: string, value: string) => void): vscode.Disposable {
        this.editPropertyCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.editPropertyCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.editPropertyCallbacks.splice(idx, 1);
            }
        });
    }

    onInspectorToggle(callback: (visible: boolean) => void): vscode.Disposable {
        this.inspectorToggleCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.inspectorToggleCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.inspectorToggleCallbacks.splice(idx, 1);
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
        this.themeToggleCallbacks = [];
        this.bgChangeCallbacks = [];
        this.inspectorToggleCallbacks = [];
        this.editPropertyCallbacks = [];
        this.startVncCallbacks = [];
        this.stopVncCallbacks = [];
        this.vncConnectedCallbacks = [];
        this.vncDisconnectedCallbacks = [];
        this.animationSpeedChangeCallbacks = [];
    }

    private handleMessage(message: { command: string; [key: string]: unknown }): void {
        const log = getLogger();
        log.trace('Webview', 'message received', { command: message.command });
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
                const color = message.color as string;
                if (typeof color === 'string') {
                    for (const cb of this.bgChangeCallbacks) {
                        cb(color);
                    }
                }
                break;
            }
            case 'toggleTheme': {
                for (const cb of this.themeToggleCallbacks) {
                    cb();
                }
                break;
            }
            case 'inspectorToggle': {
                if (typeof message.visible === 'boolean') {
                    this._inspectorVisible = message.visible;
                    for (const cb of this.inspectorToggleCallbacks) {
                        cb(message.visible);
                    }
                }
                break;
            }
            case 'editProperty': {
                const sourceLine = message.sourceLine as number;
                const propName = message.propName as string;
                const value = message.value as string;
                if (
                    typeof sourceLine === 'number' &&
                    Number.isInteger(sourceLine) &&
                    typeof propName === 'string' &&
                    EDITABLE_PROPS.includes(propName) &&
                    typeof value === 'string'
                ) {
                    for (const cb of this.editPropertyCallbacks) {
                        cb(sourceLine, propName, value);
                    }
                }
                break;
            }
            case 'webviewReady': {
                if (this._inspectorVisible) {
                    this.panel?.webview.postMessage({ command: 'setInspectorVisible', visible: true });
                }
                break;
            }
            case 'startVnc': {
                for (const cb of this.startVncCallbacks) {
                    cb();
                }
                break;
            }
            case 'stopVnc': {
                for (const cb of this.stopVncCallbacks) {
                    cb();
                }
                break;
            }
            case 'vncConnected': {
                for (const cb of this.vncConnectedCallbacks) {
                    cb();
                }
                break;
            }
            case 'vncDisconnected': {
                const reason = (message.reason as string) || '';
                for (const cb of this.vncDisconnectedCallbacks) {
                    cb(reason);
                }
                break;
            }
            case 'animationSpeedChange': {
                const speed = message.speed as number;
                if (typeof speed === 'number' && speed > 0) {
                    for (const cb of this.animationSpeedChangeCallbacks) {
                        cb(speed);
                    }
                }
                break;
            }
        }
    }

    private getHtmlContent(): string {
        const htmlPath = path.join(this.context.extensionPath, 'media', 'preview.html');

        let html: string;
        try {
            html = fs.readFileSync(htmlPath, 'utf-8');
        } catch (err) {
            getLogger().trace('Webview', 'preview.html read failed', { error: String(err) });
            return `<!DOCTYPE html>
<html><body style="background:#1e1e1e;color:#f44747;padding:24px;font-family:sans-serif;">
<h3>Error</h3><p>Could not load preview.html from extension media folder.</p>
</body></html>`;
        }

        if (this.panel) {
            html = html.replace(/\{\{cspSource\}\}/g, this.panel.webview.cspSource);
            const rfbPath = path.join(this.context.extensionPath, 'media', 'vendor', 'noVNC', 'rfb.js');
            const rfbUri = this.panel.webview.asWebviewUri(vscode.Uri.file(rfbPath));
            html = html.replace(/\{\{rfbScriptUri\}\}/g, rfbUri.toString());
        }

        return html;
    }
}
