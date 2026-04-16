import * as vscode from 'vscode';
import { findDaliPrefix, validateDaliPrefix } from './daliEnvironment';
import { exec } from 'child_process';
import { getLogger } from './logger';

export async function runSetupWizard(
    context: vscode.ExtensionContext
): Promise<string | null> {
    // Step 1: Try auto-detect DALi
    const detectedPath = await findDaliPrefix();

    let selectedPath: string | null = null;

    if (detectedPath && validateDaliPrefix(detectedPath)) {
        const choice = await vscode.window.showInformationMessage(
            `DALi found at ${detectedPath}. Use this?`,
            'Yes',
            'Change'
        );

        if (choice === 'Yes') {
            selectedPath = detectedPath;
        } else if (choice === 'Change') {
            selectedPath = await pickDaliFolder();
        } else {
            return null;
        }
    } else {
        selectedPath = await pickDaliFolder();
    }

    if (!selectedPath) {
        return null;
    }

    // Save to settings
    const config = vscode.workspace.getConfiguration('daliPreview');
    const target = vscode.workspace.workspaceFolders
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
    await config.update('daliPrefix', selectedPath, target);

    // Auto-install missing dependencies
    await installMissingDependencies();

    return selectedPath;
}

async function pickDaliFolder(): Promise<string | null> {
    while (true) {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select DALi Installation',
            title: 'Select your DALi installation folder (containing lib/ and include/)',
        });

        if (!uris || uris.length === 0) {
            return null;
        }

        const folderPath = uris[0].fsPath;

        if (validateDaliPrefix(folderPath)) {
            return folderPath;
        }

        const action = await vscode.window.showErrorMessage(
            'libdali2-core.so not found at this location',
            'Try Again',
            'Cancel'
        );

        if (action !== 'Try Again') {
            return null;
        }
    }
}

async function installMissingDependencies(): Promise<void> {
    const hasGpp = await isCommandAvailable('g++');
    const hasXvfb = await isCommandAvailable('Xvfb');
    const hasCcache = await isCommandAvailable('ccache');
    const hasX11vnc = await isCommandAvailable('x11vnc');
    const hasWebsockify = await isCommandAvailable('websockify');

    if (hasGpp && hasXvfb && hasCcache && hasX11vnc && hasWebsockify) {
        return; // All dependencies present
    }

    // Build install command for missing packages
    const packages: string[] = [];
    if (!hasGpp) { packages.push('g++'); }
    if (!hasXvfb) { packages.push('xvfb'); }
    if (!hasCcache) { packages.push('ccache'); }
    if (!hasX11vnc) { packages.push('x11vnc'); }
    if (!hasWebsockify) { packages.push('websockify'); }

    const pkgList = packages.join(', ');
    const aptCmd = `sudo apt install -y ${packages.join(' ')}`;

    const choice = await vscode.window.showWarningMessage(
        `Missing dependencies: ${pkgList}. Install now?`,
        'Install',
        'Skip'
    );

    if (choice !== 'Install') {
        return;
    }

    // Run install in VS Code integrated terminal
    const terminal = vscode.window.createTerminal('DALi Preview Setup');
    terminal.show();
    terminal.sendText(aptCmd);
    terminal.sendText('echo "\\n=== Dependencies installed. You can close this terminal. ==="');

    // Wait for user to see the terminal, then show info
    vscode.window.showInformationMessage(
        'Installing dependencies in terminal. Enter your password if prompted.'
    );
}

function isCommandAvailable(command: string): Promise<boolean> {
    return new Promise((resolve) => {
        exec(`which ${command}`, (error) => {
            resolve(!error);
        });
    });
}

export function isDaliConfigured(context: vscode.ExtensionContext): boolean {
    const config = vscode.workspace.getConfiguration('daliPreview');
    const daliPrefix = config.get<string>('daliPrefix');

    if (!daliPrefix) {
        return false;
    }

    return validateDaliPrefix(daliPrefix);
}
