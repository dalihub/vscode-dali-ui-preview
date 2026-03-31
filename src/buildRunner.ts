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

export class BuildRunner {
    private daliPrefix: string = '';
    private templateContent: string;
    private pluginTemplateContent: string;
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

        const pluginTemplatePath = path.join(context.extensionPath, 'server', 'preview_plugin.cpp.template');
        this.pluginTemplateContent = fs.readFileSync(pluginTemplatePath, 'utf-8');

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

    async buildAndRun(userCode: string, width?: number, height?: number, theme: 'light' | 'dark' = 'dark'): Promise<BuildResult> {
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
        const bgColor = BuildRunner.themeToBackgroundColor(theme);
        const harness = this.templateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
            .replace(/\{\{OUTPUT_PATH\}\}/g, pngPath)
            .replace(/\{\{METADATA_PATH\}\}/g, metadataPath)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColor);

        fs.writeFileSync(harnessPath, harness);

        // 2. Compile
        const compileResult = await this.compile(harnessPath, binPath);
        if (!compileResult.success) {
            return compileResult;
        }

        // 3. Execute
        return this.execute(binPath, pngPath, metadataPath, width, height);
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

    private execute(binPath: string, pngPath: string, metadataPath: string, width: number, height: number): Promise<BuildResult> {
        const display = this.xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';

        const env: NodeJS.ProcessEnv = {
            ...process.env,
            LD_LIBRARY_PATH: `${this.daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
            DISPLAY: display,
            DALI_WINDOW_WIDTH: String(width),
            DALI_WINDOW_HEIGHT: String(height),
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

    dispose() {
        // Cleanup
    }
}
