import * as vscode from 'vscode';
import { DEFAULT_IMAGE_TAG } from './dockerRuntime';
import { GHCR_IMAGE, detectDefaultImage } from './registry';

/** globalState key + TTL for the cached auto-detected runtime image. */
const AUTO_IMAGE_KEY = 'daliPreview.autoImage';
const AUTO_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Centralized access to `daliPreview.*` workspace configuration values.
 *
 * All property reads go through `vscode.workspace.getConfiguration('daliPreview')`
 * so they always reflect the latest settings. Use `ConfigurationService.getInstance()`
 * to obtain the singleton.
 */
export class ConfigurationService {
    private static _instance: ConfigurationService | undefined;
    /** Auto-detected runtime image (BART proxy on the corp network, else GHCR). */
    private static _autoImage: string | undefined;
    /** Bridges the read-after-write lag on `daliVersionTag` (see the getter). */
    private static _versionTagOverride: string | undefined;

    /**
     * Timestamp of the last EXTENSION-initiated runtimeMode write (via {@link update}).
     * The activate() runtimeMode config listener uses it to tell an external Settings-UI
     * edit (should prompt a reload) from one of our own switch commands (which already
     * prompt) — see {@link wasRecentSelfRuntimeModeWrite} / shouldPromptRuntimeModeReload.
     */
    private static _selfRuntimeModeWriteAt = 0;

    /** True if the extension itself wrote runtimeMode within the debounce window. */
    static wasRecentSelfRuntimeModeWrite(): boolean {
        return Date.now() - ConfigurationService._selfRuntimeModeWriteAt < 3000;
    }

    /**
     * The runtime mode actually in effect — the backend built at activation. The backend
     * is frozen until a window reload, so the panel title must show THIS, not the live
     * setting: after an edit-without-reload (e.g. "Switch Here" when the reload prompt is
     * dismissed, or a direct settings edit) the live value would make the title lie about
     * what is rendering. Set once per activation from `backend.kind`. (task-2 Hole 3)
     */
    private static _activeRuntimeMode: 'docker' | 'local' | undefined;

    static setActiveRuntimeMode(mode: 'docker' | 'local' | undefined): void {
        ConfigurationService._activeRuntimeMode = mode;
    }

    /** The active (frozen) runtime mode; falls back to the live setting before activation sets it. */
    getActiveRuntimeMode(): 'docker' | 'local' {
        return ConfigurationService._activeRuntimeMode ?? this.runtimeMode;
    }

    /** Drop the daliVersionTag override so config becomes the source of truth again.
     *  Wired to onDidChangeConfiguration('daliPreview.daliVersionTag') in activate(),
     *  which fires once VS Code's config model reflects the write (or an external edit). */
    static clearVersionTagOverride(): void {
        ConfigurationService._versionTagOverride = undefined;
    }

    static getInstance(): ConfigurationService {
        if (!ConfigurationService._instance) {
            ConfigurationService._instance = new ConfigurationService();
        }
        return ConfigurationService._instance;
    }

    private getConfig(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('daliPreview');
    }

    /** The value the user explicitly set for `daliPreview.dockerImage`, or undefined. */
    private explicitDockerImage(): string | undefined {
        const i = this.getConfig().inspect<string>('dockerImage');
        const v = i?.workspaceFolderValue ?? i?.workspaceValue ?? i?.globalValue;
        return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
    }

    /**
     * Resolve the auto-detected runtime image ONCE and cache it in globalState with a
     * 24h TTL, so activation stays instant and only a cold/stale cache pays the ~<2s
     * reachability probe. No-op when the user pinned `daliPreview.dockerImage`. Call
     * early in activate(), before constructing DockerRuntime.
     */
    static async ensureAutoImage(context: vscode.ExtensionContext): Promise<void> {
        const svc = ConfigurationService.getInstance();
        if (svc.explicitDockerImage()) {
            return; // user chose a registry — nothing to detect
        }
        const cached = context.globalState.get<{ image: string; ts: number }>(AUTO_IMAGE_KEY);
        if (cached && typeof cached.image === 'string' && Date.now() - cached.ts < AUTO_IMAGE_TTL_MS) {
            ConfigurationService._autoImage = cached.image;
            return;
        }
        const image = await detectDefaultImage();
        ConfigurationService._autoImage = image;
        await context.globalState.update(AUTO_IMAGE_KEY, { image, ts: Date.now() });
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

    /**
     * The runtime image to pull. An explicit `daliPreview.dockerImage` wins; otherwise
     * the auto-detected image ({@link ConfigurationService.ensureAutoImage}) — the BART
     * GHCR proxy on the corporate network, else GHCR. Falls back to GHCR before
     * detection has run.
     */
    get dockerImage(): string {
        return this.explicitDockerImage() ?? ConfigurationService._autoImage ?? GHCR_IMAGE;
    }

    /**
     * The runtime image tag. Prefers an in-memory override set by {@link update} —
     * VS Code's `getConfiguration().get()` can lag a just-awaited `update()` by a
     * tick or two, and the runtime-switch flow reads this back IMMEDIATELY (to pull
     * the picked tag and restart the server). Without the override the switch pulls
     * the STALE tag (e.g. re-pulls a broken `latest` instead of the version you
     * picked). The override is cleared once config catches up (see
     * {@link clearVersionTagOverride}, wired to onDidChangeConfiguration in activate()).
     */
    get daliVersionTag(): string {
        return ConfigurationService._versionTagOverride
            ?? this.getConfig().get<string>('daliVersionTag', DEFAULT_IMAGE_TAG);
    }

    get runtimeUpdatePolicy(): 'off' | 'notify' | 'auto' {
        const v = this.getConfig().get<string>('runtimeUpdatePolicy', 'notify');
        return v === 'off' || v === 'auto' ? v : 'notify';
    }

    /**
     * How to handle a newer *extension* release on GitHub (checked once per day).
     * No 'auto': a running extension can't hot-swap itself and the installer runs
     * in a terminal the user confirms. See extensionUpdateChecker.ts.
     */
    get extensionUpdatePolicy(): 'off' | 'notify' {
        return this.getConfig().get<string>('extensionUpdatePolicy', 'notify') === 'off' ? 'off' : 'notify';
    }

    get previewWidth(): number {
        // Default to the TV FHD profile (1920×1080) — DALi UI apps target the TV.
        return this.getConfig().get<number>('previewWidth', 1920);
    }

    get previewHeight(): number {
        return this.getConfig().get<number>('previewHeight', 1080);
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
        // Bridge the read-after-write lag: make an immediate re-read of daliVersionTag
        // (the runtime-switch pull + server restart) see the new value, not the stale
        // one. Cleared by the onDidChangeConfiguration listener once config catches up.
        if (key === 'daliVersionTag' && typeof value === 'string') {
            ConfigurationService._versionTagOverride = value;
        }
        // Mark our own runtimeMode writes so the activate() config listener does not
        // double-prompt a reload (the switch commands already prompt); an EXTERNAL
        // Settings edit never goes through update(), so the listener still fires for it.
        if (key === 'runtimeMode') {
            ConfigurationService._selfRuntimeModeWriteAt = Date.now();
        }
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
