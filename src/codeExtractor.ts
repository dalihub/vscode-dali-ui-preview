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
