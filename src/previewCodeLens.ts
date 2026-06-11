import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getLogger } from './logger';

const execAsync = promisify(exec);

// Match function declarations returning DALi View types (with or without params):
//   View CreateUI() {
//   View CreateUI(int width, const std::string& title) {
//   FlexLayout BuildCard() {
const FUNC_RE = /^(\s*)((?:[\w:]+\s+)*?)(View|FlexLayout|Control|Label|TextLabel|ImageView|ScrollView|TableView|Actor)\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/;

// DALi-UI component types that have ::New() factory methods.
// Only functions containing these are considered previewable.
const DALI_UI_COMPONENTS = new Set([
    'View', 'FlexLayout', 'AbsoluteLayout', 'StackLayout', 'GridLayout',
    'Label', 'TextLabel', 'ImageView', 'AnimatedImageView', 'LottieAnimationView',
    'InputField', 'ScrollView', 'Control', 'Layout',
]);

export class PreviewCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChange.event;

    /** Cached result of project-level DALi detection. undefined = not yet checked. */
    private _isDaliProject: boolean | undefined = undefined;

    refresh(): void {
        // Invalidate the cache on refresh so detection re-runs on next provideCodeLenses call
        this._isDaliProject = undefined;
        this._onDidChange.fire();
    }

    /**
     * Detect whether the current workspace is a DALi project.
     * Checks (in order):
     *  1. Any workspace folder contains a `setenv` file with DESKTOP_PREFIX
     *  2. VS Code setting `daliPreview.daliPrefix` is configured
     *  3. `pkg-config --exists dali2-ui-foundation` succeeds
     *
     * Result is cached for the lifetime of the provider (cleared on refresh()).
     */
    private async checkDaliProject(): Promise<boolean> {
        if (this._isDaliProject !== undefined) {
            return this._isDaliProject;
        }

        // 1. Check workspace folders for a `setenv` file with DESKTOP_PREFIX
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const setenvPath = path.join(folder.uri.fsPath, 'setenv');
                if (setenvFileHasDesktopPrefix(setenvPath)) {
                    this._isDaliProject = true;
                    return true;
                }
            }
        }

        // 2. Check VS Code setting daliPreview.daliPrefix
        const config = vscode.workspace.getConfiguration('daliPreview');
        const settingValue = config.get<string>('daliPrefix', '');
        if (settingValue && settingValue.trim().length > 0) {
            this._isDaliProject = true;
            return true;
        }

        // 3. Try pkg-config --exists dali2-ui-foundation
        try {
            await execAsync('pkg-config --exists dali2-ui-foundation');
            this._isDaliProject = true;
            return true;
        } catch (err) {
            getLogger().trace('CodeLens', 'pkg-config check failed', { error: String(err) });
        }

        this._isDaliProject = false;
        return false;
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const fileName = document.fileName;

        // Skip .preview.dali.cpp files — those already have their own preview mechanism
        if (fileName.endsWith('.preview.dali.cpp')) {
            return [];
        }

        // Only for .cpp / .h files
        if (!fileName.endsWith('.cpp') && !fileName.endsWith('.h')) {
            return [];
        }

        // Only show CodeLens when the workspace is a DALi project
        const isDali = await this.checkDaliProject();
        if (!isDali) {
            return [];
        }

        // Find no-arg functions returning DALi View types whose body contains ::New()
        const lenses: vscode.CodeLens[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const match = FUNC_RE.exec(line);
            if (!match) {
                continue;
            }

            const funcStartLine = i;
            const bodyEndLine = findClosingBrace(document, funcStartLine);
            if (bodyEndLine < 0) {
                continue;
            }

            // Only show if the body contains a DALi-UI component ::New() call
            if (!bodyContainsDaliNew(document, funcStartLine, bodyEndLine)) {
                continue;
            }

            // A parameterised function (a helper, not a zero-arg entry point) is
            // previewable but only with synthesized sample arguments — label it so
            // the user knows the args are placeholders, not real data.
            const hasParams = (match[5] ?? '').trim().length > 0;
            const range = new vscode.Range(i, 0, i, line.length);
            lenses.push(new vscode.CodeLens(range, {
                title: hasParams ? '▶ Preview (sample args)' : '▶ Preview',
                command: 'dali.previewFunction',
                arguments: [document.uri, funcStartLine, bodyEndLine],
            }));
        }
        const log = getLogger();
        log.trace('CodeLens', 'scan', { fileName: document.fileName, lensCount: lenses.length });
        return lenses;
    }
}

/** Check if function body contains a DALi-UI component ::New() call. */
function bodyContainsDaliNew(doc: vscode.TextDocument, startLine: number, endLine: number): boolean {
    const newCallRe = /(\w+)::New\s*\(/g;
    for (let i = startLine; i <= endLine; i++) {
        let m;
        while ((m = newCallRe.exec(doc.lineAt(i).text)) !== null) {
            if (DALI_UI_COMPONENTS.has(m[1])) {
                return true;
            }
        }
        newCallRe.lastIndex = 0;
    }
    return false;
}

function findClosingBrace(doc: vscode.TextDocument, startLine: number): number {
    let depth = 0;
    let foundOpen = false;
    for (let i = startLine; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        for (const ch of text) {
            if (ch === '{') {
                depth++;
                foundOpen = true;
            }
            if (ch === '}') {
                depth--;
            }
            if (foundOpen && depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Parse a `setenv` file and return true if it contains a non-empty DESKTOP_PREFIX= line.
 */
function setenvFileHasDesktopPrefix(filePath: string): boolean {
    try {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            const match = trimmed.match(
                /^(?:export\s+)?DESKTOP_PREFIX\s*=\s*["']?([^"'\s#]+)["']?/
            );
            if (match && match[1]) {
                return true;
            }
        }
    } catch (err) {
        getLogger().trace('CodeLens', 'setenv read error', { error: String(err) });
    }
    return false;
}
