import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildBackend } from './buildBackend';
import { ConfigurationService } from './configurationService';
import { isRtlLocale } from './previewConfig';
import { getLogger } from './logger';

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
        context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel,
        private backend: BuildBackend,
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
     * Build the C++ for the harness/plugin {{PALETTE_DEFS}} slot (ADR-004).
     * When theme==='dark', emits the static dark-palette free function
     * `__DarkPalette` (no captures — required by ColorOverrideFunc, a plain
     * `bool(*)(StringView, Vector4&)`; ui-color-manager.h:52,232). Maps the
     * dali-ui token ids (UiColor::PRIMARY/BACKGROUND/OUTLINE → "Primary"/
     * "Background"/"Outline", plus common semantic ids) to dark RGBA. Unknown
     * tokens return false → fall through to the theme (honest: only mapped
     * tokens reskin; hex colors are never touched). '' otherwise → byte-identical.
     *
     * Duplicated (intentionally) in test/e2e/standaloneBuildRunner.ts — that file
     * must not import vscode; this one pulls it in. The token→RGBA rows are
     * SHARED with docker/preview_server.cpp's __DarkServerPalette (same constants,
     * desync-guarded by the DARK_PALETTE_TOKENS list).
     */
    static buildPaletteDefs(theme?: 'light' | 'dark', locale?: string): string {
        const blocks: string[] = [];
        if (theme === 'dark') {
            blocks.push(BuildRunner.darkPaletteFreeFunction());
        }
        // locale set → emit the honest untranslated override (WU-M3.6). Free
        // function (no captures) as required by LocalizedStringOverrideFunc
        // (ui-localization-manager.h).
        if (locale) {
            blocks.push(BuildRunner.localeOverrideFreeFunction());
        }
        return blocks.join('\n');
    }

    /**
     * Build the static `__LocaleOverride` free function (no captures) backing the
     * honest untranslated-IDS signal (WU-M3.6 / ADR-007 `untranslated`). It
     * returns FALSE for every key so dali-ui falls back to dgettext, which — with
     * NO catalog loaded (M3 does not load locale catalogs) — yields the resource
     * id verbatim (ui-localization-manager.h: "dgettext null result -> resourceId").
     * So an `IDS_TITLE` label renders the raw key `IDS_TITLE`, NOT a fabricated
     * translation. This is the DELIBERATE honest boundary: the tool never invents
     * a translation string (ADR-004 §2). The matching `untranslated` provenance is
     * merged by the host (previewOrchestrator); the visible badge chip is M5.
     */
    private static localeOverrideFreeFunction(): string {
        return [
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
        ].join('\n');
    }

    /**
     * Build the post-build root layout-direction install (WU-M3.5 / ADR-004 F3.4).
     * When `locale` is an RTL locale (ar/he/fa/ur — isRtlLocale), emit a call that
     * sets the root's LAYOUT_DIRECTION to RIGHT_TO_LEFT. The root's children
     * inherit it (Actor INHERIT_LAYOUT_DIRECTION defaults true), so a ROW
     * FlexLayout mirrors its main-axis order (left-most child moves to the right).
     * `root` must be in scope at the call site — this composes into the
     * {{POST_BUILD_FOCUS}} slot (harness: after `window.Add(root)`; plugin:
     * `__ApplyPreviewFocus(Dali::Actor root)`). Uses SetProperty (not the View-only
     * SetLayoutDirection) so it works on the plugin's `Dali::Actor root` too.
     * '' when not RTL → byte-identical. This is LAYOUT mirroring only, NOT
     * translation (text is unchanged; ADR-004 §2 honest boundary).
     */
    static buildPostBuildLayoutDir(locale?: string): string {
        if (!isRtlLocale(locale)) {
            return '';
        }
        return '    root.SetProperty(Dali::Actor::Property::LAYOUT_DIRECTION, Dali::LayoutDirection::RIGHT_TO_LEFT);';
    }

    /**
     * Build the harness {{UI_CONFIG_SETUP}} slot (ADR-004) — frozen UiConfig
     * setters chained BEFORE Apply(). For fontScale, emits `.SetScalingFactor(f)`
     * which scales the _spx/_sdp units (ui-config.h:177; unit.h: _spx "is
     * multiplied by a scaling-factor configured via UiConfig"). Plain pixel
     * SetFontSize(px) is NOT affected — a sample must size text in _spx to scale.
     *
     * WU-M5.1 (ADR-007 image-placeholder): when `brokenImagePath` is given, also
     * emits `__uiConfig.SetBrokenImageUrl(BrokenImageType::NORMAL, "<path>");` so
     * an ImageView whose URL is remote/unreachable renders the bundled gray
     * placeholder at its requested SIZE (layout preserved) instead of an empty
     * box (ui-config.h: SetBrokenImageUrl is frozen-after-Apply, so it must be
     * called before Apply()). The path must resolve at render time — the caller
     * stages the bundled asset into a path the binary can read (the docker mount
     * /work, or a host path in local mode).
     *
     * Emits newline-separated statements on the harness's `__uiConfig` local
     * (declared in main() before this slot). dali-ui removed the fluent chaining
     * API (setters return void), so these are sequential statements, NOT a
     * `New().SetX()...Apply()` chain. '' when no frozen knob is set. N/A for the
     * plugin (warm server is already past Apply()).
     */
    static buildUiConfigSetup(fontScale?: number, brokenImagePath?: string): string {
        const lines: string[] = [];
        if (typeof fontScale === 'number' && fontScale > 0) {
            lines.push(`  __uiConfig.SetScalingFactor(${BuildRunner.formatFloat(fontScale)});`);
        }
        if (brokenImagePath) {
            const p = brokenImagePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            lines.push(`  __uiConfig.SetBrokenImageUrl(UiConfig::BrokenImageType::NORMAL, "${p}");`);
        }
        return lines.join('\n');
    }

    /**
     * Build the harness/plugin {{PRE_BUILD_INSTALL}} slot (ADR-004) — runtime
     * singleton installs applied just before the tree is built. theme=dark
     * installs the dark color override; fontScale installs the runtime scale
     * (UiScaleManager::SetScale — warm-server-safe, ui-scale-manager.h:124).
     * `isPlugin` controls whether the runtime fontScale install is emitted (the
     * plugin/warm path needs SetScale; the harness already froze SetScalingFactor
     * in {{UI_CONFIG_SETUP}}). '' when nothing installs → byte-identical.
     */
    static buildPreBuildInstall(
        theme?: 'light' | 'dark',
        fontScale?: number,
        isPlugin = false,
        locale?: string,
    ): string {
        const lines: string[] = [];
        if (theme === 'dark') {
            lines.push('    Dali::Ui::UiColorManager::Get().SetColorOverride(&__DarkPalette);');
        }
        // locale set → install the honest untranslated override (WU-M3.6). Runtime,
        // warm-server-safe (refreshes all bindings on install — ui-localization-
        // manager.h). __LocaleOverride is emitted into {{PALETTE_DEFS}} when locale
        // is set, so the symbol exists here.
        if (locale) {
            lines.push('    Dali::Ui::UiLocalizationManager::Get().SetLocalizedStringOverride(&__LocaleOverride);');
        }
        // Runtime scale only on the warm/plugin path; the harness uses the frozen
        // SetScalingFactor in {{UI_CONFIG_SETUP}} (both wired per ADR-004 §2).
        if (isPlugin && typeof fontScale === 'number' && fontScale > 0) {
            lines.push(`    Dali::Ui::UiScaleManager::Get().SetScale(${BuildRunner.formatFloat(fontScale)});`);
        }
        return lines.join('\n');
    }

    /**
     * Stage the bundled gray broken-image placeholder (WU-M5.1 / ADR-007) into the
     * work dir and return the path the rendered binary should pass to
     * SetBrokenImageUrl. The asset ships at `media/broken-image-placeholder.png`;
     * it is copied into `tmpDir` (which the docker backend bind-mounts at /work, so
     * the container sees `/work/broken-image-placeholder.png`; the local backend
     * reads the host path directly). Returns undefined if the asset is missing or
     * the copy fails — the caller then omits SetBrokenImageUrl (byte-identical,
     * graceful: a missing placeholder just falls back to DALi's default behavior).
     */
    private stageBrokenImagePlaceholder(): string | undefined {
        const ASSET = 'broken-image-placeholder.png';
        const src = path.join(this.extensionPath, 'media', ASSET);
        try {
            if (!fs.existsSync(src)) {
                return undefined;
            }
            const dst = path.join(this.tmpDir, ASSET);
            fs.copyFileSync(src, dst);
            // The docker backend bind-mounts tmpDir at /work, so the in-container
            // path is /work/<asset>; the local backend uses the host path as-is.
            return this.backend.kind === 'docker' ? `/work/${ASSET}` : dst;
        } catch (err) {
            getLogger().trace('Build', 'broken-image placeholder stage failed', { error: String(err) });
            return undefined;
        }
    }

    /** Format a float for a C++ literal: always a decimal point + trailing `f`. */
    private static formatFloat(v: number): string {
        const s = Number.isInteger(v) ? `${v}.0` : `${v}`;
        return `${s}f`;
    }

    /**
     * The dark-theme token ids that get reskinned. Each maps a dali-ui color
     * token string (what UiColor::PRIMARY / UiColor("Primary") resolve through)
     * to a dark RGBA. Kept SMALL and as a code constant (ADR-004 §3 honest scope):
     * only token-based colors reskin; hex colors never do. SHARED with the
     * server's __DarkServerPalette — keep both in sync.
     */
    private static readonly DARK_PALETTE_TOKENS: ReadonlyArray<{ id: string; rgba: [number, number, number, number] }> = [
        { id: 'Primary',    rgba: [0.49, 0.55, 0.99, 1.0] }, // indigo-ish accent
        { id: 'Background', rgba: [0.10, 0.10, 0.12, 1.0] }, // near-black surface
        { id: 'Outline',    rgba: [0.45, 0.45, 0.52, 1.0] }, // muted border
        { id: 'Surface',    rgba: [0.16, 0.16, 0.20, 1.0] }, // raised surface
        { id: 'OnSurface',  rgba: [0.92, 0.92, 0.96, 1.0] }, // light text on dark
        { id: 'OnPrimary',  rgba: [1.0,  1.0,  1.0,  1.0] }, // text on accent
    ];

    /**
     * Emit the static `__DarkPalette` free function (no captures) backing the
     * dark theme color override. Shared shape with the server's palette.
     */
    private static darkPaletteFreeFunction(): string {
        const rows = BuildRunner.DARK_PALETTE_TOKENS.map(
            (t) => `        {"${t.id}", Dali::Vector4(${t.rgba.map((c) => BuildRunner.formatFloat(c)).join(', ')})},`,
        ).join('\n');
        return [
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
        ].join('\n');
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
            /** `// @preview-state: focus=<id>` target (ADR-006). undefined →
             *  {{POST_BUILD_FOCUS}} becomes '' (no focus ring; byte-identical). */
            focusId?: string;
            /** theme=dark installs the dark token palette (ADR-004). undefined/
             *  'light' → {{PALETTE_DEFS}}/{{PRE_BUILD_INSTALL}} stay ''. The
             *  window background color is handled separately via `bgColorVec`. */
            theme?: 'light' | 'dark';
            /** fontScale → frozen `.SetScalingFactor(f)` in {{UI_CONFIG_SETUP}}
             *  (scales _spx units). undefined → slot is '' (byte-identical). */
            fontScale?: number;
            /** locale → RTL locales (ar/he/fa/ur) mirror the root via
             *  {{POST_BUILD_FOCUS}} (LAYOUT_DIRECTION=RIGHT_TO_LEFT) and install the
             *  honest untranslated override (WU-M3.5/M3.6). undefined → slots stay
             *  '' (byte-identical). */
            locale?: string;
            /** WU-M5.1: path (resolvable at render time) of the bundled gray
             *  broken-image placeholder, chained into {{UI_CONFIG_SETUP}} via
             *  SetBrokenImageUrl so unreachable ImageView URLs keep their layout
             *  box. undefined → no SetBrokenImageUrl (byte-identical). */
            brokenImagePath?: string;
            extra?: Record<string, string>;
        },
    ): string {
        let out = template
            .replace(/\{\{USER_INCLUDES\}\}/g, opts.includes ?? '')
            .replace(/\{\{USER_GLOBALS\}\}/g, opts.globals ?? '')
            .replace(/\{\{PALETTE_DEFS\}\}/g, BuildRunner.buildPaletteDefs(opts.theme, opts.locale))
            .replace(/\{\{UI_CONFIG_SETUP\}\}/g, BuildRunner.buildUiConfigSetup(opts.fontScale, opts.brokenImagePath))
            .replace(/\{\{PRE_BUILD_INSTALL\}\}/g, BuildRunner.buildPreBuildInstall(opts.theme, opts.fontScale, false, opts.locale))
            .replace(/\{\{USER_CODE\}\}/g, BuildRunner.injectFocusName(opts.userCode, opts.focusId))
            .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${opts.width}.0f`)
            .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${opts.height}.0f`)
            .replace(/\{\{BACKGROUND_COLOR\}\}/g, opts.bgColorVec)
            .replace(/\{\{POST_BUILD_FOCUS\}\}/g, BuildRunner.buildPostBuild(opts.locale, opts.focusId))
            .replace(/\{\{FONT_SETUP\}\}/g, opts.fontSetup);
        if (opts.extra) {
            for (const [key, value] of Object.entries(opts.extra)) {
                out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }
        }
        return out;
    }

    /**
     * Build the C++ for the harness/plugin {{POST_BUILD_FOCUS}} slot (ADR-006).
     * `root` is in scope at the slot. Resolution: FindChildByName(<id>) → if not a
     * View, DFS first-focusable (__FindFirstFocusable, defined in the template) →
     * SetCurrentFocusView. '' when no focusId, so focus-less builds are unchanged.
     *
     * Duplicated (intentionally) in test/e2e/standaloneBuildRunner.ts: that file
     * must not import vscode-dependent modules, and this one pulls in vscode.
     */
    static buildPostBuildFocus(focusId?: string): string {
        if (!focusId) {
            return '';
        }
        const id = focusId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return [
            '    {',
            `        Dali::Actor __ft = root.FindChildByName("${id}");`,
            '        Dali::Ui::View __fv = Dali::Ui::View::DownCast(__ft);',
            '        if(!__fv) { __fv = __FindFirstFocusable(root); }',
            '        if(__fv) { Dali::Ui::FocusManager::Get().SetCurrentFocusView(__fv); }',
            '    }',
        ].join('\n');
    }

    /**
     * Compose the {{POST_BUILD_FOCUS}} slot — the single post-build site where
     * `root` is in scope (ADR-006 focus + ADR-004 F3.4 RTL both need `root`). The
     * RTL layout-direction is applied FIRST (so the mirror is in effect when the
     * focus ring is drawn), then the focus install. Either part is '' when its
     * knob is unset; both '' → byte-identical to the focus-less / LTR harness.
     * Shared shape with standaloneBuildRunner (intentional duplication — that file
     * must not import vscode).
     */
    static buildPostBuild(locale?: string, focusId?: string): string {
        return [BuildRunner.buildPostBuildLayoutDir(locale), BuildRunner.buildPostBuildFocus(focusId)]
            .filter((s) => s !== '')
            .join('\n');
    }

    /**
     * Targeted NAME injection (ADR-006 step 2): so root.FindChildByName("<id>")
     * resolves the variable the user wrote (`View card2 = ...;`). If `focusId` is a
     * bare identifier AND user code declares `<type> <focusId> = ...;`, append
     * `<focusId>.SetProperty(Dali::Actor::Property::NAME, "<focusId>");` after that
     * statement. Only the focus variable is touched; unchanged when no such decl
     * (Nth-focusable fallback handles it). Duplicated in standaloneBuildRunner.ts.
     */
    static injectFocusName(userCode: string, focusId?: string): string {
        if (!focusId || !/^[A-Za-z_]\w*$/.test(focusId)) {
            return userCode;
        }
        const declRe = new RegExp(`(?:^|\\n)[^\\n]*?\\b(?:auto|[\\w:]+(?:<[^>]*>)?)\\s+${focusId}\\s*=`, 'g');
        const m = declRe.exec(userCode);
        if (!m) {
            return userCode;
        }
        const eqIdx = m.index + m[0].length;
        const semiIdx = BuildRunner.findStatementEnd(userCode, eqIdx);
        if (semiIdx < 0) {
            return userCode;
        }
        const insertAt = semiIdx + 1;
        const tag = `\n${focusId}.SetProperty(Dali::Actor::Property::NAME, Dali::String("${focusId}"));`;
        return userCode.slice(0, insertAt) + tag + userCode.slice(insertAt);
    }

    /** Index of the statement-terminating `;` at/after `from`, skipping `;` inside
     *  (), {}, [], and string/char literals. -1 if none. */
    private static findStatementEnd(code: string, from: number): number {
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

    /**
     * Compile user code into a shared library (.so) for the dlopen fast path.
     * When configName is provided, the .so is named preview_plugin_{configName}.so.
     * Delegates the actual compile to the active backend; a backend with no
     * resident server (local mode, M1) reports the path unsupported.
     */
    async compilePlugin(
        userCode: string,
        configName?: string,
        sliceGlobals = '',
        sliceIncludes = '',
        /** Per-config knobs (WU-M3.8 gallery): theme=dark installs the dark color
         *  override, locale installs the untranslated override + RTL mirror,
         *  fontScale installs the warm-safe runtime SetScale. All undefined →
         *  every slot is '' → byte-identical to the M2 plugin. The frozen-only
         *  fontScale path (SetScalingFactor) is the harness's job — the warm
         *  server is past Apply() — so the orchestrator routes frozen-needing
         *  variants to buildAndRun (ADR-004 §3). */
        config?: { theme?: 'light' | 'dark'; locale?: string; fontScale?: number },
    ): Promise<BuildResult & { soPath?: string }> {
        const log = getLogger();
        log.debug('Build', 'compilePlugin', { configName: configName || 'default', sliced: !!sliceGlobals, theme: config?.theme, locale: config?.locale });

        const suffix = configName ? `_${BuildRunner.sanitizeConfigName(configName)}` : '';
        const pluginSrc = path.join(this.tmpDir, `preview_plugin${suffix}.cpp`);
        const soPath    = path.join(this.tmpDir, `preview_plugin${suffix}.so`);

        // sliceGlobals/sliceIncludes are '' on the self-contained (Rung3) path →
        // byte-identical to before. Non-empty only when SliceBuilder collected
        // same-file defs / stubs for the Rung2 heuristic path.
        const pluginCode = this.pluginTemplateContent
            .replace(/\{\{USER_INCLUDES\}\}/g, sliceIncludes)
            .replace(/\{\{USER_GLOBALS\}\}/g, sliceGlobals)
            // {{PALETTE_DEFS}}/{{PRE_BUILD_INSTALL}} are the ADR-004 install slots
            // for the warm/dlopen path (WU-M3.8). theme/locale emit their palette
            // free functions + runtime installs; all-undefined → '' (byte-identical).
            .replace(/\{\{PALETTE_DEFS\}\}/g, BuildRunner.buildPaletteDefs(config?.theme, config?.locale))
            .replace(/\{\{PRE_BUILD_INSTALL\}\}/g, BuildRunner.buildPreBuildInstall(config?.theme, config?.fontScale, true, config?.locale))
            .replace(/\{\{USER_CODE\}\}/g, BuildRunner.instrumentAnimations(userCode))
            // Plugin focus is server-driven (warm path); the orchestrator does not
            // yet plumb focus into the dlopen path. RTL (locale) does apply here —
            // __ApplyPreviewFocus(root) is the warm post-build site where `root` is
            // in scope, so a ROW mirrors in the gallery's RTL variant. '' when LTR.
            .replace(/\{\{POST_BUILD_FOCUS\}\}/g, BuildRunner.buildPostBuild(config?.locale, undefined));

        if (!this.backend.compilePlugin) {
            return { success: false, error: `Plugin (dlopen) compile is not supported by the ${this.backend.kind} runtime backend.` };
        }
        const result = await this.backend.compilePlugin({
            source: pluginCode,
            workDir: this.tmpDir,
            srcPath: pluginSrc,
            soPath,
            timeoutMs: 30_000,
        });
        if (!result.success) {
            return { success: false, error: result.error };
        }
        log.debug('Build', 'compilePlugin done', { soPath: result.soPath });
        return { success: true, soPath: result.soPath };
    }

    /**
     * Render the harness for `userCode` and compile+run it via the active
     * backend (docker container or local g++/Xvfb) to capture a PNG.
     *
     * The templating above the backend call is identical regardless of where
     * the build runs; only the baked-in output path differs (container `/work`
     * vs a host path), which the backend's `outputPaths` resolves.
     */
    async buildAndRun(
        userCode: string,
        width?: number,
        height?: number,
        theme: 'light' | 'dark' = 'dark',
        bgColor?: string,
        font?: string,
        sliceGlobals = '',
        sliceIncludes = '',
        /** `// @preview-state: focus=<id>` target (ADR-006). When set, the harness
         *  fills its {{POST_BUILD_FOCUS}} slot + NAME-injects the focus var so the
         *  focus ring renders on that node. undefined → byte-identical to before. */
        focusId?: string,
        /** `// @preview-config: fontScale=<f>` (ADR-004). When set, the harness
         *  chains `.SetScalingFactor(f)` before Apply() so _spx-sized text scales.
         *  undefined → {{UI_CONFIG_SETUP}} stays '' (byte-identical). */
        fontScale?: number,
        /** `// @preview-config: locale=<l>` (ADR-004). Parsed for plumbing; RTL
         *  install is M3.5 (pass 2). Accepted here so the signature is stable. */
        locale?: string,
    ): Promise<BuildResult> {
        const log = getLogger();
        log.debug('Build', 'buildAndRun start', { width, height, theme, backend: this.backend.kind, focusId, fontScale, locale });

        const cfg = ConfigurationService.getInstance();
        if (!width || !height) {
            width = cfg.previewWidth;
            height = cfg.previewHeight;
        }

        const out = this.backend.outputPaths(this.tmpDir);

        // Custom fonts: the local backend can register host font directories
        // directly; the container can't see them without a bind-mount (out of
        // scope for M1), so docker mode ignores the font — unchanged behavior.
        let fontSetup = '';
        if (font) {
            if (this.backend.kind === 'local') {
                fontSetup = this.buildFontSetup(font, cfg.fontDirectories);
            } else {
                log.warn('Build', 'docker mode: custom font ignored (not yet supported in container runtime)', { font });
            }
        }

        // WU-M5.1: stage the bundled gray broken-image placeholder so an
        // unreachable ImageView URL keeps its layout box. Live preview is never
        // golden-compared, so this is enabled unconditionally here (pure upside);
        // the standalone golden runner gates it per-sample to keep existing goldens
        // byte-identical. undefined (asset missing) → SetBrokenImageUrl omitted.
        const brokenImagePath = this.stageBrokenImagePlaceholder();

        const bgColorVec = BuildRunner.resolveBgColorVec(bgColor, theme);
        const harness = this.renderHarness(this.templateContent, {
            userCode, width, height, bgColorVec, fontSetup,
            includes: sliceIncludes, globals: sliceGlobals, focusId,
            theme, fontScale, locale, brokenImagePath,
            extra: { OUTPUT_PATH: out.pngEmbed, METADATA_PATH: out.metadataEmbed },
        });

        // Remove stale outputs so we never report a previous run's PNG.
        for (const p of [out.pngHost, out.metadataHost]) {
            try { fs.unlinkSync(p); } catch { /* not present */ }
        }

        const result = await this.backend.capture({
            source: harness,
            workDir: this.tmpDir,
            pngPathHost: out.pngHost,
            metadataPathHost: out.metadataHost,
            width,
            height,
            timeoutMs: 60_000,
        });

        if (!result.success) {
            return { success: false, error: result.error ?? 'Build failed' };
        }
        return {
            success: true,
            pngPath: result.pngPath,
            metadataPath: result.metadataPath,
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
