import * as vscode from 'vscode';

export interface ParsedError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'note';
}

/**
 * Regex for a GCC diagnostic line:
 *   filename:LINE:COLUMN: error|warning|note: MESSAGE
 *
 * We capture: (1) filename, (2) line, (3) column, (4) severity, (5) message.
 */
const GCC_DIAG_RE = /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/;

/**
 * Parse GCC/g++ stderr output and map line numbers back to user code.
 *
 * @param stderr          Raw stderr from the compiler.
 * @param harnessCodeOffset  Line number (1-based) of the {{USER_CODE}} line in the
 *                           generated harness -- i.e. the value returned by
 *                           `getHarnessCodeOffset()`.
 * @returns An array of errors whose line numbers are relative to user code (0-based).
 */
export function parseGccErrors(
    stderr: string,
    harnessCodeOffset: number,
    isPlugin = false,
): ParsedError[] {
    const results: ParsedError[] = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
        const m = line.match(GCC_DIAG_RE);
        if (!m) {
            continue;
        }

        const [, filePath, lineStr, colStr, severity, message] = m;

        // Accept errors from either the harness file or the plugin file
        const isHarness = filePath.includes('preview_harness');
        const isPluginFile = filePath.includes('preview_plugin');
        if (isPlugin ? !isPluginFile : !isHarness) {
            continue;
        }

        const gccLine = parseInt(lineStr, 10);
        const column = parseInt(colStr, 10);

        // Map harness line -> user code line (0-based)
        const mappedLine = gccLine - harnessCodeOffset;

        if (mappedLine < 0) {
            // Error is in the harness boilerplate above user code -- skip
            continue;
        }

        results.push({
            line: mappedLine,
            column,
            message,
            severity: severity as ParsedError['severity'],
        });
    }

    return results;
}

/**
 * Determine on which line (1-based) the `{{USER_CODE}}` placeholder appears
 * in the plugin template.
 */
export function getPluginCodeOffset(templateContent: string): number {
    return getHarnessCodeOffset(templateContent);
}

/**
 * Determine on which line (1-based) the `{{USER_CODE}}` placeholder appears
 * in the harness template.  This value is the offset that must be subtracted
 * from GCC line numbers to obtain user-code-relative line numbers.
 */
export function getHarnessCodeOffset(templateContent: string): number {
    const lines = templateContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('{{USER_CODE}}')) {
            // Return the 1-based line number of the placeholder line.
            // Lines before AND including the placeholder are "overhead".
            return i + 1;
        }
    }
    // Fallback -- should not happen with a valid template
    return 0;
}

/**
 * Format parsed errors into a human-readable string suitable for the webview.
 */
export function formatErrorsForDisplay(errors: ParsedError[]): string {
    if (errors.length === 0) {
        return 'No errors.';
    }

    return errors
        .map((e) => {
            const tag = e.severity === 'error' ? 'Error' : e.severity === 'warning' ? 'Warning' : 'Note';
            return `${tag} - Line ${e.line + 1}, Col ${e.column}: ${e.message}`;
        })
        .join('\n');
}

/**
 * Convert parsed errors into VS Code `Diagnostic` objects that can be added
 * to a `DiagnosticCollection` for in-editor display (red/yellow underlines).
 *
 * @param errors     Errors with line numbers relative to user code (0-based).
 * @param document   The original source document being previewed.
 * @param startLine  The line offset of the user code inside the original document
 *                   (from `ExtractionResult.startLine`).
 */
export function errorsToDiagnostics(
    errors: ParsedError[],
    document: vscode.TextDocument,
    startLine: number,
): vscode.Diagnostic[] {
    return errors.map((e) => {
        const docLine = e.line + startLine;
        const col = Math.max(0, e.column - 1); // GCC columns are 1-based

        // Try to underline the whole line; fall back to a zero-width range if
        // the computed line is outside the document.
        let range: vscode.Range;
        if (docLine >= 0 && docLine < document.lineCount) {
            const lineText = document.lineAt(docLine).text;
            range = new vscode.Range(docLine, col, docLine, lineText.length);
        } else {
            range = new vscode.Range(0, 0, 0, 0);
        }

        let severity: vscode.DiagnosticSeverity;
        switch (e.severity) {
            case 'error':
                severity = vscode.DiagnosticSeverity.Error;
                break;
            case 'warning':
                severity = vscode.DiagnosticSeverity.Warning;
                break;
            case 'note':
                severity = vscode.DiagnosticSeverity.Information;
                break;
        }

        const diag = new vscode.Diagnostic(range, e.message, severity);
        diag.source = 'DALi Preview';
        return diag;
    });
}
