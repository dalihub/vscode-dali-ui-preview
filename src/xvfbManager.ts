import { spawn, execSync, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { getLogger } from './logger';

const CANDIDATE_DISPLAYS = [99, 98, 97];
const STARTUP_WAIT_MS = 500;

export class XvfbManager {
    private process: ChildProcess | undefined;
    private display: string | undefined;

    /**
     * Start an Xvfb virtual display. Tries display :99, :98, :97.
     * Returns true if Xvfb was started successfully.
     */
    async start(): Promise<boolean> {
        const log = getLogger();
        log.info('Xvfb', 'starting virtual display');
        if (this.process && this.isAlive()) {
            return true;
        }

        if (!this.isXvfbInstalled()) {
            vscode.window.showWarningMessage(
                'Xvfb is not installed. Install it with: sudo apt install xvfb'
            );
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

        vscode.window.showWarningMessage(
            'Failed to start Xvfb: all candidate displays (:99, :98, :97) are in use or failed to start.'
        );
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
     * Returns the Xvfb display string if running, or falls back to the
     * DISPLAY environment variable.
     */
    getDisplay(): string {
        if (this.display && this.isAlive()) {
            return this.display;
        }
        return process.env.DISPLAY || ':0';
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
                    console.error(`Xvfb spawn error on ${display}: ${err.message}`);
                    exited = true;
                    resolve(false);
                });

                child.on('exit', (code) => {
                    if (!exited) {
                        exited = true;
                        console.error(`Xvfb exited immediately on ${display} with code ${code}`);
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
                console.error(`Failed to spawn Xvfb on ${display}: ${err.message}`);
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
