import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationService } from './configurationService';

const SAMPLE_BASENAME = 'hello-dali.preview.dali.cpp';

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
 * Command: `dali.useDockerRuntime`
 *
 * Sets `daliPreview.runtimeMode` to `docker` at the user (global) level, then
 * runs `onApplied` (ensure the runtime image + (re)start the preview server)
 * so the switch takes effect WITHOUT a window reload.
 *
 * If docker isn't accessible, `onApplied` surfaces the dockerAccessCheck
 * guidance modal.
 */
export async function useDockerRuntimeCommand(onApplied?: () => Promise<void>): Promise<void> {
    const cfg = ConfigurationService.getInstance();
    if (cfg.runtimeMode === 'docker') {
        vscode.window.showInformationMessage('DALi Preview is already in docker mode.');
        return;
    }
    await cfg.update('runtimeMode', 'docker', vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
        'Switched to docker runtime — preparing the runtime container (no reload needed).',
    );
    await onApplied?.();
}

/**
 * Command: `dali.useNativeRuntime`
 *
 * Switches to the native runtime (host DALi at /opt/dali or similar).
 * For users who already have DALi installed and built natively. After
 * the switch the legacy setupWizard fires (if no daliPrefix is set) so
 * the user can point at their install directory.
 */
export async function useNativeRuntimeCommand(): Promise<void> {
    const cfg = ConfigurationService.getInstance();
    if (cfg.runtimeMode === 'native') {
        vscode.window.showInformationMessage('DALi Preview is already in native mode.');
        return;
    }
    const choice = await vscode.window.showWarningMessage(
        'Switch to native runtime? This requires DALi installed on the host (typically /opt/dali). ' +
        'You will be asked to point at your DALi installation folder after reloading.',
        { modal: true },
        'Switch to Native',
    );
    if (choice !== 'Switch to Native') {
        return;
    }
    await cfg.update('runtimeMode', 'native', vscode.ConfigurationTarget.Global);
    const reload = await vscode.window.showInformationMessage(
        'Switched to native runtime. Reload the window to apply (the setup wizard will appear).',
        'Reload Window',
    );
    if (reload === 'Reload Window') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
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
