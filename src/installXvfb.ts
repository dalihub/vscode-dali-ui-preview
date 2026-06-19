import * as vscode from 'vscode';

/**
 * Install Xvfb (the X virtual framebuffer) via an integrated terminal.
 *
 * Local runtime mode renders the DALi preview OFF-SCREEN into an Xvfb display so
 * no window appears on the user's desktop. When Xvfb is missing the renderer has
 * nowhere headless to draw — rather than fall back to the real screen (:0), we
 * disable rendering and offer this one-command install (mirrors installDocker).
 *
 * We deliberately do NOT auto-run before the modal: the user reviews what will
 * run and supplies their sudo password once, inside the terminal.
 */

/**
 * The single-line install command (extracted so tests assert on it and there is
 * one source of truth). `apt-get update` first so a fresh box with a stale index
 * can still resolve the package; the install is the only step that can fail
 * meaningfully, so the chain is a simple `&&`.
 */
export function buildXvfbInstallCommand(): string {
    return 'sudo apt-get update && sudo apt-get install -y xvfb' +
        ' && echo "" && echo "Xvfb installed — reload the window (or just save again) to render locally, off-screen."';
}

export async function installXvfbCommand(): Promise<void> {
    const cmd = buildXvfbInstallCommand();

    const choice = await vscode.window.showInformationMessage(
        'Xvfb (a virtual, off-screen display) will be installed in the terminal below. ' +
        'Enter your password once when prompted. Local preview then renders into Xvfb, ' +
        'so no window appears on your screen. No reboot needed.',
        { modal: true },
        'Open Terminal',
    );
    if (choice !== 'Open Terminal') {
        return;
    }

    const terminal = vscode.window.createTerminal({
        name: 'DALi Preview · Install Xvfb',
        message: 'Running the install — just enter your sudo password when prompted.',
    });
    terminal.show(false);
    // addNewLine=true: auto-run so the user goes straight to the sudo prompt.
    terminal.sendText(cmd, true);
}

/**
 * Warn that local rendering is disabled because Xvfb is missing, and offer to
 * install it. Used from activate() when local mode finds no Xvfb on PATH.
 */
export async function promptInstallXvfb(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
        'DALi Preview (local runtime) needs Xvfb to render off-screen, but it is not installed. ' +
        'Until it is, local preview is disabled — otherwise previews would open a window on your real screen.',
        'Install Xvfb',
    );
    if (choice === 'Install Xvfb') {
        await installXvfbCommand();
    }
}
