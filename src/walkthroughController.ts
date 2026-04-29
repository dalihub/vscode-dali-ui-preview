import * as vscode from 'vscode';

/** Exported so extension.ts can suppress legacy first-run popups
 *  (setupWizard, validateEnvironment toast) on the very first launch
 *  — the walkthrough alone drives initial UX. */
export const FIRST_LAUNCH_KEY = 'daliPreview.firstLaunchShown.v1';
const WALKTHROUGH_ID = 'dalihub.dali-preview#dali-preview.setup';

/** True iff this machine has never seen the walkthrough yet. */
export function isFirstLaunch(context: vscode.ExtensionContext): boolean {
    return !context.globalState.get<boolean>(FIRST_LAUNCH_KEY);
}

/**
 * Open the setup walkthrough automatically the first time the extension
 * activates on a given machine. Idempotent — uses globalState as a
 * machine-scoped flag so the walkthrough doesn't reappear on every reload.
 *
 * Users can re-open it any time via the `dali.rerunSetup` command.
 */
export async function maybeOpenWalkthrough(context: vscode.ExtensionContext): Promise<void> {
    // Sync the flag across machines using settings sync — once you've seen
    // the walkthrough, you've seen it everywhere your VS Code is signed in.
    context.globalState.setKeysForSync([FIRST_LAUNCH_KEY]);

    if (context.globalState.get<boolean>(FIRST_LAUNCH_KEY)) {
        return;
    }
    await context.globalState.update(FIRST_LAUNCH_KEY, true);
    await openWalkthrough();
}

/** Force-open the walkthrough (wired to `dali.rerunSetup`). */
export async function openWalkthrough(): Promise<void> {
    await vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        { category: WALKTHROUGH_ID },
        false,
    );
}
