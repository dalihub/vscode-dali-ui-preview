import * as vscode from 'vscode';
import { ConfigurationService } from './configurationService';
import { DockerRuntime } from './dockerRuntime';
import { checkDockerAccess } from './dockerAccessCheck';

/**
 * Build the download-notification sub-message. Deliberately percentage-free.
 *
 * Off-TTY (how the extension always spawns docker) `docker pull` exposes no
 * byte/percent detail, so any percent we derive is a coarse per-layer guess
 * that misreads a pull dominated by one big ~290 MB layer as "stuck near 0%".
 * We instead show completed/total layers — a real, monotonic milestone — plus
 * elapsed time. Pure + exported so it is unit-tested without vscode/docker.
 */
export function formatPullMessage(
    completedLayers: number,
    totalLayers: number,
    elapsedMs: number,
): string {
    const s = Math.max(0, Math.floor(elapsedMs / 1000));
    const elapsed = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const head = totalLayers > 0 ? `${completedLayers}/${totalLayers} layers` : 'starting';
    return `${head} · ${elapsed} elapsed`;
}

/**
 * Pull the configured runtime image with a VS Code progress notification.
 * Shared by `pullRuntimeImageCommand` (explicit user command) and
 * `ensureRuntimeImage` (automatic setup flow). Resolves true on success.
 */
async function pullWithProgress(
    runtime: DockerRuntime,
    tag: string,
    outputChannel: vscode.OutputChannel,
): Promise<boolean> {
    const ref = runtime.imageRef(tag);
    outputChannel.appendLine(`[Runtime] Pulling ${ref} ...`);

    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Downloading DALi runtime image (~290 MB)`,
            cancellable: false,
        },
        async (progress) => {
            const startMs = Date.now();
            let completedLayers = 0;
            let totalLayers = 0;

            // Indeterminate bar — deliberately percentage-free. Off-TTY,
            // `docker pull` emits no byte/percent detail (that bar is TTY-only),
            // and a per-layer mean misreads a pull dominated by one big ~290 MB
            // layer as "stuck near 0%" (the 0.39.1 approach). Reporting NO
            // increment keeps VS Code's bar in its always-animating
            // indeterminate state, and the heartbeat ticks an honest
            // "N/M layers · elapsed" status every second — so the user sees it
            // working without a misleading number. Install speed matters more
            // than a progress percentage we cannot compute accurately here.
            const render = (): void => {
                progress.report({
                    message: formatPullMessage(completedLayers, totalLayers, Date.now() - startMs),
                });
            };

            const heartbeat = setInterval(render, 1000);

            try {
                await runtime.pullImage(tag, (p) => {
                    completedLayers = p.completedLayers;
                    totalLayers = p.totalLayers;
                    // Never pass an increment → the bar stays indeterminate.
                    render();
                });
                outputChannel.appendLine(`[Runtime] Pull complete: ${ref}`);
                // Fire-and-forget: don't await, so the progress notification
                // closes immediately at 100% instead of lingering until this
                // toast is dismissed.
                void vscode.window.showInformationMessage(
                    `Runtime image downloaded. You can now open a sample preview.`,
                );
                return true;
            } catch (err: any) {
                const msg = err?.message ?? String(err);
                outputChannel.appendLine(`[Runtime] Pull failed: ${msg}`);
                await vscode.window.showErrorMessage(
                    `Runtime image pull failed: ${msg.slice(0, 200)}`,
                );
                return false;
            } finally {
                clearInterval(heartbeat);
            }
        },
    );
}

/**
 * Command: `dali.pullRuntimeImage`
 *
 * Pulls the configured DALi runtime image from the registry, showing a
 * VS Code progress notification with percentage. Used both as an explicit
 * user command and triggered automatically after the docker verify step in
 * the walkthrough.
 *
 * No-op (with info message) if docker is unavailable or the image is already
 * cached — UNLESS `force` is true. `force` re-pulls even a cached tag, which
 * is how an update to a rolling tag (e.g. `:latest`) is applied.
 */
export async function pullRuntimeImageCommand(
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
    force = false,
): Promise<boolean> {
    const cfg = ConfigurationService.getInstance();
    const tag = cfg.daliVersionTag;
    const ref = runtime.imageRef(tag);

    const access = await checkDockerAccess();
    if (access.state !== 'ok') {
        await vscode.window.showWarningMessage(
            `Cannot pull runtime image — docker is not accessible (state: ${access.state}). ` +
            'Run "DALi Preview: Verify Docker Access" first.',
        );
        return false;
    }

    if (!force && await runtime.hasImage(tag)) {
        await vscode.window.showInformationMessage(
            `Runtime image ${ref} is already cached locally — nothing to pull.`,
        );
        outputChannel.appendLine(`[Runtime] Image cached, skipping pull: ${ref}`);
        return true;
    }

    return pullWithProgress(runtime, tag, outputChannel);
}

/**
 * Tracks in-flight auto-pulls keyed by image tag so concurrent
 * `ensureRuntimeImage` callers share ONE download and ONE progress
 * notification.
 *
 * Without this, first-time setup could surface a *second* "Downloading ~290 MB"
 * popup: the preview-server init, every preview render (when the server isn't up
 * yet), and the post-install docker-access poller all call `ensureRuntimeImage`
 * independently and with no mutual exclusion. If a second trigger fired while
 * the first pull was still running, `hasImage` was still false, so it kicked off
 * its own pull. Coalescing on the tag collapses those into a single pull.
 */
const inFlightPulls = new Map<string, Promise<boolean>>();

/**
 * Ensure the configured runtime image is present locally. If missing, auto-pull
 * it with the same progress notification as the explicit command (but without
 * the "already cached" toast — this is the silent setup-flow path).
 *
 * Returns true if the image is available afterward (cached or freshly pulled),
 * false otherwise. Never throws — safe to call when docker isn't ready (returns
 * false), so callers can guard preview-server startup on the result.
 *
 * Concurrent calls for the same tag are coalesced into a single pull (see
 * `inFlightPulls`).
 */
export async function ensureRuntimeImage(
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
): Promise<boolean> {
    const tag = ConfigurationService.getInstance().daliVersionTag;

    const access = await checkDockerAccess();
    if (access.state !== 'ok') {
        outputChannel.appendLine(
            `[Runtime] ensureRuntimeImage skipped — docker state ${access.state}`,
        );
        return false;
    }

    if (await runtime.hasImage(tag)) {
        return true;
    }

    // Coalesce with any pull of the same tag already in progress so we never
    // show a duplicate download notification.
    const existing = inFlightPulls.get(tag);
    if (existing) {
        outputChannel.appendLine(
            `[Runtime] Joining in-flight pull for ${runtime.imageRef(tag)} (no duplicate download).`,
        );
        return existing;
    }

    const pull = pullWithProgress(runtime, tag, outputChannel);
    inFlightPulls.set(tag, pull);
    try {
        return await pull;
    } finally {
        inFlightPulls.delete(tag);
    }
}
