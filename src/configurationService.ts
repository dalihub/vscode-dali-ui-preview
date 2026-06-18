import * as vscode from 'vscode';
import { DEFAULT_DOCKER_IMAGE, DEFAULT_IMAGE_TAG } from './dockerRuntime';

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

    /**
     * Where preview builds run. 'docker' (default) uses the containerized DALi
     * runtime — no host install needed. 'local' compiles against a
     * host-installed DALi prefix (for uifw developers who rebuild DALi itself).
     */
    get runtimeMode(): 'docker' | 'local' {
        return this.getConfig().get<string>('runtimeMode', 'docker') === 'local' ? 'local' : 'docker';
    }

    /** Path to the local DALi install prefix (used only when runtimeMode is 'local'). */
    get daliPrefix(): string {
        return this.getConfig().get<string>('daliPrefix', '');
    }

    get dockerImage(): string {
        return this.getConfig().get<string>('dockerImage', DEFAULT_DOCKER_IMAGE);
    }

    get daliVersionTag(): string {
        return this.getConfig().get<string>('daliVersionTag', DEFAULT_IMAGE_TAG);
    }

    get runtimeUpdatePolicy(): 'off' | 'notify' | 'auto' {
        const v = this.getConfig().get<string>('runtimeUpdatePolicy', 'notify');
        return v === 'off' || v === 'auto' ? v : 'notify';
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

/**
 * Whether the host needs a virtual X server (Xvfb) for the given runtime mode.
 *
 * Only the 'local' runtime renders on the host (compiling against a host DALi
 * prefix under Xvfb). In 'docker' mode the container image carries its own X
 * server, so the extension must NOT start host Xvfb — doing so only emits a
 * spurious "Xvfb is not installed" warning to users who never need it.
 */
export function hostXvfbNeeded(runtimeMode: 'docker' | 'local'): boolean {
    return runtimeMode === 'local';
}
