import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { XvfbManager } from './xvfbManager';
import { DockerRuntime } from './dockerRuntime';
import { ConfigurationService } from './configurationService';
import { getLogger } from './logger';
import { ensureRuntimeImage } from './pullImageCommand';

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
    private hasCcache: boolean = false;
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
        private context: vscode.ExtensionContext,
        private xvfbManager: XvfbManager | undefined,
        private outputChannel: vscode.OutputChannel,
        private dockerRuntime?: DockerRuntime
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

        // Check ccache availability
        try {
            require('child_process').execSync('which ccache', { stdio: 'ignore' });
            this.hasCcache = true;
            this.outputChannel.appendLine('ccache detected, will use for faster builds');
        } catch (err) {
            this.hasCcache = false;
            getLogger().trace('Build', 'ccache not found', { error: String(err) });
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
     * Compile user code into a shared library (.so) for dlopen.
     * When configName is provided, the .so is named preview_plugin_{configName}.so.
     * Returns the path to the .so on success.
     */
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

        // Compile inside the container so the host doesn't need DALi.
        if (!this.dockerRuntime) {
            return { success: false, error: 'Docker runtime mode but DockerRuntime not provided.' };
        }
        if (!(await this.dockerRuntime.isAvailable())) {
            return { success: false, error: 'Docker is not available.' };
        }
        const cfg = ConfigurationService.getInstance();
        const result = await this.dockerRuntime.compilePlugin({
            source: pluginCode,
            workDir: this.tmpDir,
            srcPath: pluginSrc,
            soPath,
            imageTag: cfg.daliVersionTag,
            timeoutMs: 30_000,
        });
        if (!result.success) {
            log.debug('Build', 'docker compilePlugin failed', { elapsedMs: result.elapsedMs });
            return { success: false, error: `Plugin compile failed (docker, ${result.elapsedMs}ms):\n${result.output}` };
        }
        log.debug('Build', 'docker compilePlugin done', { soPath, elapsedMs: result.elapsedMs });
        return { success: true, soPath };
    }

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
        log.debug('Build', 'buildAndRun start', { width, height, theme });

        return this.buildAndRunDocker(userCode, width, height, theme, bgColor, font, sliceGlobals, sliceIncludes);
    }

    /**
     * Docker runtime variant of buildAndRun.
     * The container holds DALi + g++ + Xvfb; the host owns templating only.
     * Bind-mount maps the host tmpDir to /work in the container, so the
     * harness writes its PNG/metadata where the host can read them back.
     */
    private async buildAndRunDocker(
        userCode: string,
        width: number | undefined,
        height: number | undefined,
        theme: 'light' | 'dark',
        bgColor: string | undefined,
        font: string | undefined,
        sliceGlobals = '',
        sliceIncludes = '',
    ): Promise<BuildResult> {
        const log = getLogger();

        if (!this.dockerRuntime) {
            return { success: false, error: 'Docker runtime mode is enabled but no DockerRuntime was provided to BuildRunner.' };
        }

        if (!(await this.dockerRuntime.isAvailable())) {
            return {
                success: false,
                error: 'Docker is not available. Run "DALi: Install Docker via Terminal" from the Command Palette to set it up — no reboot needed.'
            };
        }

        const cfg = ConfigurationService.getInstance();
        const imageTag = cfg.daliVersionTag;
        const imageRef = this.dockerRuntime.imageRef(imageTag);

        // Auto-pull (with progress) instead of telling the user to do it
        // manually — consistent with the preview-server path.
        if (!(await ensureRuntimeImage(this.dockerRuntime, this.outputChannel))) {
            return {
                success: false,
                error: `DALi runtime image not available: ${imageRef}. ` +
                    `Download it with "DALi Preview: Download Runtime Image".`
            };
        }

        if (!width || !height) {
            width = cfg.previewWidth;
            height = cfg.previewHeight;
        }

        // Custom fonts inside the container would need their dirs bind-mounted
        // separately. Out of scope for Phase 5-A — warn and continue without.
        if (font) {
            log.warn('Build', 'docker mode: custom font ignored (not yet supported in container runtime)', { font });
        }

        // Container-side paths (bind-mount: tmpDir → /work)
        const pngPathContainer = '/work/preview.png';
        const metadataPathContainer = '/work/preview_metadata.json';
        // Host-side paths (where the bind-mounted files actually live)
        const pngPathHost = path.join(this.tmpDir, 'preview.png');
        const metadataPathHost = path.join(this.tmpDir, 'preview_metadata.json');

        const bgColorVec = BuildRunner.resolveBgColorVec(bgColor, theme);
        const harness = this.renderHarness(this.templateContent, {
            userCode, width, height, bgColorVec, fontSetup: '',
            includes: sliceIncludes, globals: sliceGlobals,
            extra: { OUTPUT_PATH: pngPathContainer, METADATA_PATH: metadataPathContainer },
        });

        // Remove stale outputs so we never report a previous run's PNG.
        for (const p of [pngPathHost, metadataPathHost]) {
            try { fs.unlinkSync(p); } catch { /* not present */ }
        }

        log.debug('Build', 'docker buildAndCapture start', { imageRef, width, height });
        const result = await this.dockerRuntime.buildAndCapture({
            source: harness,
            workDir: this.tmpDir,
            imageTag,
            width,
            height,
            timeoutMs: 60_000,
        });

        if (!result.success) {
            return {
                success: false,
                error: `Docker render failed (exit ${result.exitCode}):\n${result.output}`,
            };
        }

        if (!fs.existsSync(pngPathHost)) {
            return {
                success: false,
                error: `Container exited 0 but PNG not found at ${pngPathHost}.\nContainer output:\n${result.output}`,
            };
        }

        log.debug('Build', 'docker buildAndCapture done', { pngPathHost, elapsedMs: result.elapsedMs });
        return {
            success: true,
            pngPath: pngPathHost,
            metadataPath: fs.existsSync(metadataPathHost) ? metadataPathHost : undefined,
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
