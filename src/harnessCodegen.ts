// Single source of the harness/plugin C++ slot-filler codegen (ADR-004/006).
// vscode-free ON PURPOSE: both the production BuildRunner (src/buildRunner.ts)
// and the e2e standaloneBuildRunner (test/e2e/) import from here, so the two can
// never drift again (they previously did — buildPreBuildInstall signatures diverged).
// Emits literal dali-ui C++, so a dali-ui API rename is a change HERE (one place).
import { isRtlLocale } from './previewConfig';

/** Format a float for a C++ literal: always a decimal point + trailing `f`. */
function formatFloat(v: number): string {
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
const DARK_PALETTE_TOKENS: ReadonlyArray<{ id: string; rgba: [number, number, number, number] }> = [
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
function darkPaletteFreeFunction(): string {
    const rows = DARK_PALETTE_TOKENS.map(
        (t) => `        {"${t.id}", Dali::Vector4(${t.rgba.map((c) => formatFloat(c)).join(', ')})},`,
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
function localeOverrideFreeFunction(): string {
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
 * Build the C++ for the harness/plugin {{PALETTE_DEFS}} slot (ADR-004).
 * When theme==='dark', emits the static dark-palette free function
 * `__DarkPalette` (no captures — required by ColorOverrideFunc, a plain
 * `bool(*)(StringView, Vector4&)`; ui-color-manager.h:52,232). Maps the
 * dali-ui token ids (UiColor::PRIMARY/BACKGROUND/OUTLINE → "Primary"/
 * "Background"/"Outline", plus common semantic ids) to dark RGBA. Unknown
 * tokens return false → fall through to the theme (honest: only mapped
 * tokens reskin; hex colors are never touched). '' otherwise → byte-identical.
 *
 * Single-sourced here (imported by both the production BuildRunner and the e2e
 * standaloneBuildRunner) so the two can never drift. The token→RGBA rows are
 * SHARED with docker/preview_server.cpp's __DarkServerPalette (same constants,
 * desync-guarded by the DARK_PALETTE_TOKENS list).
 */
export function buildPaletteDefs(theme?: 'light' | 'dark', locale?: string): string {
    const blocks: string[] = [];
    if (theme === 'dark') {
        blocks.push(darkPaletteFreeFunction());
    }
    // locale set → emit the honest untranslated override (WU-M3.6). Free
    // function (no captures) as required by LocalizedStringOverrideFunc
    // (ui-localization-manager.h).
    if (locale) {
        blocks.push(localeOverrideFreeFunction());
    }
    return blocks.join('\n');
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

/**
 * Build the harness/plugin {{PRE_BUILD_INSTALL}} slot (ADR-004) — runtime
 * singleton installs applied just before the tree is built. theme=dark
 * installs the dark color override; fontScale installs the runtime scale
 * (UiScaleManager::SetScale — warm-server-safe, ui-scale-manager.h:124).
 * `isPlugin` controls whether the runtime fontScale install is emitted (the
 * plugin/warm path needs SetScale; the harness already froze SetScalingFactor
 * in {{UI_CONFIG_SETUP}}). '' when nothing installs → byte-identical.
 */
export function buildPreBuildInstall(
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
        lines.push(`    Dali::Ui::UiScaleManager::Get().SetScale(${formatFloat(fontScale)});`);
    }
    return lines.join('\n');
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
export function buildPostBuildLayoutDir(locale?: string): string {
    if (!isRtlLocale(locale)) {
        return '';
    }
    return '    root.SetProperty(Dali::Actor::Property::LAYOUT_DIRECTION, Dali::LayoutDirection::RIGHT_TO_LEFT);';
}

/**
 * Build the C++ for the harness/plugin {{POST_BUILD_FOCUS}} slot (ADR-006).
 * `root` is in scope at the slot. Resolution: FindChildByName(<id>) → if not a
 * View, DFS first-focusable (__FindFirstFocusable, defined in the template) →
 * SetCurrentFocusView. '' when no focusId, so focus-less builds are unchanged.
 *
 * Single-sourced here (imported by both the production BuildRunner and the e2e
 * standaloneBuildRunner) so the two can never drift.
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

/**
 * Compose the {{POST_BUILD_FOCUS}} slot — the single post-build site where
 * `root` is in scope (ADR-006 focus + ADR-004 F3.4 RTL both need `root`). The
 * RTL layout-direction is applied FIRST (so the mirror is in effect when the
 * focus ring is drawn), then the focus install. Either part is '' when its
 * knob is unset; both '' → byte-identical to the focus-less / LTR harness.
 * Single-sourced here (imported by both the production BuildRunner and the e2e
 * standaloneBuildRunner).
 */
export function buildPostBuild(locale?: string, focusId?: string): string {
    return [buildPostBuildLayoutDir(locale), buildPostBuildFocus(focusId)]
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
export function injectFocusName(userCode: string, focusId?: string): string {
    if (!focusId || !/^[A-Za-z_]\w*$/.test(focusId)) {
        return userCode;
    }
    const declRe = new RegExp(`(?:^|\\n)[^\\n]*?\\b(?:auto|[\\w:]+(?:<[^>]*>)?)\\s+${focusId}\\s*=`, 'g');
    const m = declRe.exec(userCode);
    if (!m) {
        return userCode;
    }
    const eqIdx = m.index + m[0].length;
    const semiIdx = findStatementEnd(userCode, eqIdx);
    if (semiIdx < 0) {
        return userCode;
    }
    const insertAt = semiIdx + 1;
    const tag = `\n${focusId}.SetProperty(Dali::Actor::Property::NAME, Dali::String("${focusId}"));`;
    return userCode.slice(0, insertAt) + tag + userCode.slice(insertAt);
}

/** Index of the statement-terminating `;` at/after `from`, skipping `;` inside
 *  (), {}, [], and string/char literals. -1 if none. */
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

/**
 * Inject animation registration so the preview server can scrub animations.
 * After every `<var>.Play();` in user code, append `__RegisterPreviewAnimation(<var>);`
 * so the resident plugin collects each Animation handle for SetCurrentProgress.
 * Named animations only — unnamed temporaries have no handle to scrub and are skipped.
 */
export function instrumentAnimations(userCode: string): string {
    // Capture the FULL handle chain before `.Play();` so member/qualified
    // handles register the whole expression — `this->anim` / `obj.anim` —
    // not a stray sub-identifier that would be undeclared in user scope.
    return userCode.replace(
        /((?:[A-Za-z_]\w*\s*(?:\.|->)\s*)*[A-Za-z_]\w*)\s*\.\s*Play\s*\(\s*\)\s*;/g,
        '$& __RegisterPreviewAnimation($1);'
    );
}

// ---------------------------------------------------------------------------
// dali-ui 2.5.30 API migration (COMPILE PATHS ONLY)
// ---------------------------------------------------------------------------

/** True for C++ insignificant whitespace. */
function isCppSpace(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * Index of the delimiter matching the opener at `openIdx`, tracking nesting of
 * that ONE delimiter pair and skipping "..."/'...' literals (with backslash
 * escapes). Returns -1 if unbalanced.
 */
function matchDelimiter(code: string, openIdx: number, open: string, close: string): number {
    let depth = 0;
    let inStr = false;
    let strCh = '';
    for (let i = openIdx; i < code.length; i++) {
        const ch = code[i];
        if (inStr) {
            if (ch === '\\') { i++; }
            else if (ch === strCh) { inStr = false; }
            continue;
        }
        if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; continue; }
        if (ch === open) { depth++; }
        else if (ch === close) { depth--; if (depth === 0) { return i; } }
    }
    return -1;
}

/**
 * Split a child/argument list on TOP-LEVEL commas, honoring nested ()/{}/[] and
 * string/char literals — so a child like `__tag(Label::New("a, b"), "__L5")`
 * (commas inside its parens and its string) stays one element. Empty elements
 * (e.g. from a trailing comma) are preserved; the caller filters them.
 */
function splitTopLevelCommas(s: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inStr = false;
    let strCh = '';
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
            if (ch === '\\') { i++; }
            else if (ch === strCh) { inStr = false; }
            continue;
        }
        if (ch === '"' || ch === '\'') { inStr = true; strCh = ch; continue; }
        if (ch === '(' || ch === '{' || ch === '[') { depth++; }
        else if (ch === ')' || ch === '}' || ch === ']') { depth--; }
        else if (ch === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
    }
    parts.push(s.slice(start));
    return parts;
}

/**
 * Rewrite the removed batch child-adder to the surviving per-child add:
 *   `recv.AddChildren({ a, b, c });`  ->  `recv.Add(a); recv.Add(b); recv.Add(c);`
 * dali-ui 2.5.30 dropped `View::AddChildren(std::initializer_list<...>)`; only
 * `Actor::Add(child)` remains (the same call the runtime-release build-ctx server
 * uses per-child). The legacy fluent-era `Children({...})` name is matched too. A
 * bare `std::vector` argument (non-`{` form) becomes an `.Add()` range-for,
 * mirroring codeExtractor.transformVectorChildren. Balanced-scanner based (not a
 * flat regex) so nested calls/strings/multi-line lists inside the braces survive.
 */
function transformChildAddersToAdd(code: string): string {
    const CALL_RE = /([A-Za-z_]\w*(?:\s*(?:\.|->)\s*[A-Za-z_]\w*)*)\s*\.\s*(?:Add)?Children\s*\(/g;
    let out = '';
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = CALL_RE.exec(code)) !== null) {
        const recv = m[1].replace(/\s+/g, '');
        const openParen = m.index + m[0].length - 1; // index of '('
        let i = openParen + 1;
        while (i < code.length && isCppSpace(code[i])) { i++; }

        if (code[i] === '{') {
            const braceEnd = matchDelimiter(code, i, '{', '}');
            if (braceEnd < 0) { continue; }
            let j = braceEnd + 1;
            while (j < code.length && isCppSpace(code[j])) { j++; }
            if (code[j] !== ')') { continue; }
            const kids = splitTopLevelCommas(code.slice(i + 1, braceEnd))
                .map((c) => c.trim())
                .filter((c) => c.length > 0);
            const replacement = kids.length
                ? kids.map((c) => `${recv}.Add(${c});`).join(' ')
                : '(void)0;';
            let end = j + 1;
            if (code[end] === ';') { end++; }
            out += code.slice(last, m.index) + replacement;
            last = end;
            CALL_RE.lastIndex = end;
        } else {
            // Bare-vector form: recv.(Add)Children(vec); -> range-for .Add loop.
            const closeParen = matchDelimiter(code, openParen, '(', ')');
            if (closeParen < 0) { continue; }
            const arg = code.slice(openParen + 1, closeParen).trim();
            if (!/^[A-Za-z_]\w*$/.test(arg)) { continue; } // not a bare identifier — leave as-is
            let end = closeParen + 1;
            if (code[end] === ';') { end++; }
            out += code.slice(last, m.index) + `for (auto& __ce : ${arg}) { ${recv}.Add(__ce); }`;
            last = end;
            CALL_RE.lastIndex = end;
        }
    }
    out += code.slice(last);
    return out;
}

/**
 * Migrate removed/renamed dali-ui APIs in fully-assembled harness/plugin C++ so it
 * COMPILES against the current runtime image (dali-ui 2.5.30+). Applied in the
 * COMPILE paths ONLY (BuildRunner harness + dlopen plugin, and the e2e
 * standaloneBuildRunner) — deliberately NOT to the code the cppParser/renderJson
 * fast-path consumes. The parser turns setters into SceneNode property KEYS that
 * the frozen, image-baked preview_server maps by name (it maps the "SetVisibility"
 * key onto SetVisible, etc.); rewriting the shared pre-parser transform instead
 * would desync the parser from that server. Running on the assembled source is
 * safe because neither template uses any of these three symbols (only user/sliced
 * code does), so the boilerplate is untouched.
 *
 * 2.5.30 breaks handled (derived from the runtime headers + the compile errors,
 * cross-checked against the runtime-release build-ctx server migration):
 *   1. View::AddChildren(std::initializer_list) REMOVED — see transformChildAddersToAdd.
 *   2. View::SetVisibility(bool) RENAMED to SetVisible(bool) — the build-ctx
 *      preview_server.cpp migrated the identical call (n=="SetVisibility" ->
 *      view.SetVisible(...)), and g++ points at SetVisible as the surviving member.
 *   3. Label::SetMarkupEnabled(bool) REMOVED — the explicit markup toggle is gone
 *      and no replacement symbol exists in the headers (g++ only offers the
 *      unrelated SetEnabled), so the call is dropped to a no-op. Markup-tagged text
 *      still lays out; the golden gate asserts on-screen geometry, not glyph
 *      content, so this stays green. If a future runtime exposes an explicit markup
 *      enabler, replace the drop here (one place).
 *
 * Single-sourced so BuildRunner and standaloneBuildRunner can never drift.
 */
export function transformDaliUiApisForCompile(code: string): string {
    let out = transformChildAddersToAdd(code);
    // SetVisibility(x) -> SetVisible(x)
    out = out.replace(/\.SetVisibility(\s*\()/g, '.SetVisible$1');
    // SetMarkupEnabled(x) -> dropped (removed toggle; markup implicit). The source's
    // own trailing ';' terminates the resulting `(void)0` no-op statement.
    out = out.replace(/[A-Za-z_][\w.]*\.SetMarkupEnabled\s*\([^;()]*\)/g, '(void)0');
    return out;
}

/**
 * Returns the DALi Vector4 background color literal for the given theme.
 */
export function themeToBackgroundColor(theme: 'light' | 'dark'): string {
    return theme === 'light'
        ? 'Vector4(1.0f, 1.0f, 1.0f, 1.0f)'
        : 'Vector4(0.1f, 0.1f, 0.12f, 1.0f)';
}

/**
 * Converts a #RRGGBB hex color string to a DALi Vector4 literal.
 * Returns the dark-theme fallback if the input is not a valid #RRGGBB string.
 */
export function hexToVector4(hex: string): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return themeToBackgroundColor('dark');
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return `Vector4(${r.toFixed(4)}f, ${g.toFixed(4)}f, ${b.toFixed(4)}f, 1.0f)`;
}

/** Resolve the DALi background Vector4 literal from an optional #RRGGBB hex or the theme. */
export function resolveBgColorVec(bgColor: string | undefined, theme: 'light' | 'dark'): string {
    return bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor)
        ? hexToVector4(bgColor)
        : themeToBackgroundColor(theme);
}
