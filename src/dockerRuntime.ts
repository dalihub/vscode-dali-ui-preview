import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { getLogger } from './logger';

const execFileAsync = promisify(execFile);

export const DEFAULT_DOCKER_IMAGE = 'ghcr.io/dalihub/dali-preview-runtime';
export const DEFAULT_IMAGE_TAG = 'latest';

/** Extract the `sha256:...` from a `repo@sha256:...` RepoDigest string. */
export function parseRepoDigest(repoDigest: string): string | undefined {
    const at = repoDigest.indexOf('@');
    if (at === -1) return undefined; // '<no value>' / empty / no RepoDigest
    const digest = repoDigest.slice(at + 1);
    return /^sha256:[0-9a-f]{64}$/i.test(digest) ? digest : undefined;
}

/**
 * Pull a sha256 digest out of `docker manifest inspect -v` JSON. The output is
 * either a single object or an array (multi-arch); we read the top-level
 * `.Descriptor.digest`. On any unexpected shape, return undefined so the caller
 * falls back to buildx.
 */
export function extractManifestDigest(stdout: string): string | undefined {
    try {
        const parsed = JSON.parse(stdout);
        const entry = Array.isArray(parsed) ? parsed[0] : parsed;
        const digest = entry?.Descriptor?.digest;
        return typeof digest === 'string' && /^sha256:[0-9a-f]{64}$/i.test(digest)
            ? digest
            : undefined;
    } catch {
        return undefined;
    }
}

export interface BuildAndCaptureRequest {
    /**
     * Templated, ready-to-compile C++ source. Must already include `main()`
     * and have OUTPUT_PATH baked in (the binary itself decides where to write
     * the PNG). The caller writes this string into `workDir/source.cpp` before
     * invocation.
     */
    source: string;

    /**
     * Host directory bind-mounted as `/work` inside the container.
     * Must already exist and be writable. The output PNG path baked into
     * `source` must point somewhere inside this directory.
     */
    workDir: string;

    /** Image tag to run, e.g. `tizen_10.0_release` or `latest`. */
    imageTag: string;

    /** Xvfb screen width, passed via PREVIEW_WIDTH env var. */
    width: number;

    /** Xvfb screen height, passed via PREVIEW_HEIGHT env var. */
    height: number;

    /**
     * Extra g++ flags appended after the source file (e.g. `['-shared', '-fPIC']`
     * for plugin builds).
     */
    extraFlags?: string[];

    /** Hard timeout in ms. Default: 60_000. */
    timeoutMs?: number;

    /**
     * Extra host paths to bind-mount read-only into the container at the
     * same path (e.g. workspace folder so absolute asset paths in user
     * code can be resolved inside the container).
     */
    extraMounts?: readonly string[];
}

export interface BuildAndCaptureResult {
    /** True iff container exited with code 0. */
    success: boolean;

    /** Combined stdout+stderr from the container (compile errors, [Perf] logs, etc.). */
    output: string;

    /** Container exit code. -1 if the docker process itself failed to spawn. */
    exitCode: number;

    /** Wall-clock time including container startup. */
    elapsedMs: number;

    /** Human-readable error when `success === false`. */
    error?: string;
}

export interface PullProgress {
    tag: string;
    /** Best-effort 0-100 percent across all known layers. */
    percent: number;
    /** Most recent status line from `docker pull`. */
    status: string;
}

/**
 * Wraps the Docker CLI for the DALi preview runtime image.
 *
 * The container model:
 *   - Image: `ghcr.io/dalihub/dali-preview-runtime:<tag>` (or override)
 *   - Entry: `/usr/local/bin/dali-preview-entrypoint <source.cpp>`
 *   - Bind:  host workDir ↔ container `/work`
 *
 * The TypeScript layer keeps full control of templating (uses existing
 * preview_harness.cpp.template + codeExtractor). The container is dumb:
 * it compiles, starts Xvfb, runs the binary, exits.
 *
 * For the dlopen fast path, PreviewServer registers the name of its
 * long-running container via `setActiveServerContainer`. compilePlugin
 * then uses `docker exec` against that container instead of spawning
 * a fresh one — saves ~300-500ms of container startup per compile.
 */
export class DockerRuntime {
    /** Container name of the long-running PreviewServer (if any). */
    private activeServerContainer: string | undefined;

    constructor(
        private readonly imageName: string = DEFAULT_DOCKER_IMAGE,
    ) {}

    /**
     * Register the long-running PreviewServer container so compilePlugin
     * can reuse it via `docker exec` instead of paying container startup
     * overhead on every compile.
     */
    setActiveServerContainer(name: string | undefined): void {
        this.activeServerContainer = name;
    }

    getActiveServerContainer(): string | undefined {
        return this.activeServerContainer;
    }

    /** Returns the configured base image name without tag. */
    getImageName(): string {
        return this.imageName;
    }

    /** Returns full image reference for a tag (e.g. `<image>:<tag>`). */
    imageRef(tag: string): string {
        return `${this.imageName}:${tag}`;
    }

    /**
     * True iff `docker info` succeeds (i.e. CLI installed AND daemon reachable
     * AND current user has socket access).
     */
    async isAvailable(): Promise<boolean> {
        const log = getLogger();
        try {
            const { stdout } = await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}']);
            const version = stdout.trim();
            const ok = version.length > 0;
            log.trace('Docker', 'isAvailable', { version, ok });
            return ok;
        } catch (err) {
            log.trace('Docker', 'isAvailable: not available', { error: String(err) });
            return false;
        }
    }

    /** True iff the given tag exists in the local image cache. */
    async hasImage(tag: string): Promise<boolean> {
        try {
            const { stdout } = await execFileAsync('docker', [
                'image', 'inspect', '--format', '{{.Id}}', this.imageRef(tag),
            ]);
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Local image digest (the RepoDigest) for a tag, or undefined if the image
     * isn't cached locally or has no RepoDigest (e.g. a locally-built image that
     * was never pushed/pulled). Returns the bare `sha256:...` portion.
     */
    async getLocalDigest(tag: string): Promise<string | undefined> {
        try {
            const { stdout } = await execFileAsync('docker', [
                'image', 'inspect', '--format', '{{index .RepoDigests 0}}', this.imageRef(tag),
            ], { timeout: 10_000 });
            return parseRepoDigest(stdout.trim());
        } catch {
            return undefined;
        }
    }

    /**
     * Remote manifest digest for a tag from the registry, or undefined when
     * offline / unauthorized / not found. Never throws.
     *
     * Prefers `docker buildx imagetools inspect` (prints the canonical,
     * multi-arch list digest), falling back to `docker manifest inspect -v`.
     */
    async getRemoteDigest(tag: string): Promise<string | undefined> {
        const ref = this.imageRef(tag);
        // buildx imagetools prints the canonical (multi-arch list) digest.
        try {
            const { stdout } = await execFileAsync(
                'docker', ['buildx', 'imagetools', 'inspect', ref],
                { timeout: 15_000 },
            );
            const m = stdout.match(/Digest:\s*(sha256:[0-9a-f]{64})/i);
            if (m) return m[1];
        } catch (err) {
            getLogger().trace('Docker', 'buildx imagetools failed, trying manifest inspect', { ref, error: String(err) });
        }
        // Fallback: manifest inspect -v (best-effort; may be a per-arch digest).
        try {
            const { stdout } = await execFileAsync(
                'docker', ['manifest', 'inspect', '-v', ref],
                { timeout: 15_000, env: { ...process.env, DOCKER_CLI_EXPERIMENTAL: 'enabled' } },
            );
            return extractManifestDigest(stdout);
        } catch (err) {
            getLogger().trace('Docker', 'remote digest unavailable', { ref, error: String(err) });
            return undefined;
        }
    }

    /**
     * True iff a remote digest exists AND differs from the local digest.
     * Returns false (not "unknown") when offline or when either digest is
     * unavailable — callers must treat false as "don't prompt the user".
     */
    async isUpdateAvailable(tag: string): Promise<boolean> {
        const [local, remote] = await Promise.all([
            this.getLocalDigest(tag),
            this.getRemoteDigest(tag),
        ]);
        if (!local || !remote) return false;
        return local !== remote;
    }

    /**
     * Convenience wrapper used by the user-facing "Download Runtime Image"
     * command — calls pullImage with progress mapped to a vscode notification.
     * Returns the same boolean as pullImage's promise resolution.
     */
    async pullImageWithProgress(
        tag: string,
        onProgress?: (p: PullProgress) => void,
    ): Promise<void> {
        return this.pullImage(tag, onProgress);
    }

    /**
     * Pull the given image tag, streaming best-effort progress via the
     * optional callback. Resolves on success, rejects with the docker stderr
     * tail on failure.
     */
    async pullImage(tag: string, onProgress?: (p: PullProgress) => void): Promise<void> {
        const log = getLogger();
        const ref = this.imageRef(tag);
        log.debug('Docker', 'pullImage start', { ref });

        return new Promise<void>((resolve, reject) => {
            const proc = spawn('docker', ['pull', ref], { stdio: ['ignore', 'pipe', 'pipe'] });
            const layerProgress = new Map<string, number>();
            let lastStatus = '';
            let stderrBuf = '';

            const handleLine = (line: string) => {
                lastStatus = line;
                const dl = line.match(/^([0-9a-f]+):\s+(?:Downloading|Extracting)\s+\[=*>?\s*\]\s+([\d.]+)%/);
                if (dl) {
                    layerProgress.set(dl[1], parseFloat(dl[2]));
                }
                const done = line.match(/^([0-9a-f]+):\s+(?:Pull complete|Already exists)/);
                if (done) {
                    layerProgress.set(done[1], 100);
                }
                const avg = layerProgress.size > 0
                    ? Array.from(layerProgress.values()).reduce((a, b) => a + b, 0) / layerProgress.size
                    : 0;
                onProgress?.({ tag, percent: avg, status: line });
            };

            let stdoutBuf = '';
            proc.stdout.on('data', (chunk: Buffer) => {
                stdoutBuf += chunk.toString();
                const lines = stdoutBuf.split('\n');
                stdoutBuf = lines.pop() ?? '';
                for (const l of lines) {
                    if (l.trim()) handleLine(l.trim());
                }
            });
            proc.stderr.on('data', (chunk: Buffer) => {
                stderrBuf += chunk.toString();
            });
            proc.on('error', (err) => {
                log.error('Docker', 'pullImage spawn error', { ref, error: String(err) });
                reject(new Error(`docker pull spawn failed: ${String(err)}`));
            });
            proc.on('exit', (code) => {
                if (code === 0) {
                    onProgress?.({ tag, percent: 100, status: 'complete' });
                    log.debug('Docker', 'pullImage done', { ref });
                    resolve();
                } else {
                    const tail = stderrBuf.trim().split('\n').slice(-3).join('\n')
                        || lastStatus
                        || `exit ${code}`;
                    log.error('Docker', 'pullImage failed', { ref, code, tail });
                    reject(new Error(`docker pull ${ref} exited ${code}: ${tail}`));
                }
            });
        });
    }

    /**
     * Compile a user .cpp into a shared object (.so) inside the container.
     * Used by the dlopen fast path: the resulting .so is then handed to
     * the long-running preview_server via RELOAD.
     *
     * Both `srcPath` and `soPath` must be inside `workDir` on the host —
     * we bind-mount workDir at the same path inside the container so the
     * paths resolve identically.
     */
    async compilePlugin(req: {
        source: string;
        workDir: string;
        srcPath: string;
        soPath: string;
        imageTag: string;
        timeoutMs?: number;
    }): Promise<{ success: boolean; output: string; elapsedMs: number; error?: string }> {
        const log = getLogger();
        const start = Date.now();

        await fs.promises.writeFile(req.srcPath, req.source, 'utf-8');

        const compileScript = `
set -e
PKG_MODULES="dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0"
g++ -std=c++17 -O0 -shared -fPIC \\
    $(pkg-config --cflags $PKG_MODULES) \\
    "${req.srcPath}" \\
    $(pkg-config --libs $PKG_MODULES) \\
    -o "${req.soPath}"
`.trim();

        // Prefer `docker exec` against the long-running PreviewServer
        // container (saves ~300-500ms of container startup per compile).
        // Fall back to a fresh `docker run --rm` if no server container
        // is registered.
        const serverContainer = this.activeServerContainer;
        const args = serverContainer
            ? ['exec', serverContainer, 'bash', '-c', compileScript]
            : [
                'run', '--rm',
                '-v', `${req.workDir}:${req.workDir}`,
                '-v', 'dali-preview-ccache:/cache',
                '--entrypoint', 'bash',
                this.imageRef(req.imageTag),
                '-c', compileScript,
            ];

        log.trace('Docker', 'compilePlugin spawn', {
            srcPath: req.srcPath, soPath: req.soPath,
            mode: serverContainer ? `exec(${serverContainer})` : 'run',
        });

        return new Promise((resolve) => {
            const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let output = '';
            let timedOut = false;

            const timeout = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
            }, req.timeoutMs ?? 30_000);

            proc.stdout.on('data', (c: Buffer) => { output += c.toString(); });
            proc.stderr.on('data', (c: Buffer) => { output += c.toString(); });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    output: output + '\n[spawn error] ' + String(err),
                    elapsedMs: Date.now() - start,
                    error: `docker run spawn failed: ${String(err)}`,
                });
            });

            proc.on('exit', (code) => {
                clearTimeout(timeout);
                const elapsedMs = Date.now() - start;
                const success = code === 0 && !timedOut;
                log.debug('Docker', 'compilePlugin done', { code, elapsedMs, success });
                resolve({
                    success,
                    output,
                    elapsedMs,
                    error: success
                        ? undefined
                        : timedOut
                            ? `compile timeout after ${req.timeoutMs ?? 30_000}ms`
                            : `compiler exited ${code}`,
                });
            });
        });
    }

    /**
     * Compile + render the templated source inside the container.
     *
     * Caller responsibility:
     *   1. Ensure `req.workDir` exists and is writable.
     *   2. Bake the desired output PNG path into `req.source` (the binary
     *      writes the PNG itself; OUTPUT_PATH must point inside `/work`,
     *      e.g. `/work/preview.png`).
     *   3. Read the PNG from the host side after this resolves successfully.
     */
    async buildAndCapture(req: BuildAndCaptureRequest): Promise<BuildAndCaptureResult> {
        const log = getLogger();
        const start = Date.now();

        const sourcePathHost = path.join(req.workDir, 'source.cpp');
        await fs.promises.writeFile(sourcePathHost, req.source, 'utf-8');

        // Persistent volumes — created lazily by docker on first use, reused
        // across every preview render:
        //   - dali-preview-ccache: g++ object-file cache (CCACHE_DIR=/cache
        //     in the image). After the first compile, harness recompiles
        //     drop from ~700ms to ~50ms (the harness body is identical
        //     except for the templated user code).
        //   - dali-preview-shader-cache: DALi's compiled GLES shader cache.
        //     Without it every render does shader compile (~100-200ms);
        //     with it, only the first run pays that cost.
        const extraMountFlags: string[] = [];
        for (const m of req.extraMounts ?? []) {
            if (m && m !== req.workDir) {
                extraMountFlags.push('-v', `${m}:${m}:ro`);
            }
        }

        const args = [
            'run', '--rm',
            '-v', `${req.workDir}:/work`,
            '-v', 'dali-preview-ccache:/cache',
            '-v', 'dali-preview-shader-cache:/root/.cache/dali_common_caches',
            ...extraMountFlags,
            '-e', `PREVIEW_WIDTH=${req.width}`,
            '-e', `PREVIEW_HEIGHT=${req.height}`,
            // Suppress EFL/eldbus stderr deluge (see previewServer.ts).
            '-e', 'EINA_LOG_BACKTRACE=disabled',
            '-e', 'EINA_LOG_LEVELS=eldbus:0,eina_safety:0,eina_log:0',
            // Mesa multi-threaded software rasterizer (see previewServer.ts).
            '-e', 'LP_NUM_THREADS=0',
            '-e', 'GALLIUM_DRIVER=llvmpipe',
            this.imageRef(req.imageTag),
            '/work/source.cpp',
            ...(req.extraFlags ?? []),
        ];

        log.trace('Docker', 'buildAndCapture spawn', { imageRef: this.imageRef(req.imageTag) });

        return new Promise<BuildAndCaptureResult>((resolve) => {
            const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let output = '';
            let timedOut = false;

            const timeout = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
            }, req.timeoutMs ?? 60_000);

            proc.stdout.on('data', (c: Buffer) => { output += c.toString(); });
            proc.stderr.on('data', (c: Buffer) => { output += c.toString(); });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    output: output + '\n[spawn error] ' + String(err),
                    exitCode: -1,
                    elapsedMs: Date.now() - start,
                    error: `docker run spawn failed: ${String(err)}`,
                });
            });

            proc.on('exit', (code) => {
                clearTimeout(timeout);
                const elapsedMs = Date.now() - start;
                const success = code === 0 && !timedOut;
                log.debug('Docker', 'buildAndCapture done', {
                    code, elapsedMs, success, timedOut,
                });
                resolve({
                    success,
                    output,
                    exitCode: code ?? -1,
                    elapsedMs,
                    error: success
                        ? undefined
                        : timedOut
                            ? `timeout after ${req.timeoutMs ?? 60_000}ms`
                            : `container exited ${code}`,
                });
            });
        });
    }
}
