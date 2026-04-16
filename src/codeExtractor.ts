import * as vscode from 'vscode';
import { PreviewConfig } from './previewConfig';
import { getLogger } from './logger';

export interface ExtractionResult {
    code: string;
    startLine: number;
    mode: 'preview-file' | 'marker' | 'single-marker';
    configs?: PreviewConfig[];
}

const MARKER_BEGIN = '// @dali-preview-begin';
const MARKER_END = '// @dali-preview-end';
const SINGLE_PREVIEW_MARKER = '// @preview';

const PREVIEW_CONFIG_RE = /^\/\/\s*@preview-config:\s*(.+)$/;
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
 * Regex matching a variable declaration like `View card = ...`
 * Captures everything after the `=` (trimmed).
 * Handles common DALi types: View, Control, Actor, ImageView, TextLabel, etc.
 */
const VAR_DECL_RE = /^\s*(?:auto|[\w:]+(?:<[^>]*>)?)\s+\w+\s*=\s*/;

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
        for (const line of lines) {
            const cfg = parsePreviewConfigLine(line);
            if (cfg) {
                configs.push(cfg);
                configLineCount++;
            } else {
                codeLines.push(line);
            }
        }
        const result: ExtractionResult = {
            code: codeLines.join('\n'),
            startLine: configLineCount,
            mode: 'preview-file',
            configs: configs.length > 0 ? configs : undefined,
        };
        log.debug('Extraction', 'mode selected', { mode: result.mode, fileName, lineCount: codeLines.length });
        return result;
    }

    // --- Mode 2: single // @preview marker → next function body ---
    if (fileName.endsWith('.cpp') || fileName.endsWith('.h')) {
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.trim() !== SINGLE_PREVIEW_MARKER) {
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

            // Find the matching closing brace
            let depth = 0;
            let foundOpen = false;
            let braceLineEnd = -1;
            for (let j = braceLineStart; j < document.lineCount; j++) {
                const text = document.lineAt(j).text;
                for (const ch of text) {
                    if (ch === '{') {
                        depth++;
                        foundOpen = true;
                    }
                    if (ch === '}') {
                        depth--;
                    }
                    if (foundOpen && depth === 0) {
                        braceLineEnd = j;
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

            // Extract lines between { and } (exclusive)
            const startLine = braceLineStart + 1;
            const codeLines: string[] = [];
            for (let j = startLine; j < braceLineEnd; j++) {
                codeLines.push(document.lineAt(j).text);
            }

            let code = codeLines.join('\n');
            if (!code.trim()) {
                break;
            }

            // Rewrite leading variable declaration to `return` if needed
            const trimmed = code.trimStart();
            if (!trimmed.startsWith('return')) {
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
        // Lines matching @preview-config are collected as configs and excluded from code.
        const codeLines: string[] = [];
        const configs: PreviewConfig[] = [];
        for (let i = beginLine + 1; i < endLine; i++) {
            const lineText = document.lineAt(i).text;
            const cfg = parsePreviewConfigLine(lineText);
            if (cfg) {
                configs.push(cfg);
            } else {
                codeLines.push(lineText);
            }
        }

        let code = codeLines.join('\n');

        // If the code starts with a variable declaration, strip it and add `return`
        // e.g. `View card = FlexLayout::New()` -> `return FlexLayout::New()`
        const trimmed = code.trimStart();
        if (!trimmed.startsWith('return')) {
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
        return text.includes(MARKER_BEGIN) || text.includes(SINGLE_PREVIEW_MARKER);
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

    return {
        code,
        startLine,
        mode: 'marker',
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
export function instrumentCode(code: string, startLine: number): string {
    const log = getLogger();
    let result = '';
    let lastIndex = 0;
    let instrumentedCount = 0;

    // Match Type::New( at the start, then find the balanced closing ')' while
    // skipping characters inside string literals so that ')' inside strings
    // (e.g. Label::New(")text)") does not prematurely close the match.
    const CALL_START_RE = /(\w+)::New\(/g;
    let startMatch;

    while ((startMatch = CALL_START_RE.exec(code)) !== null) {
        const typeName = startMatch[1];
        if (!ACTOR_TYPES.has(typeName)) {
            continue;
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
