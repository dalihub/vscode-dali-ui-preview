import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { ConfigurationService } from './configurationService';
import { DOCKER_ONBOARDING_KEY } from './dockerOnboarding';
import { getLogger } from './logger';
import { FIRST_LAUNCH_KEY } from './walkthroughController';

const execAsync = promisify(exec);

interface DockerImageInfo {
    id: string;
    tag: string;       // full reference, e.g. "ghcr.io/dalihub/dali-preview-runtime:dali_2.5.18"
    sizeBytes: number;
    sizeLabel: string; // human-readable size (docker's own format)
    createdSince: string;
}

/**
 * List all locally-cached DALi runtime images. Returns empty array if none.
 *
 * Filters by the configured `daliPreview.dockerImage` repo so we don't show
 * unrelated images (and never delete user images we didn't create).
 */
async function listDaliRuntimeImages(): Promise<DockerImageInfo[]> {
    const cfg = ConfigurationService.getInstance();
    const repoFilter = cfg.dockerImage; // e.g. ghcr.io/dalihub/dali-preview-runtime
    try {
        // Format: ID|repo:tag|sizeLabel|sizeBytes|createdSince
        // `--format` doesn't have a "size in bytes" placeholder directly, but
        // {{.Size}} returns human-readable; we parse it back to bytes for
        // sorting / aggregation.
        const { stdout } = await execAsync(
            `docker images --filter reference='${repoFilter}' ` +
            `--format '{{.ID}}|{{.Repository}}:{{.Tag}}|{{.Size}}|{{.CreatedSince}}'`,
            { timeout: 10_000 },
        );
        const lines = stdout.trim().split('\n').filter(Boolean);
        return lines.map((line) => {
            const [id, tag, sizeLabel, createdSince] = line.split('|');
            return {
                id,
                tag,
                sizeLabel,
                sizeBytes: parseDockerSize(sizeLabel),
                createdSince,
            };
        });
    } catch (err: any) {
        getLogger().warn('Docker', 'listDaliRuntimeImages failed', { error: String(err) });
        return [];
    }
}

/** Parse docker's '290MB' / '1.6GB' / '512kB' style size strings to bytes. */
function parseDockerSize(label: string): number {
    const m = /^([\d.]+)\s*([KMGT]?B)$/i.exec(label.trim());
    if (!m) return 0;
    const n = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    const factor = unit === 'TB' ? 1e12
        : unit === 'GB' ? 1e9
        : unit === 'MB' ? 1e6
        : unit === 'KB' ? 1e3
        : 1;
    return Math.round(n * factor);
}

function formatBytes(bytes: number): string {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} kB`;
    return `${bytes} B`;
}

/**
 * Command: `dali.cleanRuntimeImages`
 *
 * Lists locally-cached runtime images and lets the user pick which to delete.
 * Stops and removes any matching containers first so `docker rmi` doesn't
 * complain about images-in-use.
 */
export async function cleanRuntimeImagesCommand(outputChannel: vscode.OutputChannel): Promise<void> {
    const log = getLogger();

    const images = await listDaliRuntimeImages();
    if (images.length === 0) {
        await vscode.window.showInformationMessage(
            'No DALi runtime images are cached locally — nothing to clean.',
        );
        return;
    }

    const totalBytes = images.reduce((s, i) => s + i.sizeBytes, 0);

    // Multi-select QuickPick. Each item shows tag + size + age.
    type Item = vscode.QuickPickItem & { image: DockerImageInfo };
    const items: Item[] = images.map((img) => ({
        label: img.tag,
        description: img.sizeLabel,
        detail: `created ${img.createdSince} · ID ${img.id}`,
        image: img,
        picked: true,
    }));

    const picked = await vscode.window.showQuickPick<Item>(items, {
        canPickMany: true,
        placeHolder: `Select DALi runtime images to delete (total cached: ${formatBytes(totalBytes)})`,
        ignoreFocusOut: true,
    });

    if (!picked || picked.length === 0) {
        return;
    }

    const pickedBytes = picked.reduce((s, p) => s + p.image.sizeBytes, 0);
    const confirm = await vscode.window.showWarningMessage(
        `Delete ${picked.length} image(s), freeing ~${formatBytes(pickedBytes)}?\n\n` +
        picked.map((p) => `  • ${p.image.tag}`).join('\n'),
        { modal: true },
        'Delete',
    );
    if (confirm !== 'Delete') {
        return;
    }

    // First stop and remove any containers still using the images
    // (long-running preview servers we may have spawned).
    outputChannel.appendLine('[Maintenance] Stopping any running dali-preview-server containers ...');
    try {
        await execAsync(
            "docker ps -aq --filter name='dali-preview-server-' | xargs -r docker rm -f",
            { shell: '/bin/bash', timeout: 10_000 },
        );
    } catch (err) {
        log.warn('Docker', 'container cleanup before image rm failed', { error: String(err) });
    }

    let removed = 0;
    let freedBytes = 0;
    for (const p of picked) {
        try {
            await execAsync(`docker rmi -f ${p.image.id}`, { timeout: 30_000 });
            outputChannel.appendLine(`[Maintenance] Removed ${p.image.tag} (${p.image.sizeLabel})`);
            removed++;
            freedBytes += p.image.sizeBytes;
        } catch (err: any) {
            outputChannel.appendLine(`[Maintenance] Failed to remove ${p.image.tag}: ${err?.message ?? err}`);
        }
    }

    outputChannel.appendLine(`[Maintenance] Done — removed ${removed} image(s), freed ~${formatBytes(freedBytes)}`);
    await vscode.window.showInformationMessage(
        `Removed ${removed} image(s), freed ~${formatBytes(freedBytes)}.`,
    );
}

/**
 * Re-arm the first-run flows by clearing their "shown once per machine"
 * globalState flags. After this, the next activation treats the machine as
 * fresh: in docker mode, if Docker is missing the proactive install prompt
 * appears again.
 *
 * Why this is needed: those flags persist across an extension reinstall (VS
 * Code keeps globalState keyed by extension id), and nothing else clears them —
 * so once shown, the install prompt would never reappear, even after the user
 * removes Docker and genuinely needs to reinstall it. Clearing through the
 * globalState Memento is race-free: it updates VS Code's authoritative in-memory
 * store, unlike editing `state.vscdb` behind a running VS Code (which gets
 * overwritten on the next flush).
 */
export async function clearFirstRunFlags(globalState: vscode.Memento): Promise<void> {
    await globalState.update(DOCKER_ONBOARDING_KEY, undefined);
    await globalState.update(FIRST_LAUNCH_KEY, undefined);
}

/**
 * Command: `dali.resetExtension`
 *
 * Heavy-handed cleanup for "I'm uninstalling" or "something broke, start
 * over" scenarios. Removes:
 *   - Every dali-preview-server-* container
 *   - All cached DALi runtime images
 *   - Persistent named volumes (shader cache, ccache)
 *   - The first-run "shown once" flags, so setup guidance can appear again
 *
 * Intentionally does NOT touch the user's docker installation, group
 * memberships, or any image we didn't create.
 */
export async function resetExtensionCommand(
    outputChannel: vscode.OutputChannel,
    globalState?: vscode.Memento,
): Promise<void> {
    const cfg = ConfigurationService.getInstance();
    const repo = cfg.dockerImage;

    const choice = await vscode.window.showWarningMessage(
        'Reset DALi Preview docker state? This will:\n\n' +
        `  1. Stop & remove dali-preview-server-* containers\n` +
        `  2. Delete all cached images for ${repo}\n` +
        `  3. Delete cache volumes (dali-preview-shader-cache, dali-preview-ccache)\n` +
        `  4. Re-arm first-run setup (the Docker install prompt can appear again)\n\n` +
        'Your code, settings, and Docker installation are untouched.',
        { modal: true },
        'Reset',
    );
    if (choice !== 'Reset') return;

    outputChannel.show(true);
    outputChannel.appendLine('[Maintenance] === DALi Preview reset ===');

    // 1. Containers
    outputChannel.appendLine('[Maintenance] Removing containers ...');
    try {
        await execAsync(
            "docker ps -aq --filter name='dali-preview-server-' | xargs -r docker rm -f",
            { shell: '/bin/bash', timeout: 15_000 },
        );
    } catch (err) {
        outputChannel.appendLine(`  (skipped: ${String(err)})`);
    }

    // 2. Images
    outputChannel.appendLine('[Maintenance] Removing images ...');
    try {
        await execAsync(
            `docker images --filter reference='${repo}' -q | xargs -r docker rmi -f`,
            { shell: '/bin/bash', timeout: 30_000 },
        );
    } catch (err) {
        outputChannel.appendLine(`  (skipped: ${String(err)})`);
    }

    // 3. Volumes
    outputChannel.appendLine('[Maintenance] Removing cache volumes ...');
    for (const vol of ['dali-preview-shader-cache', 'dali-preview-ccache']) {
        try {
            await execAsync(`docker volume rm ${vol}`, { timeout: 5_000 });
            outputChannel.appendLine(`  removed: ${vol}`);
        } catch (err) {
            // Volume may not exist; not fatal.
        }
    }

    // 4. Re-arm first-run onboarding/walkthrough so setup guidance reappears
    //    next launch (e.g. after the user removes Docker and must reinstall it).
    if (globalState) {
        await clearFirstRunFlags(globalState);
        outputChannel.appendLine('[Maintenance] Re-armed first-run setup (cleared shown-once flags).');
    }

    outputChannel.appendLine('[Maintenance] === Done ===');
    const reloadChoice = await vscode.window.showInformationMessage(
        'DALi Preview docker state has been reset. Reload the window to start over.',
        'Reload Window',
    );
    if (reloadChoice === 'Reload Window') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}
