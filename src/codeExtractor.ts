import * as vscode from 'vscode';
import { PreviewConfig, PreviewState, expandPreset } from './previewConfig';
import { getLogger } from './logger';

export interface ExtractionResult {
    code: string;
    startLine: number;
    mode: 'preview-file' | 'marker' | 'single-marker';
    configs?: PreviewConfig[];
    /** Parsed `// @preview-state:` directive (focus / progress). Last valid
     *  state line in the file wins. */
    state?: PreviewState;
    /** Signature params of the previewed function (when a CodeLens targets a
     *  specific function), so the slice stubs ITS params — not the file's first. */
    params?: { name: string; type: string }[];
}

const MARKER_BEGIN = '// @dali-preview-begin';
const MARKER_END = '// @dali-preview-end';
const SINGLE_PREVIEW_MARKER = '// @preview';
/** Zero-arg factory entry marker (ADR-001). Exact-match only so it does NOT
 *  collide with `// @dali-preview-begin` (which has a suffix). */
const DALI_PREVIEW_MARKER = '// @dali-preview';

const PREVIEW_CONFIG_RE = /^\/\/\s*@preview-config:\s*(.+)$/;
// `// @preview-preset: <name>` (ADR-001 §2 / WU-M3.7). `preset-name := identifier`
// — a leading letter/underscore then word chars/hyphens. A matched line is
// expanded into PreviewConfig variants (PREVIEW_PRESETS) and APPENDED to
// configs[], then excluded from the code (handled like a @preview-config line).
const PREVIEW_PRESET_RE = /^\/\/\s*@preview-preset:\s*([A-Za-z_][\w-]*)\s*$/;
const CONFIG_NAME_RE = /name\s*=\s*"([^"]+)"/;
const CONFIG_WIDTH_RE = /width\s*=\s*(\d+)/;
const CONFIG_HEIGHT_RE = /height\s*=\s*(\d+)/;
const CONFIG_THEME_RE = /theme\s*=\s*(light|dark)/;
const CONFIG_LOCALE_RE = /locale\s*=\s*([a-zA-Z][a-zA-Z0-9_\-]+)/;
const CONFIG_FONTSCALE_RE = /fontScale\s*=\s*([\d.]+)/;
const CONFIG_FONT_RE = /(?<![a-zA-Z])font\s*=\s*([\w.\-/]+)/;

const CONFIG_ANIMATION_RE = /(?<![a-zA-Z])animation\s*=\s*(true|false)/;
const CONFIG_DURATION_RE = /duration\s*=\s*(\d+)/;
const CONFIG_FPS_RE = /fps\s*=\s*(\d+)/;

// `// @preview-state:` directive (ADR-001). Only `focus` / `progress` keys are
// matched; any other token in the body is ignored (general key=value is CUT).
const PREVIEW_STATE_RE = /^\/\/\s*@preview-state:\s*(.+)$/;
const STATE_FOCUS_RE = /(?:^|,)\s*focus\s*=\s*(?:"([^"]*)"|([A-Za-z_]\w*))/;
const STATE_PROGRESS_RE = /(?:^|,)\s*progress\s*=\s*([-+]?[\d.]+)/;

const FONTSCALE_MIN = 0.5;
const FONTSCALE_MAX = 2.0;

const ANIMATION_DURATION_MIN = 500;
const ANIMATION_DURATION_MAX = 10000;
const ANIMATION_FPS_MIN = 5;
const ANIMATION_FPS_MAX = 30;

function parsePreviewConfigLine(line: string): PreviewConfig | null {
    const m = PREVIEW_CONFIG_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    const body = m[1];
    const nameMatch = CONFIG_NAME_RE.exec(body);
    if (!nameMatch) {
        return null;
    }
    const config: PreviewConfig = { name: nameMatch[1] };
    const widthMatch = CONFIG_WIDTH_RE.exec(body);
    if (widthMatch) {
        config.width = parseInt(widthMatch[1], 10);
    }
    const heightMatch = CONFIG_HEIGHT_RE.exec(body);
    if (heightMatch) {
        config.height = parseInt(heightMatch[1], 10);
    }
    const themeMatch = CONFIG_THEME_RE.exec(body);
    if (themeMatch) {
        config.theme = themeMatch[1] as 'light' | 'dark';
    }
    const localeMatch = CONFIG_LOCALE_RE.exec(body);
    if (localeMatch) {
        config.locale = localeMatch[1];
    }
    // fontScale must be matched before font to avoid partial overlap
    const fontScaleMatch = CONFIG_FONTSCALE_RE.exec(body);
    if (fontScaleMatch) {
        const scale = parseFloat(fontScaleMatch[1]);
        if (scale >= FONTSCALE_MIN && scale <= FONTSCALE_MAX) {
            config.fontScale = scale;
        }
    }
    const fontMatch = CONFIG_FONT_RE.exec(body);
    if (fontMatch) {
        config.font = fontMatch[1];
    }
    const animationMatch = CONFIG_ANIMATION_RE.exec(body);
    if (animationMatch) {
        config.animation = animationMatch[1] === 'true';
    }
    const durationMatch = CONFIG_DURATION_RE.exec(body);
    if (durationMatch) {
        const dur = parseInt(durationMatch[1], 10);
        if (dur >= ANIMATION_DURATION_MIN && dur <= ANIMATION_DURATION_MAX) {
            config.duration = dur;
        }
    }
    const fpsMatch = CONFIG_FPS_RE.exec(body);
    if (fpsMatch) {
        const fps = parseInt(fpsMatch[1], 10);
        if (fps >= ANIMATION_FPS_MIN && fps <= ANIMATION_FPS_MAX) {
            config.fps = fps;
        }
    }
    return config;
}

/**
 * If `line` is a `// @preview-preset: <name>` directive (WU-M3.7), expand it into
 * its PreviewConfig variants. Returns:
 *   - the variant array  → push these onto configs[] and skip the line as code
 *   - []                 → it WAS a preset line but the name is unknown (logged
 *                          as a warning); still skip it as code (ADR-001 §2: no
 *                          silent error, but the line is not real preview code)
 *   - null               → not a preset line at all (treat as ordinary code)
 */
function expandPresetLine(line: string): PreviewConfig[] | null {
    const m = PREVIEW_PRESET_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    const name = m[1];
    const variants = expandPreset(name);
    if (!variants) {
        getLogger().warn('Extraction', `unknown preset '${name}' — ignoring // @preview-preset line`, { name });
        return [];
    }
    return variants;
}

/**
 * Parse a `// @preview-state:` directive (ADR-001), mirroring
 * `parsePreviewConfigLine`. Grammar: `focus=<id>` and/or `progress=<float>`,
 * comma-separated. Only `focus` and `progress` are recognised — any other key
 * is ignored (the general key=value grammar is CUT).
 *
 * - `focus` value is an identifier OR a quoted string (quotes stripped). A focus
 *   value containing whitespace/newline is REJECTED (IPC-injection safety,
 *   consistent with previewServer.ts's `/[\s\n]/` rejection).
 * - `progress` is parsed as a float (range-clamping happens at render time — M5).
 *
 * Returns null when the line is not a `@preview-state:` directive, or when no
 * recognised key carries a valid value.
 */
function parsePreviewStateLine(line: string): PreviewState | null {
    const m = PREVIEW_STATE_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    const body = m[1];
    const state: PreviewState = {};
    const focusMatch = STATE_FOCUS_RE.exec(body);
    if (focusMatch) {
        // group 1 = quoted value (may be empty), group 2 = bare identifier
        const value = focusMatch[1] !== undefined ? focusMatch[1] : focusMatch[2];
        if (value && !/[\s\n]/.test(value)) {
            state.focus = value;
        }
    }
    const progressMatch = STATE_PROGRESS_RE.exec(body);
    if (progressMatch) {
        const p = parseFloat(progressMatch[1]);
        if (!Number.isNaN(p)) {
            state.progress = p;
        }
    }
    if (state.focus === undefined && state.progress === undefined) {
        return null;
    }
    return state;
}

/**
 * Regex matching a variable declaration like `View card = ...`
 * Captures everything after the `=` (trimmed).
 * Handles common DALi types: View, Control, Actor, ImageView, TextLabel, etc.
 */
const VAR_DECL_RE = /^\s*(?:auto|[\w:]+(?:<[^>]*>)?)\s+\w+\s*=\s*/;

/**
 * True if `code` contains a statement-level `return` (at the start of a line,
 * ignoring indentation). Used to decide whether a preview body is already a
 * complete, self-returning block (the non-fluent dali-ui style) — in which case
 * the leading-var-decl → `return` rewrite must be skipped.
 */
function hasStatementReturn(code: string): boolean {
    return /(^|\n)\s*return\b/.test(code);
}

/**
 * Extract DALi preview code from a document.
 *
 * - `.preview.dali.cpp` files: entire content is preview code.
 * - `.cpp` / `.h` files: code between @dali-preview-begin/end markers.
 *
 * Returns null when the document is not previewable.
 */
export function extractPreviewCode(document: vscode.TextDocument): ExtractionResult | null {
    const log = getLogger();
    const fileName = document.fileName;

    // --- Mode 1: dedicated preview file ---
    if (fileName.endsWith('.preview.dali.cpp')) {
        const lines = document.getText().split('\n');
        const configs: PreviewConfig[] = [];
        const codeLines: string[] = [];
        let configLineCount = 0;
        let state: PreviewState | undefined;
        for (const line of lines) {
            const cfg = parsePreviewConfigLine(line);
            if (cfg) {
                configs.push(cfg);
                configLineCount++;
                continue;
            }
            const presetConfigs = expandPresetLine(line);
            if (presetConfigs !== null) {
                configs.push(...presetConfigs); // append expanded variants ([] if unknown)
                configLineCount++;
                continue;
            }
            const st = parsePreviewStateLine(line);
            if (st) {
                state = st; // last valid state line wins
                configLineCount++;
                continue;
            }
            codeLines.push(line);
        }
        const result: ExtractionResult = {
            code: codeLines.join('\n'),
            startLine: configLineCount,
            mode: 'preview-file',
            configs: configs.length > 0 ? configs : undefined,
            state,
        };
        log.debug('Extraction', 'mode selected', { mode: result.mode, fileName, lineCount: codeLines.length });
        return result;
    }

    // --- Mode 2: single // @preview (or zero-arg // @dali-preview) marker → next function body ---
    if (fileName.endsWith('.cpp') || fileName.endsWith('.h')) {
        // Collect a `// @preview-state:` directive (last valid wins) and the line
        // numbers it occupies, so those directive lines are excluded from the
        // extracted function body (the same way config lines are filtered out
        // elsewhere). State may sit above the marker or inside the body.
        let modeState: PreviewState | undefined;
        const stateLineSet = new Set<number>();
        for (let i = 0; i < document.lineCount; i++) {
            const st = parsePreviewStateLine(document.lineAt(i).text);
            if (st) {
                modeState = st; // last valid state line wins
                stateLineSet.add(i);
            }
        }

        for (let i = 0; i < document.lineCount; i++) {
            const markerText = document.lineAt(i).text.trim();
            // Recognise the single-line `// @preview` marker and the zero-arg
            // factory entry marker `// @dali-preview` (exact match so it does NOT
            // match `// @dali-preview-begin`). Both share the body-extraction path.
            if (markerText !== SINGLE_PREVIEW_MARKER && markerText !== DALI_PREVIEW_MARKER) {
                continue;
            }

            // Found the marker — scan forward for the next function opening brace
            let braceLineStart = -1;
            for (let j = i + 1; j < document.lineCount && j < i + 20; j++) {
                if (document.lineAt(j).text.includes('{')) {
                    braceLineStart = j;
                    break;
                }
            }
            if (braceLineStart < 0) {
                break; // marker found but no function below it
            }

            // Find the matching closing brace (record its column too, so inline
            // and single-line bodies `Foo() { ... }` are handled).
            const braceColStart = document.lineAt(braceLineStart).text.indexOf('{');
            let depth = 0;
            let foundOpen = false;
            let braceLineEnd = -1;
            let braceColEnd = -1;
            for (let j = braceLineStart; j < document.lineCount; j++) {
                const text = document.lineAt(j).text;
                for (let c = 0; c < text.length; c++) {
                    const ch = text[c];
                    if (ch === '{') {
                        depth++;
                        foundOpen = true;
                    } else if (ch === '}') {
                        depth--;
                    }
                    if (foundOpen && depth === 0) {
                        braceLineEnd = j;
                        braceColEnd = c;
                        break;
                    }
                }
                if (braceLineEnd >= 0) {
                    break;
                }
            }
            if (braceLineEnd < 0) {
                break;
            }

            // Body starts at the line after the opening brace (for error-line
            // mapping); inline bodies map to the brace line itself closely enough.
            const startLine = braceLineStart + 1;

            // Extract the body between the opening `{` and its matching `}`,
            // handling inline content on the brace line / close line and
            // single-line bodies. Drop `// @preview-state:` directive lines.
            const codeLines: string[] = [];
            if (braceLineStart === braceLineEnd) {
                codeLines.push(
                    document.lineAt(braceLineStart).text.slice(braceColStart + 1, braceColEnd),
                );
            } else {
                const head = document.lineAt(braceLineStart).text.slice(braceColStart + 1);
                if (head.trim()) {
                    codeLines.push(head);
                }
                for (let j = braceLineStart + 1; j < braceLineEnd; j++) {
                    if (stateLineSet.has(j)) {
                        continue;
                    }
                    codeLines.push(document.lineAt(j).text);
                }
                const tail = document.lineAt(braceLineEnd).text.slice(0, braceColEnd);
                if (tail.trim()) {
                    codeLines.push(tail);
                }
            }

            let code = codeLines.join('\n');
            if (!code.trim()) {
                break;
            }

            // Rewrite a single leading variable declaration to `return`
            // (`View card = ...;` → `return ...;`) ONLY when the body has no
            // statement-level `return` of its own. Non-fluent dali-ui bodies are
            // multi-statement and end in an explicit `return root;` (the fluent
            // chaining API was removed, so setters are sequential statements) —
            // those must be used verbatim, since stripping the leading decl would
            // leave later statements referencing an undeclared variable.
            const trimmed = code.trimStart();
            if (!hasStatementReturn(code)) {
                const match = trimmed.match(VAR_DECL_RE);
                if (match) {
                    code = 'return ' + trimmed.slice(match[0].length);
                }
            }

            log.debug('Extraction', 'mode selected', { mode: 'single-marker', fileName, lineCount: codeLines.length });
            return {
                code,
                startLine,
                mode: 'single-marker',
                state: modeState,
            };
        }
    }

    // --- Mode 3: marker-delimited region in .cpp / .h ---
    if (fileName.endsWith('.cpp') || fileName.endsWith('.h')) {
        const lineCount = document.lineCount;
        let beginLine = -1;
        let endLine = -1;

        for (let i = 0; i < lineCount; i++) {
            const text = document.lineAt(i).text.trim();
            if (text === MARKER_BEGIN) {
                beginLine = i;
            } else if (text === MARKER_END && beginLine >= 0) {
                endLine = i;
                break; // use the first complete pair
            }
        }

        if (beginLine < 0 || endLine < 0 || endLine <= beginLine + 1) {
            return null; // no valid marker pair (or empty region)
        }

        // Extract lines between the markers (exclusive of markers themselves).
        // Lines matching @preview-config / @preview-state are collected and
        // excluded from code.
        const codeLines: string[] = [];
        const configs: PreviewConfig[] = [];
        let state: PreviewState | undefined;
        for (let i = beginLine + 1; i < endLine; i++) {
            const lineText = document.lineAt(i).text;
            const cfg = parsePreviewConfigLine(lineText);
            if (cfg) {
                configs.push(cfg);
                continue;
            }
            const presetConfigs = expandPresetLine(lineText);
            if (presetConfigs !== null) {
                configs.push(...presetConfigs); // append expanded variants ([] if unknown)
                continue;
            }
            const st = parsePreviewStateLine(lineText);
            if (st) {
                state = st; // last valid state line wins
                continue;
            }
            codeLines.push(lineText);
        }

        let code = codeLines.join('\n');

        // If the code is a single leading variable declaration, strip it and add
        // `return` (`View card = FlexLayout::New()` -> `return FlexLayout::New()`).
        // Skip when the body already has a statement-level `return` of its own —
        // non-fluent dali-ui bodies are multi-statement (setters return void, so
        // no chaining) and end in an explicit `return root;`, which must be kept
        // verbatim (rewriting would leave later statements referencing an
        // undeclared variable).
        const trimmed = code.trimStart();
        if (!hasStatementReturn(code)) {
            const match = trimmed.match(VAR_DECL_RE);
            if (match) {
                code = 'return ' + trimmed.slice(match[0].length);
            }
        }

        log.debug('Extraction', 'mode selected', { mode: 'marker', fileName, lineCount: codeLines.length });
        return {
            code,
            startLine: beginLine + 1,
            mode: 'marker',
            configs: configs.length > 0 ? configs : undefined,
            state,
        };
    }

    log.debug('Extraction', 'no preview code found', { fileName });
    return null;
}

/**
 * Check whether a document can produce a DALi preview.
 */
export function isPreviewable(document: vscode.TextDocument): boolean {
    const fileName = document.fileName;

    if (fileName.endsWith('.preview.dali.cpp')) {
        return true;
    }

    if (fileName.endsWith('.cpp') || fileName.endsWith('.h')) {
        const text = document.getText();
        if (text.includes(MARKER_BEGIN) || text.includes(SINGLE_PREVIEW_MARKER)) {
            return true;
        }
        // Zero-arg entry marker: an exact `// @dali-preview` line (not the
        // `@dali-preview-begin` region marker, which is already handled above).
        return text.split('\n').some((l) => l.trim() === DALI_PREVIEW_MARKER);
    }

    return false;
}

/**
 * Extract a function body from a specific line range for CodeLens-triggered preview.
 *
 * Extracts the lines between the opening and closing braces (exclusive) and
 * rewrites a leading variable declaration to a `return` statement if needed.
 *
 * Returns null if the body cannot be determined or is empty.
 */
/** Parse a parameter list ("const std::string& a, int b") into {type, name} pairs. */
function parseParamList(s: string): { name: string; type: string }[] {
    return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
        const m = p.match(/^(.*?)\b([A-Za-z_]\w*)\s*$/);
        return m ? { type: m[1].trim(), name: m[2] } : null;
    }).filter((p): p is { name: string; type: string } => p !== null);
}

export function extractFunctionBody(
    document: vscode.TextDocument,
    funcStartLine: number,
    funcEndLine: number,
): ExtractionResult | null {
    // Find the opening brace (may be on the function signature line or the next)
    let braceLineStart = -1;
    for (let i = funcStartLine; i <= funcEndLine; i++) {
        if (document.lineAt(i).text.includes('{')) {
            braceLineStart = i;
            break;
        }
    }
    if (braceLineStart < 0) {
        return null;
    }

    // Extract lines between { and } (exclusive)
    const startLine = braceLineStart + 1;
    const endLine = funcEndLine; // the } line

    const codeLines: string[] = [];
    for (let i = startLine; i < endLine; i++) {
        codeLines.push(document.lineAt(i).text);
    }

    let code = codeLines.join('\n');
    if (!code.trim()) {
        return null;
    }

    // If the code doesn't start with `return`, try to rewrite a leading variable
    // declaration into a return statement.
    // e.g. `View card = FlexLayout::New()...` → `return FlexLayout::New()...`
    const trimmed = code.trimStart();
    if (!trimmed.startsWith('return')) {
        const match = trimmed.match(VAR_DECL_RE);
        if (match) {
            code = 'return ' + trimmed.slice(match[0].length);
        }
    }

    // Parse the signature params (funcStartLine..braceLineStart) so a CodeLens on a
    // specific function carries ITS params — not the file's first function's.
    let sig = '';
    for (let i = funcStartLine; i <= braceLineStart; i++) { sig += document.lineAt(i).text + ' '; }
    const pmatch = sig.match(/\(([^)]*)\)/);
    const params = pmatch ? parseParamList(pmatch[1]) : [];

    return {
        code,
        startLine,
        mode: 'marker',
        params,
    };
}

/**
 * Actor-derived DALi-UI types whose ::New() factory returns a handle that
 * inherits Dali::Handle::SetProperty — safe to wrap with __tag() for
 * click-to-code. Non-Actor handles (Animation, Timer, Capture, gesture
 * detectors, ...) are deliberately excluded: __tag() calls
 * SetProperty(Actor::Property::NAME, ...) and would fail to compile
 * against a non-Actor handle.
 */
const ACTOR_TYPES = new Set([
    'View', 'FlexLayout', 'AbsoluteLayout', 'StackLayout', 'GridLayout',
    'Label', 'TextLabel', 'ImageView', 'AnimatedImageView', 'LottieAnimationView',
    'InputField', 'ScrollView', 'Control', 'Layout', 'Actor',
]);

/**
 * Instrument preview code by wrapping each Actor-derived ::New() call with
 * __tag() for click-to-code. __tag() is a template helper defined in the
 * harness that sets Actor::Property::NAME and returns the same handle,
 * preserving the builder pattern chain.
 *
 * Example: FlexLayout::New() → __tag(FlexLayout::New(), "__L5")
 *
 * Non-Actor types (Animation::New, Timer::New, Capture::New, ...) are left
 * untouched so preview code that uses animation, timers, or captures still
 * compiles.
 *
 * The original user file is never modified — only the temporary build harness uses this.
 */
/**
 * Replace emoji/pictographic chars the preview runtime's font (DejaVu only) can't
 * render with a placeholder □, so DALi doesn't abort when several land in separate
 * Labels (real Tizen devices have emoji/CJK fonts; the docker preview doesn't).
 * Only touches string-literal contents; returns whether anything changed so the
 * caller can warn the user. Box-drawing / geometric shapes (━ ● ▮) are kept — they
 * render fine; only the emoji blocks are stripped.
 */
export function sanitizeUnsupportedGlyphs(code: string): { code: string; replaced: boolean } {
    let replaced = false;
    const out = code.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (full, inner) => {
        const fixed = inner.replace(/[\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu, '□');
        if (fixed !== inner) { replaced = true; return '"' + fixed + '"'; }
        return full;
    });
    return { code: out, replaced };
}

/**
 * Rewrite `EXPR.AddChildren(vec)` / `EXPR.Children(vec)` — where vec is a single
 * identifier (a std::vector<View>), not an `{ init-list }` — into an IIFE that
 * .Add()s each element. View::AddChildren (renamed from Children when dali-ui
 * dropped the fluent API) has only an initializer_list overload, so passing a
 * vector won't compile; this is the source transform for P13. An `{ ... }`
 * argument is left untouched (it already compiles). The legacy `Children` name
 * is still matched so pre-migration snippets keep working.
 */
export function transformVectorChildren(code: string): string {
    return code
        // Non-fluent statement form (the post-fluent-removal idiom):
        //   `root.AddChildren(items);`  ->  `for (auto& __ce : items) { root.Add(__ce); }`
        // Matches only a bare-identifier receiver and a single-identifier (vector)
        // argument — an `{ init-list }` argument starts with `{` and is left alone.
        .replace(
            /(^|\n)([ \t]*)([A-Za-z_]\w*)\.(?:Add)?Children\(\s*([A-Za-z_]\w*)\s*\)\s*;/g,
            (_m, pre, indent, recv, vec) => `${pre}${indent}for (auto& __ce : ${vec}) { ${recv}.Add(__ce); }`,
        )
        // Legacy fluent return-expression form (pre-migration snippets):
        //   `return EXPR.Children(items);`  ->  IIFE that .Add()s each element.
        .replace(
            /\breturn\s+([\s\S]+?)\.(?:Add)?Children\(\s*([A-Za-z_]\w*)\s*\)\s*;/g,
            (_m, expr, vec) => `return [&]{ auto __cw = ${expr}; for (auto& __ce : ${vec}) { __cw.Add(__ce); } return __cw; }();`,
        );
}

export function instrumentCode(code: string, startLine: number, helperNames: Set<string> = new Set()): string {
    const log = getLogger();
    let result = '';
    let lastIndex = 0;
    let instrumentedCount = 0;

    // Tag two things for click-to-code: an Actor-derived `Type::New(` call, OR a
    // call to a View-returning project helper (e.g. MakeSectionHeader(...)) whose
    // name SliceBuilder collected — both yield a taggable handle. Other fn calls
    // (UiColor, SetFontSize, ...) are skipped. The balanced ')' walk skips string
    // literals so a ')' inside a string doesn't close the match early.
    const CALL_START_RE = /(\w+)::New\(|\b([A-Za-z_]\w*)\s*\(/g;
    let startMatch;

    while ((startMatch = CALL_START_RE.exec(code)) !== null) {
        const typeName = startMatch[1];
        const fnName = startMatch[2];
        if (typeName) {
            if (!ACTOR_TYPES.has(typeName)) { continue; }
        } else if (!(fnName && helperNames.has(fnName))) {
            continue;   // plain call that isn't a known View-returning helper
        }

        // Walk forward from the opening '(' to find the balanced ')'
        const argsStart = startMatch.index + startMatch[0].length;
        let depth = 1;
        let i = argsStart;
        let inString = false;
        let stringChar = '';
        while (i < code.length && depth > 0) {
            const ch = code[i];
            if (inString) {
                if (ch === '\\') {
                    i++; // skip escaped character
                } else if (ch === stringChar) {
                    inString = false;
                }
            } else {
                if (ch === '"' || ch === '\'') {
                    inString = true;
                    stringChar = ch;
                } else if (ch === '(') {
                    depth++;
                } else if (ch === ')') {
                    depth--;
                }
            }
            i++;
        }

        if (depth !== 0) {
            continue; // unbalanced — skip
        }

        const fullMatch = code.substring(startMatch.index, i);
        const before = code.substring(0, startMatch.index);
        const codeLine = before.split('\n').length - 1;
        const absoluteLine = codeLine + startLine;

        result += code.substring(lastIndex, startMatch.index);
        result += `__tag(${fullMatch}, "__L${absoluteLine}")`;
        lastIndex = i;
        instrumentedCount++;

        // Advance the regex past this match
        CALL_START_RE.lastIndex = i;
    }
    result += code.substring(lastIndex);
    log.trace('Extraction', 'instrumentCode', { startLine, instrumentedCount });
    return result;
}
