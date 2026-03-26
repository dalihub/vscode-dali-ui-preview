/**
 * Lightweight mock of vscode.TextDocument for unit tests.
 * Works without importing vscode.
 */

export interface MockTextLine {
    text: string;
    lineNumber: number;
}

export interface MockTextDocument {
    fileName: string;
    uri: { fsPath: string; scheme: string };
    lineCount: number;
    getText(): string;
    lineAt(line: number): MockTextLine;
}

/**
 * Create a mock TextDocument from a file name and content string.
 */
export function createMockDocument(fileName: string, content: string): MockTextDocument {
    const lines = content.split('\n');

    return {
        fileName,
        uri: { fsPath: fileName, scheme: 'file' },
        lineCount: lines.length,
        getText(): string {
            return content;
        },
        lineAt(line: number): MockTextLine {
            if (line < 0 || line >= lines.length) {
                throw new RangeError(`Line ${line} is out of range [0, ${lines.length})`);
            }
            return {
                text: lines[line],
                lineNumber: line,
            };
        },
    };
}
