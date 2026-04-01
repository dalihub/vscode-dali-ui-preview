import * as vscode from 'vscode';

export type EditResult =
    | { success: true }
    | { success: false; reason: string };

interface PropMatcher {
    pattern: RegExp;
    buildReplacement(newValue: string): string;
}

/**
 * Regex patterns for finding and replacing property setter calls in DALi C++ source.
 * Each property maps to one or more matchers tried in order.
 */
const PROP_MATCHERS: Readonly<Record<string, PropMatcher[]>> = {
    opacity: [
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
    color: [
        {
            pattern: /\.SetBackgroundColor\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetBackgroundColor(${v})`,
        },
        {
            pattern: /\.BackgroundColor\s*\([^)]*\)/,
            buildReplacement: (v) => `.BackgroundColor(${v})`,
        },
    ],
    x: [
        {
            pattern: /\.SetX\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetX(${v})`,
        },
    ],
    y: [
        {
            pattern: /\.SetY\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetY(${v})`,
        },
    ],
    w: [
        {
            pattern: /\.SetWidth\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetWidth(${v})`,
        },
    ],
    h: [
        {
            pattern: /\.SetHeight\s*\([^)]*\)/,
            buildReplacement: (v) => `.SetHeight(${v})`,
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
        const matchers = PROP_MATCHERS[propName];
        if (!matchers || matchers.length === 0) {
            return { success: false, reason: `'${propName}' 속성 편집 패턴 없음` };
        }

        const lineStart = Math.max(0, sourceLine - searchRadius);
        const lineEnd = Math.min(doc.lineCount - 1, sourceLine + searchRadius);

        for (let li = lineStart; li <= lineEnd; li++) {
            const text = doc.lineAt(li).text;
            for (const matcher of matchers) {
                const m = matcher.pattern.exec(text);
                if (!m) {
                    continue;
                }
                const replacement = matcher.buildReplacement(newValue);
                const range = new vscode.Range(li, m.index, li, m.index + m[0].length);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(doc.uri, range, replacement);
                const ok = await vscode.workspace.applyEdit(edit);
                if (!ok) {
                    return { success: false, reason: 'applyEdit 실패 (WorkspaceEdit 적용 거부)' };
                }
                await doc.save();
                return { success: true };
            }
        }

        return {
            success: false,
            reason: `'${propName}' setter를 line ${sourceLine + 1} 주변 ${searchRadius}줄 내에서 찾지 못했습니다`,
        };
    }
}
