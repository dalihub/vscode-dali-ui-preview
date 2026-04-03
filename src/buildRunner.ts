import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { XvfbManager } from './xvfbManager';
import { findDaliPrefix, validateDaliPrefix } from './daliEnvironment';

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

    constructor(
        private context: vscode.ExtensionContext,
        private xvfbManager: XvfbManager | undefined,
        private outputChannel: vscode.OutputChannel
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

        this.tmpDir = '/tmp/dali_preview';
        if (!fs.existsSync(this.tmpDir)) {
            fs.mkdirSync(this.tmpDir, { recursive: true });
        }

        // Check ccache availability
        try {
            require('child_process').execSync('which ccache', { stdio: 'ignore' });
            this.hasCcache = true;
            this.outputChannel.appendLine('ccache detected, will use for faster builds');
        } catch {
            this.hasCcache = false;
        }

        // Load DALi prefix from settings
        this.loadDaliPrefix();
    }

    getExtensionPath(): string {
        return this.extensionPath;
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
        if (!(await this.ensureDaliPrefix())) {
            return {
                success: false,
                error: 'DALi installation not found.\nUse "DALi: Open Preview" command and configure the DALi path in settings.'
            };
        }

        const suffix = configName ? `_${BuildRunner.sanitizeConfigName(configName)}` : '';
        const pluginSrc = path.join(this.tmpDir, `preview_plugin${suffix}.cpp`);
        const soPath    = path.join(this.tmpDir, `preview_plugin${suffix}.so`);

        const pluginCode = this.pluginTemplateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode);

        fs.writeFileSync(pluginSrc, pluginCode);

        const result = await this.compileShared(pluginSrc, soPath);
        if (!result.success) {
            return result;
        }
        return { success: true, soPath };
    }

    private loadDaliPrefix() {
        const config = vscode.workspace.getConfiguration('daliPreview');
        const settingsPath = config.get<string>('daliPrefix', '');
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
        // Ensure DALi prefix is available
        if (!(await this.ensureDaliPrefix())) {
            return {
                success: false,
                error: 'DALi installation not found.\nUse "DALi: Open Preview" command and configure the DALi path in settings.'
            };
        }

        if (!width || !height) {
            const config = vscode.workspace.getConfiguration('daliPreview');
            width = config.get('previewWidth', 1024);
            height = config.get('previewHeight', 600);
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
            const config = vscode.workspace.getConfiguration('daliPreview');
            const fontDirs = config.get<string[]>('fontDirectories', []);
            // Find the directory containing the font file
            const fontDir = fontDirs.find(d => {
                try {
                    return fs.existsSync(path.join(d, font!));
                } catch {
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

    private compileShared(source: string, output: string): Promise<BuildResult> {
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
            const config = vscode.workspace.getConfiguration('daliPreview');
            width = config.get('previewWidth', 1024);
            height = config.get('previewHeight', 600);
        }

        const metadataPath = path.join(this.tmpDir, 'preview_interactive_metadata.json');
        const harnessPath  = path.join(this.tmpDir, 'preview_interactive.cpp');
        const binPath      = path.join(this.tmpDir, 'preview_interactive_bin');

        const bgColorVec = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
            ? BuildRunner.hexToVector4(bgColor)
            : BuildRunner.themeToBackgroundColor(theme);

        let fontSetup = '';
        if (font) {
            const config = vscode.workspace.getConfiguration('daliPreview');
            const fontDirs = config.get<string[]>('fontDirectories', []);
            const fontDir = fontDirs.find(d => {
                try {
                    return fs.existsSync(path.join(d, font!));
                } catch {
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
     * Check if ffmpeg is available on the system.
     */
    static async ffmpegAvailable(): Promise<boolean> {
        return new Promise((resolve) => {
            exec('which ffmpeg', { timeout: 3000 }, (error) => {
                resolve(!error);
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
            const config = vscode.workspace.getConfiguration('daliPreview');
            const fontDirs = config.get<string[]>('fontDirectories', []);
            const fontDir = fontDirs.find(d => {
                try {
                    return fs.existsSync(path.join(d, font!));
                } catch {
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
            exec(binPath, { env, timeout: timeoutMs }, (error, stdout, stderr) => {
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

    dispose() {
        // Cleanup
    }
}
