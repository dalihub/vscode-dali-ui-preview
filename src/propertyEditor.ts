import * as vscode from 'vscode';

export type EditResult =
    | { success: true }
    | { success: false; reason: string };

interface PropMatcher {
    pattern: RegExp;
    buildReplacement(newValue: string, match: RegExpExecArray): string;
}

// ---------------------------------------------------------------------------
// Input validation (H1) — allowlist per property type
// ---------------------------------------------------------------------------

const FLOAT_LITERAL = /^-?[0-9]+(\.[0-9]+)?f?$/;

const LAYOUT_POLICY = /^(MATCH_PARENT|WRAP_CONTENT|FILL_TO_PARENT|FIT_TO_CHILDREN)$/;

const PROP_VALIDATORS: Readonly<Record<string, (v: string) => boolean>> = {
    x:       (v) => FLOAT_LITERAL.test(v),
    y:       (v) => FLOAT_LITERAL.test(v),
    w:       (v) => FLOAT_LITERAL.test(v) || LAYOUT_POLICY.test(v),
    h:       (v) => FLOAT_LITERAL.test(v) || LAYOUT_POLICY.test(v),
    opacity: (v) => FLOAT_LITERAL.test(v),
    visible: (v) => v === 'true' || v === 'false',
    // Vector4(r, g, b, a) or UiColor(0xRRGGBB[AA]) — both valid DALi color forms
    color: (v) =>
        /^Vector4\(\s*-?[0-9]+(\.[0-9]+)?f?\s*,\s*-?[0-9]+(\.[0-9]+)?f?\s*,\s*-?[0-9]+(\.[0-9]+)?f?\s*,\s*-?[0-9]+(\.[0-9]+)?f?\s*\)$/.test(v) ||
        /^UiColor\(0x[0-9A-Fa-f]{6,8}\)$/.test(v),
};

// ---------------------------------------------------------------------------
// Regex patterns for finding and replacing property setter calls in DALi C++
// Each property maps to one or more matchers tried in order.
// ---------------------------------------------------------------------------

const PROP_MATCHERS: Readonly<Record<string, PropMatcher[]>> = {
    // opacity — SetProperty(Actor::Property::OPACITY, v) is the canonical form;
    // SetOpacity() kept as fallback for older hand-written code.
    opacity: [
        {
            pattern: /\.SetProperty\s*\(\s*Actor::Property::OPACITY\s*,\s*[^)]+\)/,
            buildReplacement: (v) => `.SetProperty(Actor::Property::OPACITY, ${v})`,
        },
        {
            pattern: /\.SetOpacity\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetOpacity(${v})`,
        },
    ],
    visible: [
        {
            // SetProperty(Actor::Property::VISIBLE, bool) — public Actor API
            pattern: /\.SetProperty\s*\(\s*Actor::Property::VISIBLE\s*,\s*[^)]+\)/,
            buildReplacement: (v) => `.SetProperty(Actor::Property::VISIBLE, ${v})`,
        },
        {
            // SetVisible() — legacy fallback (Dali::Actor base class)
            pattern: /\.SetVisible\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetVisible(${v})`,
        },
    ],
    // color — SetBackgroundColor(UiColor(...)) or SetBackgroundColor(Vector4(...))
    // use alternation to handle one level of nesting inside the outer parens (C2)
    color: [
        {
            pattern: /\.SetBackgroundColor\s*\((?:[^()]+|\([^()]*\))*\)/,
            buildReplacement: (v) => `.SetBackgroundColor(${v})`,
        },
    ],
    // position — SetPositionX/SetPositionY are the single-axis DALi-UI API;
    // SetPosition(x, y) is Actor core and kept as fallback.
    x: [
        {
            pattern: /\.SetPositionX\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetPositionX(${v})`,
        },
        {
            pattern: /\.SetPosition\s*\(\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*,\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*\)/,
            buildReplacement: (v, m) => `.SetPosition(${v}, ${m[2]})`,
        },
    ],
    y: [
        {
            pattern: /\.SetPositionY\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetPositionY(${v})`,
        },
        {
            pattern: /\.SetPosition\s*\(\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*,\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*\)/,
            buildReplacement: (v, m) => `.SetPosition(${m[1]}, ${v})`,
        },
    ],
    // width — SetRequestedWidth(w) is DALi-UI; SetSize(w, h) is Actor core
    w: [
        {
            pattern: /\.SetRequestedWidth\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetRequestedWidth(${v})`,
        },
        {
            pattern: /\.SetSize\s*\(\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*,\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*\)/,
            buildReplacement: (v, m) => `.SetSize(${v}, ${m[2]})`,
        },
    ],
    // height — SetRequestedHeight(h) is DALi-UI; SetSize(w, h) is Actor core
    h: [
        {
            pattern: /\.SetRequestedHeight\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetRequestedHeight(${v})`,
        },
        {
            pattern: /\.SetSize\s*\(\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*,\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*\)/,
            buildReplacement: (v, m) => `.SetSize(${m[1]}, ${v})`,
        },
    ],
};

/** Names of properties that have registered matchers and can be edited. */
export const EDITABLE_PROPS = Object.freeze(Object.keys(PROP_MATCHERS));

// ---------------------------------------------------------------------------
// INSERT_TEMPLATES — setter call to insert when no existing setter is found.
// Used as a fallback in applyEdit() when the search loop finds nothing.
// The placeholder `${value}` is replaced at runtime with the actual newValue.
// ---------------------------------------------------------------------------

const INSERT_TEMPLATES: Readonly<Record<string, (v: string) => string>> = {
    visible: (v) => `.SetProperty(Actor::Property::VISIBLE, ${v})`,
    opacity: (v) => `.SetOpacity(${v})`,
    color:   (v) => `.SetBackgroundColor(${v})`,
    x:       (v) => `.SetPositionX(${v})`,
    y:       (v) => `.SetPositionY(${v})`,
    w:       (v) => `.SetRequestedWidth(${v})`,
    h:       (v) => `.SetRequestedHeight(${v})`,
};

export class PropertyEditor {
    /**
     * Apply a property edit to the source document using VS Code's WorkspaceEdit API
     * (supports undo/redo natively).
     *
     * Searches within ±searchRadius lines from sourceLine for the property setter
     * and replaces it with the new value.
     *
     * @param doc          VS Code TextDocument to edit
     * @param sourceLine   0-based line index of the tagged Actor (__L<line>)
     * @param propName     Property name: 'opacity' | 'visible' | 'color' | 'x' | 'y' | 'w' | 'h'
     * @param newValue     New C++ literal value (e.g. '0.8f', 'true', 'Vector4(1,0,0,1)')
     * @param searchRadius Lines to search on each side of sourceLine (default 20)
     */
    async applyEdit(
        doc: vscode.TextDocument,
        sourceLine: number,
        propName: string,
        newValue: string,
        searchRadius = 20,
    ): Promise<EditResult> {
        // Empty value check
        if (!newValue) {
            return { success: false, reason: `'${propName}' edit value is empty` };
        }

        const matchers = PROP_MATCHERS[propName];
        if (!matchers || matchers.length === 0) {
            return { success: false, reason: `No edit pattern for property '${propName}'` };
        }

        // Input validation (H1) — reject values that don't match the allowlist
        const validator = PROP_VALIDATORS[propName];
        if (validator && !validator(newValue)) {
            return { success: false, reason: `Invalid value for '${propName}': ${newValue}` };
        }

        // Bounds check for sourceLine (M7)
        const clampedSource = Math.max(0, Math.min(doc.lineCount - 1, sourceLine));

        const lineStart = Math.max(0, clampedSource - searchRadius);
        const lineEnd = Math.min(doc.lineCount - 1, clampedSource + searchRadius);

        for (let li = lineStart; li <= lineEnd; li++) {
            const text = doc.lineAt(li).text;
            for (const matcher of matchers) {
                const m = matcher.pattern.exec(text);
                if (!m) {
                    continue;
                }
                const replacement = matcher.buildReplacement(newValue, m);
                const range = new vscode.Range(li, m.index, li, m.index + m[0].length);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(doc.uri, range, replacement);
                const ok = await vscode.workspace.applyEdit(edit);
                if (!ok) {
                    return { success: false, reason: 'applyEdit failed (WorkspaceEdit rejected)' };
                }
                // doc.save() is intentionally omitted (H2):
                // applyEdit triggers onDidChangeTextDocument → live preview debounce.
                // Calling doc.save() would additionally fire onDidSaveTextDocument
                // causing a redundant immediate build.
                return { success: true };
            }
        }

        // No existing setter found — attempt to INSERT a new setter call after the
        // closest ::New( call within the search window (insertion fallback).
        const insertTemplate = INSERT_TEMPLATES[propName];
        if (insertTemplate) {
            const newCallPattern = /::New\s*\(/;
            // Search from sourceLine outward to find the nearest ::New( line
            let newCallLine = -1;
            for (let radius = 0; radius <= (lineEnd - lineStart); radius++) {
                const before = clampedSource - radius;
                const after  = clampedSource + radius;
                if (before >= lineStart && newCallPattern.test(doc.lineAt(before).text)) {
                    newCallLine = before;
                    break;
                }
                if (after !== before && after <= lineEnd && newCallPattern.test(doc.lineAt(after).text)) {
                    newCallLine = after;
                    break;
                }
            }

            if (newCallLine !== -1) {
                // Determine indentation from the line after ::New( (the first chain call),
                // falling back to the indentation of the ::New( line itself.
                const nextLine = newCallLine + 1;
                let indent = '';
                if (nextLine < doc.lineCount) {
                    const nextText = doc.lineAt(nextLine).text;
                    const m = /^(\s*)/.exec(nextText);
                    indent = m ? m[1] : '';
                } else {
                    const newLineText = doc.lineAt(newCallLine).text;
                    const m = /^(\s*)/.exec(newLineText);
                    indent = m ? m[1] : '';
                }

                const insertPos = new vscode.Position(newCallLine + 1, 0);
                const insertText = `${indent}${insertTemplate(newValue)}\n`;
                const edit = new vscode.WorkspaceEdit();
                edit.insert(doc.uri, insertPos, insertText);
                const ok = await vscode.workspace.applyEdit(edit);
                if (!ok) {
                    return { success: false, reason: 'applyEdit failed (WorkspaceEdit rejected)' };
                }
                return { success: true };
            }
        }

        return {
            success: false,
            reason: `Could not find '${propName}' setter within ${searchRadius} lines of line ${sourceLine + 1}`,
        };
    }
}
