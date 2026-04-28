import * as vscode from 'vscode';

/**
 * Centralized access to `daliPreview.*` workspace configuration values.
 *
 * All property reads go through `vscode.workspace.getConfiguration('daliPreview')`
 * so they always reflect the latest settings. Use `ConfigurationService.getInstance()`
 * to obtain the singleton.
 */
export class ConfigurationService {
    private static _instance: ConfigurationService | undefined;

    static getInstance(): ConfigurationService {
        if (!ConfigurationService._instance) {
            ConfigurationService._instance = new ConfigurationService();
        }
        return ConfigurationService._instance;
    }

    private getConfig(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('daliPreview');
    }

    get daliPrefix(): string {
        return this.getConfig().get<string>('daliPrefix', '');
    }

    get previewWidth(): number {
        return this.getConfig().get<number>('previewWidth', 1024);
    }

    get previewHeight(): number {
        return this.getConfig().get<number>('previewHeight', 600);
    }

    get livePreview(): boolean {
        return this.getConfig().get<boolean>('livePreview', true);
    }

    get livePreviewDebounce(): number {
        return this.getConfig().get<number>('livePreviewDebounce', 300);
    }

    get background(): string {
        return this.getConfig().get<string>('background', 'dark');
    }

    get vncPort(): number {
        return this.getConfig().get<number>('vncPort', 5900);
    }

    get websocketPort(): number {
        return this.getConfig().get<number>('websocketPort', 6080);
    }

    get sdbPath(): string {
        return this.getConfig().get<string>('sdbPath', '');
    }

    get tizenSysroot(): string {
        return this.getConfig().get<string>('tizenSysroot', '');
    }

    get targetDevice(): string {
        return this.getConfig().get<string>('targetDevice', '');
    }

    get fontDirectories(): string[] {
        return this.getConfig().get<string[]>('fontDirectories', []);
    }

    get logLevel(): string {
        return this.getConfig().get<string>('logLevel', 'info');
    }

    /**
     * When true, the preview-server / dlopen / parser fast paths are skipped and
     * every preview falls through to the full g++ harness compile (~1100ms).
     * Diagnostic-only — used to measure or test the slow path. Default false.
     */
    get disablePreviewServer(): boolean {
        return this.getConfig().get<boolean>('disablePreviewServer', false);
    }

    /** Update a setting value */
    async update(key: string, value: unknown, target?: vscode.ConfigurationTarget): Promise<void> {
        await this.getConfig().update(key, value, target);
    }
}
