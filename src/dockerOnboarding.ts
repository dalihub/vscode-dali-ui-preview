/**
 * First-run Docker onboarding.
 *
 * Problem this solves: the docker-install prompt used to surface only when the
 * user opened a previewable C++ file (the extension activates on `onLanguage:cpp`
 * and the prompt is driven from the preview-server init). Real users often have
 * no `.preview.dali.cpp` file yet, so they never saw it. With the extension now
 * also activating `onStartupFinished`, this module proactively offers to set up
 * Docker (install + runtime image) once per machine — no preview file required.
 *
 * The orchestration here is pure/injectable so it can be unit-tested without
 * VS Code; the extension wires the real `vscode` IO into the deps.
 */

/** Per-machine globalState flag — shown-once, synced like the walkthrough flag. */
export const DOCKER_ONBOARDING_KEY = 'daliPreview.dockerOnboarding.v1';

export type OnboardingState =
    /** Prompt already shown on this machine — never re-prompt automatically. */
    | 'already-shown'
    /** Docker isn't reachable — must prompt the user to install it. */
    | 'need-docker'
    /** Docker is ready but the runtime image is missing (auto-pull elsewhere). */
    | 'need-image'
    /** Docker + image both present — nothing to do. */
    | 'already-set-up';

/**
 * Pure classifier: given the observed docker/image state, decide what the
 * onboarding flow should do. Kept side-effect-free for straightforward testing.
 */
export function classifyOnboarding(args: {
    dockerAccessOk: boolean;
    hasImage: boolean;
}): Exclude<OnboardingState, 'already-shown'> {
    if (!args.dockerAccessOk) {
        return 'need-docker';
    }
    if (!args.hasImage) {
        return 'need-image';
    }
    return 'already-set-up';
}

export interface FirstRunDockerSetupDeps {
    daliVersionTag: string;
    /** Whether the once-per-machine prompt has already been shown. */
    alreadyShown: boolean;
    /** Probe docker reachability (maps to checkDockerAccess). */
    checkAccess: () => Promise<{ state: string }>;
    /** Whether the configured runtime image tag is cached locally. */
    hasImage: (tag: string) => Promise<boolean>;
    /** Persist the shown-once flag. */
    markShown: () => Promise<void>;
    /** Ask the user to install Docker now. Returns true on consent. */
    confirmInstall: () => Promise<boolean>;
    /** Kick off the no-reboot Docker install (which auto-pulls the image after). */
    installDocker: () => Promise<void>;
    /** Optional progress logging. */
    log?: (msg: string) => void;
}

/**
 * Run the first-launch Docker onboarding at most once per machine.
 *
 * Only the `need-docker` case shows a modal: when Docker isn't installed we
 * can't auto-pull, so the user must opt into the install. The `need-image`
 * case is intentionally silent here — the preview-server init already auto-pulls
 * the image (with its own progress notification) whenever Docker is reachable,
 * and the in-flight guard in `ensureRuntimeImage` keeps that to a single
 * download. Returns the classified state (or 'already-shown') for the caller
 * to log/test.
 */
export async function maybeRunFirstRunDockerSetup(
    deps: FirstRunDockerSetupDeps,
): Promise<OnboardingState> {
    const log = deps.log ?? (() => {});

    if (deps.alreadyShown) {
        return 'already-shown';
    }

    const access = await deps.checkAccess();
    const hasImage = access.state === 'ok'
        ? await deps.hasImage(deps.daliVersionTag)
        : false;
    const state = classifyOnboarding({
        dockerAccessOk: access.state === 'ok',
        hasImage,
    });

    // Mark shown regardless of the branch so a dismissed prompt doesn't reappear
    // on every VS Code startup; users can re-trigger via the setup walkthrough.
    await deps.markShown();

    if (state === 'need-docker') {
        log('[Onboarding] Docker not reachable — offering install.');
        if (await deps.confirmInstall()) {
            await deps.installDocker();
        } else {
            log('[Onboarding] User postponed Docker setup.');
        }
    } else {
        log(`[Onboarding] state=${state} — no prompt needed.`);
    }

    return state;
}
