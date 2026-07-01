/**
 * Local-mode → Docker bootstrap.
 *
 * When the user is on the `local` runtime and Docker is not usable, the
 * "Select Runtime Version" command can't list versions. Instead of dead-ending,
 * this module drives: pick a version from the registry → install/fix Docker →
 * download that image → switch runtimeMode to docker (on success only) → reload.
 *
 * The classifiers are pure; the orchestrator (runLocalDockerBootstrap) takes
 * injected deps so the whole flow is unit-testable without VS Code or Docker
 * (mirrors the dockerOnboarding.ts pattern).
 */

/** Whether we can list versions now (docker ok) or must bootstrap docker first. */
export function decideLocalVersionAction(args: { accessState: string }):
    'list-and-switch' | 'setup-then-switch' {
    return args.accessState === 'ok' ? 'list-and-switch' : 'setup-then-switch';
}

/** Fresh install vs. fix-an-existing-install (daemon down / socket permission). */
export function decideInstallAction(accessState: string): 'install' | 'guidance' {
    return accessState === 'docker-not-installed' ? 'install' : 'guidance';
}

export type BootstrapOutcome =
    | 'switched'
    | 'no-versions'
    | 'cancelled-pick'
    | 'declined'
    | 'setup-gaveup'
    | 'pull-failed';

export interface LocalDockerBootstrapDeps {
    /** The docker access state observed just before this flow started. */
    accessState: string;
    /** The currently-configured runtime image tag (offline fallback target). */
    currentTag: string;
    /** Registry tag list — works without Docker (HTTPS). Return [] on failure. */
    listRemoteVersions: () => Promise<string[]>;
    /** Show the version picker; resolves to the chosen tag or undefined if cancelled. */
    pickVersion: (tags: string[], current: string) => Promise<string | undefined>;
    /** Confirm the heavier consequences (install + ~290 MB + mode switch). */
    confirmSetup: (version: string) => Promise<boolean>;
    /** Registry unreachable: confirm installing with the current tag instead. */
    confirmOfflineFallback: (tag: string) => Promise<boolean>;
    /** Kick off the install (fresh) or the daemon/permission fix, per accessState. */
    beginInstall: (accessState: string) => Promise<void>;
    /** Wait until Docker is reachable in THIS session; 'gaveup' on timeout/cancel. */
    waitForDockerReady: () => Promise<'ok' | 'gaveup'>;
    /** Download the chosen image tag. Resolves true on success. */
    pullImage: (tag: string) => Promise<boolean>;
    /** Persist runtimeMode=docker AND daliVersionTag=tag (success only). */
    persistDockerMode: (tag: string) => Promise<void>;
    /** Reload the window so the docker backend is picked at the next activation. */
    reload: () => Promise<void>;
    /** Surface a non-fatal warning to the user. */
    warn: (msg: string) => Promise<void>;
    /** Optional progress logging. */
    log?: (msg: string) => void;
}

/**
 * Orchestrate the local→docker bootstrap. Pure control flow over injected IO so
 * it is fully unit-testable. Persists the mode switch ONLY on complete success,
 * so a cancel/failure at any step leaves the user cleanly on the local runtime.
 */
export async function runLocalDockerBootstrap(
    deps: LocalDockerBootstrapDeps,
): Promise<BootstrapOutcome> {
    const log = deps.log ?? (() => {});

    // 1. Choose a version. The registry list needs no Docker; if it's empty
    //    (offline), offer to install with the current tag rather than dead-end.
    const remote = await deps.listRemoteVersions();
    let chosen: string;
    if (remote.length === 0) {
        log('[LocalBootstrap] No remote versions available — offering current-tag fallback.');
        if (!(await deps.confirmOfflineFallback(deps.currentTag))) {
            return 'no-versions';
        }
        chosen = deps.currentTag;
    } else {
        const pick = await deps.pickVersion(remote, deps.currentTag);
        if (!pick) {
            return 'cancelled-pick';
        }
        if (!(await deps.confirmSetup(pick))) {
            return 'declined';
        }
        chosen = pick;
    }

    // 2. Install Docker (or fix daemon/permission on an existing install).
    await deps.beginInstall(deps.accessState);

    // 3. Wait until this session can reach Docker (setfacl grants it, no reload).
    const ready = await deps.waitForDockerReady();
    if (ready === 'gaveup') {
        await deps.warn('Docker did not become available — staying on the local runtime.');
        return 'setup-gaveup';
    }

    // 4. Download the chosen image BEFORE the reload, so docker mode comes up ready.
    const pulled = await deps.pullImage(chosen);
    if (!pulled) {
        await deps.warn('Could not download the DALi runtime image — staying on the local runtime.');
        return 'pull-failed';
    }

    // 5. Commit the switch (mode + tag) only now, then reload to re-pick the backend.
    await deps.persistDockerMode(chosen);
    await deps.reload();
    log(`[LocalBootstrap] Switched to the docker runtime on '${chosen}'.`);
    return 'switched';
}
