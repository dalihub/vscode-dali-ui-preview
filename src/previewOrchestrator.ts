import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BuildRunner, BuildResult } from './buildRunner';
import { PreviewServer } from './previewServer';
import { PreviewManager } from './previewManager';
import { XvfbManager } from './xvfbManager';
import { VncManager } from './vncManager';
import { SdbManager } from './sdbManager';
import { StatusBarManager } from './statusBar';
import { extractPreviewCode, extractFunctionBody, instrumentCode, isPreviewable, ExtractionResult } from './codeExtractor';
import { parseChainExpression, SceneNode } from './cppParser';
import { enrichMetadataWithFlexProps } from './flexMetadata';
import { parseGccErrors, getHarnessCodeOffset, getPluginCodeOffset, formatErrorsForDisplay, formatRawError, errorsToDiagnostics } from './errorParser';
import { PreviewConfig, MultiPreviewResult } from './previewConfig';
import { ConfigurationService } from './configurationService';
import { getLogger } from './logger';
import { PreviewMode } from './types';

// ---------------------------------------------------------------------------
// Strategy Pattern for build paths
// ---------------------------------------------------------------------------

interface PreviewStrategy {
    readonly name: PreviewMode;
    canHandle(server: PreviewServer | undefined): boolean;
    execute(
        code: string,
        extraction: ExtractionResult,
        width: number,
        height: number,
        theme: 'light' | 'dark',
        bgColor?: string,
    ): Promise<{ result: BuildResult; parserScene?: SceneNode | null }>;
}

/**
 * Phase 4-2: Parser-first path (~200ms).
 * Uses parseChainExpression + previewServer.renderJson.
 */
class ParserStrategy implements PreviewStrategy {
    readonly name: PreviewMode = 'parser';

    constructor(
        private readonly getBuildRunner: () => BuildRunner,
        private readonly getPreviewServer: () => PreviewServer | undefined,
        private readonly outputChannel: vscode.OutputChannel,
    ) {}

    canHandle(server: PreviewServer | undefined): boolean {
        return !!server?.isRunning;
    }

    async execute(
        _code: string,
        extraction: ExtractionResult,
        width: number,
        height: number,
        theme: 'light' | 'dark',
        bgColor?: string,
    ): Promise<{ result: BuildResult; parserScene?: SceneNode | null }> {
        const log = getLogger();
        const server = this.getPreviewServer();
        if (!server?.isRunning) {
            return { result: { success: false, error: 'Server not running' } };
        }

        const parseStart = Date.now();
        const scene = parseChainExpression(extraction.code, extraction.startLine);
        const parseEnd = Date.now();
        this.outputChannel.appendLine(
            `[Perf]    parse: ${parseEnd - parseStart}ms (${scene ? 'success' : 'null'})`,
        );

        if (!scene) {
            return { result: { success: false, error: 'Parse returned null' } };
        }

        const tmpDir = this.getBuildRunner().getTmpDir();
        const pngPath = path.join(tmpDir, 'preview.png');
        const metadataPath = path.join(tmpDir, 'preview_metadata.json');
        const renderStart = Date.now();
        const result = await server.renderJson(
            scene, pngPath, metadataPath, width, height, theme, bgColor,
        );
        this.outputChannel.appendLine(
            `[Perf]    renderJson: ${Date.now() - renderStart}ms (${result.success ? 'OK' : 'FAIL'})`,
        );

        if (result.success) {
            log.debug('Build', 'parser path succeeded');
            return { result, parserScene: scene };
        }

        // Parser path failed at render time
        this.outputChannel.appendLine('[Parser] renderJson failed, falling back to compile path');
        return { result: { success: false, error: 'renderJson failed' } };
    }
}

/**
 * Phase 2: dlopen server mode.
 * Uses buildRunner.compilePlugin + previewServer.reload.
 */
class DlopenStrategy implements PreviewStrategy {
    readonly name: PreviewMode = 'server';

    constructor(
        private readonly getBuildRunner: () => BuildRunner,
        private readonly getPreviewServer: () => PreviewServer | undefined,
        private readonly outputChannel: vscode.OutputChannel,
    ) {}

    canHandle(server: PreviewServer | undefined): boolean {
        return !!server?.isRunning;
    }

    async execute(
        code: string,
        _extraction: ExtractionResult,
        width: number,
        height: number,
        theme: 'light' | 'dark',
        bgColor?: string,
    ): Promise<{ result: BuildResult; parserScene?: SceneNode | null }> {
        const log = getLogger();
        const buildRunner = this.getBuildRunner();
        const server = this.getPreviewServer();
        if (!server?.isRunning) {
            return { result: { success: false, error: 'Server not running' } };
        }

        log.debug('Build', 'trying server/dlopen path');
        const compileStart = Date.now();
        const pluginResult = await buildRunner.compilePlugin(code);
        const compileEnd = Date.now();
        this.outputChannel.appendLine(
            `[Perf]    compilePlugin: ${compileEnd - compileStart}ms (${pluginResult.success ? 'OK' : 'FAIL'})`,
        );

        if (pluginResult.success && pluginResult.soPath) {
            const tmpDir = buildRunner.getTmpDir();
            const pngPath = path.join(tmpDir, 'preview.png');
            const metadataPath = path.join(tmpDir, 'preview_metadata.json');
            const reloadStart = Date.now();
            const result = await server.reload(
                pluginResult.soPath, pngPath, metadataPath, width, height, theme, bgColor,
            );
            this.outputChannel.appendLine(
                `[Perf]    server.reload (dlopen+render+screenshot): ${Date.now() - reloadStart}ms`,
            );
            return { result };
        }

        // .so compile failed -- return error for caller to handle
        return {
            result: {
                success: false,
                error: pluginResult.error || 'Plugin compile failed',
            },
        };
    }
}

/**
 * Phase 1 fallback: full harness compile + run.
 * Uses buildRunner.buildAndRun.
 */
class HarnessStrategy implements PreviewStrategy {
    readonly name: PreviewMode = 'compile';

    constructor(
        private readonly getBuildRunner: () => BuildRunner,
        private readonly outputChannel: vscode.OutputChannel,
    ) {}

    canHandle(_server: PreviewServer | undefined): boolean {
        // Always available as the final fallback
        return true;
    }

    async execute(
        code: string,
        _extraction: ExtractionResult,
        width: number,
        height: number,
        theme: 'light' | 'dark',
        bgColor?: string,
    ): Promise<{ result: BuildResult; parserScene?: SceneNode | null }> {
        const log = getLogger();
        log.debug('Build', 'trying harness compile+run path');
        const harnessStart = Date.now();
        const result = await this.getBuildRunner().buildAndRun(code, width, height, theme, bgColor);
        this.outputChannel.appendLine(
            `[Perf]    buildAndRun (full harness): ${Date.now() - harnessStart}ms`,
        );
        return { result };
    }
}

// ---------------------------------------------------------------------------
// OrchestratorDeps — injected dependencies
// ---------------------------------------------------------------------------

export interface OrchestratorDeps {
    buildRunner: BuildRunner;
    previewManager: PreviewManager;
    previewServer: PreviewServer | undefined;
    xvfbManager: XvfbManager | undefined;
    vncManager: VncManager | undefined;
    sdbManager: SdbManager | undefined;
    statusBar: StatusBarManager | undefined;
    outputChannel: vscode.OutputChannel;
    diagnosticCollection: vscode.DiagnosticCollection;
}

// ---------------------------------------------------------------------------
// PreviewOrchestrator
// ---------------------------------------------------------------------------

function sanitizeForPath(name: string): string {
    return BuildRunner.sanitizeConfigName(name);
}

export class PreviewOrchestrator {
    // Module-level state migrated from extension.ts
    private building = false;
    private isVncMode_ = false;
    private vncStarting = false;
    private hotReloading_ = false;
    private devicePreviewRunning = false;
    private buildGeneration = 0;
    private pendingRebuildDoc: vscode.TextDocument | undefined;
    private lastPreviewedDoc_: vscode.TextDocument | undefined;
    private lastTextChangeTime_ = 0;
    private lastCodeLensFunc_: { uri: string; startLine: number; endLine: number } | undefined;
    private errorDebounceTimer: ReturnType<typeof setTimeout> | undefined;
    private currentWidth_: number;
    private currentHeight_: number;
    private currentTheme_: 'light' | 'dark';
    private currentBgColor_: string | undefined;

    private deps: OrchestratorDeps;

    // Strategy instances
    private parserStrategy: ParserStrategy;
    private dlopenStrategy: DlopenStrategy;
    private harnessStrategy: HarnessStrategy;

    constructor(
        deps: OrchestratorDeps,
        initialState: { width: number; height: number; theme: 'light' | 'dark'; bgColor?: string },
    ) {
        this.deps = deps;
        this.currentWidth_ = initialState.width;
        this.currentHeight_ = initialState.height;
        this.currentTheme_ = initialState.theme;
        this.currentBgColor_ = initialState.bgColor;

        this.parserStrategy = new ParserStrategy(
            () => this.deps.buildRunner,
            () => this.deps.previewServer,
            this.deps.outputChannel,
        );
        this.dlopenStrategy = new DlopenStrategy(
            () => this.deps.buildRunner,
            () => this.deps.previewServer,
            this.deps.outputChannel,
        );
        this.harnessStrategy = new HarnessStrategy(
            () => this.deps.buildRunner,
            this.deps.outputChannel,
        );
    }

    // -----------------------------------------------------------------------
    // Getters
    // -----------------------------------------------------------------------

    get isInteractiveMode(): boolean {
        return this.isVncMode_;
    }

    get lastDocument(): vscode.TextDocument | undefined {
        return this.lastPreviewedDoc_;
    }

    get lastCodeLensFunc(): { uri: string; startLine: number; endLine: number } | undefined {
        return this.lastCodeLensFunc_;
    }

    get lastTextChangeTime(): number {
        return this.lastTextChangeTime_;
    }

    get width(): number {
        return this.currentWidth_;
    }

    get height(): number {
        return this.currentHeight_;
    }

    get theme(): 'light' | 'dark' {
        return this.currentTheme_;
    }

    get bgColor(): string | undefined {
        return this.currentBgColor_;
    }

    // -----------------------------------------------------------------------
    // Setters
    // -----------------------------------------------------------------------

    set width(w: number) {
        this.currentWidth_ = w;
    }

    set height(h: number) {
        this.currentHeight_ = h;
    }

    set theme(t: 'light' | 'dark') {
        this.currentTheme_ = t;
        this.currentBgColor_ = undefined;
    }

    set bgColor(c: string | undefined) {
        this.currentBgColor_ = c;
    }

    setLastCodeLensFunc(func: { uri: string; startLine: number; endLine: number } | undefined): void {
        this.lastCodeLensFunc_ = func;
    }

    setLastTextChangeTime(t: number): void {
        this.lastTextChangeTime_ = t;
    }

    // -----------------------------------------------------------------------
    // Dep updates (for late-initialised services)
    // -----------------------------------------------------------------------

    updatePreviewServer(server: PreviewServer | undefined): void {
        this.deps.previewServer = server;
    }

    updatePreviewManager(manager: PreviewManager): void {
        this.deps.previewManager = manager;
    }

    // -----------------------------------------------------------------------
    // Error debounce helpers
    // -----------------------------------------------------------------------

    private scheduleShowError(message: string): void {
        if (this.errorDebounceTimer !== undefined) {
            clearTimeout(this.errorDebounceTimer);
        }
        this.errorDebounceTimer = setTimeout(() => {
            this.errorDebounceTimer = undefined;
            this.deps.previewManager?.showError(message);
        }, 500);
    }

    private cancelErrorDebounce(): void {
        if (this.errorDebounceTimer !== undefined) {
            clearTimeout(this.errorDebounceTimer);
            this.errorDebounceTimer = undefined;
        }
        this.deps.previewManager?.clearError();
    }

    // -----------------------------------------------------------------------
    // Public: runPreview
    // -----------------------------------------------------------------------

    async runPreview(
        doc: vscode.TextDocument,
        livePreview = false,
        preExtracted?: ExtractionResult,
    ): Promise<void> {
        const { buildRunner, previewManager } = this.deps;
        if (!buildRunner || !previewManager) {
            return;
        }

        const log = getLogger();
        const startTime = Date.now();
        const opId = log.createOpId();
        log.debug('Extension', 'runPreview start', { livePreview, opId });

        // If a build is already in progress, queue this doc and return
        if (this.building) {
            if (livePreview) {
                this.pendingRebuildDoc = doc;
            }
            return;
        }

        // Extract code: use pre-extracted result, then try normal extraction,
        // then fall back to the last CodeLens-previewed function range.
        let extraction = preExtracted ?? extractPreviewCode(doc);
        if (!extraction && this.lastCodeLensFunc_ && this.lastCodeLensFunc_.uri === doc.uri.toString()) {
            extraction = extractFunctionBody(doc, this.lastCodeLensFunc_.startLine, this.lastCodeLensFunc_.endLine);
        }
        if (!extraction) {
            return;
        }

        log.debug('Extension', 'extraction mode selected', { mode: extraction.mode, fileName: doc.fileName });

        this.lastPreviewedDoc_ = doc;

        const myGeneration = ++this.buildGeneration;
        this.building = true;

        // For save-triggered builds show the loading overlay; live preview builds are silent
        if (!livePreview) {
            this.deps.statusBar?.showBuilding();
            previewManager.showLoading();
        }
        this.deps.diagnosticCollection.delete(doc.uri);

        this.deps.outputChannel.appendLine(`[Perf] T2 runPreview start (live=${livePreview})`);

        // Instrument code with line annotations for click-to-code
        const instrumented = instrumentCode(extraction.code, extraction.startLine);
        const instrumentTime = Date.now();
        this.deps.outputChannel.appendLine(`[Perf]    extract+instrument: ${instrumentTime - startTime}ms`);

        try {
            // Animation path: any config with animation=true triggers GIF capture
            const animConfig = extraction.configs?.find(c => c.animation === true);
            if (animConfig) {
                await this.runAnimationPreview(
                    doc, animConfig, instrumented, myGeneration, startTime, extraction.startLine,
                );
                return;
            }

            // Multi-config path: build each config independently (2+ configs)
            if (extraction.configs && extraction.configs.length > 1) {
                await this.runMultiPreview(
                    doc, extraction.configs, instrumented, extraction.startLine, myGeneration, startTime,
                );
                return;
            }

            // Single config: apply its width/height/theme but use single-preview path
            // so the full inspector and click-to-code overlay work.
            if (extraction.configs && extraction.configs.length === 1) {
                const cfg = extraction.configs[0];
                if (cfg.width) { this.currentWidth_ = cfg.width; }
                if (cfg.height) { this.currentHeight_ = cfg.height; }
                if (cfg.theme) { this.currentTheme_ = cfg.theme; }
            }

            let result: BuildResult | undefined;
            let usedServerMode = false;
            let usedParserMode = false;
            let parserScene: SceneNode | null = null;

            this.deps.outputChannel.appendLine(
                `[Perf]    previewServer: ${this.deps.previewServer ? (this.deps.previewServer.isRunning ? 'running' : 'NOT running') : 'null'}`,
            );

            // Phase 4-2: Parser-first path (~200ms)
            if (this.parserStrategy.canHandle(this.deps.previewServer)) {
                log.debug('Build', 'trying parser path', { opId });
                const stratResult = await this.parserStrategy.execute(
                    instrumented, extraction, this.currentWidth_, this.currentHeight_,
                    this.currentTheme_, this.currentBgColor_,
                );

                if (myGeneration !== this.buildGeneration) { return; }

                if (stratResult.result.success) {
                    result = stratResult.result;
                    usedServerMode = true;
                    usedParserMode = true;
                    parserScene = stratResult.parserScene ?? null;
                } else {
                    // Fall through to next strategy
                    result = undefined;
                    if (myGeneration !== this.buildGeneration) { return; }
                }
            }

            // Phase 2: dlopen server mode
            if (!usedServerMode && this.dlopenStrategy.canHandle(this.deps.previewServer)) {
                log.debug('Build', 'trying server/dlopen path', { opId });
                const stratResult = await this.dlopenStrategy.execute(
                    instrumented, extraction, this.currentWidth_, this.currentHeight_,
                    this.currentTheme_, this.currentBgColor_,
                );

                // Discard stale result if a newer build was queued during this compile
                if (myGeneration !== this.buildGeneration) {
                    return;
                }

                if (stratResult.result.success) {
                    result = stratResult.result;
                    usedServerMode = true;
                } else {
                    // .so compile failed -- parse errors against plugin template
                    const pluginTemplate = buildRunner.getPluginTemplateContent();
                    const offset = getPluginCodeOffset(pluginTemplate);
                    const errors = parseGccErrors(stratResult.result.error || '', offset, true);
                    const buildTimeMs = Date.now() - startTime;
                    if (errors.length > 0) {
                        const diagnostics = errorsToDiagnostics(errors, doc, extraction.startLine);
                        this.deps.diagnosticCollection.set(doc.uri, diagnostics);
                        this.scheduleShowError(formatErrorsForDisplay(errors));
                    } else {
                        this.scheduleShowError(formatRawError(stratResult.result.error || ''));
                    }
                    this.deps.statusBar?.showError(stratResult.result.error?.split('\n')[0] || 'Build failed');
                    this.deps.outputChannel.appendLine(`Plugin compile failed in ${(buildTimeMs / 1000).toFixed(1)}s`);
                    return;
                }
            }

            // Phase 1 fallback: full harness compile + run
            if (!usedServerMode) {
                log.debug('Build', 'trying harness compile+run path', { opId });
                const stratResult = await this.harnessStrategy.execute(
                    instrumented, extraction, this.currentWidth_, this.currentHeight_,
                    this.currentTheme_, this.currentBgColor_,
                );
                result = stratResult.result;
            }

            // Discard stale result if a newer build was queued
            if (myGeneration !== this.buildGeneration) {
                return;
            }

            const buildTimeMs = Date.now() - startTime;

            if (result!.success && result!.pngPath) {
                // Load scene graph metadata for click-to-code overlay
                const metaStart = Date.now();
                let metadata: object | null = null;
                if (result!.metadataPath) {
                    try {
                        metadata = JSON.parse(fs.readFileSync(result!.metadataPath, 'utf-8'));
                    } catch (err) { log.trace('Extension', 'metadata read skipped', { error: String(err) }); }
                }
                // Enrich metadata with FlexLayout properties from the parser tree
                if (metadata && parserScene) {
                    enrichMetadataWithFlexProps(metadata, parserScene);
                }
                this.deps.outputChannel.appendLine(`[Perf]    metadata read+enrich: ${Date.now() - metaStart}ms`);
                this.cancelErrorDebounce();
                previewManager.updateImage(result!.pngPath, buildTimeMs, metadata);
                const modeLabel = usedParserMode ? '⚡ parser' : usedServerMode ? '⚡ server' : '🔨 compile';
                this.deps.statusBar?.showMode(usedParserMode ? 'parser' : usedServerMode ? 'server' : 'compile');
                this.deps.statusBar?.showSuccess(buildTimeMs);
                const totalElapsed = Date.now() - (this.lastTextChangeTime_ || startTime);
                this.deps.outputChannel.appendLine(`[Perf] T5 postMessage sent — total pipeline: ${buildTimeMs}ms (build), ${totalElapsed}ms (text change → update)`);
                this.deps.outputChannel.appendLine(`Preview updated in ${(buildTimeMs / 1000).toFixed(1)}s [${modeLabel}] (${this.currentWidth_}x${this.currentHeight_})`);
            } else {
                // Parse errors and show in editor
                const templatePath = path.join(
                    buildRunner.getExtensionPath(), 'server', 'preview_harness.cpp.template');
                let template = '';
                try { template = fs.readFileSync(templatePath, 'utf-8'); } catch (err) { log.trace('Extension', 'harness template read failed', { error: String(err) }); }
                const offset = getHarnessCodeOffset(template);
                const errors = parseGccErrors(result!.error || '', offset, false);

                if (errors.length > 0) {
                    const diagnostics = errorsToDiagnostics(errors, doc, extraction.startLine);
                    this.deps.diagnosticCollection.set(doc.uri, diagnostics);
                    this.scheduleShowError(formatErrorsForDisplay(errors));
                } else {
                    this.scheduleShowError(formatRawError(result!.error || ''));
                }

                this.deps.statusBar?.showError(result!.error?.split('\n')[0] || 'Build failed');
                this.deps.outputChannel.appendLine(`Preview failed: ${result!.error?.substring(0, 200)}`);
            }
        } catch (err: any) {
            if (myGeneration === this.buildGeneration) {
                this.scheduleShowError(`Unexpected error: ${err.message || err}`);
                this.deps.statusBar?.showError(err.message || 'Error');
            }
        } finally {
            this.building = false;
            log.debug('Extension', 'runPreview end', { opId, timeMs: Date.now() - startTime });
            // Process pending rebuild queued during this build
            if (this.pendingRebuildDoc) {
                const nextDoc = this.pendingRebuildDoc;
                this.pendingRebuildDoc = undefined;
                setImmediate(() => this.runPreview(nextDoc, true));
            }
        }
    }

    // -----------------------------------------------------------------------
    // Public: runAnimationPreview
    // -----------------------------------------------------------------------

    async runAnimationPreview(
        doc: vscode.TextDocument,
        animConfig: PreviewConfig,
        instrumented: string,
        myGeneration: number,
        startTime: number,
        startLine: number = 0,
    ): Promise<void> {
        const log = getLogger();
        log.debug('Extension', 'runAnimationPreview start', { configName: animConfig.name, duration: animConfig.duration, fps: animConfig.fps });
        const { buildRunner, previewManager } = this.deps;
        if (!buildRunner || !previewManager) {
            return;
        }

        const width = animConfig.width || this.currentWidth_;
        const height = animConfig.height || this.currentHeight_;
        const theme = animConfig.theme || this.currentTheme_;
        const duration = animConfig.duration ?? 2000;
        const fps = animConfig.fps ?? 10;

        this.deps.outputChannel.appendLine(
            `[Animation] Starting capture: ${duration}ms @ ${fps}fps (${Math.floor(duration * fps / 1000)} frames)`,
        );

        const result = await buildRunner.buildAndRunAnimation(
            instrumented, width, height, theme, this.currentBgColor_,
            duration, fps, animConfig.locale, animConfig.fontScale, animConfig.font,
        );

        if (myGeneration !== this.buildGeneration) {
            return;
        }

        const buildTimeMs = Date.now() - startTime;

        if (result.success) {
            let metadata: object | null = null;
            if (result.metadataPath) {
                try {
                    metadata = JSON.parse(fs.readFileSync(result.metadataPath, 'utf-8'));
                } catch (err) { log.trace('Extension', 'animation metadata read skipped', { error: String(err) }); }
            }

            const displayPath = result.gifPath || result.pngPath || '';
            if (!displayPath) {
                this.scheduleShowError('Animation build succeeded but produced no output file.');
                this.deps.outputChannel.appendLine('[Animation] Error: result.success=true but no gifPath/pngPath returned.');
                return;
            }
            this.cancelErrorDebounce();
            previewManager.updateAnimation(displayPath, buildTimeMs, result.frameCount || 0, metadata);
            this.deps.statusBar?.showMode('compile');
            this.deps.statusBar?.showSuccess(buildTimeMs);
            this.deps.outputChannel.appendLine(
                `[Animation] Preview updated in ${(buildTimeMs / 1000).toFixed(1)}s ` +
                `(${result.frameCount} frames, ${result.gifPath ? 'GIF' : 'PNG fallback'})`,
            );
        } else {
            const templatePath = path.join(
                buildRunner.getExtensionPath(), 'server', 'preview_animation.cpp.template');
            let template = '';
            try { template = fs.readFileSync(templatePath, 'utf-8'); } catch (err) { log.trace('Extension', 'animation template read failed', { error: String(err) }); }
            const offset = getHarnessCodeOffset(template);
            const errors = parseGccErrors(result.error || '', offset, false);

            if (errors.length > 0) {
                const diagnostics = errorsToDiagnostics(errors, doc, startLine);
                this.deps.diagnosticCollection.set(doc.uri, diagnostics);
                this.scheduleShowError(formatErrorsForDisplay(errors));
            } else {
                this.scheduleShowError(formatRawError(result.error || ''));
            }
            this.deps.statusBar?.showError(result.error?.split('\n')[0] || 'Animation build failed');
            this.deps.outputChannel.appendLine(`[Animation] Failed: ${result.error?.substring(0, 200)}`);
        }
    }

    // -----------------------------------------------------------------------
    // Public: runMultiPreview
    // -----------------------------------------------------------------------

    async runMultiPreview(
        doc: vscode.TextDocument,
        configs: PreviewConfig[],
        instrumented: string,
        startLine: number,
        myGeneration: number,
        startTime: number,
    ): Promise<void> {
        const log = getLogger();
        log.debug('Extension', 'runMultiPreview start', { configCount: configs.length });
        const { buildRunner, previewManager } = this.deps;
        if (!buildRunner || !previewManager) {
            return;
        }

        const results: MultiPreviewResult[] = [];

        for (const config of configs) {
            if (myGeneration !== this.buildGeneration) {
                return; // stale -- a newer build was triggered
            }

            const configStart = Date.now();
            const width = config.width ?? this.currentWidth_;
            const height = config.height ?? this.currentHeight_;
            const theme = config.theme ?? this.currentTheme_;
            const locale = config.locale;
            const fontScale = config.fontScale;
            const font = config.font;

            // Resolve font filename to its absolute directory for the IPC server path.
            let fontDir: string | undefined;
            if (font) {
                const fontDirs = ConfigurationService.getInstance().fontDirectories;
                fontDir = fontDirs.find(d => {
                    try { return fs.existsSync(path.join(d, font)); }
                    catch (err) { log.trace('Extension', 'font dir check failed', { error: String(err) }); return false; }
                });
            }

            try {
                if (this.deps.previewServer?.isRunning) {
                    const pluginResult = await buildRunner.compilePlugin(instrumented, config.name);

                    if (myGeneration !== this.buildGeneration) {
                        return;
                    }

                    if (pluginResult.success && pluginResult.soPath) {
                        const tmpDir = buildRunner.getTmpDir();
                        const pngPath = path.join(tmpDir, `preview_${sanitizeForPath(config.name)}.png`);
                        const metadataPath = path.join(tmpDir, `preview_${sanitizeForPath(config.name)}_metadata.json`);
                        const reloadResult = await this.deps.previewServer.reload(
                            pluginResult.soPath, pngPath, metadataPath, width, height, theme, this.currentBgColor_,
                            locale, fontScale, fontDir,
                        );
                        results.push({
                            config,
                            success: reloadResult.success,
                            pngPath: reloadResult.success ? pngPath : undefined,
                            metadataPath: reloadResult.success ? metadataPath : undefined,
                            buildTimeMs: Date.now() - configStart,
                            error: reloadResult.success ? undefined : (reloadResult.error || 'Reload failed'),
                        });
                    } else {
                        const pluginTemplate = buildRunner.getPluginTemplateContent();
                        const offset = getPluginCodeOffset(pluginTemplate);
                        const errors = parseGccErrors(pluginResult.error || '', offset, true);
                        const errorMsg = errors.length > 0
                            ? formatErrorsForDisplay(errors)
                            : (pluginResult.error || 'Plugin compile failed');
                        results.push({ config, success: false, buildTimeMs: Date.now() - configStart, error: errorMsg });
                    }
                } else {
                    // Phase 1 fallback
                    const result = await buildRunner.buildAndRun(
                        instrumented, width, height, theme, this.currentBgColor_,
                        locale, fontScale, font,
                    );
                    results.push({
                        config,
                        success: result.success,
                        pngPath: result.pngPath,
                        metadataPath: result.metadataPath,
                        buildTimeMs: Date.now() - configStart,
                        error: result.error,
                    });
                }
            } catch (err: any) {
                results.push({ config, success: false, buildTimeMs: Date.now() - configStart, error: err.message || String(err) });
            }
        }

        if (myGeneration !== this.buildGeneration) {
            return;
        }

        previewManager.updateMultiImage(results);

        const totalMs = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        this.deps.statusBar?.showSuccess(totalMs);
        this.deps.outputChannel.appendLine(
            `Multi-preview: ${successCount}/${results.length} succeeded in ${(totalMs / 1000).toFixed(1)}s`,
        );
    }

    // -----------------------------------------------------------------------
    // Public: VNC mode
    // -----------------------------------------------------------------------

    async startVncMode(): Promise<void> {
        const log = getLogger();
        log.debug('VNC', 'startVncMode entry');
        const { buildRunner, previewManager, vncManager, xvfbManager } = this.deps;
        if (!buildRunner || !previewManager || !vncManager) {
            return;
        }
        if (this.vncStarting) {
            return;
        }
        this.vncStarting = true;
        try {
            const editor = vscode.window.activeTextEditor;
            const doc = editor && isPreviewable(editor.document) ? editor.document : this.lastPreviewedDoc_;
            if (!doc) {
                vscode.window.showWarningMessage('DALi: No previewable file found. Please open a .preview.dali.cpp file first.');
                return;
            }

            const extraction = extractPreviewCode(doc);
            if (!extraction) {
                return;
            }

            if (extraction.configs && extraction.configs.length >= 1) {
                const cfg = extraction.configs[0];
                if (cfg.width) { this.currentWidth_ = cfg.width; }
                if (cfg.height) { this.currentHeight_ = cfg.height; }
            }

            this.deps.statusBar?.showBuilding();
            previewManager.showLoading();

            const instrumented = instrumentCode(extraction.code, extraction.startLine);
            const buildResult = await buildRunner.buildInteractive(
                instrumented, this.currentWidth_, this.currentHeight_, this.currentTheme_, this.currentBgColor_,
            );

            if (!buildResult.success || !buildResult.binPath) {
                this.deps.statusBar?.showError('VNC build failed');
                const interactiveTemplate = buildRunner.getInteractiveTemplateContent();
                const offset = getHarnessCodeOffset(interactiveTemplate);
                const errors = parseGccErrors(buildResult.error || '', offset, false, true);
                if (errors.length > 0) {
                    const diagnostics = errorsToDiagnostics(errors, doc, extraction.startLine);
                    this.deps.diagnosticCollection.set(doc.uri, diagnostics);
                    this.scheduleShowError(formatErrorsForDisplay(errors));
                } else {
                    this.scheduleShowError(buildResult.error || 'Interactive build failed');
                }
                return;
            }

            const display = xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
            const env = {
                ...buildRunner.buildEnv(display),
                DALI_WINDOW_WIDTH: String(this.currentWidth_),
                DALI_WINDOW_HEIGHT: String(this.currentHeight_),
            };

            const vncResult = await vncManager.startInteractiveMode({
                daliBinaryPath: buildResult.binPath,
                display,
                width: this.currentWidth_,
                height: this.currentHeight_,
                env,
            });

            if (!vncResult.success || !vncResult.wsUrl) {
                this.deps.statusBar?.showError('VNC start failed');
                this.scheduleShowError(vncResult.error || 'Failed to start VNC');
                return;
            }

            this.isVncMode_ = true;
            previewManager.startVncMode(vncResult.wsUrl);
            this.deps.statusBar?.showMode('vnc');
            this.deps.outputChannel.appendLine(`[VNC] Interactive mode started: ${vncResult.wsUrl}`);
            log.debug('VNC', 'startVncMode done', { wsUrl: vncResult.wsUrl });
        } finally {
            this.vncStarting = false;
        }
    }

    async stopVncMode(): Promise<void> {
        const { vncManager, previewManager } = this.deps;
        if (!vncManager || !previewManager) {
            return;
        }
        await vncManager.stopInteractiveMode();
        this.isVncMode_ = false;
        previewManager.stopVncMode();
        this.deps.statusBar?.showReady();
        this.deps.outputChannel.appendLine('[VNC] Interactive mode stopped');
    }

    async hotReloadVnc(doc: vscode.TextDocument): Promise<void> {
        const log = getLogger();
        log.debug('VNC', 'hotReloadVnc entry');
        const { buildRunner, previewManager, vncManager, xvfbManager } = this.deps;
        if (!buildRunner || !previewManager || !vncManager) {
            return;
        }
        if (this.hotReloading_) {
            return;
        }
        this.hotReloading_ = true;
        try {
            const extraction = extractPreviewCode(doc);
            if (!extraction) {
                return;
            }

            if (extraction.configs && extraction.configs.length >= 1) {
                const cfg = extraction.configs[0];
                if (cfg.width) { this.currentWidth_ = cfg.width; }
                if (cfg.height) { this.currentHeight_ = cfg.height; }
            }

            previewManager.notifyVncReloading();
            const instrumented = instrumentCode(extraction.code, extraction.startLine);
            const buildResult = await buildRunner.buildInteractive(
                instrumented, this.currentWidth_, this.currentHeight_, this.currentTheme_, this.currentBgColor_,
            );

            if (!buildResult.success || !buildResult.binPath) {
                this.deps.outputChannel.appendLine('[VNC] Hot reload build failed');
                return;
            }

            const display = xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
            const env = {
                ...buildRunner.buildEnv(display),
                DALI_WINDOW_WIDTH: String(this.currentWidth_),
                DALI_WINDOW_HEIGHT: String(this.currentHeight_),
            };

            const ok = await vncManager.restartDaliApp(buildResult.binPath, {
                display,
                width: this.currentWidth_,
                height: this.currentHeight_,
                env,
            });

            if (ok) {
                previewManager.notifyVncReloaded(vncManager.getWebSocketUrl());
                this.deps.outputChannel.appendLine('[VNC] Hot reload succeeded');
            } else {
                this.deps.outputChannel.appendLine('[VNC] Hot reload: DALi app restart failed');
            }
            log.debug('VNC', 'hotReloadVnc done', { success: ok });
        } finally {
            this.hotReloading_ = false;
        }
    }

    // -----------------------------------------------------------------------
    // Public: Device preview
    // -----------------------------------------------------------------------

    async runDevicePreview(doc: vscode.TextDocument): Promise<void> {
        const log = getLogger();
        log.debug('SDB', 'runDevicePreview entry', { serial: this.getCurrentDeviceSerial() });
        const { buildRunner, previewManager, sdbManager } = this.deps;
        const currentDeviceSerial = this.getCurrentDeviceSerial();
        if (!buildRunner || !previewManager || !sdbManager || !currentDeviceSerial) {
            return;
        }
        if (this.devicePreviewRunning) {
            return;
        }
        this.devicePreviewRunning = true;

        const extraction = extractPreviewCode(doc);
        if (!extraction) {
            this.devicePreviewRunning = false;
            return;
        }

        this.lastPreviewedDoc_ = doc;

        this.deps.statusBar?.showBuilding();
        previewManager.showLoading();
        this.deps.diagnosticCollection.delete(doc.uri);

        const startTime = Date.now();
        const instrumented = instrumentCode(extraction.code, extraction.startLine);

        try {
            this.deps.outputChannel.appendLine(`[SDB] Device preview starting: ${currentDeviceSerial}`);

            const result = await buildRunner.buildAndRunOnDevice(
                instrumented,
                sdbManager,
                currentDeviceSerial,
                this.currentWidth_,
                this.currentHeight_,
                this.currentTheme_,
                this.currentBgColor_,
            );

            const buildTimeMs = Date.now() - startTime;

            if (result.success && result.pngPath) {
                let metadata: object | null = null;
                if (result.metadataPath) {
                    try {
                        metadata = JSON.parse(fs.readFileSync(result.metadataPath, 'utf-8'));
                    } catch (err) { log.trace('SDB', 'device metadata read skipped', { error: String(err) }); }
                }
                previewManager.updateImage(result.pngPath, buildTimeMs, metadata);
                this.deps.statusBar?.showMode('device');
                this.deps.statusBar?.showSuccess(buildTimeMs);
                this.deps.outputChannel.appendLine(
                    `[SDB] Device preview completed: ${(buildTimeMs / 1000).toFixed(1)}s (${currentDeviceSerial})`,
                );
            } else {
                const templatePath = path.join(
                    buildRunner.getExtensionPath(), 'server', 'preview_harness.cpp.template');
                let template = '';
                try { template = fs.readFileSync(templatePath, 'utf-8'); } catch (err) { log.trace('SDB', 'device template read failed', { error: String(err) }); }
                const offset = getHarnessCodeOffset(template);
                const errors = parseGccErrors(result.error || '', offset, false);

                if (errors.length > 0) {
                    const diagnostics = errorsToDiagnostics(errors, doc, extraction.startLine);
                    this.deps.diagnosticCollection.set(doc.uri, diagnostics);
                    this.scheduleShowError(formatErrorsForDisplay(errors));
                } else {
                    this.scheduleShowError(formatRawError(result.error || ''));
                }
                this.deps.statusBar?.showError(result.error?.split('\n')[0] || 'Device preview failed');
                this.deps.outputChannel.appendLine(`[SDB] Device preview failed: ${result.error?.substring(0, 200)}`);
            }
        } catch (err: any) {
            this.scheduleShowError(`Device preview error: ${err.message || err}`);
            this.deps.statusBar?.showError(err.message || 'Error');
        } finally {
            this.devicePreviewRunning = false;
            log.debug('SDB', 'runDevicePreview done');
        }
    }

    // -----------------------------------------------------------------------
    // Public: VNC mode state (for external callbacks)
    // -----------------------------------------------------------------------

    setVncModeOff(): void {
        this.isVncMode_ = false;
    }

    // -----------------------------------------------------------------------
    // Dispose
    // -----------------------------------------------------------------------

    dispose(): void {
        if (this.errorDebounceTimer !== undefined) {
            clearTimeout(this.errorDebounceTimer);
            this.errorDebounceTimer = undefined;
        }
    }

    // -----------------------------------------------------------------------
    // Private: get current device serial from workspace config
    // -----------------------------------------------------------------------

    private getCurrentDeviceSerial(): string | undefined {
        return vscode.workspace.getConfiguration('daliPreview').get<string>('targetDevice', '') || undefined;
    }
}

// isPreviewable is imported directly from codeExtractor at the top of the file.
