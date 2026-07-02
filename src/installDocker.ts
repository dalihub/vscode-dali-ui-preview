import * as vscode from 'vscode';

/**
 * Install Docker via an integrated terminal, then grant the CURRENT VS Code
 * session socket access immediately — no reboot, no reload.
 *
 * The chain (steps that MUST hold use `&&`; the identity steps are non-fatal):
 *   1. install docker (get.docker.com)
 *   2. usermod -aG docker "$(id -un)"  — permanent group membership (future
 *      sessions). Non-fatal (`|| true`): a networked (LDAP/AD) login may not be
 *      a local user usermod can add, and that must NOT stop the socket ACL
 *      below, which is what actually unblocks THIS session.
 *   3. systemctl enable --now docker  — start the daemon, which CREATES the
 *      socket (must run before setfacl)
 *   4. ensure the `acl` package is present (no-op if already there)
 *   5. setfacl -m u:$(id -u):rw on the socket  — immediate access for THIS
 *      session. File ACLs are evaluated at connect() time, unlike group
 *      membership which is baked into a process when it starts, so the
 *      already-running VS Code can connect right away — no logout/reboot.
 *      We grant by NUMERIC UID (`id -u`), not by name: setfacl resolves a name
 *      via getpwnam(), which fails for domain/LDAP accounts absent from local
 *      /etc/passwd and aborts with "Invalid argument near character 3". A
 *      numeric UID needs no lookup, so it works for every account type.
 *
 * `onStarted` is invoked after the terminal opens so the caller can begin
 * polling docker access and auto-continue once it becomes reachable.
 *
 * We deliberately do NOT auto-run the command — the user reviews it and presses
 * Enter, supplying their sudo password once.
 */
/**
 * Build the single-line install command (extracted so tests can assert on it
 * and there is one source of truth).
 *
 * Downloader robustness: a bare `curl … | sudo sh` aborts the whole `&&` chain
 * on an Ubuntu box that ships without curl. We instead:
 *   1. ensure a downloader exists — prefer curl, then wget, and only if BOTH are
 *      absent install curl via apt. `apt-get update` failure stays fatal here:
 *      this branch only runs when there is no other way to fetch the installer,
 *      so swallowing it would just hide the real cause (offline / broken
 *      sources). (Contrast the `acl` step, which is optional → `|| true`.)
 *   2. download+run with whichever exists (curl preferred, wget fallback).
 *
 * Every choice group is fully parenthesized: POSIX `&&`/`||` share precedence
 * and are left-associative, so an unparenthesized `A || B && C` would wrongly
 * parse as `(A || B) && C`.
 */
export function buildDockerInstallCommand(): string {
    const ensureDownloader =
        '( command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 ' +
        '|| ( sudo apt-get update && sudo apt-get install -y curl ) )';
    const downloadAndRun =
        '( command -v curl >/dev/null 2>&1 && curl -fsSL https://get.docker.com | sudo sh ' +
        '|| wget -qO- https://get.docker.com | sudo sh )';
    return ensureDownloader +
        ' && ' + downloadAndRun +
        ' && ( sudo usermod -aG docker "$(id -un)" || true )' +
        ' && sudo systemctl enable --now docker' +
        ' && ( command -v setfacl >/dev/null 2>&1 || sudo apt-get install -y acl || true )' +
        ' && echo ""' +
        ' && ( sudo setfacl -m "u:$(id -u):rw" /var/run/docker.sock' +
        ' && echo "Docker is ready for this session — VS Code will continue automatically."' +
        ' || echo "Docker installed. Log out and back in to finalize docker access." )';
}

export async function installDockerCommand(onStarted?: () => void): Promise<void> {
    const cmd = buildDockerInstallCommand();

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
