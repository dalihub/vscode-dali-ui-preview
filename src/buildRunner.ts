import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { XvfbManager } from './xvfbManager';
import { findDaliPrefix, validateDaliPrefix } from './daliEnvironment';

export interface BuildResult {
    success: boolean;
    pngPath?: string;
    error?: string;
}

export class BuildRunner {
    private daliPrefix: string = '';
    private templateContent: string;
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

    async buildAndRun(userCode: string, width?: number, height?: number): Promise<BuildResult> {
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
        const harnessPath = path.join(this.tmpDir, 'preview_harness.cpp');
        const binPath = path.join(this.tmpDir, 'preview_bin');

        // 1. Generate harness
        const harness = this.templateContent
            .replace(/\{\{USER_CODE\}\}/g, userCode)
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
            .replace(/\{\{OUTPUT_PATH\}\}/g, pngPath);

        fs.writeFileSync(harnessPath, harness);

        // 2. Compile
        const compileResult = await this.compile(harnessPath, binPath);
        if (!compileResult.success) {
            return compileResult;
        }

        // 3. Execute
        return this.execute(binPath, pngPath, width, height);
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

    private execute(binPath: string, pngPath: string, width: number, height: number): Promise<BuildResult> {
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
                    resolve({ success: true, pngPath });
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
