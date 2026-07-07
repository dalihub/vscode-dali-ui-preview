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
 * Map ordered runtime tags to QuickPick items with the shared label/description/
 * detail rules. Pure (the `vscode.QuickPickItem` annotation is erased at runtime)
 * so it is unit-testable and reused by the local→docker bootstrap picker.
 *
 * Each item is marked `current` / `downloaded` / `will download`, and rolling
 * tags whose name lacks a concrete version get a `DALi <version>` detail line.
 */
export function buildVersionQuickPickItems(
    orderedTags: string[],
    ctx: { current: string; localSet: Set<string>; versionByTag: Map<string, string | undefined> },
): vscode.QuickPickItem[] {
    return orderedTags.map((t) => {
        const cached = ctx.localSet.has(t);
        const parts = [
            t === ctx.current ? 'current' : '',
            cached ? 'downloaded' : 'will download (~290 MB)',
        ].filter(Boolean);
        const item: vscode.QuickPickItem = { label: t, description: parts.join(' · ') };
        const version = ctx.versionByTag.get(t);
        if (version && !/\d+\.\d+\.\d+/.test(t)) {
            item.detail = `DALi ${version}`;
        }
        return item;
    });
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
    onSelected: () => Promise<boolean>,
    opts: { announce?: boolean } = {},
): Promise<string | undefined> {
    const access = await checkDockerAccess();
    if (access.state !== 'ok') {
        await vscode.window.showWarningMessage(
            `Cannot list runtime versions — docker is not accessible (${access.state}).`,
        );
        return undefined;
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
        return undefined;
    }

    // Read each cached image's DALi version label (local `docker inspect` —
    // instant, no network) so a rolling tag like `latest` shows its concrete
    // version. Version-named tags (dali_X.Y.Z) already say it in their name.
    const versionByTag = new Map<string, string | undefined>();
    await Promise.all(local.map(async (t) => {
        versionByTag.set(t, await runtime.getImageVersionLabel(t));
    }));

    const announce = opts.announce !== false;
    const cfg = ConfigurationService.getInstance();
    const current = cfg.daliVersionTag;
    // Order the picker so the version in use comes first, then other
    // already-downloaded tags, then not-yet-downloaded ones.
    const rank = (t: string): number => (t === current ? 0 : localSet.has(t) ? 1 : 2);
    const orderedTags = [...allTags].sort((a, b) => rank(a) - rank(b));
    const items = buildVersionQuickPickItems(orderedTags, { current, localSet, versionByTag });
    // Show the CURRENT runtime (with its concrete DALi version when the tag is
    // rolling) in the prompt so it's unambiguous what you're switching from.
    const curVer = versionByTag.get(current);
    const curLabel = curVer && !/\d+\.\d+\.\d+/.test(current) ? `${current} (DALi ${curVer})` : current;
    const pick = await vscode.window.showQuickPick(items, {
        placeHolder: `Current runtime: ${curLabel} — pick a version to switch to`,
        ignoreFocusOut: true,
    });
    if (!pick) {
        return undefined; // cancelled
    }
    if (pick.label === current) {
        // Re-selecting the version you are ALREADY on is NOT a dead no-op: the resident
        // server may be running an OLDER image than the one now under this tag — a rolling
        // tag (`latest` / `dali_X.Y.Z`) can move on the registry, or the server started
        // before a re-pull. Re-pull a rolling tag (force, so it actually moves) and restart
        // via onSelected() so re-selecting re-applies the current published image (this is
        // how you recover a stale server — e.g. one still on a broken-metadata image after
        // the fixed one shipped). Immutable `dali_X.Y.Z-<sha7>` tags can't move → just restart.
        const immutable = /-[0-9a-f]{7,}$/.test(pick.label);
        if (!immutable) {
            outputChannel.appendLine(`[Runtime] Re-applying '${pick.label}' — re-pulling the rolling tag to pick up any newer image…`);
            await pullRuntimeImageCommand(runtime, outputChannel, /*force*/ true);
        }
        const ready = await onSelected();
        if (announce) {
            const verNote = curVer && !/\d+\.\d+\.\d+/.test(current) ? ` (DALi ${curVer})` : '';
            if (ready) {
                void vscode.window.showInformationMessage(
                    `✓ DALi runtime re-applied ('${pick.label}'${verNote}) — the preview server was restarted on the current image.`,
                );
            } else {
                const choice = await vscode.window.showWarningMessage(
                    `DALi runtime '${pick.label}'${verNote} re-applied, but the preview server didn't come up. Reload the window to apply it.`,
                    'Reload Window',
                );
                if (choice === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            }
        }
        return pick.label;
    }

    // pullRuntimeImageCommand pulls the CONFIGURED tag, so set it to the pick first;
    // revert on a failed pull so a download failure never leaves the extension
    // pointed at a version it doesn't actually have.
    await cfg.update('daliVersionTag', pick.label, vscode.ConfigurationTarget.Global);
    outputChannel.appendLine(`[Runtime] Switching runtime to '${pick.label}' — pulling if needed…`);
    const ok = await pullRuntimeImageCommand(runtime, outputChannel, /*force*/ false);
    const ver = versionByTag.get(pick.label);
    const verSuffix = ver && !/\d+\.\d+\.\d+/.test(pick.label) ? ` (DALi ${ver})` : '';
    if (!ok) {
        await cfg.update('daliVersionTag', current, vscode.ConfigurationTarget.Global); // revert
        if (announce) {
            void vscode.window.showErrorMessage(
                `DALi runtime switch to '${pick.label}' failed — the image could not be downloaded. ` +
                `Kept the previous runtime ('${current}'). Check the "DALi Preview" output, then retry.`,
            );
        }
        return pick.label;
    }
    const ready = await onSelected();
    if (announce) {
        if (ready) {
            void vscode.window.showInformationMessage(
                `✓ DALi runtime switched to '${pick.label}'${verSuffix}. Open or save a preview file to render with it.`,
            );
        } else {
            const choice = await vscode.window.showWarningMessage(
                `DALi runtime set to '${pick.label}'${verSuffix}, but the preview server didn't come up. ` +
                `Reload the window to apply it.`,
                'Reload Window',
            );
            if (choice === 'Reload Window') {
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    }
    return pick.label;
}
