import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BuildRunner, BuildResult } from './buildRunner';
import { PreviewServer } from './previewServer';
import { PreviewManager } from './previewManager';
import { XvfbManager } from './xvfbManager';
import { StatusBarManager } from './statusBar';
import { extractPreviewCode, extractFunctionBody, instrumentCode, transformVectorChildren, sanitizeUnsupportedGlyphs, isPreviewable, ExtractionResult } from './codeExtractor';
import { parseChainExpression, SceneNode } from './cppParser';
import { buildSlice, SliceResult, SourceFile } from './sliceBuilder';
import { enrichMetadataWithFlexProps } from './flexMetadata';
import { parseGccErrors, getHarnessCodeOffset, getPluginCodeOffset, formatErrorsForDisplay, formatRawError, diagnoseGccErrors } from './errorParser';
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
        slice?: SliceResult,
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
        slice?: SliceResult,
    ): Promise<{ result: BuildResult; parserScene?: SceneNode | null }> {
        const log = getLogger();
        const buildRunner = this.getBuildRunner();
        const server = this.getPreviewServer();
        if (!server?.isRunning) {
            return { result: { success: false, error: 'Server not running' } };
        }

        log.debug('Build', 'trying server/dlopen path');
        const compileStart = Date.now();
        // Rung2 slice: inject collected same-file defs + weak stubs into the
        // globals slot. compile-probe → Rung3 fallback (external-review safety):
        // if the sliced compile fails, retry WITHOUT globals so the user sees the
        // honest current-path error against THEIR code, not a confusing error
        // inside generated stub code they never wrote.
        const useSlice = slice?.rung === 'heuristic';
        let pluginResult = await buildRunner.compilePlugin(
            code, undefined,
            useSlice ? slice!.globals : '',
            useSlice ? slice!.includes : '',
        );
        if (!pluginResult.success && useSlice) {
            this.outputChannel.appendLine('[Slice] Rung2 compile failed → Rung3 fallback (no globals)');
            log.debug('Build', 'slice compile failed, falling back to Rung3');
            pluginResult = await buildRunner.compilePlugin(code);
        }
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
        slice?: SliceResult,
    ): Promise<{ result: BuildResult; parserScene?: SceneNode | null }> {
        const log = getLogger();
        log.debug('Build', 'trying harness compile+run path');
        const harnessStart = Date.now();
        // Inject the Rung2 slice globals into the FULL HARNESS too, not just the
        // dlopen path — otherwise a cross-file/member preview (theme, helpers,
        // model types) fails with "not declared" whenever the preview server is
        // down and we fall back here.
        const useSlice = slice?.rung === 'heuristic';
        const result = await this.getBuildRunner().buildAndRun(
            code, width, height, theme, bgColor, undefined,
            useSlice ? slice!.globals : '', useSlice ? slice!.includes : '',
        );
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
    statusBar: StatusBarManager | undefined;
    outputChannel: vscode.OutputChannel;
    diagnosticCollection: vscode.DiagnosticCollection;
    /**
     * Gate a render on docker readiness (docker mode only). Returns true if the
     * render may proceed. When docker is missing it surfaces the actionable
     * setup popup (unless `silent`, for live-preview keystroke renders).
     * Injected late via `setEnsureDockerReady` (see extension.ts).
     */
    ensureDockerReady?: (opts: { silent: boolean }) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// PreviewOrchestrator
// ---------------------------------------------------------------------------

function sanitizeForPath(name: string): string {
    return BuildRunner.sanitizeConfigName(name);
}

/** Walk up from `startDir` to the nearest project root (.git or package.json), used
 *  for include containment when the file isn't inside an open workspace folder
 *  (e.g. opened standalone, or its folder isn't added to the workspace). */
function findProjectRoot(startDir: string): string {
    let dir = startDir;
    for (let i = 0; i < 12; i++) {
        if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) { return dir; }
        const parent = path.dirname(dir);
        if (parent === dir) { break; }
        dir = parent;
    }
    return startDir;
}

/**
 * Rung1 (heuristic cross-file): read the project sources the document #include's
 * by relative path ("...") — each header and, if present, its same-stem .cpp —
 * so SliceBuilder can collect helper/type/const definitions that live in other
 * files. Followed TRANSITIVELY (BFS, header → header) up to MAX_HOPS, so a type
 * two hops away (wallet_screen.h → model/wallet_vm.h) is reachable (P11). Only
 * project-local quoted includes are followed (system <...> come from the
 * template); contained to the workspace/project root; missing files skipped.
 */
function resolveProjectIncludes(doc: vscode.TextDocument): SourceFile[] {
    const sources: SourceFile[] = [];
    // Security containment: only read files inside the workspace root (or the
    // document's own directory if there's no workspace). An include that escapes
    // it — e.g. #include "/etc/passwd" or "../../../../etc/hostname" — is skipped.
    const root = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath ?? findProjectRoot(path.dirname(doc.uri.fsPath));
    const seen = new Set<string>();
    const MAX_HOPS = 4;
    let frontier: { dir: string; text: string }[] = [{ dir: path.dirname(doc.uri.fsPath), text: doc.getText() }];
    for (let hop = 0; hop < MAX_HOPS && frontier.length > 0; hop++) {
        const next: { dir: string; text: string }[] = [];
        for (const cur of frontier) {
            const includeRe = /^[ \t]*#include\s+"([^"]+)"/gm;
            let m: RegExpExecArray | null;
            while ((m = includeRe.exec(cur.text)) !== null) {
                const hdr = path.resolve(cur.dir, m[1]);
                // header + its same-stem .cpp (definitions often live in the .cpp)
                for (const p of [hdr, hdr.replace(/\.(h|hpp)$/, '.cpp')]) {
                    if (seen.has(p)) { continue; }
                    seen.add(p);
                    if (!(p === root || p.startsWith(root + path.sep))) { continue; } // containment guard
                    try {
                        if (fs.existsSync(p)) {
                            const text = fs.readFileSync(p, 'utf8');
                            sources.push({ path: p, text });
                            next.push({ dir: path.dirname(p), text });  // recurse into ITS includes
                        }
                    } catch { /* unreadable include — skip */ }
                }
            }
        }
        frontier = next;
    }
    return sources;
}

export class PreviewOrchestrator {
    // Module-level state migrated from extension.ts
    private building = false;
    private buildGeneration = 0;
    private pendingRebuildDoc: vscode.TextDocument | undefined;
    private lastPreviewedDoc_: vscode.TextDocument | undefined;
    private lastSliceSources_ = new Set<string>();
    private lastTextChangeTime_ = 0;
    private lastCodeLensFunc_: { uri: string; startLine: number; endLine: number } | undefined;
    private errorDebounceTimer: ReturnType<typeof setTimeout> | undefined;
    private currentWidth_: number;
    private currentHeight_: number;
    private currentTheme_: 'light' | 'dark';
    private currentBgColor_: string | undefined;
    private activeEpoch_ = 0;  // buildGeneration of the currently displayed preview

    // Tracks the width/height most recently supplied by a @preview-config directive
    // (undefined when the previewed file had none). Used to detect transitions
    // between cfg-bearing and cfg-less files so currentWidth_/Height_ can be reset
    // to defaults instead of leaking a previous file's size.
    private lastCfgWidth_: number | undefined;
    private lastCfgHeight_: number | undefined;

    // True once the user has explicitly toggled theme via the UI in this session.
    // While true, per-config `theme=` in @preview-config is ignored so the toggle
    // has a consistent effect across all configs (including those that pin theme).
    // Resets to false on extension reactivation (i.e. fresh session).
    private userThemeOverride_ = false;

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

    get lastDocument(): vscode.TextDocument | undefined {
        return this.lastPreviewedDoc_;
    }

    /** True if `filePath` is a cross-file source the last preview pulled in. */
    isPreviewDependency(filePath: string): boolean {
        return this.lastSliceSources_.has(filePath);
    }

    /** Re-run the last preview (used when a cross-file dependency is saved). */
    async repreviewLast(): Promise<void> {
        if (this.lastPreviewedDoc_) {
            await this.runPreview(this.lastPreviewedDoc_, true);
        }
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
        this.userThemeOverride_ = true;
    }

    set bgColor(c: string | undefined) {
        this.currentBgColor_ = c;
    }

    setLastCodeLensFunc(func: { uri: string; startLine: number; endLine: number } | undefined): void {
        this.lastCodeLensFunc_ = func;
    }

    /**
     * Reconcile currentWidth_/Height_/Theme_ with the @preview-config of the file
     * about to be previewed. When the cfg-supplied width/height changes (including
     * appearing or disappearing between files), reset to that value or to the
     * settings default; when it is unchanged, leave currentWidth_/Height_ alone so
     * a webview-driven manual resize survives subsequent rebuilds.
     */
    private applyConfigSize(extraction: ExtractionResult): void {
        const cfg = extraction.configs && extraction.configs.length === 1
            ? extraction.configs[0]
            : undefined;
        const cfgWidth = cfg?.width;
        const cfgHeight = cfg?.height;
        const defaults = ConfigurationService.getInstance();

        if (cfgWidth !== this.lastCfgWidth_) {
            this.currentWidth_ = cfgWidth ?? defaults.previewWidth;
            this.lastCfgWidth_ = cfgWidth;
        }
        if (cfgHeight !== this.lastCfgHeight_) {
            this.currentHeight_ = cfgHeight ?? defaults.previewHeight;
            this.lastCfgHeight_ = cfgHeight;
        }
        // Per-config theme is the *initial* render hint. Once the user has
        // toggled theme in this session, their choice wins so the toggle button
        // behaves consistently across files.
        if (cfg?.theme && !this.userThemeOverride_) {
            this.currentTheme_ = cfg.theme;
        }
    }

    /**
     * Sanitize → transform → slice → instrument the extracted code. Returns the
     * SliceResult (its `body` re-pointed at the instrumented code) plus the
     * instrumented string the strategies consume. Extracted from runPreview so
     * the build pipeline reads as discrete stages.
     */
    private prepareSlice(
        doc: vscode.TextDocument,
        extraction: ExtractionResult,
    ): { slice: SliceResult; instrumented: string } {
        // Strip emoji/pictographs the preview font lacks (they abort DALi when
        // spread across separate Labels); warn so the user knows □ is a stand-in.
        const sanitized = sanitizeUnsupportedGlyphs(extraction.code);
        if (sanitized.replaced) {
            this.deps.outputChannel.appendLine('[Preview] Emoji with no glyph in the preview font are shown as □ (they render fine on a real device).');
        }
        // P13: rewrite `.Children(vector)` → an .Add loop before slicing/instrumenting
        // (View::Children only takes an initializer_list, so a vector won't compile).
        const transformedCode = transformVectorChildren(sanitized.code);
        const extraSources = resolveProjectIncludes(doc);
        const slice = buildSlice(doc.getText(), doc.fileName, transformedCode, extraSources, extraction.params);
        const instrumented = instrumentCode(transformedCode, extraction.startLine, new Set(slice.helpers));
        slice.body = instrumented;
        return { slice, instrumented };
    }

    /**
     * Apply a successful build: read + enrich the scene metadata, push the image
     * to the webview, and update the status bar / perf log.
     */
    private applySuccessfulBuild(args: {
        result: BuildResult;
        parserScene: SceneNode | null;
        usedServerMode: boolean;
        usedParserMode: boolean;
        buildTimeMs: number;
        startTime: number;
        previewManager: PreviewManager;
    }): void {
        const { result, parserScene, usedServerMode, usedParserMode, buildTimeMs, startTime, previewManager } = args;
        const log = getLogger();
        // Load scene graph metadata for click-to-code overlay
        const metaStart = Date.now();
        let metadata: object | null = null;
        if (result.metadataPath) {
            try {
                metadata = JSON.parse(fs.readFileSync(result.metadataPath, 'utf-8'));
            } catch (err) { log.trace('Extension', 'metadata read skipped', { error: String(err) }); }
        }
        // Enrich metadata with FlexLayout properties from the parser tree
        if (metadata && parserScene) {
            enrichMetadataWithFlexProps(metadata, parserScene);
        }
        this.deps.outputChannel.appendLine(`[Perf]    metadata read+enrich: ${Date.now() - metaStart}ms`);
        this.cancelErrorDebounce();
        // Stamp this render with the current build generation — scrub frames for
        // older epochs are rejected (orchestrator) and discarded (webview), so a
        // previous preview's in-flight frames never leak into this one.
        this.activeEpoch_ = this.buildGeneration;
        previewManager.updateImage(result.pngPath!, buildTimeMs, metadata, false, this.activeEpoch_);
        // Animation scrubber: show controls when the resident plugin registered
        // animations (server/dlopen path only); hide otherwise.
        if (usedServerMode && result.animationCount && result.animationCount > 0) {
            previewManager.showAnimationControls(result.animationDurationMs ?? 0, this.activeEpoch_);
        } else {
            previewManager.hideAnimationControls();
        }
        const modeLabel = usedParserMode ? '⚡ parser' : usedServerMode ? '⚡ server' : '🔨 compile';
        this.deps.statusBar?.showMode(usedParserMode ? 'parser' : usedServerMode ? 'server' : 'compile');
        this.deps.statusBar?.showSuccess(buildTimeMs);
        const totalElapsed = Date.now() - (this.lastTextChangeTime_ || startTime);
        this.deps.outputChannel.appendLine(`[Perf] T5 postMessage sent — total pipeline: ${buildTimeMs}ms (build), ${totalElapsed}ms (text change → update)`);
        this.deps.outputChannel.appendLine(`Preview updated in ${(buildTimeMs / 1000).toFixed(1)}s [${modeLabel}] (${this.currentWidth_}x${this.currentHeight_})`);
    }

    /**
     * Animation scrub: re-render the resident plugin at normalized progress [0,1]
     * via RENDER_AT (no recompile/reload) and push the frame to the webview.
     * Rotates output filenames so the webview always gets a fresh resource URI.
     */
    async scrubAnimation(progress: number, epoch: number): Promise<void> {
        const server = this.deps.previewServer;
        if (!server?.isRunning) {
            return;
        }
        // Reject scrubs for a stale preview (epoch mismatch) or while a fresh
        // render is in progress. This is the core fix for the previous preview's
        // background/in-flight frames leaking into the current one, and for a
        // scrub colliding with a reload at the single-in-flight server.
        if (this.building || epoch !== this.activeEpoch_) {
            getLogger().trace('Extension', 'scrub rejected', {
                reqEpoch: epoch, activeEpoch: this.activeEpoch_, building: this.building,
            });
            // NACK so the webview frees its in-flight slot now instead of stalling
            // on its watchdog (the scrub will simply not be served).
            this.deps.previewManager.notifyScrubDropped(epoch);
            return;
        }
        const tmpDir = this.deps.buildRunner.getTmpDir();
        // Name the frame by its progress so each cached frame has a STABLE backing
        // file. A rotating mod-N name aliases distinct cached frames onto one file,
        // so a re-read after browser eviction would surface the wrong frame.
        const pngPath = path.join(tmpDir, `preview_scrub_${Math.round(progress * 100000)}.png`);
        const metadataPath = path.join(tmpDir, 'preview_scrub_metadata.json');
        const result = await server.renderAt(
            progress, pngPath, metadataPath,
            this.currentWidth_, this.currentHeight_, this.currentTheme_, this.currentBgColor_,
        );
        // Re-check: a new preview may have loaded while we awaited the render, in
        // which case this frame is now stale — drop it instead of showing it.
        if (!result.success || !result.pngPath || epoch !== this.activeEpoch_) {
            getLogger().trace('Extension', 'scrub frame dropped', {
                ok: result.success, reqEpoch: epoch, activeEpoch: this.activeEpoch_,
            });
            this.deps.previewManager.notifyScrubDropped(epoch);
            return;
        }
        let metadata: object | null = null;
        if (result.metadataPath) {
            try {
                metadata = JSON.parse(fs.readFileSync(result.metadataPath, 'utf-8'));
            } catch (err) {
                getLogger().trace('Extension', 'scrub metadata read skipped', { error: String(err) });
            }
        }
        this.deps.previewManager.updateImage(result.pngPath, 0, metadata, true, this.activeEpoch_);
    }

    /**
     * Report a full-harness build failure: parse g++ errors against the harness
     * template, set editor diagnostics (or a raw fallback), and update status.
     */
    private reportHarnessFailure(
        result: BuildResult,
        doc: vscode.TextDocument,
        startLine: number,
        buildRunner: BuildRunner,
    ): void {
        const log = getLogger();
        const templatePath = path.join(
            buildRunner.getExtensionPath(), 'server', 'preview_harness.cpp.template');
        let template = '';
        try { template = fs.readFileSync(templatePath, 'utf-8'); } catch (err) { log.trace('Extension', 'harness template read failed', { error: String(err) }); }
        const offset = getHarnessCodeOffset(template);
        const diag = diagnoseGccErrors(result.error || '', offset, doc, startLine, false);
        if (diag) {
            this.deps.diagnosticCollection.set(doc.uri, diag.diagnostics);
            this.scheduleShowError(diag.displayMessage);
        } else {
            this.scheduleShowError(formatRawError(result.error || ''));
        }
        this.deps.statusBar?.showError(result.error?.split('\n')[0] || 'Build failed');
        this.deps.outputChannel.appendLine(`Preview failed: ${result.error?.substring(0, 200)}`);
    }

    /**
     * Run the build strategies in priority order (parser → dlopen → harness),
     * honoring the buildGeneration stale guard between awaits. Returns:
     *  - {kind:'stale'}        a newer build superseded this one → caller returns
     *  - {kind:'pluginFailed'} the dlopen .so compile failed and diagnostics were
     *                          already shown → caller returns
     *  - {kind:'built'}        the result plus which path produced it
     */
    private async runBuildStrategies(args: {
        doc: vscode.TextDocument;
        extraction: ExtractionResult;
        instrumented: string;
        slice: SliceResult;
        myGeneration: number;
        startTime: number;
        opId: string;
    }): Promise<
        | { kind: 'stale' }
        | { kind: 'pluginFailed' }
        | { kind: 'built'; result: BuildResult; usedServerMode: boolean; usedParserMode: boolean; parserScene: SceneNode | null }
    > {
        const { doc, extraction, instrumented, slice, myGeneration, startTime, opId } = args;
        const log = getLogger();
        const buildRunner = this.deps.buildRunner;

        let result: BuildResult | undefined;
        let usedServerMode = false;
        let usedParserMode = false;
        let parserScene: SceneNode | null = null;

        this.deps.outputChannel.appendLine(
            `[Perf]    previewServer: ${this.deps.previewServer ? (this.deps.previewServer.isRunning ? 'running' : 'NOT running') : 'null'}`,
        );

        // Phase 4-2: Parser-first path (~200ms). Skip for heuristic slices:
        // the parser would "succeed" on an unresolved project constant like
        // UiColor(theme::ACCENT) — but the server can't turn "theme::ACCENT"
        // into a hex value and renders it black. Only the T2 slice compiles
        // the real namespace constant, so route heuristic slices straight there.
        // Also skip when the code has an animation (.Play(): the parser builds
        // only the static scene tree and emits no >>>ANIM, so the scrubber would
        // never appear — route to the dlopen path which loads + scrubs it.
        const hasAnimation = /\.\s*Play\s*\(/.test(instrumented);
        if (slice.rung === 'single-fn' && !hasAnimation && this.parserStrategy.canHandle(this.deps.previewServer)) {
            log.debug('Build', 'trying parser path', { opId });
            const stratResult = await this.parserStrategy.execute(
                instrumented, extraction, this.currentWidth_, this.currentHeight_,
                this.currentTheme_, this.currentBgColor_,
            );

            if (myGeneration !== this.buildGeneration) { return { kind: 'stale' }; }

            if (stratResult.result.success) {
                result = stratResult.result;
                usedServerMode = true;
                usedParserMode = true;
                parserScene = stratResult.parserScene ?? null;
            } else {
                // Fall through to next strategy
                result = undefined;
                if (myGeneration !== this.buildGeneration) { return { kind: 'stale' }; }
            }
        }

        // Phase 2: dlopen server mode
        if (!usedServerMode && this.dlopenStrategy.canHandle(this.deps.previewServer)) {
            log.debug('Build', 'trying server/dlopen path', { opId });
            const stratResult = await this.dlopenStrategy.execute(
                instrumented, extraction, this.currentWidth_, this.currentHeight_,
                this.currentTheme_, this.currentBgColor_,
                slice,
            );

            // Discard stale result if a newer build was queued during this compile
            if (myGeneration !== this.buildGeneration) {
                return { kind: 'stale' };
            }

            if (stratResult.result.success) {
                result = stratResult.result;
                usedServerMode = true;
            } else {
                // .so compile failed -- parse errors against plugin template
                const pluginTemplate = buildRunner.getPluginTemplateContent();
                const offset = getPluginCodeOffset(pluginTemplate);
                const buildTimeMs = Date.now() - startTime;
                const diag = diagnoseGccErrors(stratResult.result.error || '', offset, doc, extraction.startLine, true);
                if (diag) {
                    this.deps.diagnosticCollection.set(doc.uri, diag.diagnostics);
                    this.scheduleShowError(diag.displayMessage);
                } else {
                    this.scheduleShowError(formatRawError(stratResult.result.error || ''));
                }
                this.deps.statusBar?.showError(stratResult.result.error?.split('\n')[0] || 'Build failed');
                this.deps.outputChannel.appendLine(`Plugin compile failed in ${(buildTimeMs / 1000).toFixed(1)}s`);
                return { kind: 'pluginFailed' };
            }
        }

        // Phase 1 fallback: full harness compile + run
        if (!usedServerMode) {
            log.debug('Build', 'trying harness compile+run path', { opId });
            const stratResult = await this.harnessStrategy.execute(
                instrumented, extraction, this.currentWidth_, this.currentHeight_,
                this.currentTheme_, this.currentBgColor_, slice,
            );
            result = stratResult.result;
        }

        // Discard stale result if a newer build was queued
        if (myGeneration !== this.buildGeneration) {
            return { kind: 'stale' };
        }

        return { kind: 'built', result: result!, usedServerMode, usedParserMode, parserScene };
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

    setEnsureDockerReady(fn: (opts: { silent: boolean }) => Promise<boolean>): void {
        this.deps.ensureDockerReady = fn;
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

        // Docker gate: in docker mode, when the dlopen server isn't up we are about
        // to fall back to the full-harness path. Verify docker access first and, if
        // it's missing, surface the actionable install/setup popup (the no-reload
        // resume path) instead of letting buildAndRunDocker fail with a raw string
        // buried in the panel. Runs before building/lastDocument advance so an early
        // return needs no cleanup. Live-preview (keystroke) renders pass silent so
        // they never pop a modal or spam the panel.
        if (!this.deps.previewServer?.isRunning && this.deps.ensureDockerReady) {
            const ready = await this.deps.ensureDockerReady({ silent: livePreview });
            if (!ready) {
                if (!livePreview) {
                    previewManager.showError(
                        'Docker is required to render the preview. Follow the "DALi: Install Docker via Terminal" setup steps in the notification.',
                    );
                    this.deps.statusBar?.showError('Docker not available');
                }
                return;
            }
        }

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

        // Slice the RAW body first to learn which collected helpers return a View,
        // then instrument so those helper CALLS get tagged too (a cross-file
        // MakeSectionHeader(...) → click-to-code), and re-point the slice body at it.
        const { slice, instrumented } = this.prepareSlice(doc, extraction);
        this.deps.outputChannel.appendLine(`[Perf]    extract+instrument: ${Date.now() - startTime}ms`);

        try {
            // Multi-config path: build each config independently (2+ configs)
            if (extraction.configs && extraction.configs.length > 1) {
                await this.runMultiPreview(
                    doc, extraction.configs, instrumented, extraction.startLine, myGeneration, startTime,
                );
                return;
            }

            // Reconcile size/theme with the cfg of the file being previewed.
            // Goes through applyConfigSize so a stale size from a prior cfg-bearing
            // file (e.g. boarding-pass at 2520x4480) doesn't leak into the next file.
            this.applyConfigSize(extraction);

            // slice was built (raw) + re-pointed at the instrumented body above; the
            // dlopen path consumes its globals, parser/harness ignore them.
            if (slice.rung === 'heuristic') {
                this.deps.outputChannel.appendLine(
                    `[Slice] Rung2 heuristic: globals collected, ${slice.unresolvedStubs.length} stub(s)` +
                    (slice.unresolvedStubs.length ? ` [${slice.unresolvedStubs.join(', ')}]` : ''),
                );
            }
            // Track the cross-file sources this preview pulled in (entry excluded)
            // so saving one of them re-triggers this preview (live dependency reload).
            this.lastSliceSources_ = new Set(slice.sourcePaths.slice(1));

            const outcome = await this.runBuildStrategies({
                doc, extraction, instrumented, slice, myGeneration, startTime, opId,
            });
            if (outcome.kind === 'stale' || outcome.kind === 'pluginFailed') {
                return;
            }
            const { result, usedServerMode, usedParserMode, parserScene } = outcome;

            const buildTimeMs = Date.now() - startTime;

            if (result.success && result.pngPath) {
                this.applySuccessfulBuild({
                    result, parserScene, usedServerMode, usedParserMode,
                    buildTimeMs, startTime, previewManager,
                });
            } else {
                this.reportHarnessFailure(result, doc, extraction.startLine, buildRunner);
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
            // Per-config theme is honored on initial render; once the user has
            // toggled the theme button, their choice overrides every config so
            // the global toggle has a consistent visual effect.
            const theme = this.userThemeOverride_
                ? this.currentTheme_
                : (config.theme ?? this.currentTheme_);
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
    // Dispose
    // -----------------------------------------------------------------------

    dispose(): void {
        if (this.errorDebounceTimer !== undefined) {
            clearTimeout(this.errorDebounceTimer);
            this.errorDebounceTimer = undefined;
        }
    }
}

// isPreviewable is imported directly from codeExtractor at the top of the file.
