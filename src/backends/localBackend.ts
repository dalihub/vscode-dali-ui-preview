import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
    BuildBackend, CaptureRequest, CaptureResult, BackendIssue, OutputPaths,
    CompilePluginRequest, CompilePluginResult,
} from '../buildBackend';
import { findDaliPrefix, validateDaliPrefix, checkDependencies } from '../daliEnvironment';
import { XvfbManager } from '../xvfbManager';
import { getLogger } from '../logger';

/** pkg-config modules every DALi preview compile links against. */
const DALI_PKG_MODULES = 'dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0';

// Computed once at module load to avoid a `which` subprocess per compile.
const USE_CCACHE: boolean = (() => {
    try {
        execSync('which ccache', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
})();

/** Escape a host path for embedding inside a C++ string literal. */
function escapeCppString(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Local (native Ubuntu) runtime backend — compiles the rendered harness with
 * the host g++/pkg-config against a locally-installed DALi prefix and runs the
 * binary under Xvfb to capture a PNG.
 *
 * Intended for uifw developers who modify DALi itself. `capture()` is the
 * one-shot fallback (fresh process → always loads the latest `libdali2-*.so`).
 * `compilePlugin()` builds the user code into a `.so` for the dlopen fast path,
 * which the native resident PreviewServer (started in local mode) reloads
 * without a full process respawn — so editing preview code is fast. After a
 * DALi rebuild the resident server is restarted (it holds the old core libs);
 * see the lib watcher / "Restart DALi Runtime" command in extension.ts.
 */
export class LocalBackend implements BuildBackend {
    readonly kind = 'local' as const;
    readonly supportsResidentServer = true;

    constructor(
        private readonly xvfb: XvfbManager | undefined,
    ) {}

    outputPaths(workDir: string): OutputPaths {
        // The binary runs on the host, so it writes directly to the host paths.
        const pngHost = path.join(workDir, 'preview.png');
        const metadataHost = path.join(workDir, 'preview_metadata.json');
        return {
            pngEmbed: escapeCppString(pngHost),
            metadataEmbed: escapeCppString(metadataHost),
            pngHost,
            metadataHost,
        };
    }

    async validate(): Promise<BackendIssue[]> {
        const prefix = await findDaliPrefix();
        const deps = await checkDependencies();
        const issues: BackendIssue[] = [];
        if (!deps.gcc) {
            issues.push({ kind: 'dependency', message: 'g++ compiler not found on PATH.', action: 'sudo apt-get install build-essential' });
        }
        if (!deps.pkgconfig) {
            issues.push({ kind: 'dependency', message: 'pkg-config not found on PATH.', action: 'sudo apt-get install pkg-config' });
        }
        if (!deps.xvfb) {
            issues.push({ kind: 'dependency', message: 'Xvfb not found on PATH.', action: 'sudo apt-get install xvfb' });
        }
        if (!prefix || !validateDaliPrefix(prefix)) {
            issues.push({
                kind: 'prefix',
                message: prefix
                    ? `DALi install not found at ${prefix} (missing libdali2-core.so or dali2-ui-foundation.pc).`
                    : 'DALi install folder not configured.',
                action: 'Run "DALi Preview: Use Local DALi Runtime" to select your DALi install folder.',
            });
        }
        return issues;
    }

    async capture(req: CaptureRequest): Promise<CaptureResult> {
        const log = getLogger();
        const prefix = await findDaliPrefix();
        if (!prefix || !validateDaliPrefix(prefix)) {
            return {
                success: false,
                error: 'DALi runtime not found. Run "DALi Preview: Use Local DALi Runtime" to select your DALi install folder.',
            };
        }

        const srcPath = path.join(req.workDir, 'source.cpp');
        const binPath = path.join(req.workDir, 'preview_bin');
        try {
            await fs.promises.writeFile(srcPath, req.source, 'utf-8');
        } catch (e) {
            return { success: false, error: `Failed to write harness source: ${(e as Error).message}` };
        }
        // Remove a stale binary so a failed compile can't leave us running an old one.
        try { fs.unlinkSync(binPath); } catch { /* not present */ }

        log.debug('Build', 'local compile start', { prefix, ccache: USE_CCACHE });
        const compileRes = await this.compile(srcPath, binPath, prefix, req.timeoutMs ?? 60_000);
        if (!compileRes.success) {
            return { success: false, error: compileRes.error, output: compileRes.error };
        }

        const display = this.xvfb?.getDisplay() ?? process.env.DISPLAY ?? ':0';
        const runRes = await this.execute(binPath, req.pngPathHost, display, prefix, req.width, req.height);
        if (!runRes.success) {
            return { success: false, error: runRes.error, output: runRes.error };
        }

        if (!fs.existsSync(req.pngPathHost)) {
            return { success: false, error: `Binary exited OK but PNG not found at ${req.pngPathHost}.` };
        }

        log.debug('Build', 'local capture done', { pngPathHost: req.pngPathHost });
        return {
            success: true,
            pngPath: req.pngPathHost,
            metadataPath: fs.existsSync(req.metadataPathHost) ? req.metadataPathHost : undefined,
        };
    }

    /**
     * Compile the user code into a shared object (.so) for the dlopen fast path,
     * against the local DALi prefix. The native resident server then reloads it.
     */
    async compilePlugin(req: CompilePluginRequest): Promise<CompilePluginResult> {
        const prefix = await findDaliPrefix();
        if (!prefix || !validateDaliPrefix(prefix)) {
            return { success: false, error: 'DALi runtime not found. Run "DALi Preview: Use Local DALi Runtime" to select your DALi install folder.' };
        }
        try {
            await fs.promises.writeFile(req.srcPath, req.source, 'utf-8');
        } catch (e) {
            return { success: false, error: `Failed to write plugin source: ${(e as Error).message}` };
        }
        const res = await this.compile(req.srcPath, req.soPath, prefix, req.timeoutMs ?? 30_000, /* shared */ true);
        return res.success ? { success: true, soPath: req.soPath } : { success: false, error: res.error };
    }

    /**
     * Compile C++ against the local DALi prefix with g++/pkg-config.
     * `shared` produces a `-shared -fPIC` plugin `.so`; otherwise a runnable binary.
     */
    private compile(source: string, output: string, daliPrefix: string, timeoutMs: number, shared = false): Promise<{ success: boolean; error?: string }> {
        const pkgConfigPath = `${daliPrefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig`;
        const compiler = USE_CCACHE ? 'ccache g++' : 'g++';
        const cmd = [
            `PKG_CONFIG_PATH="${pkgConfigPath}"`,
            `${compiler} -std=c++17 -O0 ${shared ? '-shared -fPIC' : ''}`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --cflags ${DALI_PKG_MODULES})`,
            `"${source}"`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --libs ${DALI_PKG_MODULES})`,
            `-L"${daliPrefix}/lib" -Wl,-rpath-link,"${daliPrefix}/lib"`,
            `-o "${output}"`,
        ].join(' ');

        return new Promise((resolve) => {
            exec(cmd, { timeout: timeoutMs, shell: '/bin/bash' }, (error, _stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: `Compile error:\n${stderr || error.message}` });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    /** Run the compiled binary under the given Xvfb display to render the PNG. */
    private execute(binPath: string, pngPath: string, display: string, daliPrefix: string, width: number, height: number): Promise<{ success: boolean; error?: string }> {
        const inherited = process.env.LD_LIBRARY_PATH;
        const ldLibraryPath = inherited ? `${daliPrefix}/lib:${inherited}` : `${daliPrefix}/lib`;
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            LD_LIBRARY_PATH: ldLibraryPath,
            DISPLAY: display,
            DALI_WINDOW_WIDTH: String(width),
            DALI_WINDOW_HEIGHT: String(height),
        };

        return new Promise((resolve) => {
            exec(binPath, { env, timeout: 15_000 }, (error, stdout, stderr) => {
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
}
