import * as vscode from 'vscode';

export interface ExtractionResult {
    code: string;
    startLine: number;
    mode: 'preview-file' | 'marker';
}

const MARKER_BEGIN = '// @dali-preview-begin';
const MARKER_END = '// @dali-preview-end';

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
    const fileName = document.fileName;

    // --- Mode 1: dedicated preview file ---
    if (fileName.endsWith('.preview.dali.cpp')) {
        return {
            code: document.getText(),
            startLine: 0,
            mode: 'preview-file',
        };
    }

    // --- Mode 2: marker-delimited region in .cpp / .h ---
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

        // Extract lines between the markers (exclusive of markers themselves)
        const codeLines: string[] = [];
        for (let i = beginLine + 1; i < endLine; i++) {
            codeLines.push(document.lineAt(i).text);
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

        return {
            code,
            startLine: beginLine + 1,
            mode: 'marker',
        };
    }

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
        return text.includes(MARKER_BEGIN);
    }

    return false;
}

/**
 * Instrument preview code by wrapping each ::New() call with __tag() for click-to-code.
 * __tag() is a template helper defined in the harness that sets Actor::Property::NAME
 * and returns the same handle, preserving the builder pattern chain.
 *
 * Example: FlexLayout::New() → __tag(FlexLayout::New(), "__L5")
 *
 * The original user file is never modified — only the temporary build harness uses this.
 */
export function instrumentCode(code: string, startLine: number): string {
    const NEW_CALL_RE = /(\w+::New\([^)]*\))/g;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = NEW_CALL_RE.exec(code)) !== null) {
        const before = code.substring(0, match.index);
        const codeLine = before.split('\n').length - 1;
        const absoluteLine = codeLine + startLine;

        // Wrap: Foo::New(...) → __tag(Foo::New(...), "__L{line}")
        result += code.substring(lastIndex, match.index);
        result += `__tag(${match[0]}, "__L${absoluteLine}")`;
        lastIndex = match.index + match[0].length;
    }
    result += code.substring(lastIndex);
    return result;
}
