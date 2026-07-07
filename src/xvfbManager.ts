import { spawn, execSync, ChildProcess } from 'child_process';
import { getLogger } from './logger';

/** Virtual-display numbers to try, in order. A wide band (not just a handful) so
 *  leftover Xvfb servers from other sessions/tools — which squat on the low
 *  numbers — cannot exhaust the list and force the renderer onto the user's REAL
 *  display (:0). 16 candidates make exhaustion effectively impossible. */
const CANDIDATE_DISPLAYS = Array.from({ length: 16 }, (_, i) => 99 + i); // :99 … :114
const STARTUP_WAIT_MS = 500;
/** Our Xvfb's distinctive screen geometry — used to recognise OUR servers when reaping a
 *  recorded PID, so we never SIGTERM another tool's (or another window's) Xvfb. */
const XVFB_SCREEN = '2048x2048x24';

/**
 * True only for a process command line that is an `Xvfb` started with OUR screen geometry.
 * The reaper uses this so a recorded-but-reused PID (or a foreign Xvfb) is never killed.
 */
export function isOurXvfbProcess(cmdline: string): boolean {
    return /(^|\/)Xvfb\b/.test(cmdline) && cmdline.includes(XVFB_SCREEN);
}

export class XvfbManager {
    private process: ChildProcess | undefined;
    private display: string | undefined;

    /**
     * Start an Xvfb virtual display. Tries a wide band of displays (:99 … :114).
     * Returns true if Xvfb was started successfully.
     */
    async start(reapPid?: number): Promise<boolean> {
        const log = getLogger();
        log.info('Xvfb', 'starting virtual display');
        if (this.process && this.isAlive()) {
            return true;
        }

        // Reclaim OUR own leftover Xvfb from a previous session that exited non-gracefully
        // (a crash/force-quit skips deactivate() → stop(), so the detached Xvfb survives and
        // squats its display). Only a PID we recorded for THIS workspace, and only if it's
        // still an Xvfb with our geometry — never a foreign or another-window's Xvfb.
        if (reapPid && reapPid > 0) {
            this.reapOurOrphan(reapPid);
        }

        // No UI here: the caller (extension activate) decides how to surface a
        // failure — offer to install Xvfb when it's missing, or warn that the
        // display band is busy. Crucially, a false return must NEVER lead to
        // rendering on the real screen (getDisplay() returns undefined, and the
        // render paths refuse rather than fall back to :0).
        if (!this.isXvfbInstalled()) {
            log.info('Xvfb', 'not installed — caller should offer to install');
            return false;
        }

        for (const displayNum of CANDIDATE_DISPLAYS) {
            const candidate = `:${displayNum}`;

            if (this.isDisplayInUse(displayNum)) {
                continue;
            }

            const started = await this.tryStart(candidate);
            if (started) {
                this.display = candidate;
                return true;
            }
        }

        log.info('Xvfb', 'could not claim any virtual display', { tried: `:${CANDIDATE_DISPLAYS[0]}…:${CANDIDATE_DISPLAYS[CANDIDATE_DISPLAYS.length - 1]}` });
        return false;
    }

    /**
     * Stop the Xvfb process if running.
     */
    stop(): void {
        if (this.process) {
            try {
                this.process.kill('SIGTERM');
            } catch (err) {
                getLogger().trace('Xvfb', 'kill already exited', { error: String(err) });
            }
            this.process = undefined;
            this.display = undefined;
        }
    }

    /**
     * The managed Xvfb display string (e.g. ':99') ONLY while our Xvfb is alive.
     * Returns undefined otherwise — callers MUST treat that as "no headless
     * display" and refuse to render, NEVER fall back to the inherited DISPLAY
     * (which on a desktop is the user's real screen :0). Rendering there pops a
     * visible window — exactly the bug this guard prevents.
     */
    getDisplay(): string | undefined {
        if (this.display && this.isAlive()) {
            return this.display;
        }
        return undefined;
    }

    /** Whether the Xvfb binary is on PATH. Public so local-mode setup can offer
     *  to install it when missing, instead of silently failing to a :0 render. */
    isInstalled(): boolean {
        return this.isXvfbInstalled();
    }

    /** PID of the Xvfb we started (for the caller to record per-workspace so a later
     *  session can reap it if this one exits non-gracefully). Undefined if not running. */
    getPid(): number | undefined {
        return this.process?.pid;
    }

    /**
     * SIGTERM a recorded PID only if it is still one of OUR Xvfb servers (matches our
     * geometry via /proc/<pid>/cmdline), then clear its stale X lock so the display frees
     * up for reuse. Safe no-op if the PID is dead, foreign, or /proc is unavailable.
     */
    private reapOurOrphan(pid: number): void {
        const fs = require('fs');
        try {
            const raw: string = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf-8');
            const cmdline = raw.replace(/\0/g, ' ').trim();
            if (!isOurXvfbProcess(cmdline)) {
                return; // not our Xvfb (dead-and-reused, or a foreign process) — never kill
            }
            getLogger().info('Xvfb', 'reaping our orphaned Xvfb from a previous session', { pid });
            try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
            // Best-effort: drop the display's lock file (e.g. /tmp/.X101-lock) if it points at this pid.
            const m = cmdline.match(/(^|\s):(\d+)\b/);
            if (m) {
                const lock = `/tmp/.X${m[2]}-lock`;
                try { if (parseInt(fs.readFileSync(lock, 'utf-8').trim(), 10) === pid) { fs.unlinkSync(lock); } } catch { /* ignore */ }
            }
        } catch {
            // /proc/<pid> gone (already dead) or unreadable → nothing to reap.
        }
    }

    private isXvfbInstalled(): boolean {
        try {
            execSync('which Xvfb', { stdio: 'pipe' });
            return true;
        } catch (err) {
            getLogger().trace('Xvfb', 'Xvfb not installed', { error: String(err) });
            return false;
        }
    }

    private isDisplayInUse(displayNum: number): boolean {
        try {
            // X lock files indicate an active display
            const lockFile = `/tmp/.X${displayNum}-lock`;
            const fs = require('fs');
            if (fs.existsSync(lockFile)) {
                // Verify the PID in the lock file is still alive
                const pid = parseInt(fs.readFileSync(lockFile, 'utf-8').trim(), 10);
                if (!isNaN(pid)) {
                    try {
                        process.kill(pid, 0);
                        return true; // Process is alive, display is in use
                    } catch (err) {
                        getLogger().trace('Xvfb', 'stale lock file', { error: String(err), displayNum });
                        return false;
                    }
                }
            }
            return false;
        } catch (err) {
            getLogger().trace('Xvfb', 'display check failed', { error: String(err) });
            return false;
        }
    }

    private tryStart(display: string): Promise<boolean> {
        const log = getLogger();
        log.debug('Xvfb', 'trying display', { display });
        return new Promise((resolve) => {
            try {
                const child = spawn('Xvfb', [
                    display,
                    '-screen', '0', '2048x2048x24',
                    '-nolisten', 'tcp',
                    '-ac'
                ], {
                    stdio: 'ignore',
                    detached: true,
                });

                // Don't let the child keep the parent alive
                child.unref();

                let exited = false;

                child.on('error', (err) => {
                    log.trace('Xvfb', 'spawn error', { display, error: err.message });
                    exited = true;
                    resolve(false);
                });

                child.on('exit', (code) => {
                    if (!exited) {
                        exited = true;
                        log.trace('Xvfb', 'exited immediately', { display, code });
                        resolve(false);
                    }
                });

                // Wait briefly, then check if the process is still alive
                setTimeout(() => {
                    if (exited) {
                        return; // Already resolved via error/exit handler
                    }

                    if (this.isProcessAlive(child)) {
                        this.process = child;
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, STARTUP_WAIT_MS);
            } catch (err: any) {
                log.trace('Xvfb', 'failed to spawn', { display, error: err.message });
                resolve(false);
            }
        });
    }

    private isAlive(): boolean {
        return this.process !== undefined && this.isProcessAlive(this.process);
    }

    private isProcessAlive(child: ChildProcess): boolean {
        if (!child.pid) {
            return false;
        }
        try {
            process.kill(child.pid, 0);
            return true;
        } catch (err) {
            getLogger().trace('Xvfb', 'process not alive', { error: String(err) });
            return false;
        }
    }
}
