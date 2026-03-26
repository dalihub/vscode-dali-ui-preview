/**
 * Mocha bootstrap: register a fake 'vscode' module so that source files
 * that `import * as vscode from 'vscode'` can be loaded in plain Node.js
 * without the real VS Code runtime.
 *
 * This file is required before any test via mocha's --require flag.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require('module');
const originalRequire = Module.prototype.require;

const vscodeMock = {
    workspace: {
        getConfiguration: (_section?: string) => ({
            get: (_key: string, defaultValue?: any) => defaultValue,
        }),
        workspaceFolders: undefined,
    },
    Uri: {
        file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
        parse: (s: string) => ({ fsPath: s, scheme: 'file', path: s }),
    },
    Range: class Range {
        constructor(
            public startLine: number,
            public startCharacter: number,
            public endLine: number,
            public endCharacter: number,
        ) {}
    },
    Position: class Position {
        constructor(public line: number, public character: number) {}
    },
    Diagnostic: class Diagnostic {
        public source?: string;
        constructor(
            public range: any,
            public message: string,
            public severity?: number,
        ) {}
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },
    window: {
        showInformationMessage: () => Promise.resolve(undefined),
        showWarningMessage: () => Promise.resolve(undefined),
        showErrorMessage: () => Promise.resolve(undefined),
        createOutputChannel: () => ({
            appendLine: () => {},
            append: () => {},
            show: () => {},
            dispose: () => {},
        }),
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: () => Promise.resolve(undefined),
    },
    EventEmitter: class EventEmitter {
        event = () => ({ dispose: () => {} });
        fire() {}
        dispose() {}
    },
};

Module.prototype.require = function (id: string, ...rest: any[]) {
    if (id === 'vscode') {
        return vscodeMock;
    }
    return originalRequire.apply(this, [id, ...rest]);
};
