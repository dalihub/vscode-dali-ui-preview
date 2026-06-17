import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildBackend } from './buildBackend';
import { ConfigurationService } from './configurationService';
import { getLogger } from './logger';

export interface BuildResult {
    success: boolean;
    pngPath?: string;
    metadataPath?: string;
    error?: string;
    // Set on a RELOAD result when the loaded plugin registered animations:
    // count of scrubbable animations and the longest animation's duration (ms).
    animationCount?: number;
    animationDurationMs?: number;
}

export class BuildRunner {
    private templateContent: string;
    private pluginTemplateContent: string;
    private tmpDir: string;
    private extensionPath: string;

    /**
     * Compute a workspace-specific temp directory path.
     *
     * When a workspace folder is open, appends an 8-char MD5 hash of the
     * workspace root URI to avoid multi-window conflicts.  Falls back to the
     * plain `/tmp/dali_preview` when no workspace folder is available.
     */
    static getWorkspaceTmpDir(): string {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            const rootPath = folders[0].uri.fsPath;
            const hash = crypto.createHash('md5').update(rootPath).digest('hex').slice(0, 8);
            return `/tmp/dali_preview_${hash}`;
        }
        return '/tmp/dali_preview';
    }

    constructor(
        context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel,
        private backend: BuildBackend,
    ) {
        this.extensionPath = context.extensionPath;
        const templatePath = path.join(context.extensionPath, 'server', 'preview_harness.cpp.template');
        this.templateContent = fs.readFileSync(templatePath, 'utf-8');

        const pluginTemplatePath = path.join(context.extensionPath, 'server', 'preview_plugin.cpp.template');
        this.pluginTemplateContent = fs.readFileSync(pluginTemplatePath, 'utf-8');

        this.tmpDir = BuildRunner.getWorkspaceTmpDir();
        if (!fs.existsSync(this.tmpDir)) {
            fs.mkdirSync(this.tmpDir, { recursive: true });
        }
    }

    getExtensionPath(): string {
        return this.extensionPath;
    }

    getTmpDir(): string {
        return this.tmpDir;
    }

    getPluginTemplateContent(): string {
        return this.pluginTemplateContent;
    }

    /**
     * Sanitize a config name to a safe filename segment.
     * Replaces spaces and special chars with underscores, lowercases.
     */
    static sanitizeConfigName(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    /**
     * Returns the DALi Vector4 background color literal for the given theme.
     */
    static themeToBackgroundColor(theme: 'light' | 'dark'): string {
        return theme === 'light'
            ? 'Vector4(1.0f, 1.0f, 1.0f, 1.0f)'
            : 'Vector4(0.1f, 0.1f, 0.12f, 1.0f)';
    }

    /**
     * Converts a #RRGGBB hex color string to a DALi Vector4 literal.
     * Returns the dark-theme fallback if the input is not a valid #RRGGBB string.
     */
    static hexToVector4(hex: string): string {
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
            return BuildRunner.themeToBackgroundColor('dark');
        }
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return `Vector4(${r.toFixed(4)}f, ${g.toFixed(4)}f, ${b.toFixed(4)}f, 1.0f)`;
    }

    /** Resolve the DALi background Vector4 literal from an optional #RRGGBB hex or the theme. */
    private static resolveBgColorVec(bgColor: string | undefined, theme: 'light' | 'dark'): string {
        return bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
            ? BuildRunner.hexToVector4(bgColor)
            : BuildRunner.themeToBackgroundColor(theme);
    }

    /**
     * Build the FontClient::AddCustomFontDirectory(...) harness snippet for an
     * optional custom font. Returns '' when no font is given. The directory is
     * resolved from `fontDirs` (falling back to the font's own dirname) and
     * escaped for embedding in a C++ string literal.
     */
    private buildFontSetup(font: string | undefined, fontDirs: string[]): string {
        if (!font) {
            return '';
        }
        const fontDir = fontDirs.find(d => {
            try {
                return fs.existsSync(path.join(d, font));
            } catch (err) {
                getLogger().trace('Build', 'font dir check failed', { error: String(err) });
                return false;
            }
        }) || path.dirname(font);
        const escapedDir = fontDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `    FontClient::Get().AddCustomFontDirectory("${escapedDir}");`;
    }

    /**
     * Substitute the shared harness placeholders. The common slots
     * (includes/globals/code/width/height/background/font) are filled here;
     * mode-specific slots (OUTPUT_PATH, OUTPUT_DIR, METADATA_PATH, ANIMATION_*)
     * are passed via `extra`. The user-supplied slots (includes/globals/code)
     * are substituted first — exactly as the original inline chains did — so the
     * rendered harness is byte-identical regardless of `extra` ordering.
     */
    private renderHarness(
        template: string,
        opts: {
            userCode: string;
            width: number;
            height: number;
            bgColorVec: string;
            fontSetup: string;
            includes?: string;
            globals?: string;
            extra?: Record<string, string>;
        },
    ): string {
        let out = template
            .replace(/\{\{USER_INCLUDES\}\}/g, opts.includes ?? '')
            .replace(/\{\{USER_GLOBALS\}\}/g, opts.globals ?? '')
            .replace(/\{\{USER_CODE\}\}/g, opts.userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, opts.bgColorVec)
            .replace(/\{\{FONT_SETUP\}\}/g, opts.fontSetup);
        if (opts.extra) {
            for (const [key, value] of Object.entries(opts.extra)) {
                out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }
        }
        return out;
    }

    /**
     * Inject animation registration so the preview server can scrub animations.
     * After every `<var>.Play();` in user code, append `__RegisterPreviewAnimation(<var>);`
     * so the resident plugin collects each Animation handle for SetCurrentProgress.
     * Named animations only — unnamed temporaries have no handle to scrub and are skipped.
     */
    static instrumentAnimations(userCode: string): string {
        // Capture the FULL handle chain before `.Play();` so member/qualified
        // handles register the whole expression — `this->anim` / `obj.anim` —
        // not a stray sub-identifier that would be undeclared in user scope.
        return userCode.replace(
            /((?:[A-Za-z_]\w*\s*(?:\.|->)\s*)*[A-Za-z_]\w*)\s*\.\s*Play\s*\(\s*\)\s*;/g,
            '$& __RegisterPreviewAnimation($1);'
        );
    }

    /**
     * Compile user code into a shared library (.so) for the dlopen fast path.
     * When configName is provided, the .so is named preview_plugin_{configName}.so.
     * Delegates the actual compile to the active backend; a backend with no
     * resident server (local mode, M1) reports the path unsupported.
     */
    async compilePlugin(
        userCode: string,
        configName?: string,
        sliceGlobals = '',
        sliceIncludes = '',
    ): Promise<BuildResult & { soPath?: string }> {
        const log = getLogger();
        log.debug('Build', 'compilePlugin', { configName: configName || 'default', sliced: !!sliceGlobals });

        const suffix = configName ? `_${BuildRunner.sanitizeConfigName(configName)}` : '';
        const pluginSrc = path.join(this.tmpDir, `preview_plugin${suffix}.cpp`);
        const soPath    = path.join(this.tmpDir, `preview_plugin${suffix}.so`);

        // sliceGlobals/sliceIncludes are '' on the self-contained (Rung3) path →
        // byte-identical to before. Non-empty only when SliceBuilder collected
        // same-file defs / stubs for the Rung2 heuristic path.
        const pluginCode = this.pluginTemplateContent
            .replace(/\{\{USER_INCLUDES\}\}/g, sliceIncludes)
            .replace(/\{\{USER_GLOBALS\}\}/g, sliceGlobals)
            .replace(/\{\{USER_CODE\}\}/g, BuildRunner.instrumentAnimations(userCode));

        if (!this.backend.compilePlugin) {
            return { success: false, error: `Plugin (dlopen) compile is not supported by the ${this.backend.kind} runtime backend.` };
        }
        const result = await this.backend.compilePlugin({
            source: pluginCode,
            workDir: this.tmpDir,
            srcPath: pluginSrc,
            soPath,
            timeoutMs: 30_000,
        });
        if (!result.success) {
            return { success: false, error: result.error };
        }
        log.debug('Build', 'compilePlugin done', { soPath: result.soPath });
        return { success: true, soPath: result.soPath };
    }

    /**
     * Render the harness for `userCode` and compile+run it via the active
     * backend (docker container or local g++/Xvfb) to capture a PNG.
     *
     * The templating above the backend call is identical regardless of where
     * the build runs; only the baked-in output path differs (container `/work`
     * vs a host path), which the backend's `outputPaths` resolves.
     */
    async buildAndRun(
        userCode: string,
        width?: number,
        height?: number,
        theme: 'light' | 'dark' = 'dark',
        bgColor?: string,
        font?: string,
        sliceGlobals = '',
        sliceIncludes = ''
    ): Promise<BuildResult> {
        const log = getLogger();
        log.debug('Build', 'buildAndRun start', { width, height, theme, backend: this.backend.kind });

        const cfg = ConfigurationService.getInstance();
        if (!width || !height) {
            width = cfg.previewWidth;
            height = cfg.previewHeight;
        }

        const out = this.backend.outputPaths(this.tmpDir);

        // Custom fonts: the local backend can register host font directories
        // directly; the container can't see them without a bind-mount (out of
        // scope for M1), so docker mode ignores the font — unchanged behavior.
        let fontSetup = '';
        if (font) {
            if (this.backend.kind === 'local') {
                fontSetup = this.buildFontSetup(font, cfg.fontDirectories);
            } else {
                log.warn('Build', 'docker mode: custom font ignored (not yet supported in container runtime)', { font });
            }
        }

        const bgColorVec = BuildRunner.resolveBgColorVec(bgColor, theme);
        const harness = this.renderHarness(this.templateContent, {
            userCode, width, height, bgColorVec, fontSetup,
            includes: sliceIncludes, globals: sliceGlobals,
            extra: { OUTPUT_PATH: out.pngEmbed, METADATA_PATH: out.metadataEmbed },
        });

        // Remove stale outputs so we never report a previous run's PNG.
        for (const p of [out.pngHost, out.metadataHost]) {
            try { fs.unlinkSync(p); } catch { /* not present */ }
        }

        const result = await this.backend.capture({
            source: harness,
            workDir: this.tmpDir,
            pngPathHost: out.pngHost,
            metadataPathHost: out.metadataHost,
            width,
            height,
            timeoutMs: 60_000,
        });

        if (!result.success) {
            return { success: false, error: result.error ?? 'Build failed' };
        }
        return {
            success: true,
            pngPath: result.pngPath,
            metadataPath: result.metadataPath,
        };
    }

    dispose() {
        // Clean transient artifacts from /tmp/dali_preview/. The persistent
        // preview_server binary is preserved because rebuilding it is
        // expensive (~several seconds) and PreviewServer's mtime check
        // handles staleness when the source changes.
        try {
            const removed = cleanupBuildTmpDir(this.tmpDir);
            if (removed > 0) {
                this.outputChannel.appendLine(
                    `[BuildRunner] Removed ${removed} temp artifact${removed === 1 ? '' : 's'} from ${this.tmpDir}`
                );
            }
        } catch (err: any) {
            this.outputChannel.appendLine(`[BuildRunner] Temp cleanup failed: ${err?.message || err}`);
        }
    }
}

/**
 * Files to preserve across cleanup cycles. `preview_server` is an
 * expensive-to-rebuild persistent binary — leave it in place so the next
 * session starts instantly.
 */
const CLEANUP_KEEP = new Set(['preview_server']);

/**
 * Remove all transient extension artifacts from `tmpDir`, except files
 * listed in CLEANUP_KEEP. Best-effort: individual failures are ignored.
 * Exported for unit testing — the runtime caller is `BuildRunner.dispose()`.
 *
 * @returns the number of entries successfully removed.
 */
export function cleanupBuildTmpDir(tmpDir: string): number {
    if (!fs.existsSync(tmpDir)) {
        return 0;
    }
    let removed = 0;
    let entries: string[];
    try {
        entries = fs.readdirSync(tmpDir);
    } catch (err) {
        getLogger().trace('Cleanup', 'readdir failed', { error: String(err) });
        return 0;
    }
    for (const name of entries) {
        if (CLEANUP_KEEP.has(name)) {
            continue;
        }
        const full = path.join(tmpDir, name);
        try {
            const stat = fs.lstatSync(full);
            if (stat.isDirectory()) {
                fs.rmSync(full, { recursive: true, force: true });
            } else {
                fs.unlinkSync(full);
            }
            removed++;
        } catch (err) {
            getLogger().trace('Cleanup', 'remove artifact failed', { error: String(err), name });
        }
    }
    return removed;
}
