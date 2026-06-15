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
 * Lets the user switch between DALi runtime versions and flip back and forth
 * to compare them. Merges two sources so it works offline:
 *   - local cached tags (`docker images`) — switch instantly, no download
 *   - registry tags (`listRemoteTags`)     — selecting one pulls it first
 *
 * Each entry is marked `downloaded` / `will download` and the active tag
 * `current`. Stores the pick in `daliPreview.daliVersionTag`, pulls it if
 * needed, and restarts the preview server on the selected version.
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

    // Local tags switch instantly and work offline; remote tags may need a
    // pull. Listing remote is best-effort — an offline failure still lets the
    // user pick any already-downloaded version.
    const local = await runtime.listLocalTags();
    const localSet = new Set(local);
    let remote: string[] = [];
    try {
        remote = await listRemoteTags(runtime.getImageName());
    } catch (err) {
        outputChannel.appendLine(
            `[Runtime] Could not list registry versions (offline?): ${String(err).slice(0, 120)}`,
        );
    }

    // Local first (instant switch), then registry-only tags.
    const allTags = [...local, ...remote.filter((t) => !localSet.has(t))];
    if (allTags.length === 0) {
        await vscode.window.showWarningMessage(
            'No runtime versions found locally or in the registry.',
        );
        return;
    }

    // Read each cached image's DALi version label (local `docker inspect` —
    // instant, no network) so a rolling tag like `latest` shows its concrete
    // version. Version-named tags (dali_X.Y.Z) already say it in their name.
    const versionByTag = new Map<string, string | undefined>();
    await Promise.all(local.map(async (t) => {
        versionByTag.set(t, await runtime.getImageVersionLabel(t));
    }));

    const current = ConfigurationService.getInstance().daliVersionTag;
    // Order the picker so the version in use comes first, then other
    // already-downloaded tags, then not-yet-downloaded ones.
    const rank = (t: string): number => (t === current ? 0 : localSet.has(t) ? 1 : 2);
    const orderedTags = [...allTags].sort((a, b) => rank(a) - rank(b));
    const items: vscode.QuickPickItem[] = orderedTags.map((t) => {
        const cached = localSet.has(t);
        const parts = [
            t === current ? 'current' : '',
            cached ? 'downloaded' : 'will download (~290 MB)',
        ].filter(Boolean);
        const item: vscode.QuickPickItem = { label: t, description: parts.join(' · ') };
        // Show the concrete version on a second line (detail) for rolling tags
        // whose name doesn't already contain it — clearly visible, not truncated.
        const version = versionByTag.get(t);
        if (version && !/\d+\.\d+\.\d+/.test(t)) {
            item.detail = `DALi ${version}`;
        }
        return item;
    });
    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: `Select a DALi runtime version to preview with (current: ${current})`,
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
