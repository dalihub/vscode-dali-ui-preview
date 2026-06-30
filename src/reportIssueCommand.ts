import * as vscode from 'vscode';
import * as os from 'os';
import { ConfigurationService } from './configurationService';

/*
 * "DALi Preview: Report Issue" — open a GitHub new-issue page pre-filled with a short
 * bug template AND an auto-collected environment block (extension/VS Code/OS versions,
 * runtime mode, runtime image). One click from the user, everything we need is already
 * there. Uses a plain pre-filled GitHub URL (via openExternal) rather than the built-in
 * issue reporter, so the diagnostic template is fully under our control and works on
 * every VS Code version. (VS Code also shows a native "Report Issue" entry on the
 * extension's page because package.json declares `bugs.url`.)
 */

const REPO = 'https://github.com/dalihub/vscode-dali-ui-preview';
/** GitHub silently truncates / rejects very long new-issue URLs — stay well under. */
const MAX_URL = 7000;

export interface IssueEnv {
    extensionVersion: string;
    vscodeVersion: string;
    os: string;
    runtimeMode: string;
    runtimeImage: string;
}

/** The pre-filled issue body: a short bug template + an auto-collected env footer. Pure. */
export function buildIssueBody(env: IssueEnv, errorContext?: string): string {
    return [
        '**What happened?**',
        errorContext ? `\n\`\`\`\n${errorContext.trim()}\n\`\`\`\n` : '<!-- describe the problem -->\n',
        '**Steps to reproduce**',
        '1. \n2. \n',
        '**Expected behaviour**',
        '<!-- what did you expect to happen? -->\n',
        '**Minimal preview code (if it helps)**',
        '```cpp\n\n```\n',
        '---',
        '<!-- auto-collected — please keep -->',
        `- Extension: dali-preview v${env.extensionVersion}`,
        `- VS Code: ${env.vscodeVersion}`,
        `- OS: ${env.os}`,
        `- Runtime mode: ${env.runtimeMode}`,
        `- Runtime image: ${env.runtimeImage}`,
        '- Logs: set `daliPreview.logLevel` to `debug`, reproduce, then paste the relevant lines from the **DALi Preview** output channel.',
    ].join('\n');
}

/** Build the GitHub new-issue URL; if a long error makes it oversized, keep just the env footer. Pure. */
export function buildIssueUrl(title: string, body: string): string {
    const base = `${REPO}/issues/new`;
    // Match the repo's bug.yml issue form, which labels reports `bug,ai-task` (the
    // `ai-task` label is what routes an issue into the project's autodev pipeline).
    const q = (t: string, b: string): string =>
        `${base}?labels=bug,ai-task&title=${encodeURIComponent(t)}&body=${encodeURIComponent(b)}`;
    const full = q(title, body);
    if (full.length <= MAX_URL) {
        return full;
    }
    const footerAt = body.indexOf('---');
    const trimmed = footerAt >= 0 ? body.slice(footerAt) : body.slice(0, 1500);
    return q(title, trimmed);
}

export async function reportIssueCommand(context: vscode.ExtensionContext, errorContext?: string): Promise<void> {
    const cfg = ConfigurationService.getInstance();
    const env: IssueEnv = {
        extensionVersion: (context.extension?.packageJSON?.version as string | undefined) ?? 'unknown',
        vscodeVersion: vscode.version,
        os: `${os.platform()} ${os.release()} ${os.arch()}`,
        runtimeMode: cfg.runtimeMode,
        runtimeImage: `${cfg.dockerImage}:${cfg.daliVersionTag}`,
    };
    const title = errorContext ? `[bug] ${errorContext.split('\n')[0].trim().slice(0, 80)}` : '';
    await vscode.env.openExternal(vscode.Uri.parse(buildIssueUrl(title, buildIssueBody(env, errorContext))));
}
