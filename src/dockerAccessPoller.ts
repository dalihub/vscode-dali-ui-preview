import { checkDockerAccess } from './dockerAccessCheck';
import { getLogger } from './logger';

export interface DockerAccessPollerOptions {
    /** Probe interval in ms. Default 2000. */
    intervalMs?: number;
    /** Max probes before giving up. Default 150 (~5 min at 2s). */
    maxAttempts?: number;
    /** Invoked once, when docker access first becomes 'ok'. */
    onOk: () => void | Promise<void>;
}

/**
 * Polls `checkDockerAccess()` until docker becomes reachable, then fires
 * `onOk` exactly once. Used after the install / setfacl flow so the extension
 * can continue automatically — with no VS Code reload — the moment the current
 * session gains socket access.
 *
 * Modeled on PreviewServer's bounded restart-timer convention: a single
 * self-rescheduling setTimeout (no setInterval → no overlapping probes when a
 * probe is slow), bounded by maxAttempts, cancelable via stop(), idempotent
 * start().
 */
export class DockerAccessPoller {
    private timer: ReturnType<typeof setTimeout> | undefined;
    private attempts = 0;
    private running = false;
    private readonly intervalMs: number;
    private readonly maxAttempts: number;
    private readonly onOk: () => void | Promise<void>;

    constructor(opts: DockerAccessPollerOptions) {
        this.intervalMs = opts.intervalMs ?? 2000;
        this.maxAttempts = opts.maxAttempts ?? 150;
        this.onOk = opts.onOk;
    }

    get isRunning(): boolean {
        return this.running;
    }

    /** Begin polling. A second call while already running is a no-op. */
    start(): void {
        if (this.running) {
            return;
        }
        this.running = true;
        this.attempts = 0;
        this.scheduleNext(0);
    }

    /** Stop polling and cancel any pending probe. */
    stop(): void {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    private scheduleNext(delay: number): void {
        this.timer = setTimeout(() => {
            void this.tick();
        }, delay);
    }

    private async tick(): Promise<void> {
        if (!this.running) {
            return;
        }
        this.attempts++;
        const result = await checkDockerAccess();
        // The poll may have been stopped while we awaited the probe.
        if (!this.running) {
            return;
        }
        if (result.state === 'ok') {
            this.stop();
            try {
                await this.onOk();
            } catch (err) {
                getLogger().warn('Docker', 'access poller onOk failed', { error: String(err) });
            }
            return;
        }
        if (this.attempts >= this.maxAttempts) {
            getLogger().warn('Docker', 'access poller gave up', { attempts: this.attempts });
            this.stop();
            return;
        }
        this.scheduleNext(this.intervalMs);
    }
}
