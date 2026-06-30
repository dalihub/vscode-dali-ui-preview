import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Folder name created inside the user-chosen location by `dali.openExamples`. */
const EXAMPLES_DIRNAME = 'dali-samples';

/** Marker the tour's index `README.md` carries, used (with the numbered step
 *  folders) to recognise a copied tour without a sentinel file. */
const TOUR_README_MARKER = 'DALi Preview';

/**
 * Command: `dali.openExamples`
 *
 * Copies the bundled `examples/` tour (one folder per preview mode, each with
 * a README) into a user-chosen location as `dali-samples/`, then opens it in
 * a NEW window. Keeping it in its own folder + window means the throwaway
 * example edits never mix with — or dirty the git state of — the user's real
 * project.
 */
export async function openExamplesCommand(context: vscode.ExtensionContext): Promise<void> {
    const sourceDir = path.join(context.extensionPath, 'examples');
    if (!fs.existsSync(sourceDir)) {
        vscode.window.showErrorMessage(
            `Bundled samples not found at ${sourceDir}. Reinstall the extension.`,
        );
        return;
    }

    const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Create DALi samples here',
        title: 'Choose a folder to copy the DALi samples into',
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

/**
 * On activation, if the freshly-opened workspace IS a copied examples tour
 * (created by {@link openExamplesCommand}), auto-open its index `README.md`
 * in markdown preview so the guide greets the user without a manual click.
 *
 * `dali.openExamples` opens the copy in a NEW window, which restarts the
 * extension host — so the guide can't be shown inline by the command itself;
 * it has to be re-detected here on the next activation. Detection is by
 * STRUCTURE — the index README (which names the tour) plus ≥2 numbered step
 * folders (`NN-name`) — not a sentinel file or hard-coded folder names, so
 * renumbering the tour never breaks it and real projects don't false-trigger.
 * VS Code dedupes the preview tab, so a reload simply re-focuses it.
 */
export async function maybeShowExamplesReadme(): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const root = folder.uri.fsPath;
        const readme = path.join(root, 'README.md');
        if (!fs.existsSync(readme)) {
            continue;
        }
        let namesTheTour = false;
        try {
            namesTheTour = fs.readFileSync(readme, 'utf8').slice(0, 500).includes(TOUR_README_MARKER);
        } catch { /* unreadable — skip */ }
        let numberedDirs = 0;
        try {
            for (const e of fs.readdirSync(root, { withFileTypes: true })) {
                if (e.isDirectory() && /^\d{2}-/.test(e.name)) {
                    numberedDirs++;
                }
            }
        } catch { /* unreadable — skip */ }
        if (namesTheTour && numberedDirs >= 2) {
            await vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(readme));
            return; // one tour per window
        }
    }
}
