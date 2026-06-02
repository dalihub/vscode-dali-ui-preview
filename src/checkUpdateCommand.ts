import * as vscode from 'vscode';
import { DockerRuntime } from './dockerRuntime';
import { ConfigurationService } from './configurationService';
import { checkDockerAccess } from './dockerAccessCheck';
import { pullRuntimeImageCommand } from './pullImageCommand';
import { getLogger } from './logger';

/** Per-machine timestamp of the last auto update check (NOT settings-synced). */
export const LAST_UPDATE_CHECK_KEY = 'daliPreview.lastUpdateCheck.v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
 * Activation auto-check: throttled to once/day via globalState, gated by the
 * `daliPreview.autoCheckRuntimeUpdate` setting, docker-mode only, and fully
 * silent on no-update / offline / error. When an update is found, calls
 * `onUpdateAvailable` (a non-modal affordance, e.g. a status-bar badge).
 */
export async function maybeAutoCheckRuntimeUpdate(
    context: vscode.ExtensionContext,
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
    onUpdateAvailable: () => void,
): Promise<void> {
    try {
        const cfg = ConfigurationService.getInstance();
        if (!cfg.autoCheckRuntimeUpdate) return;
        if (cfg.runtimeMode !== 'docker') return;

        const last = context.globalState.get<number>(LAST_UPDATE_CHECK_KEY, 0);
        if (Date.now() - last < ONE_DAY_MS) return;

        const access = await checkDockerAccess();
        if (access.state !== 'ok') return;

        // Record the attempt BEFORE the network probe so a flaky/offline check
        // still backs off for a day (non-blocking, fail-silent).
        await context.globalState.update(LAST_UPDATE_CHECK_KEY, Date.now());

        const tag = cfg.daliVersionTag;
        if (await runtime.isUpdateAvailable(tag)) {
            outputChannel.appendLine(`[Update] Newer runtime image (${tag}) available.`);
            onUpdateAvailable();
        }
    } catch (err) {
        getLogger().trace('Docker', 'auto update check failed (ignored)', { error: String(err) });
    }
}
