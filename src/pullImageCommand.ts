import * as vscode from 'vscode';
import { ConfigurationService } from './configurationService';
import { DockerRuntime } from './dockerRuntime';
import { checkDockerAccess } from './dockerAccessCheck';
import { describeRegistry, BART_PROXY_HOST } from './registry';
import { listRemoteTags } from './registryClient';

/** A ROLLING tag (`latest` / `dali_X.Y.Z`) can move on the registry and may be missing/uncached
 *  on a caching proxy even when a concrete immutable build is available. An immutable
 *  `dali_X.Y.Z-<sha>` tag never moves. */
export function isRollingTag(tag: string): boolean {
    // A tag WITHOUT a trailing `-<sha>` can move on the registry — `latest`, the moving
    // minor `dali_X.Y.Z`, and the per-build pin `dali_X.Y.Z.BUILD` (re-tagged on each
    // ext-sha rebuild) — so a caching proxy may need an upstream round-trip to revalidate
    // it. Only a `dali_..-<sha>` tag is truly immutable. (4-part X.Y.Z.BUILD supported.)
    return tag === 'latest' || /^dali_\d+\.\d+\.\d+(\.\d+)?$/.test(tag);
}

/**
 * When a rolling tag can't be pulled, pick the best CONCRETE fallback from the registry's tag list.
 *
 * Root cause (why this is needed): on a caching proxy like the corp BART/Artifactory mirror, a
 * MUTABLE tag (`latest`, and also the moving `dali_X.Y.Z`) is not served from cache — the proxy
 * must revalidate it against the upstream (ghcr.io) on each pull to check whether it moved, and
 * that upstream round-trip fails over the restricted corp egress. An IMMUTABLE `dali_X.Y.Z-<sha>`
 * tag never moves, so the proxy serves it straight from cache with no upstream call — which is why
 * `latest` fails there while `dali_2.5.28-<sha>` (the SAME digest) succeeds.
 *
 * Therefore prefer the newest IMMUTABLE `dali_X.Y.Z-<sha>` (the reliably-servable one), and only
 * fall back to a moving `dali_X.Y.Z` if no immutable tag exists. The agent prunes old builds, so
 * the newest-version immutable is the current, already-fixed image. Returns undefined when the
 * list has no usable concrete tag. Pure + exported for unit testing.
 */
export function pickFallbackTag(tags: string[], failedTag: string): string | undefined {
    // Parse the numeric version, supporting BOTH the 3-part `dali_X.Y.Z` and the current
    // 4-part `dali_X.Y.Z.BUILD` forms. The 4th (build) component is included so two builds
    // of the same minor (e.g. dali_2.5.29.10863 vs dali_2.5.29.10708) sort correctly —
    // WITHOUT it the newest-selection ties on [2,5,29] and can pin an older build.
    const ver = (t: string): [number, number, number, number] | undefined => {
        const m = /^dali_(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/.exec(t);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : 0] : undefined;
    };
    const newest = (arr: string[]): string | undefined =>
        arr.length === 0 ? undefined : [...arr].sort((a, b) => {
            const [av, bv] = [ver(a)!, ver(b)!];
            return bv[0] - av[0] || bv[1] - av[1] || bv[2] - av[2] || bv[3] - av[3];
        })[0];
    const usable = tags.filter((t) => t !== failedTag && ver(t));
    // Immutable = a trailing `-<sha>` (never moves → served straight from a proxy cache).
    // Accepts 3- and 4-part versions: dali_X.Y.Z-<sha> and dali_X.Y.Z.BUILD-<sha>.
    const immutable = usable.filter((t) => /^dali_\d+\.\d+\.\d+(\.\d+)?-[0-9a-f]{7,}$/.test(t));
    // Moving/pin = no sha: dali_X.Y.Z (minor) or dali_X.Y.Z.BUILD (per-build pin).
    const moving = usable.filter((t) => /^dali_\d+\.\d+\.\d+(\.\d+)?$/.test(t));
    return newest(immutable) ?? newest(moving);
}

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

export type PullErrorCategory = 'network' | 'auth' | 'notfound' | 'cert' | 'dns' | 'unknown';

/**
 * Categorize a docker pull error and decide whether a SAME-host retry is worth it.
 * Returns { category, userMessage, shouldRetry, details }. Exported for testing.
 *
 * `shouldRetry` governs only the same-registry auto-retry — cross-registry
 * fallback (see {@link buildDownloadFailureGuidance}) happens regardless, so a
 * config error like `cert`/`dns` fails the host fast, then the other registry is
 * still tried.
 */
export function analyzePullError(errorMessage: string): {
    category: PullErrorCategory;
    userMessage: string;
    shouldRetry: boolean;
    details: string;
} {
    const lower = errorMessage.toLowerCase();

    // Auth FIRST: GHCR token failures often arrive wrapped in an httpReadSeeker
    // frame that also trips the network matcher, but auth is the actionable one.
    if (
        lower.includes('failed to authorize') ||
        lower.includes('failed to fetch anonymous token') ||
        lower.includes('401') ||
        lower.includes('403') ||
        lower.includes('unauthorized') ||
        lower.includes('denied')
    ) {
        return {
            category: 'auth',
            userMessage: 'Authentication/authorization with the registry failed (often transient).',
            shouldRetry: true,
            details: 'The registry returned an auth error. Can be transient if a proxy intercepts the token endpoint.',
        };
    }

    // TLS trust — a corporate MITM proxy presenting a cert the daemon doesn't trust.
    if (
        lower.includes('x509') ||
        lower.includes('certificate signed by unknown authority') ||
        lower.includes('certificate has expired') ||
        lower.includes('certificate is not trusted') ||
        lower.includes('tls: failed to verify')
    ) {
        return {
            category: 'cert',
            userMessage: 'The Docker daemon does not trust the registry’s TLS certificate.',
            shouldRetry: false,
            details: 'A corporate MITM web proxy is likely intercepting the connection with a CA the Docker daemon does not trust.',
        };
    }

    // DNS — host does not resolve (typically off the corp network / VPN).
    if (
        lower.includes('no such host') ||
        lower.includes('server misbehaving') ||
        lower.includes('name resolution') ||
        lower.includes('could not resolve host')
    ) {
        return {
            category: 'dns',
            userMessage: 'The registry host could not be resolved (DNS).',
            shouldRetry: false,
            details: 'The host did not resolve — you may be off the Samsung corporate network/VPN, or DNS is misconfigured.',
        };
    }

    if (
        lower.includes('connection refused') ||
        lower.includes('connection reset') ||
        lower.includes('timeout') ||
        lower.includes('i/o timeout') ||
        lower.includes('network is unreachable') ||
        lower.includes('no route to host') ||
        lower.includes('tls handshake') ||
        lower.includes('httpreadseeker') ||
        lower.includes('eof')
    ) {
        return {
            category: 'network',
            userMessage: 'Network connection to the registry was interrupted (often temporary).',
            shouldRetry: true,
            details: 'Proxy/firewall/transient connectivity to the registry. Retrying often helps.',
        };
    }

    if (
        lower.includes('not found') ||
        lower.includes('manifest unknown') ||
        lower.includes('manifest not found') ||
        lower.includes('image not found')
    ) {
        return {
            category: 'notfound',
            userMessage: 'The requested runtime image/tag was not found in the registry.',
            shouldRetry: false,
            details: 'The configured tag does not exist (or was removed). Pick a different version.',
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
 * Per-registry, per-category guidance: WHY a pull failed on a specific host and
 * HOW to fix it. Host-aware, because the corp-network failure modes differ by
 * registry — the internal BART proxy must be reached DIRECTLY (bypassing the web
 * proxy), whereas ghcr.io must be reached THROUGH it. Pure/exported for testing.
 */
export function describeFailure(
    category: PullErrorCategory,
    host: string,
): { reason: string; fix: string } {
    const isBart = host === BART_PROXY_HOST;
    switch (category) {
        case 'cert':
            return {
                reason: `Docker daemon does not trust the TLS certificate presented for ${host}.`,
                fix: isBart
                    ? 'The pull is going through the corporate MITM web proxy. Make the daemon reach Samsung-internal hosts DIRECTLY: add ".samsung.net" to the daemon NO_PROXY (/etc/systemd/system/docker.service.d/http-proxy.conf) and `sudo systemctl restart docker`. (Or install the corporate proxy CA into the system trust store.)'
                    : 'If reaching ghcr.io through the corporate web proxy, install that proxy’s CA into the SYSTEM trust store (e.g. update-ca-certificates) and `sudo systemctl restart docker`.',
            };
        case 'dns':
            return {
                reason: `Host ${host} did not resolve (DNS).`,
                fix: isBart
                    ? 'The internal BART host only resolves on the Samsung corporate network/VPN. Connect to the corp network/VPN and retry.'
                    : 'DNS for ghcr.io failed — check your network/DNS/proxy settings.',
            };
        case 'network':
            return {
                reason: isBart
                    ? `Network connection to ${host} (internal BART mirror) was refused/reset/timed out.`
                    : `Network connection to ${host} timed out — the Docker daemon could not reach ghcr.io directly.`,
                fix: isBart
                    ? 'Ensure you are on the corp network and the daemon routes ".samsung.net" DIRECTLY (not via the web proxy): add ".samsung.net" to the daemon NO_PROXY and restart docker.'
                    : 'The image is pulled by the Docker DAEMON (not VS Code), and the daemon most likely has NO corporate HTTP proxy configured — so direct egress to ghcr.io is throttled/blocked (intermittent i/o timeout). Fix: give the daemon the proxy via a systemd drop-in "/etc/systemd/system/docker.service.d/http-proxy.conf" with HTTP_PROXY/HTTPS_PROXY set to your corporate proxy and NO_PROXY=".samsung.net,localhost,127.0.0.1" (keeps the internal BART mirror direct), then `sudo systemctl daemon-reload && sudo systemctl restart docker`. On the corp network the internal BART mirror is the reliable source and needs no proxy — connecting to the corp network alone usually resolves this.',
            };
        case 'auth':
            return {
                reason: `${host} returned an authorization error (401/403).`,
                fix: 'Usually transient — retry. If it persists, a proxy may be intercepting the registry token endpoint.',
            };
        case 'notfound':
            return {
                reason: `The requested tag does not exist on ${host}.`,
                fix: 'Pick a different version (e.g. "latest" or "dali_2.5.28") via "DALi Preview: Select Runtime Version".',
            };
        default:
            return {
                reason: `Unexpected error from ${host}.`,
                fix: 'Open the "DALi Preview" output log for the full docker error.',
            };
    }
}

/**
 * Compose the full user-facing "download failed" guidance across EVERY registry
 * tried (primary + any fallback): names each server, why it failed, and how to fix
 * it. Pure/exported for testing.
 */
export function buildDownloadFailureGuidance(
    attempts: { label: string; host: string; error: string }[],
): string {
    const lines: string[] = ['Could not download the DALi runtime image.', ''];
    lines.push(attempts.length > 1 ? `Tried ${attempts.length} registries — all failed:` : 'Tried:');
    for (const a of attempts) {
        const { category } = analyzePullError(a.error);
        const { reason, fix } = describeFailure(category, a.host);
        lines.push(`• ${a.label} (${a.host})`);
        lines.push(`    Why: ${reason}`);
        lines.push(`    Fix: ${fix}`);
    }
    lines.push('');
    lines.push('The "local" runtime (daliPreview.runtimeMode: local) needs no download and is unaffected.');
    return lines.join('\n');
}

/**
 * Pull `tag` from ONE registry (the runtime's image name) with a progress
 * notification and up to `maxRetries` SAME-host auto-retries (backoff on the
 * retryable categories). Returns the outcome instead of showing any dialog — the
 * caller decides fallback/guidance. Never throws.
 */
async function attemptPull(
    runtime: DockerRuntime,
    tag: string,
    outputChannel: vscode.OutputChannel,
    maxRetries = 3,
): Promise<{ success: boolean; error: string }> {
    const ref = runtime.imageRef(tag);
    // describeRegistry only reads the host (first path segment), so the tagged ref works.
    const src = describeRegistry(ref);
    outputChannel.appendLine(`[Runtime] Pulling ${ref} from ${src.label} — ${src.host}`);

    let attempt = 0;
    let lastError = '';

    while (attempt < maxRetries) {
        attempt++;
        outputChannel.appendLine(`[Runtime] Attempt ${attempt}/${maxRetries} (${src.host})`);

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Downloading DALi runtime image (~290 MB) from ${src.label}${attempt > 1 ? ` (attempt ${attempt}/${maxRetries})` : ''}`,
                cancellable: false,
            },
            async (progress) => {
                const startMs = Date.now();
                let completedLayers = 0;
                let totalLayers = 0;
                const render = (): void => {
                    progress.report({
                        message: formatPullMessage(completedLayers, totalLayers, Date.now() - startMs),
                    });
                };
                const heartbeatTimer = setInterval(render, 1000);
                try {
                    await runtime.pullImage(tag, (p) => {
                        completedLayers = p.completedLayers;
                        totalLayers = p.totalLayers;
                        render();
                    });
                    outputChannel.appendLine(`[Runtime] Pull complete: ${ref}`);
                    return { success: true as const };
                } catch (err: any) {
                    const msg = err?.message ?? String(err);
                    outputChannel.appendLine(`[Runtime] Pull failed (attempt ${attempt}, ${src.host}): ${msg}`);
                    return { success: false as const, error: msg };
                } finally {
                    clearInterval(heartbeatTimer);
                }
            },
        );

        if (result.success) {
            return { success: true, error: '' };
        }
        lastError = result.error;
        const analysis = analyzePullError(result.error);
        outputChannel.appendLine(
            `[Runtime] Error category: ${analysis.category} (${src.host}). ${analysis.details}`,
        );
        if (!analysis.shouldRetry || attempt >= maxRetries) {
            break;
        }
        const delaySecs = Math.min(2 ** (attempt - 1), 16);
        outputChannel.appendLine(`[Runtime] Retrying ${src.host} in ${delaySecs}s (${analysis.category})...`);
        await new Promise((r) => setTimeout(r, delaySecs * 1000));
    }
    return { success: false, error: lastError };
}

/**
 * Pull `tag`, preferring the internal BART mirror and rotating registries fast.
 *
 * Strategy (redesigned per the corp-network reality — see the runtime-download diagnosis):
 *   • **BART first.** The internal BART GHCR mirror is the reliable path (no proxy needed);
 *     ghcr.io needs the daemon to have a corporate proxy it often lacks. So we try the BART
 *     variant of this repo BEFORE ghcr.io, regardless of what the (VS-Code-side, possibly
 *     stale/misprobed) auto-detection cached. External users with no BART just fail it fast.
 *   • **One attempt per host, then immediately fall back** to the other registry — no slow
 *     3× same-host retry. The whole primary→fallback cycle repeats up to `MAX_ROUNDS` for
 *     transient failures (a round with only hard/config errors stops early).
 *   • **Self-correcting detection.** On success we record the working host
 *     ({@link ConfigurationService.noteWorkingImage}) so the NEXT session resolves straight
 *     to it — no repeat of the doomed ghcr.io attempts.
 *   • A cross-registry win is `docker tag`ed to the configured name (so hasImage/run find it).
 *   • Rolling tag the proxy can't serve → newest immutable, tried ONCE per host as a last
 *     resort after the rounds (kept out of the per-round loop so host fallback stays fast).
 *
 * Shared by `pullRuntimeImageCommand` (explicit command) and `ensureRuntimeImage*`. Never throws.
 */
const MAX_PULL_ROUNDS = 3;

async function pullWithFallback(
    runtime: DockerRuntime,
    tag: string,
    outputChannel: vscode.OutputChannel,
): Promise<boolean> {
    const attempts: { label: string; host: string; error: string }[] = [];

    // BART-first host order. `runtime` is the configured (auto-detected) image; `alt` is the
    // BART⇄GHCR counterpart. Put whichever is the BART host first.
    const alt = runtime.alternateRuntime?.();
    let hosts: DockerRuntime[];
    if (!alt) {
        hosts = [runtime]; // custom/pinned image with no known counterpart
    } else if (describeRegistry(runtime.getImageName()).host === BART_PROXY_HOST) {
        hosts = [runtime, alt];
    } else {
        hosts = [alt, runtime]; // configured is ghcr.io → try the BART mirror (alt) first
    }

    // Success handler: alias to the configured name if we won on a different host, persist the
    // working host so future sessions try it first, pin a fallback tag, and notify the user.
    const succeed = async (rt: DockerRuntime, pulledTag: string): Promise<boolean> => {
        const desc = describeRegistry(rt.getImageName());
        if (rt.getImageName() !== runtime.getImageName()) {
            try {
                await runtime.tagImage(rt.imageRef(pulledTag), runtime.imageRef(pulledTag));
                outputChannel.appendLine(`[Runtime] Aliased ${rt.imageRef(pulledTag)} → ${runtime.imageRef(pulledTag)}.`);
            } catch (err: any) {
                outputChannel.appendLine(`[Runtime] Alias failed (non-fatal): ${String(err?.message ?? err)}`);
            }
        }
        await ConfigurationService.noteWorkingImage(rt.getImageName());
        if (pulledTag !== tag) {
            await ConfigurationService.getInstance().update('daliVersionTag', pulledTag, vscode.ConfigurationTarget.Global);
            void vscode.window.showInformationMessage(
                `'${tag}' couldn't be served, so DALi Preview pinned the available version '${pulledTag}'. Change it any time via "Select Runtime Version".`,
            );
        } else {
            void vscode.window.showInformationMessage(
                `DALi runtime image downloaded from ${desc.label}. You can now open a sample preview.`,
            );
        }
        return true;
    };

    // Rounds: one attempt per host with the requested tag, BART first, immediate host fallback.
    for (let round = 1; round <= MAX_PULL_ROUNDS; round++) {
        let anyRetryableThisRound = false;
        for (const rt of hosts) {
            const desc = describeRegistry(rt.getImageName());
            outputChannel.appendLine(`[Runtime] Round ${round}/${MAX_PULL_ROUNDS}: ${rt.imageRef(tag)} — ${desc.label}`);
            const res = await attemptPull(rt, tag, outputChannel, 1); // ONE attempt, no same-host retry
            if (res.success) {
                return succeed(rt, tag);
            }
            attempts.push({ label: desc.label, host: desc.host, error: res.error });
            if (analyzePullError(res.error).shouldRetry) {
                anyRetryableThisRound = true;
            }
        }
        // Stop early if this round hit only hard/config errors (cert/dns/notfound) — repeating
        // them can't help; the last-resort tag fallback + guidance below still run.
        if (!anyRetryableThisRound) {
            break;
        }
        if (round < MAX_PULL_ROUNDS) {
            const delaySecs = round; // 1s, 2s between full rounds
            outputChannel.appendLine(`[Runtime] All registries failed round ${round} — retrying in ${delaySecs}s…`);
            await new Promise((r) => setTimeout(r, delaySecs * 1000));
        }
    }

    // Last resort: a ROLLING tag a caching proxy can't serve → newest IMMUTABLE build, once per host.
    if (isRollingTag(tag)) {
        let immTag: string | undefined;
        for (const rt of hosts) {
            try {
                immTag = pickFallbackTag(await listRemoteTags(rt.getImageName()), tag);
            } catch (e) {
                outputChannel.appendLine(`[Runtime] Could not list tags for fallback: ${String(e).slice(0, 120)}`);
            }
            if (immTag) { break; }
        }
        if (immTag) {
            outputChannel.appendLine(`[Runtime] '${tag}' unavailable on all registries — trying the pinned version '${immTag}'…`);
            for (const rt of hosts) {
                const desc = describeRegistry(rt.getImageName());
                const res = await attemptPull(rt, immTag, outputChannel, 1);
                if (res.success) {
                    return succeed(rt, immTag);
                }
                attempts.push({ label: desc.label, host: desc.host, error: res.error });
            }
        }
    }

    // Everything failed → consolidated, actionable guidance.
    const guidance = buildDownloadFailureGuidance(attempts);
    outputChannel.appendLine(`[Runtime] Download failed.\n${guidance}`);
    const anyRetryable = attempts.some((a) => analyzePullError(a.error).shouldRetry);
    const items = anyRetryable ? ['Retry', 'View Logs'] : ['View Logs'];
    const action = await vscode.window.showErrorMessage(guidance, ...items);
    if (action === 'Retry') {
        outputChannel.appendLine('[Runtime] User requested retry.');
        return pullWithFallback(runtime, tag, outputChannel);
    }
    if (action === 'View Logs') {
        outputChannel.show();
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

    return pullWithFallback(runtime, tag, outputChannel);
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
    return ensureRuntimeImageForTag(runtime, tag, outputChannel);
}

/**
 * Like `ensureRuntimeImage`, but for an EXPLICIT tag rather than the configured
 * one — used by the local→docker bootstrap to download the tag the user just
 * picked while `daliVersionTag` is still unchanged. Never throws.
 *
 * Concurrent calls for the same tag are coalesced into a single pull (see
 * `inFlightPulls`).
 */
export async function ensureRuntimeImageForTag(
    runtime: DockerRuntime,
    tag: string,
    outputChannel: vscode.OutputChannel,
): Promise<boolean> {
    const access = await checkDockerAccess();
    if (access.state !== 'ok') {
        outputChannel.appendLine(
            `[Runtime] ensureRuntimeImageForTag skipped — docker state ${access.state}`,
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

    const pull = pullWithFallback(runtime, tag, outputChannel);
    inFlightPulls.set(tag, pull);
    try {
        return await pull;
    } finally {
        inFlightPulls.delete(tag);
    }
}
