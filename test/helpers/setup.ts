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
            update: (_key: string, _value: any, _target?: any) => Promise.resolve(),
        }),
        workspaceFolders: undefined,
        getWorkspaceFolder: (_uri: any) => undefined,
        applyEdit: (_edit: any) => Promise.resolve(true),
        onDidChangeConfiguration: (_listener: any) => ({ dispose: () => {} }),
    },
    WorkspaceEdit: class WorkspaceEdit {
        private _ops: Array<{ uri: any; range: any; newText: string; kind: 'replace' | 'insert' }> = [];
        replace(uri: any, range: any, newText: string) {
            this._ops.push({ uri, range, newText, kind: 'replace' });
        }
        insert(uri: any, position: any, newText: string) {
            this._ops.push({ uri, range: position, newText, kind: 'insert' });
        }
        get ops() { return this._ops; }
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
    StatusBarAlignment: {
        Left: 1,
        Right: 2,
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
        createStatusBarItem: (_alignment?: number, _priority?: number) => ({
            text: '',
            tooltip: undefined,
            command: undefined,
            color: undefined,
            show: () => {},
            hide: () => {},
            dispose: () => {},
        }),
        createWebviewPanel: (_viewType: string, _title: string, _viewColumn: number, _options?: any) => ({
            webview: {
                html: '',
                cspSource: 'vscode-resource:',
                postMessage: () => {},
                onDidReceiveMessage: () => ({ dispose: () => {} }),
                asWebviewUri: (uri: any) => uri,
            },
            reveal: () => {},
            onDidDispose: () => ({ dispose: () => {} }),
            dispose: () => {},
            visible: true,
        }),
        withProgress: async (_opts: any, task: any) =>
            task(
                { report: () => {} },
                { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) },
            ),
        createTerminal: (_opts?: any) => ({
            name: (_opts && _opts.name) || 'mock-terminal',
            show: () => {},
            sendText: () => {},
            dispose: () => {},
            exitStatus: undefined,
        }),
        onDidCloseTerminal: (_listener: any) => ({ dispose: () => {} }),
        showQuickPick: (_items: any, _opts?: any) => Promise.resolve(undefined),
        showOpenDialog: (_opts?: any) => Promise.resolve(undefined),
    },
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3,
        Active: -1,
        Beside: -2,
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: () => Promise.resolve(undefined),
    },
    env: {
        openExternal: (_uri: any) => Promise.resolve(true),
        clipboard: { writeText: (_text: string) => Promise.resolve() },
    },
    Disposable: class Disposable {
        constructor(private _fn: () => void) {}
        dispose() { this._fn(); }
        static from(...disposables: { dispose(): void }[]) {
            return new (vscodeMock as any).Disposable(() => {
                for (const d of disposables) { d.dispose(); }
            });
        }
    },
    EventEmitter: class EventEmitter {
        event = () => ({ dispose: () => {} });
        fire() {}
        dispose() {}
    },
    CodeLens: class CodeLens {
        constructor(
            public range: any,
            public command?: any,
        ) {}
    },
    ProgressLocation: {
        SourceControl: 1,
        Window: 10,
        Notification: 15,
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
    },
    ThemeColor: class ThemeColor {
        constructor(public id: string) {}
    },
};

Module.prototype.require = function (id: string, ...rest: any[]) {
    if (id === 'vscode') {
        return vscodeMock;
    }
    return originalRequire.apply(this, [id, ...rest]);
};

// Initialize the logger so modules that call getLogger() don't throw.
// Must run after the vscode mock is registered.
const { initLogger } = require('../../src/logger');
const mockOutputChannel = (vscodeMock.window as any).createOutputChannel();
initLogger(mockOutputChannel);
