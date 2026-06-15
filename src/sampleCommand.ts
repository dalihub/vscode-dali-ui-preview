import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const SAMPLE_BASENAME = 'hello-dali.preview.dali.cpp';

/** Folder name created inside the user-chosen location by `dali.openExamples`. */
const EXAMPLES_DIRNAME = 'dali-examples';

/**
 * Command: `dali.openSample`
 *
 * Copies the bundled hello-dali sample into the user's workspace
 * (or globalStorage as fallback when no workspace is open) and opens
 * it. If the file already exists in the workspace, just opens it.
 */
export async function openSampleCommand(context: vscode.ExtensionContext): Promise<void> {
    const sourcePath = path.join(context.extensionPath, 'samples', SAMPLE_BASENAME);
    if (!fs.existsSync(sourcePath)) {
        vscode.window.showErrorMessage(
            `Bundled sample not found at ${sourcePath}. Reinstall the extension.`,
        );
        return;
    }

    // Prefer workspace folder so the user can save edits naturally;
    // fall back to globalStorage when no folder is open.
    let destPath: string;
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (ws) {
        destPath = path.join(ws.uri.fsPath, SAMPLE_BASENAME);
    } else {
        await fs.promises.mkdir(context.globalStorageUri.fsPath, { recursive: true });
        destPath = path.join(context.globalStorageUri.fsPath, SAMPLE_BASENAME);
    }

    if (!fs.existsSync(destPath)) {
        await fs.promises.copyFile(sourcePath, destPath);
    }

    const doc = await vscode.workspace.openTextDocument(destPath);
    await vscode.window.showTextDocument(doc);
}

/**
 * Command: `dali.openExamples`
 *
 * Copies the bundled `examples/` tour (one folder per preview mode, each with
 * a README) into a user-chosen location as `dali-examples/`, then opens it in
 * a NEW window. Keeping it in its own folder + window means the throwaway
 * example edits never mix with — or dirty the git state of — the user's real
 * project.
 */
export async function openExamplesCommand(context: vscode.ExtensionContext): Promise<void> {
    const sourceDir = path.join(context.extensionPath, 'examples');
    if (!fs.existsSync(sourceDir)) {
        vscode.window.showErrorMessage(
            `Bundled examples not found at ${sourceDir}. Reinstall the extension.`,
        );
        return;
    }

    const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Create DALi examples here',
        title: 'Choose a folder to copy the DALi examples into',
    });
    if (!picked || picked.length === 0) {
        return; // user cancelled
    }
    const dest = path.join(picked[0].fsPath, EXAMPLES_DIRNAME);

    if (fs.existsSync(dest)) {
        const choice = await vscode.window.showInformationMessage(
            `'${EXAMPLES_DIRNAME}' already exists here. Open it as-is, or replace it with a fresh copy?`,
            'Open Existing', 'Replace', 'Cancel',
        );
        if (!choice || choice === 'Cancel') {
            return;
        }
        if (choice === 'Replace') {
            await fs.promises.rm(dest, { recursive: true, force: true });
            await fs.promises.cp(sourceDir, dest, { recursive: true });
        }
        // 'Open Existing' falls through to open without copying.
    } else {
        await fs.promises.cp(sourceDir, dest, { recursive: true });
    }

    // Open the copy in a NEW window so it stays isolated from the current
    // workspace.
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(dest), { forceNewWindow: true },
    );
}

/**
 * Command: `dali.showReadme`
 *
 * Opens the bundled README.md in VS Code's built-in markdown preview.
 * Wired to the walkthrough's "Welcome" step's "Open Documentation"
 * button so the user gets actual project context, not the settings page.
 */
export async function showReadmeCommand(context: vscode.ExtensionContext): Promise<void> {
    // VSIX vsce normalises README.md to lowercase `readme.md`.
    const candidates = [
        path.join(context.extensionPath, 'README.md'),
        path.join(context.extensionPath, 'readme.md'),
    ];
    const found = candidates.find((p) => {
        try { fs.accessSync(p); return true; } catch { return false; }
    });
    if (!found) {
        vscode.window.showErrorMessage('README.md not found in extension directory.');
        return;
    }
    const uri = vscode.Uri.file(found);
    // `markdown.showPreview` opens VS Code's built-in markdown renderer
    // — same one users see for any .md file. Keeps formatting/links.
    await vscode.commands.executeCommand('markdown.showPreview', uri);
}
