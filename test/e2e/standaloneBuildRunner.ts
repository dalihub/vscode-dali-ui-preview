/**
 * Standalone build runner for E2E golden screenshot tests.
 * No vscode dependency — pure Node.js only.
 */
import { exec, execSync } from 'child_process';
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

// Computed once at module load to avoid per-compilation subprocess overhead.
const USE_CCACHE: boolean = (() => {
    try {
        execSync('which ccache', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
})();

/**
 * Compile the harness C++ source and run it under Xvfb to capture a PNG.
 */
export async function buildAndCapture(opts: StandaloneBuildOptions): Promise<StandaloneBuildResult> {
    const tmpDir = '/tmp/dali_e2e';
    try {
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
    } catch (e) {
        return { success: false, error: `Failed to create tmp dir: ${(e as Error).message}` };
    }

    const harnessPath = path.join(tmpDir, 'e2e_harness.cpp');
    const binPath = path.join(tmpDir, 'e2e_bin');

    // Escape paths for embedding as C++ string literals.
    const escapeCppString = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    let templateContent: string;
    try {
        templateContent = fs.readFileSync(opts.templatePath, 'utf-8');
    } catch (e) {
        return { success: false, error: `Failed to read template: ${(e as Error).message}` };
    }

    const harness = templateContent
        .replace(/\{\{USER_CODE\}\}/g, opts.userCode)
        .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
        .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
        .replace(/\{\{OUTPUT_PATH\}\}/g, escapeCppString(opts.outputPngPath))
        .replace(/\{\{METADATA_PATH\}\}/g, escapeCppString(opts.metadataPath))
        .replace(/\{\{BACKGROUND_COLOR\}\}/g, 'Vector4(0.1f, 0.1f, 0.12f, 1.0f)')
        .replace(/\{\{FONT_SETUP\}\}/g, '');

    try {
        fs.writeFileSync(harnessPath, harness);
    } catch (e) {
        return { success: false, error: `Failed to write harness: ${(e as Error).message}` };
    }

    // Remove stale binary before compiling to avoid running an old artifact on failure.
    if (fs.existsSync(binPath)) {
        fs.unlinkSync(binPath);
    }

    const compileResult = await compile(harnessPath, binPath, opts.daliPrefix);
    if (!compileResult.success) {
        return compileResult;
    }

    return execute(binPath, opts.outputPngPath, opts.display, opts.daliPrefix, opts.width, opts.height);
}

function compile(source: string, output: string, daliPrefix: string): Promise<StandaloneBuildResult> {
    const pkgConfigPath = `${daliPrefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig`;
    const compiler = USE_CCACHE ? 'ccache g++' : 'g++';

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

    const inherited = process.env.LD_LIBRARY_PATH;
    const ldLibraryPath = inherited
        ? `${daliPrefix}/lib:${inherited}`
        : `${daliPrefix}/lib`;

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        LD_LIBRARY_PATH: ldLibraryPath,
        DISPLAY: display,
        DALI_WINDOW_WIDTH: String(width),
        DALI_WINDOW_HEIGHT: String(height),
    };

    return new Promise((resolve) => {
        exec(binPath, { env, timeout: 15000 }, (error, stdout, stderr) => {
            // Check exit code first; stdout 'OK:' is a secondary confirmation.
            if (error) {
                resolve({ success: false, error: `Runtime error:\n${stderr || error.message}` });
            } else if (stdout.includes('OK:')) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: `Unexpected output:\n${stdout}\n${stderr}` });
            }
        });
    });
}
