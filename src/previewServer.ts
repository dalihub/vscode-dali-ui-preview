import { ChildProcess, spawn, exec } from 'child_process';
import * as crypto from 'crypto';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildResult } from './buildRunner';
import { SceneNode } from './cppParser';
import { DockerRuntime } from './dockerRuntime';
import { getLogger } from './logger';

const execAsync = promisify(exec);

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
    private readonly serverBin: string;

    constructor(
        private readonly extensionPath: string,
        private readonly daliPrefix: string,
        private readonly display: string,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly tmpDir: string = '/tmp/dali_preview',
        // Docker mode: when both are set, the server runs inside a long-running
        // container instead of as a native host process. The container ships
        // /opt/dali/bin/preview_server pre-built, so ensureServerBinary becomes
        // a no-op and spawnServer launches `docker run -i ...` instead.
        private readonly dockerRuntime?: DockerRuntime,
        private readonly dockerImageTag?: string,
        // Extra host paths to bind-mount into the docker container at the
        // same path. Use this to make user assets (images, fonts) referenced
        // by absolute path in user code visible inside the container.
        private readonly dockerExtraMounts: readonly string[] = [],
    ) {
        this.serverBin = path.join(this.tmpDir, 'preview_server');
    }

    /** True iff this server is configured to run inside a Docker container. */
    get isDockerMode(): boolean {
        return !!(this.dockerRuntime && this.dockerImageTag);
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    get isRunning(): boolean {
        return this.ready && !!this.serverProcess && !this.serverProcess.killed;
    }

    /**
     * Ensure the server binary is compiled. Compiles if missing, or if the
     * source file (server/preview_server.cpp) is newer than the existing
     * binary — this protects against stale binaries after extension updates
     * that change the IPC protocol or scene builder.
     */
    async ensureServerBinary(): Promise<void> {
        if (this.isDockerMode) {
            // The preview_server binary is pre-built inside the docker image
            // at /opt/dali/bin/preview_server. Nothing to compile on the host.
            return;
        }

        const srcPath = path.join(this.extensionPath, 'server', 'preview_server.cpp');
        const binExists = fs.existsSync(this.serverBin);
        const srcExists = fs.existsSync(srcPath);

        if (binExists && srcExists) {
            const binMtime = fs.statSync(this.serverBin).mtimeMs;
            const srcMtime = fs.statSync(srcPath).mtimeMs;
            if (binMtime >= srcMtime) {
                return; // up-to-date
            }
            this.outputChannel.appendLine(
                '[PreviewServer] Source newer than binary — rebuilding to avoid IPC protocol drift.'
            );
        } else if (binExists) {
            return; // source not bundled (e.g. installed .vsix) — trust the existing binary
        }

        const buildScript = path.join(this.extensionPath, 'server', 'build_server.sh');
        if (!fs.existsSync(buildScript)) {
            throw new Error(`build_server.sh not found at ${buildScript}`);
        }

        if (!fs.existsSync(this.tmpDir)) {
            fs.mkdirSync(this.tmpDir, { recursive: true });
        }

        this.outputChannel.appendLine('[PreviewServer] Compiling server binary...');
        try {
            await execAsync(`bash "${buildScript}" "${this.daliPrefix}" "${this.tmpDir}"`, {
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
           bgColor?: string, locale?: string, fontScale?: number, font?: string): Promise<BuildResult> {
        return new Promise((resolve) => {
            if (!this.isRunning || !this.serverProcess) {
                resolve({ success: false, error: 'Preview server is not running' });
                return;
            }

            // H2: Reject paths and optional fields containing whitespace or newlines (IPC injection)
            if (/[\s\n]/.test(soPath) || /[\s\n]/.test(pngPath) || /[\s\n]/.test(metadataPath) ||
                (locale !== undefined && /[\s\n]/.test(locale)) ||
                (font !== undefined && /[\s\n]/.test(font))) {
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

            const colorField = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor) ? bgColor : '-';
            const localeField = locale || '-';
            const fontScaleField = fontScale !== undefined ? String(fontScale) : '-';
            const fontField = font || '-';
            const cmd = `RELOAD ${soPath} ${pngPath} ${metadataPath} ${width} ${height} ${theme} ${colorField} ${localeField} ${fontScaleField} ${fontField}\n`;
            this.serverProcess.stdin!.write(cmd);
        });
    }

    /**
     * Send a RENDER_JSON command. Resolves with BuildResult when server responds.
     * The scene tree is serialised to a unique temp JSON file and passed to the server.
     */
    async renderJson(scene: SceneNode, pngPath: string, metadataPath: string,
                     width: number, height: number, theme: 'light' | 'dark' = 'dark',
                     bgColor?: string): Promise<BuildResult> {
        if (!this.isRunning || !this.serverProcess) {
            return { success: false, error: 'Preview server is not running' };
        }

        if (/[\s\n]/.test(pngPath) || /[\s\n]/.test(metadataPath)) {
            return { success: false, error: 'path contains invalid characters' };
        }

        if (this.pendingRequest) {
            this.pendingRequest.resolve({ success: false, error: 'reload already in progress' });
            this.pendingRequest = undefined;
        }

        // Use a unique temp file per request to avoid race conditions on concurrent calls
        const jsonPath = path.join(this.tmpDir, `scene-${Date.now()}.json`);
        try {
            await fs.promises.mkdir(this.tmpDir, { recursive: true });
            await fs.promises.writeFile(jsonPath, JSON.stringify(scene));
        } catch (err: any) {
            return { success: false, error: `Failed to write scene JSON: ${err.message}` };
        }

        const proc = this.serverProcess;
        return new Promise((resolve) => {
            this.pendingRequest = {
                resolve: (result) => {
                    // Clean up temp JSON file after server has read it
                    fs.promises.unlink(jsonPath).catch(() => {});
                    resolve(result);
                },
                metadataPath,
            };

            const colorField = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor) ? bgColor : '-';
            const cmd = `RENDER_JSON ${jsonPath} ${pngPath} ${metadataPath} ${width} ${height} ${theme} ${colorField}\n`;
            proc.stdin!.write(cmd);
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
        // Deregister container so compilePlugin falls back to docker run.
        if (this.isDockerMode && this.dockerRuntime) {
            this.dockerRuntime.setActiveServerContainer(undefined);
        }
        if (this.serverProcess) {
            try {
                this.serverProcess.kill('SIGTERM');
            } catch (err) {
                getLogger().trace('Server', 'server kill already dead', { error: String(err) });
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

    /**
     * Returns the [command, args] pair for spawning the server process.
     *
     * Native mode: the locally-compiled preview_server binary, no args.
     * Docker mode: `docker run -i --rm` against the runtime image, with
     *   - the host tmpDir bind-mounted at the same path so all paths in
     *     IPC commands (soPath, pngPath, jsonPath...) resolve identically
     *     inside the container — no path translation needed.
     *   - persistent named volumes for ccache and the DALi shader cache so
     *     repeated previews avoid recompiling shaders/objects.
     */
    /**
     * Deterministic container name derived from the workspace tmpDir hash.
     * Same workspace → same container name across reloads, which lets us
     * `docker rm -f` any stale container before starting a new one.
     */
    private dockerContainerName(): string {
        const hash = crypto.createHash('md5').update(this.tmpDir).digest('hex').slice(0, 12);
        return `dali-preview-server-${hash}`;
    }

    private buildSpawnCommand(): [string, string[]] {
        if (this.isDockerMode) {
            const imageRef = this.dockerRuntime!.imageRef(this.dockerImageTag!);
            const containerName = this.dockerContainerName();
            // Build the -v flags for the workspace and any extra mounts so
            // absolute paths in user code (image assets, fonts) resolve
            // identically inside the container.
            const extraMountFlags: string[] = [];
            for (const mountPath of this.dockerExtraMounts) {
                if (mountPath && mountPath !== this.tmpDir) {
                    extraMountFlags.push('-v', `${mountPath}:${mountPath}:ro`);
                }
            }
            const args = [
                'run', '-i', '--rm',
                '--init',
                '--name', containerName,
                '-v', `${this.tmpDir}:${this.tmpDir}`,
                '-v', 'dali-preview-shader-cache:/root/.cache/dali_common_caches',
                '-v', 'dali-preview-ccache:/cache',
                ...extraMountFlags,
                '-e', 'DALI_WINDOW_WIDTH=1024',
                '-e', 'DALI_WINDOW_HEIGHT=600',
                // Silence the EFL/eldbus stderr deluge. Without these env vars,
                // every failed D-Bus connect (which happens many times per
                // render in headless containers) emits a 30-line eina_btlog
                // backtrace and floods the Output channel.
                '-e', 'EINA_LOG_BACKTRACE=disabled',
                '-e', 'EINA_LOG_LEVELS=eldbus:0,eina_safety:0,eina_log:0',
                // Force mesa software path multi-threaded — without this,
                // llvmpipe defaults can leave most cores idle on big renders
                // (e.g. 2520x4480 phone-style preview drops from ~500ms to
                // ~100ms when all CPU cores are used).
                '-e', 'LP_NUM_THREADS=0',
                '-e', 'GALLIUM_DRIVER=llvmpipe',
                '--entrypoint', '/usr/local/bin/dali-preview-serve',
                imageRef,
            ];
            return ['docker', args];
        }
        return [this.serverBin, []];
    }

    /**
     * Filter container stderr noise — eldbus / eina_safety backtraces are
     * harmless in headless mode but enormous. Anything that looks like
     * library backtrace garbage gets dropped silently. Real ERROR/WARN
     * lines from DALi (which don't match these patterns) still pass.
     */
    private static isStderrNoise(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed) return true;
        // eldbus / eina backtrace markers
        if (/^##\s*Copy & Paste/.test(trimmed)) return true;
        if (/^eina_btlog\s*<<\s*EOF/.test(trimmed)) return true;
        if (/^EOF$/.test(trimmed)) return true;
        // Backtrace lines look like:  /path/to/lib.so<TAB>0xhex 0xhex
        if (/^\/.*\.so[.\d]*\s+0x[0-9a-f]+\s+0x[0-9a-f]+$/.test(trimmed)) return true;
        if (/^\/.*\/(preview_server|preview_bin|dali-preview)[^\s]*\s+0x[0-9a-f]+\s+0x[0-9a-f]+$/.test(trimmed)) return true;
        // EFL safety / log domain spam (we silenced via env, this is belt-and-suspenders)
        if (/^(ERR|CRI|WRN|DBG)<\d+>:(eldbus|eina_safety|eina_log|ecore_system_upower|ecore_system_systemd)\s/.test(trimmed)) return true;
        // Xlib stub messages we can't fix in headless
        if (/^Xlib:\s+extension/.test(trimmed)) return true;
        return false;
    }

    /**
     * Filter container stdout — DALi prints verbose INFO logs on every
     * render that drown the Output channel. Keep IPC lines (>>>...),
     * [ServerPerf] markers, and genuine errors; drop the rest.
     */
    private static isStdoutNoise(line: string): boolean {
        const stripped = PreviewServer.stripAnsi(line).trim();
        if (!stripped) return true;
        // Always show IPC and perf markers
        if (stripped.startsWith('>>>')) return false;
        if (stripped.startsWith('[ServerPerf]')) return false;
        // DALi INFO/DEBUG lines (most of the noise)
        if (/^INFO:\s*DALI:/.test(stripped)) return true;
        if (/^DEBUG:\s*DALI:/.test(stripped)) return true;
        // Recurring D-Bus / accessibility complaints — harmless in headless
        if (/^ERROR:\s*DALI:.*(dbus|Accessibility|DBusClient)/i.test(stripped)) return true;
        // Plain DALi continuation lines (no level prefix, comes from file:line: pattern)
        if (/^[a-z0-9_-]+\.cpp:\s+\w+\(\d+\)\s+>/.test(stripped)) return true;
        // ANSI reset-only lines
        if (/^\[\d+m$/.test(stripped)) return true;
        return false;
    }

    private spawnServer(): Promise<boolean> {
        return new Promise((resolve) => {
            const env: NodeJS.ProcessEnv = this.isDockerMode
                ? { ...process.env }  // docker run carries its own env via -e flags
                : {
                    ...process.env,
                    DISPLAY: this.display,
                    LD_LIBRARY_PATH: `${this.daliPrefix}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
                    DALI_WINDOW_WIDTH: '1024',
                    DALI_WINDOW_HEIGHT: '600',
                };

            // Kill any stale container with the same name (e.g. from a
            // previous extension session that crashed before --rm could clean up).
            if (this.isDockerMode) {
                const containerName = this.dockerContainerName();
                try {
                    require('child_process').execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
                } catch { /* container may not exist; ignore */ }
            }

            const [cmd, args] = this.buildSpawnCommand();
            const proc = this._spawn(cmd, args, {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.serverProcess = proc;
            this.stdoutBuffer  = '';

            const spawnTime = Date.now();
            const modeLabel = this.isDockerMode ? `docker (${this.dockerRuntime!.imageRef(this.dockerImageTag!)})` : `native (DISPLAY=${env.DISPLAY})`;
            this.outputChannel.appendLine(`[PreviewServer] Spawned PID=${proc.pid}, mode=${modeLabel}, timeout=${READY_TIMEOUT_MS}ms`);

            const readyTimer = setTimeout(() => {
                if (!this.ready) {
                    const elapsed = Date.now() - spawnTime;
                    this.outputChannel.appendLine(`[PreviewServer] Timed out waiting for READY after ${elapsed}ms (buffer: "${this.stdoutBuffer.slice(0, 200)}")`);
                    proc.kill('SIGTERM');
                    resolve(false);
                }
            }, READY_TIMEOUT_MS);

            // Display buffers — accumulate fragments until we have complete
            // lines, then filter and echo. Without this, a single line split
            // across two `data` events (e.g. when DALi prints a long ANSI-
            // colored ERROR line that docker happens to chunk in the middle)
            // bypasses isStdoutNoise / isStderrNoise because each fragment
            // looks like its own "line" to the filter.
            //
            // The full raw text still feeds this.stdoutBuffer for IPC parsing
            // — only the user-visible echo is line-buffered.
            const displayBuf = { stdout: '', stderr: '' };

            const flushDisplayBuffer = (which: 'stdout' | 'stderr',
                                        noiseFilter: (line: string) => boolean) => {
                const buf = displayBuf[which];
                const lastNewline = buf.lastIndexOf('\n');
                if (lastNewline < 0) {
                    return; // no complete line yet, keep buffering
                }
                const complete = buf.slice(0, lastNewline);
                displayBuf[which] = buf.slice(lastNewline + 1);
                const meaningful = complete.split('\n')
                    .filter((line) => !noiseFilter(line))
                    .join('\n')
                    .trimEnd();
                if (meaningful) {
                    this.outputChannel.appendLine(`[Server ${which}] ${meaningful}`);
                }
            };

            proc.stdout!.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                displayBuf.stdout += text;
                flushDisplayBuffer('stdout', PreviewServer.isStdoutNoise);
                // Full text always feeds IPC parser regardless of display buffering.
                this.stdoutBuffer += text;
                this.processStdoutBuffer(readyTimer, resolve);
            });

            proc.stderr!.on('data', (chunk: Buffer) => {
                displayBuf.stderr += chunk.toString();
                flushDisplayBuffer('stderr', PreviewServer.isStderrNoise);
            });

            proc.on('exit', (code) => {
                this.outputChannel.appendLine(`[PreviewServer] Process exited (code=${code})`);
                this.ready = false;
                this.serverProcess = undefined;
                if (this.isDockerMode && this.dockerRuntime) {
                    this.dockerRuntime.setActiveServerContainer(undefined);
                }

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

    /** Strip ANSI escape sequences (e.g. \x1b[0m) that DALi logs may inject into stdout. */
    private static stripAnsi(s: string): string {
        // eslint-disable-next-line no-control-regex
        return s.replace(/\x1b\[[0-9;]*m/g, '');
    }

    private processStdoutBuffer(readyTimer: NodeJS.Timeout, readyResolve?: (v: boolean) => void) {
        let newlineIdx: number;
        while ((newlineIdx = this.stdoutBuffer.indexOf('\n')) !== -1) {
            const raw = this.stdoutBuffer.slice(0, newlineIdx).trimEnd();
            this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);

            const line = PreviewServer.stripAnsi(raw);

            // Server IPC lines use ">>>" prefix to distinguish from DALi runtime log noise.
            if (line === '>>>READY') {
                this.ready        = true;
                this.restartCount = 0;
                clearTimeout(readyTimer);
                // Register container with DockerRuntime so compilePlugin can
                // use `docker exec` against the running container instead of
                // spawning a fresh one (saves ~300-500ms per compile).
                if (this.isDockerMode && this.dockerRuntime) {
                    this.dockerRuntime.setActiveServerContainer(this.dockerContainerName());
                }
                this.outputChannel.appendLine('[PreviewServer] Ready.');
                readyResolve?.(true);

            } else if (line.startsWith('>>>OK:')) {
                const pngPath = line.slice(6);
                if (this.pendingRequest) {
                    const { resolve, metadataPath } = this.pendingRequest;
                    this.pendingRequest = undefined;
                    resolve({ success: true, pngPath, metadataPath });
                }

            } else if (line.startsWith('>>>ERROR:')) {
                const msg = line.slice(9);
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
