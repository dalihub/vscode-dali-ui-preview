import * as vscode from 'vscode';
import { findDaliPrefix, resolveDaliPrefix } from './daliEnvironment';
import { ConfigurationService } from './configurationService';
import { BackendIssue } from './buildBackend';

/**
 * "DALi Preview: Use Local DALi Runtime" — let a uifw developer point the
 * extension at their locally-built DALi install.
 *
 * Flow: if a valid prefix is auto-detected (from the setting / $DESKTOP_PREFIX /
 * a workspace setenv / common paths), confirm it ("Use this?") so the common
 * case is one click; otherwise (or on "Choose another…") open a folder picker.
 * The picked folder is resolved to the real prefix even if the user selects a
 * parent that contains dali-env/opt. Then save `daliPreview.daliPrefix`, flip
 * `runtimeMode` to 'local', and offer a window reload so the local backend is
 * wired in at activation.
 */
/** A higher-precedence `runtimeMode` setting that overrides a User (Global) write. */
export interface RuntimeModeShadow {
    scope: 'workspace' | 'workspaceFolder';
    value: string;
}

/**
 * Detect whether a Workspace- or Folder-scoped `daliPreview.runtimeMode` will
 * shadow a User (Global)-scoped write to `desired`.
 *
 * VS Code config precedence is Folder > Workspace > User > Default, so writing
 * runtimeMode to Global is silently ignored when a higher scope pins a different
 * value (e.g. `test/samples/.vscode/settings.json` pins "docker" for the golden
 * tests). Returns the shadowing scope+value, or null when the Global write will
 * actually take effect. Folder scope outranks Workspace scope: a folder value
 * alone decides the outcome regardless of any workspace value.
 */
export function detectRuntimeModeShadow(
    inspected: { workspaceValue?: string; workspaceFolderValue?: string } | undefined,
    desired: string,
): RuntimeModeShadow | null {
    if (!inspected) {
        return null;
    }
    if (inspected.workspaceFolderValue !== undefined) {
        return inspected.workspaceFolderValue !== desired
            ? { scope: 'workspaceFolder', value: inspected.workspaceFolderValue }
            : null;
    }
    if (inspected.workspaceValue !== undefined) {
        return inspected.workspaceValue !== desired
            ? { scope: 'workspace', value: inspected.workspaceValue }
            : null;
    }
    return null;
}

export async function useLocalRuntimeCommand(activeModeIsLocal = false): Promise<void> {
    const detected = await findDaliPrefix();
    const detectedPrefix = detected ? resolveDaliPrefix(detected) : null;

    let selected: string | null;
    if (detectedPrefix) {
        const choice = await vscode.window.showInformationMessage(
            `DALi runtime detected at ${detectedPrefix}. Use this?`,
            'Use This', 'Choose Another…',
        );
        if (choice === undefined) {
            return; // dismissed
        }
        selected = choice === 'Use This'
            ? detectedPrefix
            : await pickDaliFolder(vscode.Uri.file(detectedPrefix));
    } else {
        selected = await pickDaliFolder(detected ? vscode.Uri.file(detected) : undefined);
    }

    if (!selected) {
        return; // user cancelled
    }

    const cfg = ConfigurationService.getInstance();
    // Already running the local runtime against this exact prefix → no change,
    // no reload. `activeModeIsLocal` is the mode actually in effect (decided at
    // activation), not just the persisted setting — so this only short-circuits
    // when a reload has genuinely already taken effect.
    if (activeModeIsLocal && cfg.daliPrefix.trim() === selected.trim()) {
        await vscode.window.showInformationMessage(
            `Already using the local DALi runtime at ${selected}.`,
        );
        return;
    }

    await cfg.update('daliPrefix', selected, vscode.ConfigurationTarget.Global);
    await cfg.update('runtimeMode', 'local', vscode.ConfigurationTarget.Global);

    // A Workspace/Folder-scoped runtimeMode outranks the Global write we just made
    // (e.g. opening a file under test/samples, whose .vscode/settings.json pins
    // "docker"). Reloading the Global write alone wouldn't switch anything — offer a
    // one-click override that writes runtimeMode=local to the SHADOWING scope so it
    // takes effect immediately (or let the user open that settings file themselves).
    const config = vscode.workspace.getConfiguration('daliPreview');
    const inspected = config.inspect ? config.inspect<string>('runtimeMode') : undefined;
    const shadow = detectRuntimeModeShadow(inspected, 'local');
    if (shadow) {
        const scopeLabel = shadow.scope === 'workspaceFolder' ? "this folder's" : "this workspace's";
        const SWITCH_HERE = 'Switch Here to Local';
        const choice = await vscode.window.showWarningMessage(
            `Local runtime saved to your User settings, but ${scopeLabel} settings pin ` +
            `daliPreview.runtimeMode to "${shadow.value}", which takes precedence. Switch ${scopeLabel} ` +
            `settings to "local" too so it applies here, or open them to change it yourself.`,
            SWITCH_HERE, 'Open Settings',
        );
        if (choice === 'Open Settings') {
            await vscode.commands.executeCommand(
                shadow.scope === 'workspaceFolder'
                    ? 'workbench.action.openFolderSettings'
                    : 'workbench.action.openWorkspaceSettings',
            );
            return;
        }
        if (choice !== SWITCH_HERE) {
            return; // dismissed
        }
        // Explicit override: write runtimeMode=local to the winning scope so the
        // switch actually takes effect, then fall through to the reload prompt.
        await cfg.update(
            'runtimeMode',
            'local',
            shadow.scope === 'workspaceFolder'
                ? vscode.ConfigurationTarget.WorkspaceFolder
                : vscode.ConfigurationTarget.Workspace,
        );
    }

    const choice = await vscode.window.showInformationMessage(
        `DALi Preview: local runtime set to ${selected}. Reload the window to apply.`,
        'Reload Window',
    );
    if (choice === 'Reload Window') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}

/**
 * Surface local-runtime readiness problems with an actionable next step. Used
 * by the preview gate when a local-mode render can't proceed (no DALi folder,
 * or missing host tools). When the DALi folder is the problem, offer to pick it
 * right away; otherwise guide the dependency install.
 */
export async function presentLocalRuntimeIssues(issues: BackendIssue[]): Promise<void> {
    if (issues.length === 0) {
        return;
    }
    const summary = issues.map(i => `• ${i.message}`).join('\n');
    const detail = issues.map(i => i.action).filter(Boolean).join('\n');

    if (issues.some(i => i.kind === 'prefix')) {
        const choice = await vscode.window.showWarningMessage(
            `DALi Preview (local runtime) is not ready:\n${summary}`,
            { modal: true, detail },
            'Select DALi Folder…',
        );
        if (choice === 'Select DALi Folder…') {
            // Reached only from the local-mode readiness gate, so the active mode
            // is local; the picked (valid) prefix will differ from the broken one,
            // so this still saves + offers a reload.
            await useLocalRuntimeCommand(true);
        }
        return;
    }

    // Only missing host dependencies — guide the install.
    await vscode.window.showWarningMessage(
        `DALi Preview (local runtime) is missing host dependencies:\n${summary}`,
        { modal: true, detail },
    );
}

/**
 * Folder picker that loops until a DALi prefix is resolved or cancelled.
 * Accepts the prefix itself OR a parent containing dali-env/opt (resolveDaliPrefix),
 * so picking the project/home folder still works.
 */
async function pickDaliFolder(defaultUri?: vscode.Uri): Promise<string | null> {
    let startUri = defaultUri;
    for (;;) {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: startUri,
            openLabel: 'Use this DALi runtime',
            title: 'Select your DALi install (the dali-env/opt prefix, or a parent folder that contains it)',
        });
        if (!uris || uris.length === 0) {
            return null;
        }
        const picked = uris[0].fsPath;
        const resolved = resolveDaliPrefix(picked);
        if (resolved) {
            return resolved;
        }
        const action = await vscode.window.showErrorMessage(
            `No DALi install found at or under ${picked}. Pick the prefix folder that ` +
            `contains lib/libdali2-core.so and lib/pkgconfig/dali2-ui-foundation.pc (often …/dali-env/opt).`,
            'Try Again', 'Cancel',
        );
        if (action !== 'Try Again') {
            return null;
        }
        startUri = uris[0];
    }
}
