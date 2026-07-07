import { ChildProcess, spawn, exec } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildResult } from './buildRunner';
import { SceneNode } from './cppParser';
import { DockerRuntime } from './dockerRuntime';
import { getLogger } from './logger';

const MAX_RESTARTS = 3;
const READY_TIMEOUT_MS = 15000;

/** pkg-config modules the native preview_server links against. */
const DALI_PKG_MODULES = 'dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0';

/**
 * Local (native) preview-server configuration. When provided, PreviewServer
 * compiles `docker/preview_server.cpp` against the host DALi prefix and spawns
 * the resulting binary under Xvfb — instead of running the container image.
 */
export interface LocalServerConfig {
    /** Local DALi install prefix (contains lib/ and include/). */
    daliPrefix: string;
    /** Xvfb display string the server renders into, e.g. ':99'. */
    display: string;
    /** Path to the bundled preview_server C++ source. */
    serverSrcPath: string;
    /** Host path to build/cache the native server binary. */
    serverBinPath: string;
}

interface PendingRequest {
    resolve: (result: BuildResult) => void;
    metadataPath: string;
}

export class PreviewServer {
    private serverProcess: ChildProcess | undefined;
    private ready = false;
    private restartCount = 0;
    private pendingRequest: PendingRequest | undefined;
    private pendingAnimInfo: { count: number; durationMs: number } | undefined;
    private stdoutBuffer = '';
    private restartTimer: NodeJS.Timeout | undefined;
    /** Set by stop() so the process 'exit' handler (which SIGTERM itself fires) does NOT
     *  auto-restart — otherwise an intentionally-stopped server resurrects as an orphan. */
    private stopping = false;

    constructor(
        private readonly extensionPath: string,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly tmpDir: string = '/tmp/dali_preview',
        // The server always runs inside a long-running container. The container
        // ships /opt/dali/bin/preview_server pre-built, so ensureServerBinary is
        // a no-op and spawnServer launches `docker run -i ...`.
        private readonly dockerRuntime?: DockerRuntime,
        private readonly dockerImageTag?: string,
        // Extra host paths to bind-mount into the docker container at the
        // same path. Use this to make user assets (images, fonts) referenced
        // by absolute path in user code visible inside the container.
        private readonly dockerExtraMounts: readonly string[] = [],
        // When set, run a locally-compiled native server instead of the
        // container (for local runtime mode). Mutually exclusive with the
        // docker* params above.
        private readonly localConfig?: LocalServerConfig,
    ) {}

    /** True when running the containerized server; false for the native local server. */
    get isDockerMode(): boolean {
        return !this.localConfig;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    get isRunning(): boolean {
        return this.ready && !!this.serverProcess && !this.serverProcess.killed;
    }

    /**
     * Docker mode: no-op — the preview_server binary is pre-built inside the
     * image at /opt/dali/bin/preview_server.
     * Local mode: compile `preview_server.cpp` against the host DALi prefix when
     * the binary is missing or older than the source.
     */
    async ensureServerBinary(): Promise<void> {
        if (!this.localConfig) {
            return;
        }
        const cfg = this.localConfig;
        if (!fs.existsSync(cfg.serverSrcPath)) {
            throw new Error(`preview_server source not found at ${cfg.serverSrcPath}`);
        }
        let needsBuild = !fs.existsSync(cfg.serverBinPath);
        if (!needsBuild) {
            try {
                needsBuild = fs.statSync(cfg.serverSrcPath).mtimeMs > fs.statSync(cfg.serverBinPath).mtimeMs;
            } catch {
                needsBuild = true;
            }
        }
        if (!needsBuild) {
            return;
        }
        this.outputChannel.appendLine(`[PreviewServer] Building native preview_server (${cfg.daliPrefix}) ...`);
        const pkgConfigPath = `${cfg.daliPrefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig`;
        const cmd = [
            `PKG_CONFIG_PATH="${pkgConfigPath}"`,
            'g++ -std=c++17 -O2',
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --cflags ${DALI_PKG_MODULES})`,
            `"${cfg.serverSrcPath}"`,
            `$(PKG_CONFIG_PATH="${pkgConfigPath}" pkg-config --libs ${DALI_PKG_MODULES})`,
            `-L"${cfg.daliPrefix}/lib" -Wl,-rpath-link,"${cfg.daliPrefix}/lib" -ldl`,
            `-o "${cfg.serverBinPath}"`,
        ].join(' ');
        await new Promise<void>((resolve, reject) => {
            exec(cmd, { timeout: 120_000, shell: '/bin/bash' }, (error, _stdout, stderr) => {
                if (error) {
                    reject(new Error(`preview_server compile failed:\n${stderr || error.message}`));
                } else {
                    resolve();
                }
            });
        });
        this.outputChannel.appendLine('[PreviewServer] Native preview_server built.');
    }

    /**
     * Start the server process and wait for READY signal.
     */
    async start(): Promise<boolean> {
        if (this.isRunning) {
            return true;
        }
        this.stopping = false; // a fresh start clears any prior stop request

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
            this.pendingAnimInfo = undefined; // a queued ANIM line must not attach to this reload's OK

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
     * Send a RENDER_AT command: re-render the already-loaded plugin at a normalized
     * animation progress [0,1] and capture. Used for animation scrubbing — no recompile
     * and no reload, just SetCurrentProgress + capture on the resident plugin.
     */
    renderAt(progress: number, pngPath: string, metadataPath: string,
             width: number, height: number, theme: 'light' | 'dark' = 'dark',
             bgColor?: string): Promise<BuildResult> {
        return new Promise((resolve) => {
            if (!this.isRunning || !this.serverProcess) {
                resolve({ success: false, error: 'Preview server is not running' });
                return;
            }
            if (/[\s\n]/.test(pngPath) || /[\s\n]/.test(metadataPath)) {
                resolve({ success: false, error: 'path contains invalid characters' });
                return;
            }
            if (this.pendingRequest) {
                this.pendingRequest.resolve({ success: false, error: 'render already in progress' });
                this.pendingRequest = undefined;
            }
            this.pendingAnimInfo = undefined;
            this.pendingRequest = { resolve, metadataPath };

            const p = Math.max(0, Math.min(1, progress));
            const colorField = bgColor && /^#[0-9a-fA-F]{6}$/.test(bgColor) ? bgColor : '-';
            const cmd = `RENDER_AT ${p} ${pngPath} ${metadataPath} ${width} ${height} ${theme} ${colorField}\n`;
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
        this.pendingAnimInfo = undefined;

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
        this.stopping = true; // the exit handler must NOT auto-restart after an intentional stop
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
        // Local mode: just the native binary; env (DISPLAY/LD_LIBRARY_PATH) is
        // applied in spawnServer.
        if (this.localConfig) {
            return [this.localConfig.serverBinPath, []];
        }
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
            // Also mount tmpDir at /work: stageImageAssets rewrites image URLs to
            // `/work/<name>` in docker mode (the harness build mounts /work), and the
            // parser/RENDER_JSON scene carries those — without this the container has
            // no /work, so a staged ImageView asset renders as the broken-image
            // placeholder. (scene JSON / png paths use the tmpDir:tmpDir mount above.)
            '-v', `${this.tmpDir}:/work`,
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

    /**
     * Remove any stale container left over from a previous session that crashed
     * before `--rm` could clean it up. Overridable in tests so the IPC suite
     * never shells out to a real docker daemon.
     */
    protected _killStaleContainer(): void {
        if (this.localConfig) {
            return; // no container in local (native) mode
        }
        const containerName = this.dockerContainerName();
        try {
            require('child_process').execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
        } catch { /* container may not exist; ignore */ }
    }

    private spawnServer(): Promise<boolean> {
        return new Promise((resolve) => {
            // Docker run carries its own env via -e flags; the native server needs
            // DISPLAY (Xvfb) + LD_LIBRARY_PATH pointing at the local DALi prefix.
            const env: NodeJS.ProcessEnv = { ...process.env };
            if (this.localConfig) {
                const inherited = process.env.LD_LIBRARY_PATH;
                env.LD_LIBRARY_PATH = inherited
                    ? `${this.localConfig.daliPrefix}/lib:${inherited}`
                    : `${this.localConfig.daliPrefix}/lib`;
                env.DISPLAY = this.localConfig.display;
            }

            this._killStaleContainer();

            const [cmd, args] = this.buildSpawnCommand();
            const proc = this._spawn(cmd, args, {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.serverProcess = proc;
            this.stdoutBuffer  = '';

            const spawnTime = Date.now();
            const modeLabel = this.localConfig
                ? `native (${this.localConfig.serverBinPath})`
                : `docker (${this.dockerRuntime!.imageRef(this.dockerImageTag!)})`;
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

                // Auto-restart unless explicitly stopped or max restarts exceeded.
                // stop() SIGTERMs the process, which fires THIS handler — the `stopping`
                // guard stops that SIGTERM from resurrecting the server as an unowned orphan.
                if (this.stopping) {
                    this.outputChannel.appendLine('[PreviewServer] Stopped — not restarting');
                } else if (this.restartCount < MAX_RESTARTS) {
                    this.restartCount++;
                    this.outputChannel.appendLine(
                        `[PreviewServer] Restarting (attempt ${this.restartCount}/${MAX_RESTARTS})...`
                    );
                    // H3: Store handle so stop() can cancel this timer
                    this.restartTimer = setTimeout(() => {
                        this.restartTimer = undefined;
                        this.spawnServer().catch((e) =>
                            this.outputChannel.appendLine(`[PreviewServer] Restart spawn failed: ${String(e)}`)
                        );
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

            } else if (line.startsWith('>>>ANIM:')) {
                // ">>>ANIM:<count>:<durationMs>" — emitted on RELOAD before >>>OK,
                // describing the loaded plugin's scrubbable animations.
                const [countStr, durStr] = line.slice(8).split(':');
                this.pendingAnimInfo = {
                    count: parseInt(countStr, 10) || 0,
                    durationMs: parseInt(durStr, 10) || 0,
                };

            } else if (line.startsWith('>>>OK:')) {
                const pngPath = line.slice(6);
                if (this.pendingRequest) {
                    const { resolve, metadataPath } = this.pendingRequest;
                    this.pendingRequest = undefined;
                    const anim = this.pendingAnimInfo;
                    this.pendingAnimInfo = undefined;
                    resolve({
                        success: true, pngPath, metadataPath,
                        animationCount: anim?.count,
                        animationDurationMs: anim?.durationMs,
                    });
                }

            } else if (line.startsWith('>>>ERROR:')) {
                const msg = line.slice(9);
                this.pendingAnimInfo = undefined;
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
