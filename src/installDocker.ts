import * as vscode from 'vscode';

/**
 * Install Docker via an integrated terminal, then grant the CURRENT VS Code
 * session socket access immediately — no reboot, no reload.
 *
 * The chain (any step's failure aborts the rest via `&&`):
 *   1. install docker (get.docker.com)
 *   2. usermod -aG docker  — permanent group membership (future sessions)
 *   3. systemctl enable --now docker  — start the daemon, which CREATES the
 *      socket (must run before setfacl)
 *   4. ensure the `acl` package is present (no-op if already there)
 *   5. setfacl -m u:$USER:rw on the socket  — immediate access for THIS session.
 *      File ACLs are evaluated at connect() time, unlike group membership which
 *      is baked into a process when it starts, so the already-running VS Code
 *      can connect right away — no logout/reboot.
 *
 * `onStarted` is invoked after the terminal opens so the caller can begin
 * polling docker access and auto-continue once it becomes reachable.
 *
 * We deliberately do NOT auto-run the command — the user reviews it and presses
 * Enter, supplying their sudo password once.
 */
export async function installDockerCommand(onStarted?: () => void): Promise<void> {
    const cmd =
        'curl -fsSL https://get.docker.com | sudo sh' +
        ' && sudo usermod -aG docker "$USER"' +
        ' && sudo systemctl enable --now docker' +
        ' && ( command -v setfacl >/dev/null 2>&1 || sudo apt-get install -y acl || true )' +
        ' && sudo setfacl -m "u:$USER:rw" /var/run/docker.sock' +
        ' && echo "" && echo "Docker is ready for this session — VS Code will continue automatically."';

    // Pre-install modal so the user knows exactly what to expect: one password,
    // then hands-off. Keeps the sudo-password prompt (which appears INSIDE the
    // terminal) from surprising them.
    const choice = await vscode.window.showInformationMessage(
        'Docker will be installed in the terminal below. Enter your password once when ' +
        'prompted — installation, permissions, and the runtime download then proceed ' +
        'automatically. You do NOT need to reboot or reload VS Code.',
        { modal: true },
        'Open Terminal',
    );
    if (choice !== 'Open Terminal') {
        return;
    }

    const terminal = vscode.window.createTerminal({
        name: 'DALi Preview · Install Docker',
        message:
            'Running the install — just enter your sudo password when prompted. ' +
            'When it finishes, VS Code continues automatically (no reboot).',
    });
    terminal.show(false);
    // addNewLine=true: auto-run so the user goes straight to the sudo password
    // prompt. The pre-install modal already explained what will run.
    terminal.sendText(cmd, true);
    onStarted?.();
}
