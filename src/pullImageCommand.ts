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
 * Categorize a docker pull error and suggest an action.
 * Returns { category, userMessage, shouldRetry, details }
 * Exported for testing.
 */
export function analyzePullError(errorMessage: string): {
    category: 'network' | 'auth' | 'notfound' | 'unknown';
    userMessage: string;
    shouldRetry: boolean;
    details: string;
} {
    const lower = errorMessage.toLowerCase();

    if (
        lower.includes('failed to authorize') ||
        lower.includes('failed to fetch anonymous token') ||
        lower.includes('401') ||
        lower.includes('403')
    ) {
        return {
            category: 'auth',
            userMessage: 'Authentication or authorization failed. Check your network connectivity and firewall settings.',
            shouldRetry: true,
            details: 'GHCR registry returned an authentication error. This can be transient if your network/proxy blocks the token endpoint.',
        };
    }

    if (
        lower.includes('connection refused') ||
        lower.includes('connection reset') ||
        lower.includes('timeout') ||
        lower.includes('i/o timeout') ||
        lower.includes('network is unreachable') ||
        lower.includes('httpreadseeker')
    ) {
        return {
            category: 'network',
            userMessage: 'Network connection issue detected. This is often temporary.',
            shouldRetry: true,
            details: 'The network connection to the registry was interrupted. This can happen due to proxy, firewall, or transient connectivity issues. Retrying often helps.',
        };
    }

    if (
        lower.includes('not found') ||
        lower.includes('manifest not found') ||
        lower.includes('image not found')
    ) {
        return {
            category: 'notfound',
            userMessage: 'Runtime image not found in the registry.',
            shouldRetry: false,
            details: 'The configured image does not exist or is no longer available.',
        };
    }

    return {
        category: 'unknown',
        userMessage: 'An unexpected error occurred while pulling the runtime image.',
        shouldRetry: true,
        details: errorMessage,
    };
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

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        outputChannel.appendLine(`[Runtime] Attempt ${attempt}/${maxRetries}`);

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Downloading DALi runtime image (~290 MB)${attempt > 1 ? ` (attempt ${attempt}/${maxRetries})` : ''}`,
                cancellable: false,
            },
            async (progress) => {
                const startMs = Date.now();
                let completedLayers = 0;
                let totalLayers = 0;
                let heartbeatTimer: any;

                const render = (): void => {
                    progress.report({
                        message: formatPullMessage(completedLayers, totalLayers, Date.now() - startMs),
                    });
                };

                heartbeatTimer = setInterval(render, 1000);

                try {
                    await runtime.pullImage(tag, (p) => {
                        completedLayers = p.completedLayers;
                        totalLayers = p.totalLayers;
                        render();
                    });
                    outputChannel.appendLine(`[Runtime] Pull complete: ${ref}`);
                    void vscode.window.showInformationMessage(
                        `Runtime image downloaded. You can now open a sample preview.`,
                    );
                    return { success: true };
                } catch (err: any) {
                    const msg = err?.message ?? String(err);
                    outputChannel.appendLine(`[Runtime] Pull failed (attempt ${attempt}): ${msg}`);
                    return { success: false, error: msg };
                } finally {
                    if (heartbeatTimer) clearInterval(heartbeatTimer);
                }
            },
        );

        if (result.success) {
            return true;
        }

        const analysis = analyzePullError(result.error);
        outputChannel.appendLine(
            `[Runtime] Error category: ${analysis.category}. Details: ${analysis.details}`,
        );

        if (!analysis.shouldRetry || attempt >= maxRetries) {
            // Final attempt failed or not retryable
            const items: string[] = ['View Logs'];
            if (analysis.shouldRetry) {
                items.unshift('Retry');
            }

            const action = await vscode.window.showErrorMessage(
                `${analysis.userMessage}\n\nFull error: ${result.error.slice(0, 150)}`,
                ...items,
            );

            if (action === 'Retry') {
                outputChannel.appendLine(`[Runtime] User requested retry`);
                continue;
            } else if (action === 'View Logs') {
                outputChannel.show();
                return false;
            } else {
                return false;
            }
        }

        // Auto-retry with backoff
        const delaySecs = Math.min(2 ** (attempt - 1), 16);
        outputChannel.appendLine(
            `[Runtime] Retrying in ${delaySecs}s (${analysis.category} error detected)...`,
        );

        await new Promise((r) => setTimeout(r, delaySecs * 1000));
    }

    return false;
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
