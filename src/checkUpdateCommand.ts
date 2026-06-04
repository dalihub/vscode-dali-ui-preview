import * as vscode from 'vscode';
import { DockerRuntime } from './dockerRuntime';
import { ConfigurationService } from './configurationService';
import { checkDockerAccess } from './dockerAccessCheck';
import { pullRuntimeImageCommand } from './pullImageCommand';
import { listRemoteTags } from './registryClient';
import { getLogger } from './logger';

/** Per-machine timestamp of the last auto update check (NOT settings-synced). */
export const LAST_UPDATE_CHECK_KEY = 'daliPreview.lastUpdateCheck.v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface AutoUpdateCallbacks {
    /** Show a non-blocking "update available" affordance (e.g. status-bar badge). */
    onUpdateAvailable: () => void;
    /** (Re)start the preview server on the freshly-pulled image. */
    onUpdated: () => Promise<void>;
}

/**
 * Command: `dali.checkRuntimeUpdate`
 *
 * Manual "check for updates" — always probes, always reports (including
 * "up to date"). If an update is available, offers a force re-pull and then
 * restarts the preview server on the new image via `onUpdated`.
 */
export async function checkRuntimeUpdateCommand(
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
    onUpdated?: () => Promise<void>,
): Promise<void> {
    const access = await checkDockerAccess();
    if (access.state !== 'ok') {
        await vscode.window.showWarningMessage(
            `Cannot check for runtime updates — docker is not accessible (state: ${access.state}).`,
        );
        return;
    }

    const tag = ConfigurationService.getInstance().daliVersionTag;
    outputChannel.appendLine(`[Update] Checking for a newer runtime image (${tag}) ...`);

    const available = await runtime.isUpdateAvailable(tag);
    if (!available) {
        await vscode.window.showInformationMessage(`DALi runtime image (${tag}) is up to date.`);
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        `A newer DALi runtime image (${tag}) is available.`,
        'Update now',
        'Later',
    );
    if (choice === 'Update now') {
        const ok = await pullRuntimeImageCommand(runtime, outputChannel, /*force*/ true);
        if (ok) {
            await onUpdated?.();
        }
    }
}

/**
 * Activation auto-check, gated by `daliPreview.runtimeUpdatePolicy` and a
 * once-a-day globalState throttle. Docker-mode only, fully silent on
 * no-update / offline / error.
 *
 *   policy 'off'    → never checks
 *   policy 'notify' → status-bar badge + "Update now" notification
 *   policy 'auto'   → force-pull + restart in the background
 */
export async function maybeAutoCheckRuntimeUpdate(
    context: vscode.ExtensionContext,
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
    callbacks: AutoUpdateCallbacks,
): Promise<void> {
    try {
        const cfg = ConfigurationService.getInstance();
        const policy = cfg.runtimeUpdatePolicy;
        if (policy === 'off') return;
        if (cfg.runtimeMode !== 'docker') return;

        const last = context.globalState.get<number>(LAST_UPDATE_CHECK_KEY, 0);
        if (Date.now() - last < ONE_DAY_MS) return;

        const access = await checkDockerAccess();
        if (access.state !== 'ok') return;

        // Record the attempt BEFORE the network probe so a flaky/offline check
        // still backs off for a day (non-blocking, fail-silent).
        await context.globalState.update(LAST_UPDATE_CHECK_KEY, Date.now());

        const tag = cfg.daliVersionTag;
        if (!(await runtime.isUpdateAvailable(tag))) return;

        outputChannel.appendLine(`[Update] Newer runtime image (${tag}) available (policy=${policy}).`);

        if (policy === 'auto') {
            const ok = await pullRuntimeImageCommand(runtime, outputChannel, /*force*/ true);
            if (ok) {
                await callbacks.onUpdated();
                void vscode.window.showInformationMessage(
                    `DALi runtime image (${tag}) updated to the latest version.`,
                );
            }
            return;
        }

        // policy === 'notify'
        callbacks.onUpdateAvailable();
        const choice = await vscode.window.showInformationMessage(
            `A newer DALi runtime image (${tag}) is available.`,
            'Update now',
            'Later',
        );
        if (choice === 'Update now') {
            const ok = await pullRuntimeImageCommand(runtime, outputChannel, /*force*/ true);
            if (ok) await callbacks.onUpdated();
        }
    } catch (err) {
        getLogger().trace('Docker', 'auto update check failed (ignored)', { error: String(err) });
    }
}

/**
 * Command: `dali.selectRuntimeVersion`
 *
 * Lists the available image tags from the registry, lets the user pick one,
 * stores it in `daliPreview.daliVersionTag`, pulls it (with progress) and
 * restarts the preview server on the selected version.
 */
export async function selectRuntimeVersionCommand(
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
    onSelected: () => Promise<void>,
): Promise<void> {
    const access = await checkDockerAccess();
    if (access.state !== 'ok') {
        await vscode.window.showWarningMessage(
            `Cannot list runtime versions — docker is not accessible (${access.state}).`,
        );
        return;
    }

    let tags: string[];
    try {
        tags = await listRemoteTags(runtime.getImageName());
    } catch (err) {
        await vscode.window.showErrorMessage(
            `Failed to list runtime versions from the registry: ${String(err).slice(0, 200)}`,
        );
        return;
    }
    if (tags.length === 0) {
        await vscode.window.showWarningMessage(
            'No runtime versions found in the registry (or this registry is not supported).',
        );
        return;
    }

    const current = ConfigurationService.getInstance().daliVersionTag;
    const items = tags.map((t) => ({
        label: t,
        description: t === current ? '(current)' : '',
    }));
    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: `Select the DALi runtime version to use (current: ${current})`,
        ignoreFocusOut: true,
    });
    if (!pick || pick.label === current) {
        return;
    }

    await ConfigurationService.getInstance().update(
        'daliVersionTag', pick.label, vscode.ConfigurationTarget.Global,
    );
    outputChannel.appendLine(`[Runtime] Version switched to '${pick.label}' — pulling if needed…`);
    const ok = await pullRuntimeImageCommand(runtime, outputChannel, /*force*/ false);
    if (ok) {
        await onSelected();
    }
}
