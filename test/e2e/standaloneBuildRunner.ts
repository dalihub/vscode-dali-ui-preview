/**
 * Standalone build runner for E2E golden screenshot tests.
 * No vscode dependency — pure Node.js only.
 *
 * The harness slot-filler codegen is NOT duplicated here anymore (M3a): it is
 * imported from the single vscode-free source `src/harnessCodegen.ts`, so this
 * runner and the production `BuildRunner` can never drift again (they used to —
 * `buildPreBuildInstall` signatures had diverged). The re-exports below preserve
 * the historical public surface for any test that imported these names from
 * this module.
 */
import { exec, execFile, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as codegen from '../../src/harnessCodegen';

// Re-export the shared codegen slot-fillers under their historical names so any
// existing importer of THIS module keeps resolving. Single source: harnessCodegen.
export {
    buildPaletteDefs,
    buildUiConfigSetup,
    buildPreBuildInstall,
    buildPostBuildLayoutDir,
    buildPostBuildFocus,
    buildPostBuild,
    injectFocusName,
} from '../../src/harnessCodegen';

export interface StandaloneBuildOptions {
    userCode: string;
    /** Slice includes/globals for the M1 3-slot template. Empty (default) for
     *  self-contained goldens → byte-identical to the pre-slot harness. */
    userIncludes?: string;
    userGlobals?: string;
    width: number;
    height: number;
    outputPngPath: string;
    metadataPath: string;
    templatePath: string;
    daliPrefix: string;
    display: string;
    /** `// @preview-state: focus=<id>` target (ADR-006). When set, the harness's
     *  {{POST_BUILD_FOCUS}} slot resolves it (FindChildByName → Nth-focusable
     *  fallback) and the matching variable declaration is NAME-tagged so
     *  FindChildByName("<id>") works. Undefined → slot becomes '' (no ring). */
    focusId?: string;
    /** `// @preview-config: theme=dark` (ADR-004). Installs the dark token
     *  palette via {{PALETTE_DEFS}}/{{PRE_BUILD_INSTALL}} AND switches the window
     *  background to dark. Undefined → slots stay '' and the existing hardcoded
     *  dark background is kept (byte-identical to pre-M3 goldens). */
    theme?: 'light' | 'dark';
    /** `// @preview-config: fontScale=<f>` (ADR-004). Chains `.SetScalingFactor(f)`
     *  before Apply() in {{UI_CONFIG_SETUP}} so _spx-sized text scales. Undefined
     *  → slot is '' (byte-identical). */
    fontScale?: number;
    /** `// @preview-config: locale=<l>` (ADR-004). Parsed for plumbing; RTL
     *  install is M3.5 (pass 2). Accepted so the option shape is stable. */
    locale?: string;
    /** WU-M5.1: absolute host path of the bundled gray broken-image placeholder.
     *  When set, the build stages it into the render dir and chains
     *  SetBrokenImageUrl so an unreachable ImageView URL keeps its layout box.
     *  Gated per-sample (a `// @broken-image` marker) so the existing goldens —
     *  which never load a broken image — stay byte-identical. */
    brokenImagePath?: string;
}

/** Window background Vector4 literal for the standalone harness. theme=light →
 *  white; everything else keeps the existing hardcoded dark literal so pre-M3
 *  goldens stay byte-identical. */
function bgColorLiteral(theme?: 'light' | 'dark'): string {
    return theme === 'light'
        ? 'Vector4(1.0f, 1.0f, 1.0f, 1.0f)'
        : 'Vector4(0.1f, 0.1f, 0.12f, 1.0f)';
}

export interface StandaloneBuildResult {
    success: boolean;
    error?: string;
}

/**
 * Stage the shared exporter header next to the harness source. The harness
 * template does `#include "preview_export.h"` (M3b single-source exporter), and a
 * quote-include resolves relative to the compiled source's directory — so the
 * header must be copied into the same dir the harness .cpp is written to (native:
 * the tmp compile dir; docker: the bind-mounted WORK dir → /work). The header is a
 * sibling of the template (both live in <repo>/server), so it is derived from
 * `templatePath`. Mirrors BuildRunner.stageExportHeader in production.
 */
function stageExportHeader(destDir: string, templatePath: string): void {
    const src = path.join(path.dirname(templatePath), 'preview_export.h');
    fs.copyFileSync(src, path.join(destDir, 'preview_export.h'));
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

    // A prefix is usable only if its pkg-config is actually present — skip a
    // half-built dali-env that exists but has no .pc files (e.g. dali_backend),
    // otherwise readdir's first match wins and every compile fails with
    // "No package 'dali2-ui-foundation'".
    const hasPc = (p: string): boolean =>
        fs.existsSync(path.join(p, 'lib', 'pkgconfig', 'dali2-ui-foundation.pc'));

    const directPath = path.join(home, 'dali-env', 'opt');
    if (hasPc(directPath)) {
        return directPath;
    }

    const tizenDir = path.join(home, 'tizen');
    if (fs.existsSync(tizenDir)) {
        try {
            for (const entry of fs.readdirSync(tizenDir, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    const candidate = path.join(tizenDir, entry.name, 'dali-env', 'opt');
                    if (hasPc(candidate)) {
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

    const userCode = codegen.injectFocusName(opts.userCode, opts.focusId);
    // Migrate removed/renamed dali-ui APIs (2.5.30: AddChildren→Add,
    // SetVisibility→SetVisible, SetMarkupEnabled dropped) so this golden/sweep
    // harness compiles against the current runtime image — mirrors BuildRunner.
    const harness = codegen.transformDaliUiApisForCompile(templateContent
        .replace(/\{\{USER_INCLUDES\}\}/g, opts.userIncludes ?? '')
        .replace(/\{\{USER_GLOBALS\}\}/g, opts.userGlobals ?? '')
        .replace(/\{\{PALETTE_DEFS\}\}/g, codegen.buildPaletteDefs(opts.theme, opts.locale))
        // Native path: the binary reads the host placeholder path directly.
        .replace(/\{\{UI_CONFIG_SETUP\}\}/g, codegen.buildUiConfigSetup(opts.fontScale, opts.brokenImagePath))
        .replace(/\{\{PRE_BUILD_INSTALL\}\}/g, codegen.buildPreBuildInstall(opts.theme, opts.fontScale, false, opts.locale))
        .replace(/\{\{USER_CODE\}\}/g, userCode)
        .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
        .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
        .replace(/\{\{OUTPUT_PATH\}\}/g, escapeCppString(opts.outputPngPath))
        .replace(/\{\{METADATA_PATH\}\}/g, escapeCppString(opts.metadataPath))
        .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorLiteral(opts.theme))
        .replace(/\{\{POST_BUILD_FOCUS\}\}/g, codegen.buildPostBuild(opts.locale, opts.focusId))
        .replace(/\{\{FONT_SETUP\}\}/g, ''));

    try {
        fs.writeFileSync(harnessPath, harness);
        // Stage the shared exporter header next to the harness (it #includes it).
        stageExportHeader(tmpDir, opts.templatePath);
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

/**
 * Build + render inside the SAME docker image the live preview uses, so goldens
 * match real preview exactly — DALi 2.0.0 + DejaVu-only fonts (emoji with no glyph
 * render as □, just like the real preview, instead of the native machine's emoji
 * font). Renders to /work/render.png in a mounted tmp dir, then copies to the host.
 */
export async function buildAndCaptureDocker(opts: StandaloneBuildOptions, image: string): Promise<StandaloneBuildResult> {
    const WORK = '/tmp/dali_e2e_docker';
    try { fs.mkdirSync(WORK, { recursive: true }); } catch { /* exists */ }

    let template: string;
    try { template = fs.readFileSync(opts.templatePath, 'utf-8'); }
    catch (e) { return { success: false, error: `Failed to read template: ${(e as Error).message}` }; }

    // WU-M5.1: stage the bundled placeholder into the WORK bind-mount so the
    // container sees it at /work/<asset> for SetBrokenImageUrl. Gated per-sample
    // (opts.brokenImagePath set only for `// @broken-image` samples), so the
    // existing goldens stay byte-identical.
    let dockerBrokenPath: string | undefined;
    if (opts.brokenImagePath) {
        try {
            const assetName = path.basename(opts.brokenImagePath);
            fs.copyFileSync(opts.brokenImagePath, path.join(WORK, assetName));
            dockerBrokenPath = `/work/${assetName}`;
        } catch (e) { return { success: false, error: `Failed to stage broken-image placeholder: ${(e as Error).message}` }; }
    }

    const userCode = codegen.injectFocusName(opts.userCode, opts.focusId);
    // Migrate removed/renamed dali-ui APIs (2.5.30) for the docker golden/sweep
    // harness — mirrors BuildRunner (compile-path only, see harnessCodegen).
    const harness = codegen.transformDaliUiApisForCompile(template
        .replace(/\{\{USER_INCLUDES\}\}/g, opts.userIncludes ?? '')
        .replace(/\{\{USER_GLOBALS\}\}/g, opts.userGlobals ?? '')
        .replace(/\{\{PALETTE_DEFS\}\}/g, codegen.buildPaletteDefs(opts.theme, opts.locale))
        .replace(/\{\{UI_CONFIG_SETUP\}\}/g, codegen.buildUiConfigSetup(opts.fontScale, dockerBrokenPath))
        .replace(/\{\{PRE_BUILD_INSTALL\}\}/g, codegen.buildPreBuildInstall(opts.theme, opts.fontScale, false, opts.locale))
        .replace(/\{\{USER_CODE\}\}/g, userCode)
        .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
        .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
        .replace(/\{\{OUTPUT_PATH\}\}/g, '/work/render.png')
        .replace(/\{\{METADATA_PATH\}\}/g, '/work/meta.json')
        .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorLiteral(opts.theme))
        .replace(/\{\{POST_BUILD_FOCUS\}\}/g, codegen.buildPostBuild(opts.locale, opts.focusId))
        .replace(/\{\{FONT_SETUP\}\}/g, ''));

    try {
        fs.writeFileSync(path.join(WORK, 'harness.cpp'), harness);
        // Stage the shared exporter header into the bind-mount so the container
        // sees it at /work/preview_export.h (harness.cpp #includes it).
        stageExportHeader(WORK, opts.templatePath);
        fs.rmSync(path.join(WORK, 'render.png'), { force: true });
    } catch (e) { return { success: false, error: `Failed to write harness: ${(e as Error).message}` }; }

    const W = opts.width, H = opts.height;
    const script = [
        'export PKG_CONFIG_PATH=/opt/dali/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig',
        'P="dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0"',
        'g++ -std=c++17 -O0 /work/harness.cpp $(pkg-config --cflags $P) $(pkg-config --libs $P) -L/opt/dali/lib -Wl,-rpath-link,/opt/dali/lib -o /work/bin 2>/work/err || { sed -n "1,40p" /work/err; exit 2; }',
        `Xvfb :99 -screen 0 ${W}x${H}x24 >/dev/null 2>&1 & sleep 3`,
        `DISPLAY=:99 DALI_WINDOW_WIDTH=${W} DALI_WINDOW_HEIGHT=${H} timeout 60 /work/bin`,
    ].join('\n');
    // execFile with an args array — no host-shell parsing, so the script's own
    // quotes (sed "1,40p") and newlines survive intact into the container.
    const args = ['run', '--rm', '-v', `${WORK}:/work`, '--entrypoint', 'bash', image, '-c', script];

    return new Promise((resolve) => {
        execFile('docker', args, { timeout: 150000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (!fs.existsSync(path.join(WORK, 'render.png'))) {
                resolve({ success: false, error: `Docker render failed:\n${stdout}\n${stderr}` });
                return;
            }
            try {
                fs.copyFileSync(path.join(WORK, 'render.png'), opts.outputPngPath);
                const meta = path.join(WORK, 'meta.json');
                if (fs.existsSync(meta)) { fs.copyFileSync(meta, opts.metadataPath); }
                resolve({ success: true });
            } catch (e) {
                resolve({ success: false, error: `Copy failed: ${(e as Error).message}` });
            }
        });
    });
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
