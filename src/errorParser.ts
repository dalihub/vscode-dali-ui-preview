import * as vscode from 'vscode';

export interface ParsedError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'note';
    /**
     * Absolute path of the ORIGINAL source file this error belongs to, set only
     * for a `#line`-relabeled cross-file/member error (WU-M4.5) whose file matched
     * one of the slice's `sourcePaths`. When set, `line` is already the 0-based line
     * in THAT file (the `#line` coords are original) — no harness-offset arithmetic
     * was applied. Undefined for ordinary harness/plugin errors (existing behavior).
     */
    file?: string;
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
    isInteractive = false,
    sourcePaths?: string[],
): ParsedError[] {
    const results: ParsedError[] = [];
    const lines = stderr.split('\n');
    const sources = sourcePaths ?? [];

    for (const line of lines) {
        const m = line.match(GCC_DIAG_RE);
        if (!m) {
            continue;
        }

        const [, filePath, lineStr, colStr, severity, message] = m;
        const gccLine = parseInt(lineStr, 10);
        const column = parseInt(colStr, 10);

        // WU-M4.5: a `#line` directive relabeled this error to one of the user's
        // REAL source files (the slice's sourcePaths). g++ echoes the directive's
        // path verbatim, so its coords are ALREADY original — pass it through with
        // (file, line) as-is (line 1-based -> 0-based), NO harness-offset math, and
        // do NOT drop it (the static harness/plugin gate below would have). Only the
        // first matching source wins. Skipped entirely when sourcePaths is empty, so
        // existing behavior is byte-identical.
        const matchedSource = sources.find((sp) => pathsMatch(filePath, sp));
        if (matchedSource) {
            results.push({
                line: gccLine - 1,            // #line coords are 1-based original lines
                column,
                message,
                severity: severity as ParsedError['severity'],
                file: matchedSource,
            });
            continue;
        }

        // Accept errors from the appropriate generated file
        const isHarness = filePath.includes('preview_harness');
        const isPluginFile = filePath.includes('preview_plugin');
        const isInteractiveFile = filePath.includes('preview_interactive');

        let matches: boolean;
        if (isInteractive) {
            matches = isInteractiveFile;
        } else if (isPlugin) {
            matches = isPluginFile;
        } else {
            matches = isHarness;
        }

        if (!matches) {
            continue;
        }

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
 * True if a g++-reported `filePath` refers to the slice source `sp`. g++ echoes
 * the `#line` directive's path verbatim, so exact equality is the common case;
 * the basename fallback tolerates a compiler that normalizes the path (e.g. makes
 * it relative). Only matches when basenames agree, so an unrelated file in another
 * directory with a coincidental suffix never matches.
 */
function pathsMatch(filePath: string, sp: string): boolean {
    if (filePath === sp) {
        return true;
    }
    const base = (p: string): string => p.split(/[\\/]/).pop() ?? p;
    const fb = base(filePath);
    const sb = base(sp);
    return fb === sb && (filePath.endsWith(sp) || sp.endsWith(filePath));
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
 * Summarise raw compiler stderr into a short, user-readable message.
 *
 * Used as a fallback when `parseGccErrors` returns an empty array — e.g. when
 * the error is in harness boilerplate (not user code), or when pkg-config /
 * linker steps fail rather than the compile itself.
 *
 * The function extracts the first meaningful error line and strips noisy
 * system-path prefixes, keeping the output under ~120 characters.
 */
export function formatRawError(raw: string): string {
    if (!raw || raw.trim().length === 0) {
        return 'Build failed (no output).';
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    // Prefer the first line that contains ': error:' — it is most informative.
    const errorLine = lines.find(l => /:\s*error:/i.test(l));
    const candidate = errorLine ?? lines[0];

    // Strip leading tmp-file path up to the first ':' that precedes a line number,
    // turning e.g. "/tmp/dali_preview/preview_harness.cpp:5:3: error: …"
    // into "Line 5:3: error: …"
    const mapped = candidate.replace(
        /^[^\s:]+:(\d+):(\d+):\s*(error|warning|note):\s*/i,
        'Line $1, Col $2: '
    );

    // Trim to a reasonable display length
    const out = mapped.length > 200 ? mapped.slice(0, 197) + '…' : mapped;

    // A runtime/code API skew (stale image) often surfaces here too — when the
    // skew error lands in harness boilerplate, parseGccErrors drops it and the
    // caller falls back to this raw summary. Append the same actionable hint so
    // the guidance survives that path.
    return detectRuntimeApiSkew(raw) ? `${out}\n\n${RUNTIME_API_SKEW_HINT}` : out;
}

/**
 * dali-ui renamed its child-adding API between runtime-image versions
 * (`View::Children(initializer_list)` → `View::AddChildren`, 2026-06). When the
 * runtime IMAGE and the preview CODE disagree on which name exists, g++ emits e.g.
 *   `'class Dali::Ui::FlexLayout' has no member named 'AddChildren'; did you mean 'Children'?`
 * (or the reverse, when the image is NEWER than the code). That is NOT a bug the
 * user can fix in their source — it means the runtime image is out of sync with the
 * code, which in practice is almost always a STALE runtime (built before the code
 * migrated). Detect that signature so we can point the user at the fix instead of
 * leaving them staring at a cryptic compiler line.
 *
 * IMPORTANT: g++ quotes identifiers with Unicode curly quotes (U+2018 ‘ … U+2019 ’),
 * NOT ASCII apostrophes, so the character classes below MUST accept both — matching
 * only `'…'` silently never fires on real compiler output (verified the hard way).
 */
const RUNTIME_API_SKEW_RE =
    /Dali::Ui::\w+['‘’]?\s+has no member named\s+['‘’']?(?:AddChildren|Children)['‘’']?/;

/** True if `stderr` carries the dali-ui child-API version-skew signature. */
export function detectRuntimeApiSkew(stderr: string): boolean {
    return RUNTIME_API_SKEW_RE.test(stderr ?? '');
}

/**
 * Actionable hint appended to a preview error caused by a runtime/code API skew.
 * Covers BOTH runtime modes (the error is identical; only the fix differs):
 *  - docker runtime → pull a fresh image,
 *  - local runtime  → the native DALi prefix is older than the code.
 */
export const RUNTIME_API_SKEW_HINT =
    '⚠️ Your DALi runtime is out of sync with this code (the dali-ui child API name '
    + 'differs between the runtime and the preview) — almost always a STALE runtime. '
    + 'Fix: • Docker runtime → Command Palette “DALi Preview: Download Runtime Image” '
    + '(or “Check for Runtime Image Update”). • Local runtime '
    + '(daliPreview.runtimeMode=local) → your native DALi prefix predates the code; '
    + 'rebuild that prefix, or switch to the Docker runtime.';

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
        // A `#line`-relabeled cross-file/member error (WU-M4.5) already carries the
        // 0-based line in its OWN file — it must NOT be shifted by the entry doc's
        // `startLine` (that offset only applies to user-code-relative harness errors).
        const docLine = e.file !== undefined ? e.line : e.line + startLine;
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

/**
 * Parse raw g++ stderr into editor diagnostics plus a formatted display message.
 *
 * Returns `null` when no structured errors were recognised — the caller then
 * shows its own raw-error fallback (the orchestrator's build modes differ in
 * what that fallback is, so it stays at the call site). This collapses the
 * identical `parseGccErrors → errorsToDiagnostics → formatErrorsForDisplay`
 * sequence that every build mode otherwise repeats inline.
 */
export function diagnoseGccErrors(
    stderr: string,
    harnessCodeOffset: number,
    document: vscode.TextDocument,
    startLine: number,
    isPlugin = false,
    isInteractive = false,
    sourcePaths?: string[],
): { diagnostics: vscode.Diagnostic[]; displayMessage: string } | null {
    const errors = parseGccErrors(stderr, harnessCodeOffset, isPlugin, isInteractive, sourcePaths);
    if (errors.length === 0) {
        return null;
    }
    const displayMessage = formatErrorsForDisplay(errors);
    return {
        diagnostics: errorsToDiagnostics(errors, document, startLine),
        displayMessage: detectRuntimeApiSkew(stderr)
            ? `${displayMessage}\n\n${RUNTIME_API_SKEW_HINT}`
            : displayMessage,
    };
}
