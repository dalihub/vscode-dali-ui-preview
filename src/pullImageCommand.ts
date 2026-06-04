import * as vscode from 'vscode';
import { ConfigurationService } from './configurationService';
import { DockerRuntime } from './dockerRuntime';
import { checkDockerAccess } from './dockerAccessCheck';

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
            let lastReported = 0;
            try {
                await runtime.pullImage(tag, (p) => {
                    // VS Code's progress increments are deltas, not absolute %.
                    const delta = Math.max(0, p.percent - lastReported);
                    lastReported = p.percent;
                    progress.report({
                        increment: delta,
                        message: `${Math.round(p.percent)}% — ${p.status.slice(0, 80)}`,
                    });
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
 * Ensure the configured runtime image is present locally. If missing, auto-pull
 * it with the same progress notification as the explicit command (but without
 * the "already cached" toast — this is the silent setup-flow path).
 *
 * Returns true if the image is available afterward (cached or freshly pulled),
 * false otherwise. Never throws — safe to call when docker isn't ready (returns
 * false), so callers can guard preview-server startup on the result.
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

    return pullWithProgress(runtime, tag, outputChannel);
}
