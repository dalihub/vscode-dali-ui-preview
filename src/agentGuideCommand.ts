import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/*
 * "DALi Preview: Add AI Agent Guide" — scaffold an AGENTS.md in the workspace root
 * that teaches an AI coding agent (Copilot / Cursor / Claude / …) how to write code
 * the extension can preview. AGENTS.md is the cross-tool convention agents read for
 * project-specific instructions; the guide content ships bundled as
 * media/agent-guide.md.
 *
 * The write is merge-safe: only the region between our marker comments is owned by
 * this command, so any other AGENTS.md content the user/agent has is preserved.
 */

const START = '<!-- dali-preview:agent-guide -->';
const END = '<!-- /dali-preview:agent-guide -->';

/**
 * Insert/refresh the DALi guide block in an AGENTS.md at `target`, preserving every
 * other line. Pure (no vscode) so it is unit-testable. Returns 'created' when the
 * file did not exist, 'updated' when an existing block was replaced, 'appended'
 * when the block was added to a file that had other content.
 */
export function writeAgentGuide(target: string, guideBody: string): 'created' | 'updated' | 'appended' {
    const block = `${START}\n${guideBody.trim()}\n${END}`;
    if (!fs.existsSync(target)) {
        fs.writeFileSync(target, `# AGENTS.md\n\n${block}\n`);
        return 'created';
    }
    const cur = fs.readFileSync(target, 'utf8');
    const s = cur.indexOf(START);
    const e = cur.indexOf(END);
    if (s !== -1 && e !== -1 && e > s) {
        fs.writeFileSync(target, cur.slice(0, s) + block + cur.slice(e + END.length));
        return 'updated';
    }
    fs.writeFileSync(target, `${cur.replace(/\s+$/, '')}\n\n${block}\n`);
    return 'appended';
}

export async function addAgentGuideCommand(context: vscode.ExtensionContext): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        await vscode.window.showErrorMessage(
            'DALi Preview: open a folder or workspace first — the AI agent guide is written to AGENTS.md in the project root.',
        );
        return;
    }

    let guideBody: string;
    try {
        guideBody = fs.readFileSync(path.join(context.extensionPath, 'media', 'agent-guide.md'), 'utf8');
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        await vscode.window.showErrorMessage(`DALi Preview: could not read the bundled agent guide (${reason}).`);
        return;
    }

    const target = path.join(folder.uri.fsPath, 'AGENTS.md');
    let result: 'created' | 'updated' | 'appended';
    try {
        result = writeAgentGuide(target, guideBody);
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        await vscode.window.showErrorMessage(`DALi Preview: could not write AGENTS.md (${reason}).`);
        return;
    }

    const verb = result === 'created' ? 'Created' : result === 'updated' ? 'Updated the DALi section in' : 'Added the DALi guide to';
    const open = 'Open AGENTS.md';
    const choice = await vscode.window.showInformationMessage(
        `DALi Preview: ${verb} AGENTS.md — your AI agent can now write previewable DALi UI.`,
        open,
    );
    if (choice === open) {
        const doc = await vscode.workspace.openTextDocument(target);
        await vscode.window.showTextDocument(doc);
    }
}
