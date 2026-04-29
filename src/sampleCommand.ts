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
 * Sets `daliPreview.runtimeMode` to `docker` at the user (global) level
 * and prompts the user to reload so the change takes effect.
 *
 * If docker isn't accessible, the next preview attempt will trigger the
 * dockerAccessCheck guidance modal.
 */
export async function useDockerRuntimeCommand(): Promise<void> {
    const cfg = ConfigurationService.getInstance();
    if (cfg.runtimeMode === 'docker') {
        vscode.window.showInformationMessage('DALi Preview is already in docker mode.');
        return;
    }
    await cfg.update('runtimeMode', 'docker', vscode.ConfigurationTarget.Global);
    const choice = await vscode.window.showInformationMessage(
        'Switched to docker runtime. Reload the window to apply.',
        'Reload Window',
    );
    if (choice === 'Reload Window') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}
