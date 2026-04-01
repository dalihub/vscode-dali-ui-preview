/**
 * Standalone build runner for E2E golden screenshot tests.
 * No vscode dependency — pure Node.js only.
 */
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface StandaloneBuildOptions {
    userCode: string;
    width: number;
    height: number;
    outputPngPath: string;
    metadataPath: string;
    templatePath: string;
    daliPrefix: string;
    display: string;
}

export interface StandaloneBuildResult {
    success: boolean;
    error?: string;
}

/**
 * Detect DALi prefix without VS Code dependency.
 * Priority: env DALI_PREFIX → env DESKTOP_PREFIX → common paths.
 */
export function detectDaliPrefix(): string | null {
    const fromEnv = process.env.DALI_PREFIX || process.env.DESKTOP_PREFIX;
    if (fromEnv && fromEnv.trim().length > 0) {
        return fromEnv.trim();
    }

    const home = process.env.HOME || '';
    if (!home) {
        return null;
    }

    const directPath = path.join(home, 'dali-env', 'opt');
    if (fs.existsSync(directPath)) {
        return directPath;
    }

    const tizenDir = path.join(home, 'tizen');
    if (fs.existsSync(tizenDir)) {
        try {
            for (const entry of fs.readdirSync(tizenDir, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    const candidate = path.join(tizenDir, entry.name, 'dali-env', 'opt');
                    if (fs.existsSync(candidate)) {
                        return candidate;
                    }
                }
            }
        } catch {
            // ignore
        }
    }

    return null;
}

function hasCcache(): boolean {
    try {
        require('child_process').execSync('which ccache', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Compile the harness C++ source and run it under Xvfb to capture a PNG.
 */
export async function buildAndCapture(opts: StandaloneBuildOptions): Promise<StandaloneBuildResult> {
    const tmpDir = '/tmp/dali_e2e';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const harnessPath = path.join(tmpDir, 'e2e_harness.cpp');
    const binPath = path.join(tmpDir, 'e2e_bin');

    const templateContent = fs.readFileSync(opts.templatePath, 'utf-8');

    const harness = templateContent
        .replace(/\{\{USER_CODE\}\}/g, opts.userCode)
        .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
        .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
        .replace(/\{\{OUTPUT_PATH\}\}/g, opts.outputPngPath)
        .replace(/\{\{METADATA_PATH\}\}/g, opts.metadataPath)
        .replace(/\{\{BACKGROUND_COLOR\}\}/g, 'Vector4(0.1f, 0.1f, 0.12f, 1.0f)')
        .replace(/\{\{FONT_SETUP\}\}/g, '');

    fs.writeFileSync(harnessPath, harness);

    const compileResult = await compile(harnessPath, binPath, opts.daliPrefix);
    if (!compileResult.success) {
        return compileResult;
    }

    return execute(binPath, opts.outputPngPath, opts.display, opts.daliPrefix, opts.width, opts.height);
}

function compile(source: string, output: string, daliPrefix: string): Promise<StandaloneBuildResult> {
    const pkgConfigPath = `${daliPrefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig`;
    const compiler = hasCcache() ? 'ccache g++' : 'g++';

    const cmd = [
        `PKG_CONFIG_PATH="${pkgConfigPath}"`,
        `${compiler} -std=c++17 -O0`,
        `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
        `"${source}"`,
        `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --libs dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0)`,
        `-L"${daliPrefix}/lib" -Wl,-rpath-link,"${daliPrefix}/lib"`,
        `-o "${output}"`
    ].join(' ');

    return new Promise((resolve) => {
        exec(cmd, { timeout: 60000, shell: '/bin/bash' }, (error, _stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: `Compile error:\n${stderr || error.message}` });
            } else {
                resolve({ success: true });
            }
        });
    });
}

function execute(
    binPath: string,
    pngPath: string,
    display: string,
    daliPrefix: string,
    width: number,
    height: number
): Promise<StandaloneBuildResult> {
    if (fs.existsSync(pngPath)) {
        fs.unlinkSync(pngPath);
    }

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        LD_LIBRARY_PATH: `${daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
        DISPLAY: display,
        DALI_WINDOW_WIDTH: String(width),
        DALI_WINDOW_HEIGHT: String(height),
    };

    return new Promise((resolve) => {
        exec(binPath, { env, timeout: 15000 }, (error, stdout, stderr) => {
            if (stdout.includes('OK:')) {
                resolve({ success: true });
            } else if (error) {
                resolve({ success: false, error: `Runtime error:\n${stderr || error.message}` });
            } else {
                resolve({ success: false, error: `Unexpected output:\n${stdout}\n${stderr}` });
            }
        });
    });
}
