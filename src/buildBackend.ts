/**
 * BuildBackend — the seam between backend-agnostic harness templating
 * (owned by BuildRunner) and the actual compile-and-render step.
 *
 * Two implementations:
 *   - DockerBackend (src/backends/dockerBackend.ts): runs the DALi runtime
 *     inside a container. The default; no host DALi install needed.
 *   - LocalBackend  (src/backends/localBackend.ts): compiles with the host
 *     g++/pkg-config against a locally-installed DALi prefix and runs the
 *     binary under Xvfb. For uifw developers who rebuild DALi itself and want
 *     the preview to reflect their freshly-built `.so` files.
 *
 * BuildRunner renders the harness C++ ONCE (placeholders substituted, the
 * output path baked in via `outputPaths`) and hands the string to the backend.
 * Docker-specific concerns (the `/work` bind-mount path duality, image pulls,
 * the resident-container `docker exec` optimization) live entirely inside
 * DockerBackend, so LocalBackend never sees a docker-ism.
 */

export type RuntimeMode = 'docker' | 'local';

/**
 * Where the rendered harness writes its outputs, and where the host reads
 * them back. The *embed* paths are baked into the C++ source (`{{OUTPUT_PATH}}`
 * / `{{METADATA_PATH}}`) and must already be escaped for a C++ string literal;
 * they differ from the host paths only for docker (container `/work/...`).
 */
export interface OutputPaths {
    /** PNG path baked into the harness — container path (docker) or host path (local). C++-escaped. */
    pngEmbed: string;
    /** Metadata JSON path baked into the harness. C++-escaped. */
    metadataEmbed: string;
    /** Host filesystem path to read the rendered PNG back from. */
    pngHost: string;
    /** Host filesystem path to read the metadata JSON back from. */
    metadataHost: string;
}

export interface CaptureRequest {
    /**
     * Fully-rendered harness C++ source — BuildRunner has already substituted
     * every placeholder (including the baked-in OUTPUT_PATH/METADATA_PATH).
     */
    source: string;
    /** Host working directory (BuildRunner's tmpDir); must exist and be writable. */
    workDir: string;
    /** Host path where the binary writes the PNG (from `outputPaths().pngHost`). */
    pngPathHost: string;
    /** Host path where the binary writes the metadata JSON. */
    metadataPathHost: string;
    width: number;
    height: number;
    /** Hard timeout in ms. */
    timeoutMs?: number;
}

export interface CaptureResult {
    success: boolean;
    /** Host PNG path on success. */
    pngPath?: string;
    /** Host metadata JSON path, present only when the binary wrote one. */
    metadataPath?: string;
    /** Human-readable error when `success === false`. */
    error?: string;
    /** Raw compiler/runtime output for diagnostics (mapped back to source lines upstream). */
    output?: string;
}

export interface CompilePluginRequest {
    /** Fully-rendered plugin C++ source (placeholders substituted by BuildRunner). */
    source: string;
    /** Host working directory. */
    workDir: string;
    /** Host path to write the plugin source to. */
    srcPath: string;
    /** Host path the resulting shared object should be written to. */
    soPath: string;
    timeoutMs?: number;
}

export interface CompilePluginResult {
    success: boolean;
    soPath?: string;
    error?: string;
}

/** One actionable readiness problem surfaced by `validate()`. */
export interface BackendIssue {
    /** Coarse category, e.g. 'docker' | 'dependency' | 'prefix'. */
    kind: string;
    /** What's wrong, in one line. */
    message: string;
    /** How to fix it (a shell command or a next step), shown to the user. */
    action?: string;
}

export interface BuildBackend {
    /** Which runtime this backend drives. */
    readonly kind: RuntimeMode;

    /**
     * Whether the resident preview-server fast path (parser/dlopen/scrub) is
     * usable with this backend. docker = true; local = false in M1 (every
     * preview is a one-shot harness build, so a freshly-rebuilt DALi `.so` is
     * always picked up without restarting anything).
     */
    readonly supportsResidentServer: boolean;

    /** Resolve the output paths (embed + host) for a given working directory. */
    outputPaths(workDir: string): OutputPaths;

    /** Precondition check. Returns [] when ready, else actionable issues. */
    validate(): Promise<BackendIssue[]>;

    /** Compile the rendered harness and run it to capture a PNG. */
    capture(req: CaptureRequest): Promise<CaptureResult>;

    /**
     * Compile the user code into a shared object for the dlopen fast path.
     * Optional: a backend without a resident server (local, M1) omits it, and
     * BuildRunner reports the path unsupported.
     */
    compilePlugin?(req: CompilePluginRequest): Promise<CompilePluginResult>;
}
