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
import { PreviewConfig, MultiPreviewResult, ProvenanceEntry } from './previewConfig';
import { ConfigurationService } from './configurationService';
import { getLogger } from './logger';
import { PreviewMode } from './types';

// Quantization grid for scrub-frame backing filenames. Each scrub frame is
// written to `preview_scrub_<round(progress*GRID)>.png`, so the on-disk set is
// BOUNDED to GRID+1 names (reused/overwritten across animations and durations)
// instead of leaking a fresh PNG per distinct progress for an entire session.
// The grid must exceed the webview's max FRAME_COUNT (48, see media/preview.html)
// so two adjacent timeline frames never quantize onto the same file: 200 yields a
// 0.5% bucket against a >=2.1% frame spacing (~4x margin), keeping each cached
// frame on its own stable file (the BUG10 anti-aliasing invariant).
const SCRUB_PROGRESS_GRID = 200;

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
        extraction: ExtractionResult,
        width: number,
        height: number,
        theme: 'light' | 'dark',
        bgColor?: string,
        slice?: SliceResult,
    ): Promise<{ result: BuildResult; parserScene?: SceneNode | null }> {
        const log = getLogger();
        const buildRunner = this.getBuildRunner();
        const server = this.getPreviewServer();
        // Single-config knobs (WU-M3.8 warm path): a lone `@preview-config` with
        // locale/fontScale installs into the resident plugin (RTL mirror +
        // untranslated override + runtime SetScale) and is re-sent on RELOAD, so a
        // single-config file is honest in LIVE warm preview too. undefined when
        // absent → byte-identical. theme already flows via the `theme` arg.
        const singleCfg = extraction.configs && extraction.configs.length === 1
            ? extraction.configs[0] : undefined;
        const cfgLocale = singleCfg?.locale;
        const cfgFontScale = singleCfg?.fontScale;
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
        // Thread locale (RTL mirror + untranslated override) and fontScale
        // (runtime SetScale) into the warm plugin. theme is intentionally NOT
        // routed here: theme reskin on the warm/server path is owned by M3.3/M3.4
        // (server color override + window bg via reload), so re-installing it in
        // the plugin would double-apply. undefined knobs → byte-identical plugin.
        const cfgKnobs = { locale: cfgLocale, fontScale: cfgFontScale };
        let pluginResult = await buildRunner.compilePlugin(
            code, undefined,
            useSlice ? slice!.globals : '',
            useSlice ? slice!.includes : '',
            cfgKnobs,
        );
        if (!pluginResult.success && useSlice) {
            this.outputChannel.appendLine('[Slice] Rung2 compile failed → Rung3 fallback (no globals)');
            log.debug('Build', 'slice compile failed, falling back to Rung3');
            pluginResult = await buildRunner.compilePlugin(code, undefined, '', '', cfgKnobs);
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
            // Re-send the single-config locale/fontScale on RELOAD too, symmetric
            // with the multi-config gallery path. The plugin .so already installs
            // them via its slots; this keeps the resident server in sync (its own
            // RELOAD install is the docker baked-in part — live sign-off).
            const result = await server.reload(
                pluginResult.soPath, pngPath, metadataPath, width, height, theme, bgColor,
                cfgLocale, cfgFontScale,
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
        extraction: ExtractionResult,
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
        // Single-config knobs (WU-M3.5/M3.2): a lone `@preview-config` with
        // fontScale/locale threads into the harness so a single-config file
        // mirrors RTL / scales text in LIVE preview too — matching the golden the
        // standalone runner bakes for the same sample. undefined when absent →
        // byte-identical. (Multi-config gallery threads per-variant in
        // runMultiPreview; theme already flows via currentTheme_.)
        const singleCfg = extraction.configs && extraction.configs.length === 1
            ? extraction.configs[0] : undefined;
        // `// @preview-state: focus=<id>` (ADR-006): the harness is the proven
        // focus-capable path. runBuildStrategies routes focus-bearing previews
        // here (skipping parser/dlopen), so pass the target through to fill the
        // {{POST_BUILD_FOCUS}} slot. undefined when no focus directive → unchanged.
        const result = await this.getBuildRunner().buildAndRun(
            code, width, height, theme, bgColor, undefined,
            useSlice ? slice!.globals : '', useSlice ? slice!.includes : '',
            extraction.state?.focus, singleCfg?.fontScale, singleCfg?.locale,
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
     * Gate a render on runtime readiness. Returns true if the render may
     * proceed. When the runtime isn't ready it surfaces actionable setup
     * guidance (docker install, or — in local mode — pick the DALi folder /
     * install missing host deps), unless `silent` (live-preview keystrokes).
     * Injected late via `setEnsureRuntimeReady` (see extension.ts).
     */
    ensureRuntimeReady?: (opts: { silent: boolean }) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// PreviewOrchestrator
// ---------------------------------------------------------------------------

function sanitizeForPath(name: string): string {
    return BuildRunner.sanitizeConfigName(name);
}

/**
 * Detect the `IDS_` resource keys a translatable binding references in preview
 * code (WU-M3.6 / ADR-007 `untranslated`). Matches `SetTranslatableText("IDS_X")`
 * and any bare `"IDS_..."` string literal (covers the common label/binding APIs
 * without a full parse). Returns the de-duplicated, in-order key list.
 */
function findIdsKeys(code: string): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    const re = /"(IDS_[A-Za-z0-9_]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        if (!seen.has(m[1])) {
            seen.add(m[1]);
            keys.push(m[1]);
        }
    }
    return keys;
}

/**
 * Build the `untranslated` provenance for a single-config preview (WU-M3.6).
 * Honest signal only: when a `locale` is set AND the code uses `IDS_` keys, M3
 * loads NO catalog, so those keys render as their raw id (the harness installs
 * the no-op `__LocaleOverride` → dgettext fallback → raw key). We record ONE
 * `untranslated` provenance entry naming the keys, which the host merges into the
 * metadata. The VISIBLE badge chip is M5 (ADR-007 F5.3) — M3 only prepares the
 * channel. Returns [] when no locale or no IDS_ keys (→ no provenance, no badge).
 */
export function buildUntranslatedProvenance(locale: string | undefined, code: string): ProvenanceEntry[] {
    if (!locale) {
        return [];
    }
    const keys = findIdsKeys(code);
    if (keys.length === 0) {
        return [];
    }
    const shown = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ', …' : '');
    return [{
        kind: 'untranslated',
        detail: `${shown} shown as key (no ${locale} catalog)`,
    }];
}

/**
 * Detect ImageView URLs in preview code that are remote/unreachable, so the host
 * can record an `image-placeholder` provenance (WU-M5.1 / ADR-007). The harness's
 * SetBrokenImageUrl makes such a URL render the bundled gray placeholder at the
 * view's requested size; this badge tells the user those pixels are a stand-in.
 *
 * Honest heuristic (static — no network): an `ImageView::New("...")` /
 * `.SetResourceUrl("...")` argument is flagged when it is a remote scheme
 * (http/https/ftp) OR a custom/unknown scheme (`foo://`), since neither resolves
 * in the sandbox. Plain local paths/filenames are NOT flagged — they may resolve
 * (and if they don't, the placeholder still shows; we just don't over-claim).
 * Returns the de-duplicated, in-order list of flagged URLs.
 */
function findUnreachableImageUrls(code: string): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();
    // Match the string literal argument of ImageView::New(...) or SetResourceUrl(...).
    const re = /(?:ImageView\s*::\s*New|SetResourceUrl)\s*\(\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        const url = m[1];
        // Remote scheme or any custom scheme `name://` — neither fetches offline.
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) && !seen.has(url)) {
            seen.add(url);
            urls.push(url);
        }
    }
    return urls;
}

/**
 * Build the `image-placeholder` provenance for a preview (WU-M5.1 / ADR-007).
 * When the code references one or more remote/unreachable ImageView URLs, the
 * harness renders the bundled gray placeholder in their place (layout preserved),
 * so we record ONE entry naming the URLs. The host merges it into the metadata;
 * the visible badge chip is WU-M5.3. Returns [] when no such URL (→ no badge).
 */
export function buildImagePlaceholderProvenance(code: string): ProvenanceEntry[] {
    const urls = findUnreachableImageUrls(code);
    if (urls.length === 0) {
        return [];
    }
    const shown = urls.slice(0, 2).join(', ') + (urls.length > 2 ? ', …' : '');
    return [{
        kind: 'image-placeholder',
        detail: `${shown} unreachable — showing gray placeholder`,
    }];
}

/**
 * Build the `focus-multiconfig` provenance for a multi-config preview that
 * carried a `// @preview-state: focus=` (WU-M5.5 / ADR-007). focus only renders
 * on the single-config harness path, so in a gallery the ring is dropped; this
 * promotes the old warn-log to a per-variant badge so the silent-drop is VISIBLE.
 * Returns [] when no focus id (→ no badge, single-config focus is unaffected).
 */
export function buildFocusMulticonfigProvenance(focusId: string | undefined): ProvenanceEntry[] {
    if (!focusId) {
        return [];
    }
    return [{
        kind: 'focus-multiconfig',
        detail: `focus=${focusId} not applied in multi-config preview`,
    }];
}

/**
 * Merge a provenance array into a (possibly null) metadata object as the
 * top-level `provenance` field (ADR-007 §1/§2 host-merge). No-op when there is
 * nothing to merge. Existing entries (e.g. a future runtime `>>>PROV:` marker)
 * are preserved and appended to. Mutates+returns `metadata` (or a fresh object
 * when it was null but provenance exists), so existing metadata consumers are
 * unaffected (purely additive top-level field, Inv-6).
 */
export function mergeProvenance(metadata: object | null, provenance: ProvenanceEntry[]): object | null {
    if (provenance.length === 0) {
        return metadata;
    }
    const meta = (metadata ?? {}) as { provenance?: ProvenanceEntry[] };
    meta.provenance = [...(meta.provenance ?? []), ...provenance];
    return meta;
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
        // (View::AddChildren only takes an initializer_list, so a vector won't compile).
        const transformedCode = transformVectorChildren(sanitized.code);
        // Stage local-file image assets (ImageView/SetResourceUrl) into the build
        // mount and rewrite their URLs to the in-container path, so they actually
        // render instead of falling back to the broken-image placeholder. Resolved
        // relative to the preview file's directory; remote/unresolvable URLs are
        // left untouched (placeholder handles them). Runs before slice/instrument
        // so both the harness and warm-server paths see the rewritten URLs.
        const stagedCode = this.deps.buildRunner.stageImageAssets(
            transformedCode,
            path.dirname(doc.uri.fsPath),
        );
        const extraSources = resolveProjectIncludes(doc);
        const slice = buildSlice(doc.getText(), doc.fileName, stagedCode, extraSources, extraction.params);
        const instrumented = instrumentCode(stagedCode, extraction.startLine, new Set(slice.helpers));
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
        /** ADR-007 provenance to merge into the metadata (WU-M3.6). Empty by
         *  default → metadata unchanged (no badge). */
        provenance?: ProvenanceEntry[];
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
        // WU-M3.6: merge ADR-007 provenance (untranslated IDS_) as a top-level
        // metadata field. host-merge → no server change; webview badge is M5.
        if (args.provenance && args.provenance.length > 0) {
            metadata = mergeProvenance(metadata, args.provenance);
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
        await this.renderAtProgress(progress, epoch);
    }

    /**
     * WU-M5.4: apply a declared `// @preview-state: progress=<f>` after a build by
     * scrubbing the resident plugin to that position ONCE. Unlike the interactive
     * `scrubAnimation`, this is invoked by the build itself (the reload just
     * completed) so it does NOT consult the `building` guard — the build owns the
     * server right now and `activeEpoch_` is current. Still epoch-guarded after the
     * await so a newer preview can't be overwritten. No-op when the server is down.
     */
    private async applyDeclaredProgress(progress: number, epoch: number): Promise<void> {
        if (!this.deps.previewServer?.isRunning) {
            return;
        }
        const p = Math.max(0, Math.min(1, progress));
        await this.renderAtProgress(p, epoch);
    }

    /**
     * Shared scrub render: RENDER_AT the resident plugin at `progress` and push the
     * frame to the webview (marked isScrub so the webview caches it without
     * re-adopting the epoch). The bucketed filename keeps each cached frame on a
     * stable backing file. Epoch-re-checked after the await so a frame for a
     * superseded preview is dropped. Callers gate entry (the `building` guard for
     * interactive scrubs; the just-finished build for declared progress).
     */
    private async renderAtProgress(progress: number, epoch: number): Promise<void> {
        const server = this.deps.previewServer;
        if (!server?.isRunning) {
            return;
        }
        const tmpDir = this.deps.buildRunner.getTmpDir();
        // Name the frame by a quantized progress bucket so each cached frame keeps a
        // STABLE backing file (a rotating mod-N name aliases distinct cached frames
        // onto one file, so a re-read after browser eviction surfaces the wrong
        // frame). The grid is FIXED so the file set stays BOUNDED to
        // SCRUB_PROGRESS_GRID+1 names — reused across animations instead of leaking a
        // fresh PNG per progress all session — while remaining collision-free for any
        // timeline up to the webview's 48-frame cap. Old frames are then fully swept
        // by BuildRunner.dispose()'s cleanupBuildTmpDir() on shutdown.
        const bucket = Math.round(progress * SCRUB_PROGRESS_GRID);
        const pngPath = path.join(tmpDir, `preview_scrub_${bucket}.png`);
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
        sourcePaths?: string[],
    ): void {
        const log = getLogger();
        const templatePath = path.join(
            buildRunner.getExtensionPath(), 'server', 'preview_harness.cpp.template');
        let template = '';
        try { template = fs.readFileSync(templatePath, 'utf-8'); } catch (err) { log.trace('Extension', 'harness template read failed', { error: String(err) }); }
        const offset = getHarnessCodeOffset(template);
        // WU-M4.5: pass the slice's sourcePaths so a `#line`-relabeled cross-file/
        // member error (e.g. cards.cpp:38) maps to the user's real file:line instead
        // of being dropped by the harness-only filename gate.
        const diag = diagnoseGccErrors(result.error || '', offset, doc, startLine, false, false, sourcePaths);
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
        // `// @preview-state: progress=<f>` (WU-M5.4): force the SERVER/dlopen path
        // — the OPPOSITE of focus. The animation scrubber (__SetPreviewProgress /
        // RENDER_AT) lives ONLY in the resident plugin, so a progress frame needs the
        // dlopen path that loads it. progress is applied after the build (scrubAnimation).
        const hasProgress = typeof extraction.state?.progress === 'number';
        // `// @preview-state: focus=<id>` (ADR-006): force the full-harness path.
        // The harness is the proven focus-capable build (it fills {{POST_BUILD_FOCUS}}
        // + NAME-injects the focus var); the T1 parser/scene-builder can't focus, and
        // the dlopen plugin's server-side focus hook is not wired. A focus directive is
        // a deliberate "show me this state" action, so the slower harness render is OK.
        //
        // CONFLICT (WU-M5.4): focus forces harness, progress forces server — mutually
        // exclusive paths. POLICY: progress WINS (a runtime-state request is more
        // specific). When both are set we suppress the harness-force here so the
        // dlopen path runs and the scrubber exists; runPreview emits a `focus-approx`
        // provenance recording that focus was dropped in favor of progress.
        const hasFocus = !!extraction.state?.focus && !hasProgress;
        if (!hasFocus && slice.rung === 'single-fn' && !hasAnimation && this.parserStrategy.canHandle(this.deps.previewServer)) {
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

        // Phase 2: dlopen server mode. Skipped for focus-bearing previews
        // (hasFocus) — the plugin's server-side focus hook is not wired, so we
        // fall through to the harness path which can render the focus ring.
        if (!hasFocus && !usedServerMode && this.dlopenStrategy.canHandle(this.deps.previewServer)) {
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
                // WU-M4.5: thread the slice's sourcePaths so a `#line`-relabeled
                // cross-file/member error in the plugin compile maps to the user's
                // real file:line (the globals slot's inlined defs carry `#line`).
                const diag = diagnoseGccErrors(stratResult.result.error || '', offset, doc, extraction.startLine, true, false, slice.sourcePaths);
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

    setEnsureRuntimeReady(fn: (opts: { silent: boolean }) => Promise<boolean>): void {
        this.deps.ensureRuntimeReady = fn;
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

        // Runtime gate: when no resident server is up we're about to fall back to
        // the one-shot build path. Verify the runtime is ready first and, if not,
        // surface actionable setup guidance (docker install, or — in local mode —
        // pick the DALi folder / install host deps) instead of letting the build
        // fail with a raw string buried in the panel. Runs before building/
        // lastDocument advance so an early return needs no cleanup. Live-preview
        // (keystroke) renders pass silent so they never pop a modal or spam the panel.
        if (!this.deps.previewServer?.isRunning && this.deps.ensureRuntimeReady) {
            const ready = await this.deps.ensureRuntimeReady({ silent: livePreview });
            if (!ready) {
                if (!livePreview) {
                    previewManager.showError(
                        'Preview runtime is not ready. Follow the setup steps in the notification.',
                    );
                    this.deps.statusBar?.showError('Runtime not available');
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
                // Honesty (WU-M5.5): focus is not applied per-variant in multi-config
                // (focus routes to the single harness path). A warn-log alone is
                // invisible (the user doesn't watch the panel), so promote it to a
                // `focus-multiconfig` provenance badge on each variant (ADR-007). Keep
                // the cheap log too. undefined focus → no badge.
                if (extraction.state?.focus) {
                    this.deps.outputChannel.appendLine(
                        `[Preview] ⚠ // @preview-state: focus=${extraction.state.focus} is not applied in multi-config preview (${extraction.configs.length} configs). The focus ring is only shown in single-config previews. (Shown as a 'focus-multiconfig' badge on each variant.)`,
                    );
                }
                await this.runMultiPreview(
                    doc, extraction.configs, instrumented, extraction.startLine, myGeneration, startTime,
                    extraction.state?.focus,
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
                // WU-M3.6: honest untranslated signal for a single-config preview
                // with a locale + IDS_ keys (no catalog → raw key). WU-M5.1: an
                // image-placeholder signal when the code references a remote/
                // unreachable ImageView URL (rendered as the bundled placeholder).
                // Both merged into the metadata for the M5 badge channel (ADR-007).
                const singleCfg = extraction.configs && extraction.configs.length === 1
                    ? extraction.configs[0] : undefined;
                const provenance = [
                    ...buildUntranslatedProvenance(singleCfg?.locale, extraction.code),
                    ...buildImagePlaceholderProvenance(extraction.code),
                ];
                // WU-M5.4 conflict: focus + progress are mutually exclusive paths;
                // progress wins (see runBuildStrategies). Record that focus was
                // dropped so the user SEES it (focus-approx badge, ADR-007).
                const hasProgress = typeof extraction.state?.progress === 'number';
                if (extraction.state?.focus && hasProgress) {
                    provenance.push({
                        kind: 'focus-approx',
                        detail: `focus=${extraction.state.focus} ignored — progress=${extraction.state.progress} took the scrubber path`,
                    });
                }
                this.applySuccessfulBuild({
                    result, parserScene, usedServerMode, usedParserMode,
                    buildTimeMs, startTime, previewManager, provenance,
                });
                // WU-M5.4: apply `progress=<f>` by scrubbing the resident plugin to
                // that normalized position ONCE (clamped to [0,1] in
                // applyDeclaredProgress). Only meaningful on the server/dlopen path
                // with a registered animation — that is where the scrubber
                // (__SetPreviewProgress / RENDER_AT) exists. On the harness fallback
                // (server down) there is no scrubber, so the first frame (progress 0)
                // stands; the directive is then a no-op.
                if (hasProgress && usedServerMode && result.animationCount && result.animationCount > 0) {
                    await this.applyDeclaredProgress(extraction.state!.progress!, this.activeEpoch_);
                }
            } else {
                this.reportHarnessFailure(result, doc, extraction.startLine, buildRunner, slice.sourcePaths);
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
        /** WU-M5.5: a `// @preview-state: focus=` that was dropped because focus
         *  only renders on the single-config harness path. When set, each variant
         *  result carries a `focus-multiconfig` provenance so the webview shows the
         *  silent-drop as a badge (ADR-007). undefined → no badge. */
        focusId?: string,
    ): Promise<void> {
        const log = getLogger();
        log.debug('Extension', 'runMultiPreview start', { configCount: configs.length, focusId });
        const { buildRunner, previewManager } = this.deps;
        if (!buildRunner || !previewManager) {
            return;
        }

        // WU-M5.5: focus-multiconfig provenance, merged onto every variant's
        // metadata by previewManager.updateMultiImage. [] when no dropped focus.
        const focusProvenance = buildFocusMulticonfigProvenance(focusId);

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
                    // WU-M3.8: thread the per-config locale/fontScale into the plugin
                    // compile so each gallery variant installs its own RTL mirror +
                    // untranslated override (locale) and runtime SetScale (fontScale)
                    // — ADR-004 warm-path install slots. theme is NOT routed into the
                    // plugin here (theme reskin on the warm path is owned by M3.3/M3.4
                    // via the server override + window bg through reload, so doubling
                    // it in the plugin is avoided). The RELOAD command below still
                    // re-sends theme/locale/fontScale to the resident server.
                    const pluginResult = await buildRunner.compilePlugin(
                        instrumented, config.name, '', '', { locale, fontScale },
                    );

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
                    // Phase 1 fallback (harness path). Thread fontScale/locale so a
                    // gallery variant still scales text (frozen SetScalingFactor) and
                    // mirrors RTL even without the resident server (WU-M3.8 / ADR-004
                    // §3: frozen-needing knobs are exactly what the harness path
                    // applies). theme already threaded; font/focus stay defaulted.
                    const result = await buildRunner.buildAndRun(
                        instrumented, width, height, theme, this.currentBgColor_,
                        undefined, '', '', undefined, fontScale, locale,
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

        // WU-M5.5: tag each successful variant with the dropped-focus provenance so
        // every tile shows the `focus-multiconfig` badge (host-merge per ADR-007;
        // previewManager merges it into the metadata it reads). No-op when [].
        if (focusProvenance.length > 0) {
            for (const r of results) {
                if (r.success) {
                    r.provenance = [...(r.provenance ?? []), ...focusProvenance];
                }
            }
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
