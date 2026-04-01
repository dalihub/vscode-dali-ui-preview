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

const PROP_VALIDATORS: Readonly<Record<string, (v: string) => boolean>> = {
    x:       (v) => FLOAT_LITERAL.test(v),
    y:       (v) => FLOAT_LITERAL.test(v),
    w:       (v) => FLOAT_LITERAL.test(v),
    h:       (v) => FLOAT_LITERAL.test(v),
    opacity: (v) => FLOAT_LITERAL.test(v),
    visible: (v) => v === 'true' || v === 'false',
    // Vector4(r, g, b, a) — four float literals
    color: (v) =>
        /^Vector4\(\s*-?[0-9]+(\.[0-9]+)?f?\s*,\s*-?[0-9]+(\.[0-9]+)?f?\s*,\s*-?[0-9]+(\.[0-9]+)?f?\s*,\s*-?[0-9]+(\.[0-9]+)?f?\s*\)$/.test(v),
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
    // position — DALi uses SetPosition(x, y); edit x or y independently
    // by capturing both arguments and rebuilding the call (C1)
    x: [
        {
            pattern: /\.SetPosition\s*\(\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*,\s*(-?[0-9]+(?:\.[0-9]+)?f?)\s*\)/,
            buildReplacement: (v, m) => `.SetPosition(${v}, ${m[2]})`,
        },
    ],
    y: [
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
            return { success: false, reason: `'${propName}' 편집값이 비어 있습니다` };
        }

        const matchers = PROP_MATCHERS[propName];
        if (!matchers || matchers.length === 0) {
            return { success: false, reason: `'${propName}' 속성 편집 패턴 없음` };
        }

        // Input validation (H1) — reject values that don't match the allowlist
        const validator = PROP_VALIDATORS[propName];
        if (validator && !validator(newValue)) {
            return { success: false, reason: `'${propName}' 입력값이 유효하지 않습니다: ${newValue}` };
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
                    return { success: false, reason: 'applyEdit 실패 (WorkspaceEdit 적용 거부)' };
                }
                // doc.save() is intentionally omitted (H2):
                // applyEdit triggers onDidChangeTextDocument → live preview debounce.
                // Calling doc.save() would additionally fire onDidSaveTextDocument
                // causing a redundant immediate build.
                return { success: true };
            }
        }

        return {
            success: false,
            reason: `'${propName}' setter를 line ${sourceLine + 1} 주변 ${searchRadius}줄 내에서 찾지 못했습니다`,
        };
    }
}
