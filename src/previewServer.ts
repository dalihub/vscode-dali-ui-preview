import { ChildProcess, spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildResult } from './buildRunner';

const execAsync = promisify(exec);

const SERVER_BIN = '/tmp/dali_preview/preview_server';
const MAX_RESTARTS = 3;
const READY_TIMEOUT_MS = 15000;

interface PendingRequest {
    resolve: (result: BuildResult) => void;
    metadataPath: string;
}

export class PreviewServer {
    private serverProcess: ChildProcess | undefined;
    private ready = false;
    private restartCount = 0;
    private pendingRequest: PendingRequest | undefined;
    private stdoutBuffer = '';
    private restartTimer: NodeJS.Timeout | undefined;

    constructor(
        private readonly extensionPath: string,
        private readonly daliPrefix: string,
        private readonly display: string,
        private readonly outputChannel: vscode.OutputChannel,
    ) {}

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    get isRunning(): boolean {
        return this.ready && !!this.serverProcess && !this.serverProcess.killed;
    }

    /**
     * Ensure the server binary is compiled. Compiles only if missing or stale.
     */
    async ensureServerBinary(): Promise<void> {
        if (fs.existsSync(SERVER_BIN)) {
            return;
        }

        const buildScript = path.join(this.extensionPath, 'server', 'build_server.sh');
        if (!fs.existsSync(buildScript)) {
            throw new Error(`build_server.sh not found at ${buildScript}`);
        }

        const tmpDir = '/tmp/dali_preview';
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        this.outputChannel.appendLine('[PreviewServer] Compiling server binary (one-time)...');
        try {
            await execAsync(`bash "${buildScript}" "${this.daliPrefix}"`, {
                timeout: 60000,
                env: {
                    ...process.env,
                    LD_LIBRARY_PATH: `${this.daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
                },
            });
            this.outputChannel.appendLine('[PreviewServer] Server binary compiled.');
        } catch (err: any) {
            const msg = err.stderr?.toString() || err.message || 'unknown';
            throw new Error(`Failed to compile preview server: ${msg}`);
        }
    }

    /**
     * Start the server process and wait for READY signal.
     */
    async start(): Promise<boolean> {
        if (this.isRunning) {
            return true;
        }

        try {
            await this.ensureServerBinary();
        } catch (err: any) {
            this.outputChannel.appendLine(`[PreviewServer] ${err.message}`);
            return false;
        }

        return this.spawnServer();
    }

    /**
     * Send a RELOAD command. Resolves with BuildResult when server responds.
     */
    reload(soPath: string, pngPath: string, metadataPath: string,
           width: number, height: number, theme: 'light' | 'dark' = 'dark',
           bgColor?: string): Promise<BuildResult> {
        return new Promise((resolve) => {
            if (!this.isRunning || !this.serverProcess) {
                resolve({ success: false, error: 'Preview server is not running' });
                return;
            }

            // H2: Reject paths containing whitespace or newlines (IPC injection)
            if (/[\s\n]/.test(soPath) || /[\s\n]/.test(pngPath) || /[\s\n]/.test(metadataPath)) {
                resolve({ success: false, error: 'path contains invalid characters' });
                return;
            }

            // H1: Reject any in-flight reload before starting a new one
            if (this.pendingRequest) {
                this.pendingRequest.resolve({ success: false, error: 'reload already in progress' });
                this.pendingRequest = undefined;
            }

            // H5: Store metadataPath in pendingRequest to avoid .png → _metadata.json derivation
            this.pendingRequest = { resolve, metadataPath };

            const colorField = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor) ? ` ${bgColor}` : '';
            const cmd = `RELOAD ${soPath} ${pngPath} ${metadataPath} ${width} ${height} ${theme}${colorField}\n`;
            this.serverProcess.stdin!.write(cmd);
        });
    }

    /** Terminate the server process. */
    stop(): void {
        this.ready = false;
        // H3: Cancel any pending restart timer to avoid ghost processes
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = undefined;
        }
        if (this.serverProcess) {
            try {
                this.serverProcess.kill('SIGTERM');
            } catch {
                // already dead
            }
            this.serverProcess = undefined;
        }
    }

    // -----------------------------------------------------------------------
    // Internal — process management
    // -----------------------------------------------------------------------

    /** Overridable in tests to inject a fake child process. */
    protected _spawn(cmd: string, args: string[], opts: object): ChildProcess {
        return spawn(cmd, args, opts as any);
    }

    private spawnServer(): Promise<boolean> {
        return new Promise((resolve) => {
            const env: NodeJS.ProcessEnv = {
                ...process.env,
                DISPLAY: this.display,
                LD_LIBRARY_PATH: `${this.daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
                DALI_WINDOW_WIDTH: '1024',
                DALI_WINDOW_HEIGHT: '600',
            };

            const proc = this._spawn(SERVER_BIN, [], {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.serverProcess = proc;
            this.stdoutBuffer  = '';

            const readyTimer = setTimeout(() => {
                if (!this.ready) {
                    this.outputChannel.appendLine('[PreviewServer] Timed out waiting for READY');
                    proc.kill('SIGTERM');
                    resolve(false);
                }
            }, READY_TIMEOUT_MS);

            proc.stdout!.on('data', (chunk: Buffer) => {
                this.stdoutBuffer += chunk.toString();
                this.processStdoutBuffer(readyTimer, resolve);
            });

            proc.stderr!.on('data', (chunk: Buffer) => {
                this.outputChannel.appendLine(`[Server stderr] ${chunk.toString().trimEnd()}`);
            });

            proc.on('exit', (code) => {
                this.outputChannel.appendLine(`[PreviewServer] Process exited (code=${code})`);
                this.ready = false;
                this.serverProcess = undefined;

                // Reject any in-flight request
                if (this.pendingRequest) {
                    this.pendingRequest.resolve({ success: false, error: 'Server process exited unexpectedly' });
                    this.pendingRequest = undefined;
                }

                // Auto-restart unless explicitly stopped or max restarts exceeded
                if (this.restartCount < MAX_RESTARTS) {
                    this.restartCount++;
                    this.outputChannel.appendLine(
                        `[PreviewServer] Restarting (attempt ${this.restartCount}/${MAX_RESTARTS})...`
                    );
                    // H3: Store handle so stop() can cancel this timer
                    this.restartTimer = setTimeout(() => {
                        this.restartTimer = undefined;
                        this.spawnServer().catch(() => {});
                    }, 500);
                } else {
                    this.outputChannel.appendLine('[PreviewServer] Max restarts reached, giving up');
                }
            });

            proc.on('error', (err) => {
                // H4: Clear ready timer to avoid duplicate resolve(false) calls
                clearTimeout(readyTimer);
                this.outputChannel.appendLine(`[PreviewServer] Spawn error: ${err.message}`);
                resolve(false);
            });
        });
    }

    private processStdoutBuffer(readyTimer: NodeJS.Timeout, readyResolve?: (v: boolean) => void) {
        let newlineIdx: number;
        while ((newlineIdx = this.stdoutBuffer.indexOf('\n')) !== -1) {
            const line = this.stdoutBuffer.slice(0, newlineIdx).trimEnd();
            this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);

            if (line === 'READY') {
                this.ready        = true;
                this.restartCount = 0;
                clearTimeout(readyTimer);
                this.outputChannel.appendLine('[PreviewServer] Ready.');
                readyResolve?.(true);

            } else if (line.startsWith('OK:')) {
                const pngPath = line.slice(3);
                if (this.pendingRequest) {
                    const { resolve, metadataPath } = this.pendingRequest;
                    this.pendingRequest = undefined;
                    resolve({ success: true, pngPath, metadataPath });
                }

            } else if (line.startsWith('ERROR:')) {
                const msg = line.slice(6);
                if (this.pendingRequest) {
                    const { resolve } = this.pendingRequest;
                    this.pendingRequest = undefined;
                    resolve({ success: false, error: msg });
                } else {
                    this.outputChannel.appendLine(`[PreviewServer] Error: ${msg}`);
                }
            }
        }
    }
}
