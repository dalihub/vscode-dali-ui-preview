import * as vscode from 'vscode';

/**
 * Open an integrated terminal and pre-fill the Docker install command
 * chain. The user only needs to press Enter and supply their sudo
 * password once — the three steps (install, group-add, daemon-enable)
 * are chained with `&&` so any step's failure aborts the rest.
 *
 * We deliberately do NOT execute the command automatically. The terminal
 * stays open so the user can read the output, see prompts (sudo
 * password), and intervene if something needs adjusting.
 */
export async function installDockerCommand(): Promise<void> {
    const cmd =
        'curl -fsSL https://get.docker.com | sudo sh' +
        ' && sudo usermod -aG docker $USER' +
        ' && sudo systemctl enable --now docker' +
        ' && echo "" && echo "✅ Docker installed. After this command, REBOOT your system" ' +
        '&& echo "(sudo reboot) so the docker group is picked up by every session."';

    const terminal = vscode.window.createTerminal({
        name: 'DALi Preview · Install Docker',
        message:
            'Pre-filled the Docker install command. Press Enter to start ' +
            '(sudo password will be requested once). After it finishes, ' +
            'reboot your system before reopening this folder.',
    });
    terminal.show(false);
    // sendText with addNewLine=false — user reviews and presses Enter.
    terminal.sendText(cmd, false);
}
