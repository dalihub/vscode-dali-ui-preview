/**
 * Standalone build runner for E2E golden screenshot tests.
 * No vscode dependency — pure Node.js only.
 */
import { exec, execFile, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Build the harness {{PALETTE_DEFS}} slot — the dark-theme token palette free
 * function. Duplicated (intentionally) from src/buildRunner.ts.buildPaletteDefs:
 * this file must NOT import vscode. The token→RGBA rows are SHARED with
 * src/buildRunner.ts AND docker/preview_server.cpp (keep all three in sync).
 */
export function buildPaletteDefs(theme?: 'light' | 'dark', locale?: string): string {
    const blocks: string[] = [];
    if (theme === 'dark') {
        const rows = DARK_PALETTE_TOKENS.map(
            (t) => `        {"${t.id}", Dali::Vector4(${t.rgba.map(formatFloat).join(', ')})},`,
        ).join('\n');
        blocks.push([
            '// Dark-theme token palette (theme=dark). Free function — no captures —',
            '// as required by ColorOverrideFunc (ui-color-manager.h). Returns false',
            '// for unmapped ids so they fall through to the theme (hex colors never',
            '// reach here, so they are unaffected — honest reskin boundary).',
            'static bool __DarkPalette(Dali::StringView id, Dali::Vector4& out)',
            '{',
            '    struct Row { const char* k; Dali::Vector4 v; };',
            '    static const Row table[] = {',
            rows,
            '    };',
            '    for(const auto& r : table)',
            '    {',
            '        if(id == r.k) { out = r.v; return true; }',
            '    }',
            '    return false;',
            '}',
        ].join('\n'));
    }
    // locale set → honest untranslated override (WU-M3.6). Returns false for every
    // key so dali-ui falls back to dgettext → raw key when uncatalogued. Free fn
    // (no captures) as required by LocalizedStringOverrideFunc.
    if (locale) {
        blocks.push([
            '// Locale override (locale=<l>). Free function — no captures — as',
            '// required by LocalizedStringOverrideFunc (ui-localization-manager.h).',
            '// Returns false for EVERY key so dali-ui falls back to dgettext; with',
            '// no catalog loaded that yields the resource id verbatim (e.g. an',
            '// IDS_TITLE binding shows "IDS_TITLE"). The tool never fabricates a',
            '// translation — honest untranslated boundary (ADR-004 §2, ADR-007).',
            'static bool __LocaleOverride(Dali::StringView resourceId, Dali::StringView domain, Dali::String& outString)',
            '{',
            '    (void)resourceId; (void)domain; (void)outString;',
            '    return false; // fall through to dgettext → raw key when uncatalogued',
            '}',
        ].join('\n'));
    }
    return blocks.join('\n');
}

/** Build the harness {{UI_CONFIG_SETUP}} slot (frozen, pre-Apply). Mirrors
 *  src/buildRunner.ts.buildUiConfigSetup. `brokenImagePath` (WU-M5.1) sets
 *  SetBrokenImageUrl so an unreachable ImageView URL renders the bundled gray
 *  placeholder at its requested size. undefined → byte-identical to pre-M5.
 *
 *  dali-ui dropped the fluent chaining API (setters return void), so these are
 *  sequential statements on the harness's `__uiConfig` local — NOT a `.SetX()`
 *  suffix chained onto a New(). Kept in sync with buildRunner.buildUiConfigSetup
 *  (this runner can't import it: vscode dep). */
export function buildUiConfigSetup(fontScale?: number, brokenImagePath?: string): string {
    const lines: string[] = [];
    if (typeof fontScale === 'number' && fontScale > 0) {
        lines.push(`  __uiConfig.SetScalingFactor(${formatFloat(fontScale)});`);
    }
    if (brokenImagePath) {
        const p = brokenImagePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        lines.push(`  __uiConfig.SetBrokenImageUrl(UiConfig::BrokenImageType::NORMAL, "${p}");`);
    }
    return lines.join('\n');
}

/** Build the harness {{PRE_BUILD_INSTALL}} slot (runtime, pre-tree). Mirrors
 *  src/buildRunner.ts.buildPreBuildInstall (harness variant — no plugin SetScale,
 *  the harness froze SetScalingFactor instead). */
export function buildPreBuildInstall(theme?: 'light' | 'dark', locale?: string): string {
    const lines: string[] = [];
    if (theme === 'dark') {
        lines.push('    Dali::Ui::UiColorManager::Get().SetColorOverride(&__DarkPalette);');
    }
    // locale set → install the honest untranslated override (WU-M3.6).
    if (locale) {
        lines.push('    Dali::Ui::UiLocalizationManager::Get().SetLocalizedStringOverride(&__LocaleOverride);');
    }
    return lines.join('\n');
}

/** RTL locales whose ROW layout mirrors. Mirrors src/previewConfig.ts RTL_LOCALES
 *  (the standalone runner must not import vscode-dependent modules). Matched by
 *  base language subtag (ar_EG → ar). */
const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);
function isRtlLocale(locale?: string): boolean {
    if (!locale) { return false; }
    return RTL_LOCALES.has(locale.split(/[_-]/)[0].toLowerCase());
}

/** Build the post-build root layout-direction install (WU-M3.5). For an RTL
 *  locale, sets root LAYOUT_DIRECTION=RIGHT_TO_LEFT so a ROW mirrors (children
 *  inherit it). Composed into {{POST_BUILD_FOCUS}} where `root` is in scope.
 *  Mirrors src/buildRunner.ts.buildPostBuildLayoutDir. */
export function buildPostBuildLayoutDir(locale?: string): string {
    if (!isRtlLocale(locale)) {
        return '';
    }
    return '    root.SetProperty(Dali::Actor::Property::LAYOUT_DIRECTION, Dali::LayoutDirection::RIGHT_TO_LEFT);';
}

/** Shared dark token list — keep in sync with src/buildRunner.ts and
 *  docker/preview_server.cpp. */
const DARK_PALETTE_TOKENS: ReadonlyArray<{ id: string; rgba: [number, number, number, number] }> = [
    { id: 'Primary',    rgba: [0.49, 0.55, 0.99, 1.0] },
    { id: 'Background', rgba: [0.10, 0.10, 0.12, 1.0] },
    { id: 'Outline',    rgba: [0.45, 0.45, 0.52, 1.0] },
    { id: 'Surface',    rgba: [0.16, 0.16, 0.20, 1.0] },
    { id: 'OnSurface',  rgba: [0.92, 0.92, 0.96, 1.0] },
    { id: 'OnPrimary',  rgba: [1.0,  1.0,  1.0,  1.0] },
];

/** Format a float for a C++ literal: decimal point + trailing `f`. */
function formatFloat(v: number): string {
    const s = Number.isInteger(v) ? `${v}.0` : `${v}`;
    return `${s}f`;
}

/** Window background Vector4 literal for the standalone harness. theme=light →
 *  white; everything else keeps the existing hardcoded dark literal so pre-M3
 *  goldens stay byte-identical. */
function bgColorLiteral(theme?: 'light' | 'dark'): string {
    return theme === 'light'
        ? 'Vector4(1.0f, 1.0f, 1.0f, 1.0f)'
        : 'Vector4(0.1f, 0.1f, 0.12f, 1.0f)';
}

/**
 * Build the C++ for the harness/plugin {{POST_BUILD_FOCUS}} slot (ADR-006).
 * `root` is in scope at the slot (harness OnInit / plugin __ApplyPreviewFocus).
 * Resolution: FindChildByName(<id>) → if not a View, DFS first-focusable
 * (__FindFirstFocusable, defined in the template) → SetCurrentFocusView.
 * Returns '' when no focusId, so focus-less goldens stay byte-identical.
 *
 * Duplicated (intentionally, not shared) in src/buildRunner.ts: this file must
 * NOT import vscode-dependent modules, and buildRunner.ts pulls in vscode.
 */
export function buildPostBuildFocus(focusId?: string): string {
    if (!focusId) {
        return '';
    }
    const id = focusId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return [
        '    {',
        `        Dali::Actor __ft = root.FindChildByName("${id}");`,
        '        Dali::Ui::View __fv = Dali::Ui::View::DownCast(__ft);',
        '        if(!__fv) { __fv = __FindFirstFocusable(root); }',
        '        if(__fv) {',
        '            Dali::Ui::FocusManager::Get().SetCurrentFocusView(__fv);',
        '            // dali-ui v2.5.28 made the focus ring device-driven: a programmatic',
        '            // SetCurrentFocusView no longer flags the view as focus-indicated, so',
        '            // no ring is drawn in a static render. Force the FOCUS_INDICATED state',
        "            // (integration-api; there is no public setter), then re-enable the",
        '            // default indicator so FocusManager re-attaches its ring to the current',
        '            // focus view (empirically verified: focus child count 0 -> 1).',
        '            Dali::Ui::Integration::View::SetState(__fv, Dali::Ui::ViewState::FOCUS_INDICATED, true);',
        '            Dali::Ui::FocusManager::Get().SetDefaultFocusIndicatorEnabled(true);',
        '        }',
        '    }',
    ].join('\n');
}

/** Compose the {{POST_BUILD_FOCUS}} slot — RTL layout-direction (applied first so
 *  the mirror is in effect when the ring draws) + focus install. Either part is
 *  '' when its knob is unset; both '' → byte-identical. Mirrors
 *  src/buildRunner.ts.buildPostBuild (intentional duplication — no vscode here). */
export function buildPostBuild(locale?: string, focusId?: string): string {
    return [buildPostBuildLayoutDir(locale), buildPostBuildFocus(focusId)]
        .filter((s) => s !== '')
        .join('\n');
}

/**
 * Targeted NAME injection (ADR-006 step 2): so root.FindChildByName("<id>")
 * resolves the variable the user wrote (`View card2 = ...;`). If `focusId` is a
 * bare identifier AND user code declares `<type> <focusId> = ...;`, append
 * `<focusId>.SetProperty(Dali::Actor::Property::NAME, "<focusId>");` right after
 * that statement. Minimal & safe — only the focus variable is touched; if no
 * such declaration is found, code is returned unchanged (Nth-focusable fallback
 * handles it at runtime). Quoted/numeric focus ids are left to FindChildByName /
 * the fallback.
 *
 * Duplicated in src/buildRunner.ts (see buildPostBuildFocus note).
 */
export function injectFocusName(userCode: string, focusId?: string): string {
    if (!focusId || !/^[A-Za-z_]\w*$/.test(focusId)) {
        return userCode;
    }
    // Match a declaration `<type> <focusId> = <init>;` ending at the first
    // top-level `;`. The init may span lines / contain nested ()/{} and strings,
    // so walk for the terminating semicolon outside strings & brackets rather
    // than using a greedy regex (which could swallow a later statement).
    const declRe = new RegExp(`(?:^|\\n)[^\\n]*?\\b(?:auto|[\\w:]+(?:<[^>]*>)?)\\s+${focusId}\\s*=`, 'g');
    const m = declRe.exec(userCode);
    if (!m) {
        return userCode;
    }
    const eqIdx = m.index + m[0].length; // just past the `=`
    const semiIdx = findStatementEnd(userCode, eqIdx);
    if (semiIdx < 0) {
        return userCode;
    }
    const insertAt = semiIdx + 1; // after the `;`
    const tag = `\n${focusId}.SetProperty(Dali::Actor::Property::NAME, Dali::String("${focusId}"));`;
    return userCode.slice(0, insertAt) + tag + userCode.slice(insertAt);
}

/** Index of the statement-terminating `;` at or after `from`, skipping `;`
 *  inside (), {}, [], and string/char literals. -1 if none. */
function findStatementEnd(code: string, from: number): number {
    let depth = 0;
    let inStr = false;
    let strCh = '';
    for (let i = from; i < code.length; i++) {
        const ch = code[i];
        if (inStr) {
            if (ch === '\\') { i++; }
            else if (ch === strCh) { inStr = false; }
            continue;
        }
        if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; }
        else if (ch === '(' || ch === '{' || ch === '[') { depth++; }
        else if (ch === ')' || ch === '}' || ch === ']') { depth--; }
        else if (ch === ';' && depth <= 0) { return i; }
    }
    return -1;
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

    const userCode = injectFocusName(opts.userCode, opts.focusId);
    const harness = templateContent
        .replace(/\{\{USER_INCLUDES\}\}/g, opts.userIncludes ?? '')
        .replace(/\{\{USER_GLOBALS\}\}/g, opts.userGlobals ?? '')
        .replace(/\{\{PALETTE_DEFS\}\}/g, buildPaletteDefs(opts.theme, opts.locale))
        // Native path: the binary reads the host placeholder path directly.
        .replace(/\{\{UI_CONFIG_SETUP\}\}/g, buildUiConfigSetup(opts.fontScale, opts.brokenImagePath))
        .replace(/\{\{PRE_BUILD_INSTALL\}\}/g, buildPreBuildInstall(opts.theme, opts.locale))
        .replace(/\{\{USER_CODE\}\}/g, userCode)
        .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
        .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
        .replace(/\{\{OUTPUT_PATH\}\}/g, escapeCppString(opts.outputPngPath))
        .replace(/\{\{METADATA_PATH\}\}/g, escapeCppString(opts.metadataPath))
        .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorLiteral(opts.theme))
        .replace(/\{\{POST_BUILD_FOCUS\}\}/g, buildPostBuild(opts.locale, opts.focusId))
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

    const userCode = injectFocusName(opts.userCode, opts.focusId);
    const harness = template
        .replace(/\{\{USER_INCLUDES\}\}/g, opts.userIncludes ?? '')
        .replace(/\{\{USER_GLOBALS\}\}/g, opts.userGlobals ?? '')
        .replace(/\{\{PALETTE_DEFS\}\}/g, buildPaletteDefs(opts.theme, opts.locale))
        .replace(/\{\{UI_CONFIG_SETUP\}\}/g, buildUiConfigSetup(opts.fontScale, dockerBrokenPath))
        .replace(/\{\{PRE_BUILD_INSTALL\}\}/g, buildPreBuildInstall(opts.theme, opts.locale))
        .replace(/\{\{USER_CODE\}\}/g, userCode)
        .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
        .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
        .replace(/\{\{OUTPUT_PATH\}\}/g, '/work/render.png')
        .replace(/\{\{METADATA_PATH\}\}/g, '/work/meta.json')
        .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColorLiteral(opts.theme))
        .replace(/\{\{POST_BUILD_FOCUS\}\}/g, buildPostBuild(opts.locale, opts.focusId))
        .replace(/\{\{FONT_SETUP\}\}/g, '');

    try {
        fs.writeFileSync(path.join(WORK, 'harness.cpp'), harness);
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
