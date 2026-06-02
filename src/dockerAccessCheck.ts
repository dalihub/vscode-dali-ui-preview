import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { getLogger } from './logger';

const execAsync = promisify(exec);

export type DockerAccessState =
    | 'ok'
    | 'docker-not-installed'
    | 'daemon-not-running'
    | 'permission-denied'
    | 'unknown-error';

export interface DockerAccessResult {
    state: DockerAccessState;
    /** Server version string when state === 'ok'. */
    serverVersion?: string;
    /** Raw error text for log/diagnosis. */
    detail?: string;
}

/**
 * Probe whether the current VS Code process can talk to the docker daemon.
 *
 * Distinguishes the three failure modes the user-facing guidance cares about:
 *   - docker CLI not installed
 *   - daemon down
 *   - daemon up but socket access denied (the classic "I added myself to the
 *     docker group but my session still doesn't see it" case)
 */
export async function checkDockerAccess(): Promise<DockerAccessResult> {
    const log = getLogger();

    try {
        await execAsync('which docker', { timeout: 3000 });
    } catch {
        log.trace('Docker', 'access check: docker CLI not on PATH');
        return { state: 'docker-not-installed' };
    }

    try {
        const { stdout } = await execAsync('docker info --format {{.ServerVersion}}', {
            timeout: 5000,
        });
        const v = stdout.trim();
        if (!v) {
            return { state: 'unknown-error', detail: 'docker info returned empty' };
        }
        log.trace('Docker', 'access check: ok', { serverVersion: v });
        return { state: 'ok', serverVersion: v };
    } catch (err: any) {
        const msg = String(err?.stderr || err?.message || err);
        log.trace('Docker', 'access check: failed', { detail: msg });

        if (/permission denied/i.test(msg) && /docker.sock|docker API/i.test(msg)) {
            return { state: 'permission-denied', detail: msg };
        }
        if (/cannot connect to.*docker daemon/i.test(msg)) {
            return { state: 'daemon-not-running', detail: msg };
        }
        // Some Docker CLI versions print the "permission denied" message in
        // a slightly different shape (e.g. tini wrapper). Treat any leftover
        // permission-denied substring as the same case for guidance purposes.
        if (/permission denied/i.test(msg)) {
            return { state: 'permission-denied', detail: msg };
        }
        return { state: 'unknown-error', detail: msg };
    }
}

/**
 * Show a contextual notification + Output channel detail when docker access
 * is missing. The user picks an action: read docs, retry, etc. We never
 * automate sudo or reboots — those need user consent and an interactive
 * terminal.
 */
export async function showDockerSetupGuidance(
    result: DockerAccessResult,
    outputChannel: vscode.OutputChannel,
    onAccessLikelyChanged?: () => void,
): Promise<void> {
    if (result.state === 'ok') {
        return;
    }

    outputChannel.appendLine(
        `[DockerAccess] state=${result.state}${result.detail ? ': ' + result.detail.split('\n')[0] : ''}`,
    );

    switch (result.state) {
        case 'docker-not-installed': {
            const choice = await vscode.window.showErrorMessage(
                'DALi Preview (docker mode): Docker is not installed.',
                'Install instructions',
            );
            if (choice === 'Install instructions') {
                showInstallDocs(outputChannel);
            }
            return;
        }

        case 'daemon-not-running': {
            const choice = await vscode.window.showErrorMessage(
                'DALi Preview (docker mode): Docker daemon is not running.',
                'How to start',
                'Verify again',
            );
            if (choice === 'How to start') {
                outputChannel.appendLine(
                    '[DockerAccess] To start the daemon:  sudo systemctl start docker',
                );
                outputChannel.show(true);
            } else if (choice === 'Verify again') {
                await vscode.commands.executeCommand('dali.verifyDocker');
            }
            return;
        }

        case 'permission-denied': {
            const choice = await vscode.window.showWarningMessage(
                'DALi Preview (docker mode): Docker is installed but VS Code cannot access it yet. ' +
                'Your user is in the docker group, but the new group has not been applied to this session.',
                'Fix for this session',
                'Why?',
                'Reboot guide',
            );
            if (choice === 'Fix for this session') {
                applySocketAclFix(outputChannel);
                onAccessLikelyChanged?.();
            } else if (choice === 'Why?') {
                await vscode.window.showInformationMessage(
                    'Linux applies group memberships only at the start of a new session. ' +
                    'After `usermod -aG docker $USER`, the change is in /etc/group, but ' +
                    'every running process (including VS Code and your shell) still has ' +
                    'the OLD group list cached.\n\n' +
                    '"Fix for this session" grants access immediately by adding a socket ' +
                    'ACL with setfacl (evaluated at connect-time, so already-running VS Code ' +
                    'picks it up) — no logout or reboot. A reboot also works and is permanent.',
                    { modal: true },
                );
            } else if (choice === 'Reboot guide') {
                await vscode.window.showInformationMessage(
                    'Save your work, then run from a terminal:\n\n' +
                    '  sudo reboot\n\n' +
                    'After the system comes back, reopen this folder in VS Code and ' +
                    'run "DALi: Verify Docker" to confirm.',
                    { modal: true },
                );
            }
            return;
        }

        case 'unknown-error': {
            outputChannel.appendLine(
                '[DockerAccess] Unexpected error from `docker info`. Full output:',
            );
            outputChannel.appendLine(result.detail ?? '(no detail)');
            outputChannel.show(true);
            await vscode.window.showErrorMessage(
                'DALi Preview (docker mode): Unexpected error talking to docker. See Output → DALi Preview.',
            );
            return;
        }
    }
}

function showInstallDocs(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('');
    outputChannel.appendLine('=== Docker install (Ubuntu) ===');
    outputChannel.appendLine('Run these in a terminal (sudo password requested once):');
    outputChannel.appendLine('');
    outputChannel.appendLine('  curl -fsSL https://get.docker.com | sudo sh');
    outputChannel.appendLine('  sudo usermod -aG docker "$USER"');
    outputChannel.appendLine('  sudo systemctl enable --now docker');
    outputChannel.appendLine('  sudo setfacl -m "u:$USER:rw" /var/run/docker.sock');
    outputChannel.appendLine('');
    outputChannel.appendLine('The setfacl line grants THIS session access immediately —');
    outputChannel.appendLine('no logout or reboot. Then run "DALi: Verify Docker" to confirm.');
    outputChannel.appendLine('');
    outputChannel.show(true);
}

/**
 * Open a terminal that grants the current session docker socket access
 * immediately — for users who already installed docker but whose session never
 * picked up the group. No install, no reboot: start the daemon, add the socket
 * ACL (immediate, connect-time), and persist group membership for the future.
 */
function applySocketAclFix(outputChannel: vscode.OutputChannel): void {
    const cmd =
        'sudo systemctl enable --now docker' +
        ' && ( command -v setfacl >/dev/null 2>&1 || sudo apt-get install -y acl || true )' +
        ' && sudo setfacl -m "u:$USER:rw" /var/run/docker.sock' +
        ' && sudo usermod -aG docker "$USER"' +
        ' && echo "" && echo "Docker access granted for this session — VS Code will continue automatically."';
    const terminal = vscode.window.createTerminal({ name: 'DALi Preview · Fix Docker Access' });
    terminal.show(false);
    terminal.sendText(cmd, false);
    outputChannel.appendLine('[DockerAccess] Offered immediate setfacl fix (no reboot).');
}

/**
 * Re-run access check and show a one-shot status message.
 * Wired to the `dali.verifyDocker` command. On success, prompts the user
 * to download the runtime image (the next walkthrough step) — with their
 * consent we kick off `dali.pullRuntimeImage` automatically so they don't
 * have to remember it.
 */
export async function verifyDockerCommand(
    outputChannel: vscode.OutputChannel,
    onAccessLikelyChanged?: () => void,
): Promise<void> {
    const result = await checkDockerAccess();
    if (result.state !== 'ok') {
        await showDockerSetupGuidance(result, outputChannel, onAccessLikelyChanged);
        return;
    }

    outputChannel.appendLine(`[DockerAccess] verified ok: server ${result.serverVersion}`);
    const choice = await vscode.window.showInformationMessage(
        `Docker is accessible (server ${result.serverVersion}). ` +
        `Next: download the DALi runtime image (~290 MB) so the first preview is instant.`,
        'Download Runtime Image',
        'Skip for now',
    );
    if (choice === 'Download Runtime Image') {
        await vscode.commands.executeCommand('dali.pullRuntimeImage');
    }
}
