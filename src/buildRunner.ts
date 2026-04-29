import { exec } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { XvfbManager } from './xvfbManager';
import { DockerRuntime } from './dockerRuntime';
import { findDaliPrefix, validateDaliPrefix } from './daliEnvironment';
import { SdbManager } from './sdbManager';
import { ConfigurationService } from './configurationService';
import { getLogger } from './logger';

export interface BuildResult {
    success: boolean;
    pngPath?: string;
    metadataPath?: string;
    error?: string;
}

export interface AnimationBuildResult extends BuildResult {
    gifPath?: string;
    frameCount?: number;
    durationMs?: number;
}

export interface InteractiveBuildResult {
    success: boolean;
    binPath?: string;
    error?: string;
}

export class BuildRunner {
    private daliPrefix: string = '';
    private templateContent: string;
    private interactiveTemplateContent: string;
    private pluginTemplateContent: string;
    private animationTemplateContent: string;
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

        const interactiveTemplatePath = path.join(context.extensionPath, 'server', 'preview_interactive.cpp.template');
        this.interactiveTemplateContent = fs.readFileSync(interactiveTemplatePath, 'utf-8');

        const pluginTemplatePath = path.join(context.extensionPath, 'server', 'preview_plugin.cpp.template');
        this.pluginTemplateContent = fs.readFileSync(pluginTemplatePath, 'utf-8');

        const animationTemplatePath = path.join(context.extensionPath, 'server', 'preview_animation.cpp.template');
        this.animationTemplateContent = fs.readFileSync(animationTemplatePath, 'utf-8');

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

        // Load DALi prefix from settings
        this.loadDaliPrefix();
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

    getInteractiveTemplateContent(): string {
        return this.interactiveTemplateContent;
    }

    async getDaliPrefix(): Promise<string> {
        if (!(await this.ensureDaliPrefix())) {
            return '';
        }
        return this.daliPrefix;
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

    /**
     * Compile user code into a shared library (.so) for dlopen.
     * When configName is provided, the .so is named preview_plugin_{configName}.so.
     * Returns the path to the .so on success.
     */
    async compilePlugin(userCode: string, configName?: string): Promise<BuildResult & { soPath?: string }> {
        const log = getLogger();
        log.debug('Build', 'compilePlugin', { configName: configName || 'default' });

        const suffix = configName ? `_${BuildRunner.sanitizeConfigName(configName)}` : '';
        const pluginSrc = path.join(this.tmpDir, `preview_plugin${suffix}.cpp`);
        const soPath    = path.join(this.tmpDir, `preview_plugin${suffix}.so`);

        const pluginCode = this.pluginTemplateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode);

        // Docker mode: compile inside the container so the host doesn't need DALi.
        if (ConfigurationService.getInstance().runtimeMode === 'docker') {
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

        // Native mode: existing behavior
        if (!(await this.ensureDaliPrefix())) {
            return {
                success: false,
                error: 'DALi installation not found.\nUse "DALi: Open Preview" command and configure the DALi path in settings.'
            };
        }

        fs.writeFileSync(pluginSrc, pluginCode);

        const result = await this.compileShared(pluginSrc, soPath);
        if (!result.success) {
            return result;
        }
        return { success: true, soPath };
    }

    private loadDaliPrefix() {
        const cfg = ConfigurationService.getInstance();
        const settingsPath = cfg.daliPrefix;
        if (settingsPath && validateDaliPrefix(settingsPath)) {
            this.daliPrefix = settingsPath;
        }
    }

    private async ensureDaliPrefix(): Promise<boolean> {
        if (this.daliPrefix && validateDaliPrefix(this.daliPrefix)) {
            return true;
        }
        // Try auto-detect
        const detected = await findDaliPrefix();
        if (detected && validateDaliPrefix(detected)) {
            this.daliPrefix = detected;
            return true;
        }
        return false;
    }

    async buildAndRun(
        userCode: string,
        width?: number,
        height?: number,
        theme: 'light' | 'dark' = 'dark',
        bgColor?: string,
        locale?: string,
        fontScale?: number,
        font?: string
    ): Promise<BuildResult> {
        const log = getLogger();
        log.debug('Build', 'buildAndRun start', { width, height, theme });

        // Docker runtime: skip native DALi prefix check, dispatch to docker path.
        if (ConfigurationService.getInstance().runtimeMode === 'docker') {
            return this.buildAndRunDocker(userCode, width, height, theme, bgColor, font);
        }

        // Ensure DALi prefix is available
        if (!(await this.ensureDaliPrefix())) {
            return {
                success: false,
                error: 'DALi installation not found.\nUse "DALi: Open Preview" command and configure the DALi path in settings.'
            };
        }

        if (!width || !height) {
            const cfg = ConfigurationService.getInstance();
            width = cfg.previewWidth;
            height = cfg.previewHeight;
        }
        const pngPath = path.join(this.tmpDir, 'preview.png');
        const metadataPath = path.join(this.tmpDir, 'preview_metadata.json');
        const harnessPath = path.join(this.tmpDir, 'preview_harness.cpp');
        const binPath = path.join(this.tmpDir, 'preview_bin');

        // 1. Generate harness
        const bgColorVec = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
            ? BuildRunner.hexToVector4(bgColor)
            : BuildRunner.themeToBackgroundColor(theme);

        // Build font setup code for harness template substitution
        let fontSetup = '';
        if (font) {
            const fontDirs = ConfigurationService.getInstance().fontDirectories;
            // Find the directory containing the font file
            const fontDir = fontDirs.find(d => {
                try {
                    return fs.existsSync(path.join(d, font!));
                } catch (err) {
                    getLogger().trace('Build', 'font dir check failed', { error: String(err) });
                    return false;
                }
            }) || path.dirname(font);
            // Escape backslashes and double-quotes before embedding in C++ string literal
            const escapedDir = fontDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            fontSetup = `    FontClient::Get().AddCustomFontDirectory("${escapedDir}");`;
        }

        const harness = this.templateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
            .replace(/\{\{OUTPUT_PATH\}\}/g, pngPath)
            .replace(/\{\{METADATA_PATH\}\}/g, metadataPath)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorVec)
            .replace(/\{\{FONT_SETUP\}\}/g, fontSetup);

        fs.writeFileSync(harnessPath, harness);

        // 2. Compile
        const compileResult = await this.compile(harnessPath, binPath);
        if (!compileResult.success) {
            return compileResult;
        }

        // 3. Execute
        return this.execute(binPath, pngPath, metadataPath, width, height, locale, fontScale);
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
    ): Promise<BuildResult> {
        const log = getLogger();

        if (!this.dockerRuntime) {
            return { success: false, error: 'Docker runtime mode is enabled but no DockerRuntime was provided to BuildRunner.' };
        }

        if (!(await this.dockerRuntime.isAvailable())) {
            return {
                success: false,
                error: 'Docker is not available. Install Docker, add your user to the docker group, and re-launch VS Code.'
            };
        }

        const cfg = ConfigurationService.getInstance();
        const imageTag = cfg.daliVersionTag;
        const imageRef = this.dockerRuntime.imageRef(imageTag);

        if (!(await this.dockerRuntime.hasImage(imageTag))) {
            return {
                success: false,
                error: `DALi runtime image not found locally: ${imageRef}\nPull it with:  docker pull ${imageRef}`
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

        const bgColorVec = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
            ? BuildRunner.hexToVector4(bgColor)
            : BuildRunner.themeToBackgroundColor(theme);

        const harness = this.templateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
            .replace(/\{\{OUTPUT_PATH\}\}/g, pngPathContainer)
            .replace(/\{\{METADATA_PATH\}\}/g, metadataPathContainer)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorVec)
            .replace(/\{\{FONT_SETUP\}\}/g, '');

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

    private compileShared(source: string, output: string): Promise<BuildResult> {
        const log = getLogger();
        const pkgConfigPath = `${this.daliPrefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig`;
        const compiler = this.hasCcache ? 'ccache g++' : 'g++';

        const cmd = [
            `PKG_CONFIG_PATH="${pkgConfigPath}"`,
            `${compiler} -std=c++17 -O0 -shared -fPIC`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
            `"${source}"`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --libs dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
            `-L"${this.daliPrefix}/lib" -Wl,-rpath-link,"${this.daliPrefix}/lib"`,
            `-o "${output}"`
        ].join(' ');

        log.trace('Compile', 'g++ command (shared)', { cmd });
        return new Promise((resolve) => {
            exec(cmd, { timeout: 30000, shell: '/bin/bash' }, (error, _stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr || error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    private compile(source: string, output: string): Promise<BuildResult> {
        const log = getLogger();
        const pkgConfigPath = `${this.daliPrefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig`;
        const compiler = this.hasCcache ? 'ccache g++' : 'g++';

        const cmd = [
            `PKG_CONFIG_PATH="${pkgConfigPath}"`,
            `${compiler} -std=c++17 -O0`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
            `"${source}"`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --libs dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
            `-L"${this.daliPrefix}/lib" -Wl,-rpath-link,"${this.daliPrefix}/lib"`,
            `-o "${output}"`
        ].join(' ');

        log.trace('Compile', 'g++ command', { cmd });
        return new Promise((resolve) => {
            exec(cmd, { timeout: 30000, shell: '/bin/bash' }, (error, _stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr || error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    private execute(
        binPath: string, pngPath: string, metadataPath: string,
        width: number, height: number,
        locale?: string, fontScale?: number
    ): Promise<BuildResult> {
        const log = getLogger();
        const display = this.xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';

        const env: NodeJS.ProcessEnv = {
            ...process.env,
            LD_LIBRARY_PATH: `${this.daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
            DISPLAY: display,
            DALI_WINDOW_WIDTH: String(width),
            DALI_WINDOW_HEIGHT: String(height),
            ...(locale ? { LANG: `${locale}.UTF-8` } : {}),
            // Phase 3-1 stub: env var set for future DALi API hook; actual TextController
            // integration planned for a later phase.
            ...(fontScale !== undefined ? { DALI_FONT_SCALE: String(fontScale) } : {}),
        };

        log.trace('Execute', 'running binary', { binPath, display, DALI_WINDOW_WIDTH: String(width), DALI_WINDOW_HEIGHT: String(height) });

        // Remove old PNG
        if (fs.existsSync(pngPath)) {
            fs.unlinkSync(pngPath);
        }

        return new Promise((resolve) => {
            exec(binPath, { env, timeout: 10000 }, (error, stdout, stderr) => {
                if (stdout.includes('OK:')) {
                    resolve({ success: true, pngPath, metadataPath });
                } else if (error) {
                    resolve({ success: false, error: `Runtime error:\n${stderr || error.message}` });
                } else {
                    resolve({ success: false, error: `Unexpected output:\n${stdout}\n${stderr}` });
                }
            });
        });
    }

    /**
     * Compile user code with the interactive harness template.
     * The resulting binary enters app.MainLoop() and stays running
     * (for VNC mode), rather than capturing a PNG and exiting.
     */
    async buildInteractive(
        userCode: string,
        width?: number,
        height?: number,
        theme: 'light' | 'dark' = 'dark',
        bgColor?: string,
        font?: string
    ): Promise<InteractiveBuildResult> {
        if (!(await this.ensureDaliPrefix())) {
            return {
                success: false,
                error: 'DALi installation not found.\nUse "DALi: Open Preview" command and configure the DALi path in settings.'
            };
        }

        if (!width || !height) {
            const cfg = ConfigurationService.getInstance();
            width = cfg.previewWidth;
            height = cfg.previewHeight;
        }

        const metadataPath = path.join(this.tmpDir, 'preview_interactive_metadata.json');
        const harnessPath  = path.join(this.tmpDir, 'preview_interactive.cpp');
        const binPath      = path.join(this.tmpDir, 'preview_interactive_bin');

        const bgColorVec = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
            ? BuildRunner.hexToVector4(bgColor)
            : BuildRunner.themeToBackgroundColor(theme);

        let fontSetup = '';
        if (font) {
            const fontDirs = ConfigurationService.getInstance().fontDirectories;
            const fontDir = fontDirs.find(d => {
                try {
                    return fs.existsSync(path.join(d, font!));
                } catch (err) {
                    getLogger().trace('Build', 'interactive font dir check failed', { error: String(err) });
                    return false;
                }
            }) || path.dirname(font);
            const escapedDir = fontDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            fontSetup = `    FontClient::Get().AddCustomFontDirectory("${escapedDir}");`;
        }

        const harness = this.interactiveTemplateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
            .replace(/\{\{METADATA_PATH\}\}/g, metadataPath)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorVec)
            .replace(/\{\{FONT_SETUP\}\}/g, fontSetup);

        fs.writeFileSync(harnessPath, harness);

        const compileResult = await this.compile(harnessPath, binPath);
        if (!compileResult.success) {
            return { success: false, error: compileResult.error };
        }

        return { success: true, binPath };
    }

    /**
     * Returns the environment vars needed to run a DALi binary.
     */
    buildEnv(display: string): NodeJS.ProcessEnv {
        return {
            ...process.env,
            LD_LIBRARY_PATH: `${this.daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
            DISPLAY: display,
        };
    }

    /**
     * Check if ffmpeg is available on the system. Result is cached after first call.
     */
    private static _ffmpegCache: boolean | undefined = undefined;

    static async ffmpegAvailable(): Promise<boolean> {
        if (BuildRunner._ffmpegCache !== undefined) {
            return BuildRunner._ffmpegCache;
        }
        return new Promise((resolve) => {
            exec('which ffmpeg', { timeout: 3000 }, (error) => {
                BuildRunner._ffmpegCache = !error;
                resolve(BuildRunner._ffmpegCache);
            });
        });
    }

    /**
     * Compile and run animation capture: captures N frames then assembles a GIF via ffmpeg.
     * Falls back to returning individual PNG paths when ffmpeg is unavailable.
     */
    async buildAndRunAnimation(
        userCode: string,
        width: number,
        height: number,
        theme: 'light' | 'dark',
        bgColor: string | undefined,
        duration: number,
        fps: number,
        locale?: string,
        fontScale?: number,
        font?: string
    ): Promise<AnimationBuildResult> {
        if (!(await this.ensureDaliPrefix())) {
            return {
                success: false,
                error: 'DALi installation not found.\nUse "DALi: Open Preview" command and configure the DALi path in settings.'
            };
        }

        const framesDir = path.join(this.tmpDir, 'anim_frames');
        const gifPath = path.join(this.tmpDir, 'animation.gif');
        const metadataPath = path.join(this.tmpDir, 'preview_metadata.json');
        const harnessPath = path.join(this.tmpDir, 'preview_animation.cpp');
        const binPath = path.join(this.tmpDir, 'preview_animation_bin');

        // Prepare frames directory (clear previous frames)
        fs.rmSync(framesDir, { recursive: true, force: true });
        fs.mkdirSync(framesDir, { recursive: true });

        const bgColorVec = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
            ? BuildRunner.hexToVector4(bgColor)
            : BuildRunner.themeToBackgroundColor(theme);

        let fontSetup = '';
        if (font) {
            const fontDirs = ConfigurationService.getInstance().fontDirectories;
            const fontDir = fontDirs.find(d => {
                try {
                    return fs.existsSync(path.join(d, font!));
                } catch (err) {
                    getLogger().trace('Build', 'animation font dir check failed', { error: String(err) });
                    return false;
                }
            }) || path.dirname(font);
            const escapedDir = fontDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            fontSetup = `    FontClient::Get().AddCustomFontDirectory("${escapedDir}");`;
        }

        const totalFrames = Math.floor(duration * fps / 1000);

        const harness = this.animationTemplateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
            .replace(/\{\{OUTPUT_DIR\}\}/g, framesDir)
            .replace(/\{\{METADATA_PATH\}\}/g, metadataPath)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorVec)
            .replace(/\{\{FONT_SETUP\}\}/g, fontSetup)
            .replace(/\{\{ANIMATION_DURATION\}\}/g, String(duration))
            .replace(/\{\{ANIMATION_FPS\}\}/g, String(fps));

        fs.writeFileSync(harnessPath, harness);

        const compileResult = await this.compile(harnessPath, binPath);
        if (!compileResult.success) {
            return { success: false, error: compileResult.error };
        }

        // Execute animation binary and wait for ANIM_DONE
        const captureTimeoutMs = duration + 15000;
        const capturedFrames = await this.executeAnimation(binPath, width, height, captureTimeoutMs, locale, fontScale);
        if (capturedFrames < 0) {
            return { success: false, error: 'Animation capture failed or timed out.' };
        }

        const actualFrames = capturedFrames > 0 ? capturedFrames : totalFrames;

        // Assemble GIF with ffmpeg
        const hasffmpeg = await BuildRunner.ffmpegAvailable();
        if (hasffmpeg) {
            const gifResult = await this.assembleGif(framesDir, gifPath, fps);
            if (gifResult) {
                return { success: true, gifPath, metadataPath, frameCount: actualFrames, durationMs: duration };
            }
            this.outputChannel.appendLine('[Animation] ffmpeg GIF assembly failed, falling back to first frame PNG');
        } else {
            this.outputChannel.appendLine('[Animation] ffmpeg not found. Install ffmpeg for GIF output. Showing first frame.');
        }

        // Fallback: return first frame PNG
        const firstFrame = path.join(framesDir, 'frame_000.png');
        if (fs.existsSync(firstFrame)) {
            return { success: true, pngPath: firstFrame, metadataPath, frameCount: actualFrames, durationMs: duration };
        }

        return { success: false, error: 'No frames captured.' };
    }

    private executeAnimation(
        binPath: string,
        width: number,
        height: number,
        timeoutMs: number,
        locale?: string,
        fontScale?: number
    ): Promise<number> {
        const display = this.xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            LD_LIBRARY_PATH: `${this.daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
            DISPLAY: display,
            DALI_WINDOW_WIDTH: String(width),
            DALI_WINDOW_HEIGHT: String(height),
            ...(locale ? { LANG: `${locale}.UTF-8` } : {}),
            ...(fontScale !== undefined ? { DALI_FONT_SCALE: String(fontScale) } : {}),
        };

        return new Promise((resolve) => {
            exec(binPath, { env, timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                const doneMatch = /ANIM_DONE:(\d+)/.exec(stdout);
                if (doneMatch) {
                    resolve(parseInt(doneMatch[1], 10));
                } else if (error && !stdout.includes('FRAME:')) {
                    this.outputChannel.appendLine(`[Animation] Runtime error: ${stderr || error.message}`);
                    resolve(-1);
                } else {
                    // Partial capture (e.g. timeout fired after some frames): count FRAME: lines
                    if (error) {
                        this.outputChannel.appendLine(
                            `[Animation] Warning: capture ended before ANIM_DONE (${error.message}). Using partial frames.`
                        );
                    }
                    const frameLines = (stdout.match(/^FRAME:/gm) || []).length;
                    resolve(frameLines);
                }
            });
        });
    }

    private assembleGif(framesDir: string, gifPath: string, fps: number): Promise<boolean> {
        const cmd = [
            'ffmpeg -y',
            `-framerate ${fps}`,
            `-i "${framesDir}/frame_%03d.png"`,
            '-vf "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"',
            `"${gifPath}"`
        ].join(' ');

        return new Promise((resolve) => {
            exec(cmd, { timeout: 60000, shell: '/bin/bash' }, (error, _stdout, stderr) => {
                if (error) {
                    this.outputChannel.appendLine(`[Animation] ffmpeg error: ${stderr || error.message}`);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Build the harness for local execution and then deploy to a Tizen device via SDB.
     * Pipeline: compile locally → sdb push → sdb shell execute → sdb pull PNG + metadata.
     */
    async buildAndRunOnDevice(
        userCode: string,
        sdbManager: SdbManager,
        deviceSerial: string | undefined,
        width?: number,
        height?: number,
        theme: 'light' | 'dark' = 'dark',
        bgColor?: string,
        locale?: string,
        fontScale?: number,
        font?: string
    ): Promise<BuildResult> {
        if (!(await this.ensureDaliPrefix())) {
            return {
                success: false,
                error: 'DALi installation not found.\nUse "DALi: Open Preview" command and configure the DALi path in settings.'
            };
        }

        if (!width || !height) {
            const cfg = ConfigurationService.getInstance();
            width = cfg.previewWidth;
            height = cfg.previewHeight;
        }

        const localPng      = path.join(this.tmpDir, 'preview_device.png');
        const localMeta     = path.join(this.tmpDir, 'preview_device_metadata.json');
        const harnessPath   = path.join(this.tmpDir, 'preview_device_harness.cpp');
        const localBin      = path.join(this.tmpDir, 'preview_device_bin');

        const deviceCfg = ConfigurationService.getInstance();
        const tizenSysroot = deviceCfg.tizenSysroot;
        const remoteDir    = '/tmp/dali_preview';
        const remoteBin    = `${remoteDir}/preview_device_bin`;
        const remotePng    = `${remoteDir}/preview_device.png`;
        const remoteMeta   = `${remoteDir}/preview_device_metadata.json`;

        const bgColorVec = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
            ? BuildRunner.hexToVector4(bgColor)
            : BuildRunner.themeToBackgroundColor(theme);

        let fontSetup = '';
        if (font) {
            const fontDirs = deviceCfg.fontDirectories;
            const fontDir = fontDirs.find(d => {
                try {
                    return fs.existsSync(path.join(d, font!));
                } catch (err) {
                    getLogger().trace('Build', 'device font dir check failed', { error: String(err) });
                    return false;
                }
            }) || path.dirname(font);
            const escapedDir = fontDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            fontSetup = `    FontClient::Get().AddCustomFontDirectory("${escapedDir}");`;
        }

        // 1. Generate harness (reuse same template, but output paths point to remote)
        const harness = this.templateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
            .replace(/\{\{OUTPUT_PATH\}\}/g, remotePng)
            .replace(/\{\{METADATA_PATH\}\}/g, remoteMeta)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorVec)
            .replace(/\{\{FONT_SETUP\}\}/g, fontSetup);

        fs.writeFileSync(harnessPath, harness);

        // 2. Compile (cross-compile if sysroot configured, else host compiler)
        const compileResult = tizenSysroot
            ? await this.compileCrossDevice(harnessPath, localBin, tizenSysroot)
            : await this.compile(harnessPath, localBin);

        if (!compileResult.success) {
            return compileResult;
        }

        // 3. Prepare remote directory
        try {
            await sdbManager.shell(`mkdir -p ${remoteDir}`, deviceSerial);
        } catch (err) {
            getLogger().trace('SDB', 'remote mkdir non-fatal', { error: String(err) });
        }

        // 4. Push binary
        try {
            await sdbManager.push(localBin, remoteBin, deviceSerial);
            await sdbManager.shell(`chmod +x ${remoteBin}`, deviceSerial);
        } catch (err: any) {
            return { success: false, error: `SDB push failed: ${err.message}` };
        }

        // 5. Execute on device
        const display = ':0';
        const envStr = [
            `DISPLAY=${display}`,
            `DALI_WINDOW_WIDTH=${width}`,
            `DALI_WINDOW_HEIGHT=${height}`,
            ...(locale ? [`LANG=${locale}.UTF-8`] : []),
            ...(fontScale !== undefined ? [`DALI_FONT_SCALE=${fontScale}`] : []),
        ].join(' ');

        let execOutput: string;
        try {
            execOutput = await sdbManager.shell(
                `${envStr} ${remoteBin}`,
                deviceSerial,
                20000
            );
        } catch (err: any) {
            return { success: false, error: `Device execution failed: ${err.message}` };
        }

        if (!execOutput.includes('OK:')) {
            return { success: false, error: `Device runtime error:\n${execOutput}` };
        }

        // 6. Pull PNG and metadata
        try {
            await sdbManager.pull(remotePng, localPng, deviceSerial);
        } catch (err: any) {
            return { success: false, error: `SDB pull (PNG) failed: ${err.message}` };
        }

        try {
            await sdbManager.pull(remoteMeta, localMeta, deviceSerial);
        } catch (err) {
            getLogger().trace('SDB', 'metadata pull skipped', { error: String(err) });
        }

        return { success: true, pngPath: localPng, metadataPath: localMeta };
    }

    private compileCrossDevice(source: string, output: string, sysroot: string): Promise<BuildResult> {
        const escapedSysroot = sysroot
            .replace(/"/g, '\\"')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
        const pkgConfigPath = `${escapedSysroot}/usr/lib/pkgconfig:${escapedSysroot}/usr/share/pkgconfig`;
        const compiler = 'arm-linux-gnueabi-g++';

        const cmd = [
            `PKG_CONFIG_PATH="${pkgConfigPath}" PKG_CONFIG_SYSROOT_DIR="${escapedSysroot}"`,
            `${compiler} -std=c++17 -O0`,
            `--sysroot="${escapedSysroot}"`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" PKG_CONFIG_SYSROOT_DIR="${escapedSysroot}" pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
            `"${source}"`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" PKG_CONFIG_SYSROOT_DIR="${escapedSysroot}" pkg-config --libs dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
            `-o "${output}"`
        ].join(' ');

        return new Promise((resolve) => {
            exec(cmd, { timeout: 60000, shell: '/bin/bash' }, (error, _stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr || error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
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
