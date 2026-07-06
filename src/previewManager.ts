import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MultiPreviewResult } from './previewConfig';
import { getLogger } from './logger';
import { ConfigurationService } from './configurationService';

/**
 * The preview panel tab title, tagged with the live runtime so a developer who
 * switched runtimes (e.g. via "Select Runtime Version") can tell at a glance
 * whether the preview is rendering locally or in Docker. Docker also shows its
 * image version tag; the tag is irrelevant in local mode and is omitted.
 */
export function runtimePanelTitle(mode: 'docker' | 'local', versionTag: string): string {
    return mode === 'local'
        ? 'DALi Preview — Local'
        : `DALi Preview — Docker (${versionTag})`;
}

export class PreviewManager {
    private panel: vscode.WebviewPanel | undefined;
    private resizeCallbacks: Array<(width: number, height: number) => void> = [];
    private refreshCallbacks: Array<() => void> = [];
    private selectElementCallbacks: Array<(line: number) => void> = [];
    private themeToggleCallbacks: Array<() => void> = [];
    private bgChangeCallbacks: Array<(color: string) => void> = [];
    private inspectorToggleCallbacks: Array<(visible: boolean) => void> = [];
    private scrubCallbacks: Array<(progress: number, epoch: number) => void> = [];
    private _inspectorVisible = false;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext, private tmpDir: string = '/tmp/dali_preview') {}

    show(preserveFocus = false): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two, preserveFocus);
            return;
        }

        const mediaPath = path.join(this.context.extensionPath, 'media');

        const cfg = ConfigurationService.getInstance();
        this.panel = vscode.window.createWebviewPanel(
            'daliPreview',
            runtimePanelTitle(cfg.runtimeMode, cfg.daliVersionTag),
            { viewColumn: vscode.ViewColumn.Two, preserveFocus },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(this.tmpDir),
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

    /**
     * Update the panel tab title to the CURRENT runtime mode + version tag. Called
     * right after a runtime switch so the tab reflects the new version immediately
     * (otherwise the title only refreshes on the next render). No-op if no panel is
     * open — the title is set correctly at creation time then.
     */
    refreshRuntimeTitle(): void {
        if (!this.panel) {
            return;
        }
        const cfg = ConfigurationService.getInstance();
        this.panel.title = runtimePanelTitle(cfg.runtimeMode, cfg.daliVersionTag);
    }

    updateImage(pngPath: string, buildTimeMs: number, metadata?: object | null, isScrub = false, epoch = 0): void {
        if (!this.panel) {
            return;
        }

        const pngUri = this.panel.webview.asWebviewUri(vscode.Uri.file(pngPath));

        this.panel.webview.postMessage({
            command: 'updateImage',
            uri: pngUri.toString(),
            buildTime: buildTimeMs,
            metadata: metadata || null,
            isScrub,
            epoch,
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

            // WU-M5.5 (ADR-007 host-merge): fold any host-side provenance for this
            // variant (e.g. `focus-multiconfig`) into the metadata's top-level
            // `provenance` array so the webview badge (WU-M5.3) shows it. Creates a
            // metadata object if the build emitted none. Existing entries preserved.
            if (r.provenance && r.provenance.length > 0) {
                const meta = (item.metadata ?? {}) as { provenance?: unknown[] };
                meta.provenance = [...(meta.provenance ?? []), ...r.provenance];
                item.metadata = meta;
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

    onInspectorToggle(callback: (visible: boolean) => void): vscode.Disposable {
        this.inspectorToggleCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.inspectorToggleCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.inspectorToggleCallbacks.splice(idx, 1);
            }
        });
    }

    onScrub(callback: (progress: number, epoch: number) => void): vscode.Disposable {
        this.scrubCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.scrubCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.scrubCallbacks.splice(idx, 1);
            }
        });
    }

    /** Show the animation scrubber/play controls (preview has scrubbable animations). */
    showAnimationControls(durationMs: number, epoch = 0): void {
        this.panel?.webview.postMessage({ command: 'showAnimation', durationMs, epoch });
    }

    /** Hide the animation controls (preview has no animations). */
    hideAnimationControls(): void {
        this.panel?.webview.postMessage({ command: 'hideAnimation' });
    }

    /** Tell the webview a scrub request couldn't be served, so it releases its
     * in-flight slot immediately instead of waiting on its watchdog. */
    notifyScrubDropped(epoch: number): void {
        this.panel?.webview.postMessage({ command: 'scrubDropped', epoch });
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
        this.scrubCallbacks = [];
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
            case 'scrubAnimation': {
                const progress = message.progress as number;
                const epoch = (message.epoch as number) ?? 0;
                if (typeof progress === 'number') {
                    for (const cb of this.scrubCallbacks) {
                        cb(progress, epoch);
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
        }

        return html;
    }
}
