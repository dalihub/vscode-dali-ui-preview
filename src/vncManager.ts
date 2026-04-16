import { spawn, execSync, ChildProcess } from 'child_process';
import * as net from 'net';
import * as vscode from 'vscode';
import { getLogger } from './logger';

export interface VncStartParams {
    daliBinaryPath: string;
    display: string;
    width: number;
    height: number;
    env: NodeJS.ProcessEnv;
}

export interface VncStartResult {
    success: boolean;
    wsUrl?: string;
    error?: string;
}

const VNC_PORT_RANGE_START = 5900;
const VNC_PORT_RANGE_END = 5910;
const WS_PORT_RANGE_START = 6080;
const WS_PORT_RANGE_END = 6090;
const VNC_DISPLAY_CANDIDATES = [96, 95, 94];
const PROCESS_STARTUP_WAIT_MS = 800;
const XVFB_STARTUP_WAIT_MS = 500;
const DALI_READY_TIMEOUT_MS = 8000;

export class VncManager {
    private x11vncProcess: ChildProcess | undefined;
    private websockifyProcess: ChildProcess | undefined;
    private daliAppProcess: ChildProcess | undefined;
    private vncXvfbProcess: ChildProcess | undefined;
    private vncDisplay: string | undefined;
    private actualWindowWidth: number = 0;
    private actualWindowHeight: number = 0;
    private vncPort: number = VNC_PORT_RANGE_START;
    private wsPort: number = WS_PORT_RANGE_START;
    private _isRunning = false;
    private _restarting = false;
    onDaliAppExitCallback: (() => void) | undefined;

    constructor(private outputChannel: vscode.OutputChannel) {}

    get isRunning(): boolean {
        return this._isRunning;
    }

    getWebSocketUrl(): string {
        return `ws://localhost:${this.wsPort}`;
    }

    /**
     * Checks that x11vnc and websockify are installed.
     * Returns the name of the first missing binary, or null if all found.
     */
    static checkDependencies(): string | null {
        for (const bin of ['x11vnc', 'websockify']) {
            try {
                execSync(`which ${bin}`, { stdio: 'pipe' });
            } catch (err) {
                getLogger().trace('VNC', 'dependency not found', { bin, error: String(err) });
                return bin;
            }
        }
        return null;
    }

    /**
     * Starts the interactive VNC session:
     * 1. Spawn DALi app (long-running event loop)
     * 2. Start x11vnc on the same display
     * 3. Start websockify to bridge WS ↔ TCP
     */
    async startInteractiveMode(params: VncStartParams): Promise<VncStartResult> {
        if (this._isRunning) {
            await this.stopInteractiveMode();
        }

        const missing = VncManager.checkDependencies();
        if (missing) {
            const msg = `'${missing}' is not installed. Install with: sudo apt install ${missing === 'websockify' ? 'websockify' : 'x11vnc'}`;
            vscode.window.showWarningMessage(`DALi Interactive Mode: ${msg}`);
            return { success: false, error: msg };
        }

        // Find available ports
        this.vncPort = await this.findAvailablePort(VNC_PORT_RANGE_START, VNC_PORT_RANGE_END);
        if (this.vncPort === -1) {
            return { success: false, error: 'No available VNC port in range 5900-5910' };
        }
        this.wsPort = await this.findAvailablePort(WS_PORT_RANGE_START, WS_PORT_RANGE_END);
        if (this.wsPort === -1) {
            return { success: false, error: 'No available WebSocket port in range 6080-6090' };
        }

        // Step 0: Start dedicated Xvfb (large enough for DPI-scaled DALi window)
        const vncDisplay = await this.startVncXvfb(4096, 4096);
        if (!vncDisplay) {
            return { success: false, error: 'Failed to start VNC Xvfb display' };
        }
        const vncParams: VncStartParams = {
            ...params,
            display: vncDisplay,
            env: { ...params.env, DISPLAY: vncDisplay },
        };

        // Step 1: Spawn DALi app on the VNC display
        const daliStarted = await this.spawnDaliApp(vncParams);
        if (!daliStarted) {
            this.killVncXvfb();
            return { success: false, error: 'Failed to start DALi interactive app' };
        }

        // Step 2: Start x11vnc clipped to the actual DALi window size
        const clipW = this.actualWindowWidth || params.width;
        const clipH = this.actualWindowHeight || params.height;
        const x11vncStarted = await this.startX11vnc(vncDisplay, clipW, clipH);
        if (!x11vncStarted) {
            this.killDaliApp();
            this.killVncXvfb();
            return { success: false, error: 'Failed to start x11vnc' };
        }

        // Step 3: Start websockify
        const websockifyStarted = await this.startWebsockify();
        if (!websockifyStarted) {
            this.killDaliApp();
            this.killX11vnc();
            this.killVncXvfb();
            return { success: false, error: 'Failed to start websockify' };
        }

        this._isRunning = true;
        const wsUrl = this.getWebSocketUrl();
        this.outputChannel.appendLine(`[VncManager] Interactive mode started: VNC :${this.vncPort}, WS :${this.wsPort}`);
        return { success: true, wsUrl };
    }

    /**
     * Stops all VNC-related processes.
     */
    async stopInteractiveMode(): Promise<void> {
        this._isRunning = false;
        this.killDaliApp();
        this.killX11vnc();
        this.killWebsockify();
        this.killVncXvfb();
        this.outputChannel.appendLine('[VncManager] Interactive mode stopped');
    }

    /**
     * Restarts only the DALi app with a new binary (hot reload).
     * x11vnc and websockify stay running — same display, new process.
     */
    async restartDaliApp(newBinaryPath: string, params: Omit<VncStartParams, 'daliBinaryPath'>): Promise<boolean> {
        this.outputChannel.appendLine('[VncManager] Hot-reloading DALi app...');
        this._restarting = true;
        this.killDaliApp();
        const display = this.vncDisplay || params.display;
        const result = await this.spawnDaliApp({
            ...params,
            daliBinaryPath: newBinaryPath,
            display,
            env: { ...params.env, DISPLAY: display },
        });
        this._restarting = false;
        return result;
    }

    dispose(): void {
        this.stopInteractiveMode().catch(() => {
            // best-effort cleanup
        });
    }

    // ---- Private helpers ----

    private async spawnDaliApp(params: VncStartParams): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const child = spawn(params.daliBinaryPath, [], {
                    env: params.env,
                    stdio: ['ignore', 'pipe', 'pipe'],
                });

                let readyReceived = false;
                let stdoutBuf = '';

                child.stdout?.on('data', (data: Buffer) => {
                    stdoutBuf += data.toString();
                    const lines = stdoutBuf.split('\n');
                    stdoutBuf = lines.pop() ?? '';
                    for (const line of lines) {
                        this.outputChannel.appendLine(`[DALi-VNC] ${line}`);
                        if (!readyReceived && line.includes('READY')) {
                            readyReceived = true;
                            const match = line.match(/READY\s+(\d+)\s+(\d+)/);
                            if (match) {
                                this.actualWindowWidth = parseInt(match[1], 10);
                                this.actualWindowHeight = parseInt(match[2], 10);
                                this.outputChannel.appendLine(`[VncManager] DALi actual window: ${this.actualWindowWidth}x${this.actualWindowHeight}`);
                            }
                            resolve(true);
                        }
                    }
                });

                child.stderr?.on('data', (data: Buffer) => {
                    this.outputChannel.appendLine(`[DALi-VNC stderr] ${data.toString().trim()}`);
                });

                child.on('error', (err) => {
                    this.outputChannel.appendLine(`[VncManager] DALi app spawn error: ${err.message}`);
                    resolve(false);
                });

                child.on('exit', (code) => {
                    this.outputChannel.appendLine(`[VncManager] DALi app exited with code ${code}`);
                    if (this._isRunning && !this._restarting) {
                        this._isRunning = false;
                        this.killX11vnc();
                        this.killWebsockify();
                        this.killVncXvfb();
                        this.onDaliAppExitCallback?.();
                    }
                    if (!readyReceived) {
                        resolve(false);
                    }
                });

                this.daliAppProcess = child;

                // Timeout fallback: if no READY signal, assume started after delay
                setTimeout(() => {
                    if (!readyReceived && this.isProcessAlive(child)) {
                        readyReceived = true;
                        resolve(true);
                    } else if (!readyReceived) {
                        resolve(false);
                    }
                }, DALI_READY_TIMEOUT_MS);

            } catch (err: any) {
                this.outputChannel.appendLine(`[VncManager] Failed to spawn DALi app: ${err.message}`);
                resolve(false);
            }
        });
    }

    private async startX11vnc(display: string, clipW: number, clipH: number): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const args = [
                    '-display', display,
                    '-rfbport', String(this.vncPort),
                    '-clip', `${clipW}x${clipH}+0+0`,
                    '-localhost',
                    '-nopw',
                    '-shared',
                    '-forever',
                    '-noxdamage',
                    '-quiet',
                ];

                const child = spawn('x11vnc', args, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: false,
                });

                let started = false;

                child.stdout?.on('data', (data: Buffer) => {
                    const text = data.toString();
                    this.outputChannel.appendLine(`[x11vnc] ${text.trim()}`);
                    if (!started && (text.includes('PORT=') || text.includes('listening'))) {
                        started = true;
                        resolve(true);
                    }
                });

                child.stderr?.on('data', (data: Buffer) => {
                    const text = data.toString();
                    this.outputChannel.appendLine(`[x11vnc] ${text.trim()}`);
                    if (!started && text.includes('PORT=')) {
                        started = true;
                        resolve(true);
                    }
                });

                child.on('error', (err) => {
                    this.outputChannel.appendLine(`[VncManager] x11vnc error: ${err.message}`);
                    resolve(false);
                });

                child.on('exit', (code) => {
                    if (!started) {
                        this.outputChannel.appendLine(`[VncManager] x11vnc exited early with code ${code}`);
                        resolve(false);
                    }
                });

                this.x11vncProcess = child;

                // Wait for startup
                setTimeout(() => {
                    if (!started && this.isProcessAlive(child)) {
                        started = true;
                        resolve(true);
                    } else if (!started) {
                        resolve(false);
                    }
                }, PROCESS_STARTUP_WAIT_MS);

            } catch (err: any) {
                this.outputChannel.appendLine(`[VncManager] Failed to spawn x11vnc: ${err.message}`);
                resolve(false);
            }
        });
    }

    private async startWebsockify(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const args = [
                    `127.0.0.1:${this.wsPort}`,
                    `127.0.0.1:${this.vncPort}`,
                ];

                const child = spawn('websockify', args, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: false,
                });

                let started = false;

                child.stdout?.on('data', (data: Buffer) => {
                    this.outputChannel.appendLine(`[websockify] ${data.toString().trim()}`);
                });

                child.stderr?.on('data', (data: Buffer) => {
                    const text = data.toString();
                    this.outputChannel.appendLine(`[websockify] ${text.trim()}`);
                    if (!started && (text.includes('listening') || text.includes('handler'))) {
                        started = true;
                        resolve(true);
                    }
                });

                child.on('error', (err) => {
                    this.outputChannel.appendLine(`[VncManager] websockify error: ${err.message}`);
                    resolve(false);
                });

                child.on('exit', (code) => {
                    if (!started) {
                        this.outputChannel.appendLine(`[VncManager] websockify exited early with code ${code}`);
                        resolve(false);
                    }
                });

                this.websockifyProcess = child;

                // Startup delay fallback
                setTimeout(() => {
                    if (!started && this.isProcessAlive(child)) {
                        started = true;
                        resolve(true);
                    } else if (!started) {
                        resolve(false);
                    }
                }, PROCESS_STARTUP_WAIT_MS);

            } catch (err: any) {
                this.outputChannel.appendLine(`[VncManager] Failed to spawn websockify: ${err.message}`);
                resolve(false);
            }
        });
    }

    private async startVncXvfb(width: number, height: number): Promise<string | null> {
        const fs = require('fs');
        for (const displayNum of VNC_DISPLAY_CANDIDATES) {
            const display = `:${displayNum}`;
            const lockFile = `/tmp/.X${displayNum}-lock`;
            if (fs.existsSync(lockFile)) {
                try {
                    const pid = parseInt(fs.readFileSync(lockFile, 'utf-8').trim(), 10);
                    if (!isNaN(pid)) {
                        process.kill(pid, 0);
                        continue;
                    }
                } catch (err) { getLogger().trace('VNC', 'stale lock file', { error: String(err) }); }
            }
            const started = await this.tryStartXvfb(display, width, height);
            if (started) {
                this.vncDisplay = display;
                this.outputChannel.appendLine(`[VncManager] VNC Xvfb started on ${display} at ${width}x${height}`);
                return display;
            }
        }
        return null;
    }

    private tryStartXvfb(display: string, width: number, height: number): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const child = spawn('Xvfb', [
                    display,
                    '-screen', '0', `${width}x${height}x24`,
                    '-nolisten', 'tcp',
                    '-ac',
                ], {
                    stdio: 'ignore',
                    detached: false,
                });

                let exited = false;
                child.on('error', () => { exited = true; resolve(false); });
                child.on('exit', () => { if (!exited) { exited = true; resolve(false); } });

                setTimeout(() => {
                    if (!exited && child.pid) {
                        try { process.kill(child.pid, 0); this.vncXvfbProcess = child; resolve(true); }
                        catch (err) { getLogger().trace('VNC', 'xvfb process not alive', { error: String(err) }); resolve(false); }
                    } else if (!exited) { resolve(false); }
                }, XVFB_STARTUP_WAIT_MS);
            } catch (err) {
                getLogger().trace('VNC', 'xvfb spawn failed', { error: String(err) });
                resolve(false);
            }
        });
    }

    private killVncXvfb(): void {
        if (this.vncXvfbProcess) {
            try { this.vncXvfbProcess.kill('SIGTERM'); } catch (err) { getLogger().trace('VNC', 'killVncXvfb already dead', { error: String(err) }); }
            this.vncXvfbProcess = undefined;
            this.vncDisplay = undefined;
        }
    }

    private killDaliApp(): void {
        if (this.daliAppProcess) {
            try {
                this.daliAppProcess.kill('SIGTERM');
            } catch (err) { getLogger().trace('VNC', 'killDaliApp already dead', { error: String(err) }); }
            this.daliAppProcess = undefined;
        }
    }

    private killX11vnc(): void {
        if (this.x11vncProcess) {
            try {
                this.x11vncProcess.kill('SIGTERM');
            } catch (err) { getLogger().trace('VNC', 'killX11vnc already dead', { error: String(err) }); }
            this.x11vncProcess = undefined;
        }
    }

    private killWebsockify(): void {
        if (this.websockifyProcess) {
            try {
                this.websockifyProcess.kill('SIGTERM');
            } catch (err) { getLogger().trace('VNC', 'killWebsockify already dead', { error: String(err) }); }
            this.websockifyProcess = undefined;
        }
    }

    private isProcessAlive(child: ChildProcess): boolean {
        if (!child.pid) {
            return false;
        }
        try {
            process.kill(child.pid, 0);
            return true;
        } catch (err) {
            getLogger().trace('VNC', 'process not alive', { error: String(err) });
            return false;
        }
    }

    /**
     * Finds an available TCP port in [start, end].
     * Returns -1 if none found.
     */
    static findAvailablePort(start: number, end: number): Promise<number> {
        return new Promise((resolve) => {
            let current = start;

            const tryNext = () => {
                if (current > end) {
                    resolve(-1);
                    return;
                }
                const port = current++;
                const server = net.createServer();
                server.listen(port, '127.0.0.1', () => {
                    server.close(() => resolve(port));
                });
                server.on('error', () => {
                    tryNext();
                });
            };

            tryNext();
        });
    }

    private findAvailablePort(start: number, end: number): Promise<number> {
        return VncManager.findAvailablePort(start, end);
    }
}
