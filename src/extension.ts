import * as vscode from 'vscode';
import { PreviewManager } from './previewManager';
import { BuildRunner } from './buildRunner';
import { PreviewServer } from './previewServer';
import { XvfbManager } from './xvfbManager';
import { StatusBarManager, ThemeStatusBarItem } from './statusBar';
import { extractFunctionBody, isPreviewable } from './codeExtractor';
import { PreviewCodeLensProvider } from './previewCodeLens';
import { LivePreviewDebouncer } from './livePreviewDebouncer';
import { initLogger, getLogger } from './logger';
import { ConfigurationService, hostXvfbNeeded } from './configurationService';
import { DockerRuntime } from './dockerRuntime';
import { checkDockerAccess, showDockerSetupGuidance, verifyDockerCommand, decidePreviewDockerGate, DockerAccessResult } from './dockerAccessCheck';
import { cleanRuntimeImagesCommand, resetExtensionCommand } from './dockerMaintenance';
import { installDockerCommand } from './installDocker';
import { installXvfbCommand, promptInstallXvfb } from './installXvfb';
import { pullRuntimeImageCommand, ensureRuntimeImage, ensureRuntimeImageForTag } from './pullImageCommand';
import { openExamplesCommand, showReadmeCommand, maybeShowExamplesReadme } from './sampleCommand';
import { openWalkthrough } from './walkthroughController';
import { maybeRunFirstRunDockerSetup, DOCKER_ONBOARDING_KEY } from './dockerOnboarding';
import { PreviewOrchestrator } from './previewOrchestrator';
import { DockerAccessPoller } from './dockerAccessPoller';
import { checkRuntimeUpdateCommand, maybeAutoCheckRuntimeUpdate, selectRuntimeVersionCommand, buildVersionQuickPickItems } from './checkUpdateCommand';
import * as path from 'path';
import { BuildBackend } from './buildBackend';
import { DockerBackend } from './backends/dockerBackend';
import { LocalBackend } from './backends/localBackend';
import { useLocalRuntimeCommand, presentLocalRuntimeIssues } from './localRuntimeCommand';
import { addAgentGuideCommand } from './agentGuideCommand';
import { reportIssueCommand } from './reportIssueCommand';
import { findDaliPrefix, validateDaliPrefix } from './daliEnvironment';
import { listRemoteTags } from './registryClient';
import { decideLocalVersionAction, decideInstallAction, runLocalDockerBootstrap } from './localDockerBootstrap';

let previewManager: PreviewManager | undefined;
let buildRunner: BuildRunner | undefined;
let previewServer: PreviewServer | undefined;
let xvfbManager: XvfbManager | undefined;
let statusBar: StatusBarManager | undefined;
let themeStatusBar: ThemeStatusBarItem | undefined;
let diagnosticCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;
let liveDebouncer: LivePreviewDebouncer<vscode.TextDocument> | undefined;
let bgColorDebounceTimer: ReturnType<typeof setTimeout> | undefined;

// Code-to-Preview debounce timer
let cursorHighlightTimer: ReturnType<typeof setTimeout> | undefined;

// The orchestrator owns all preview pipeline state and logic
let orchestrator: PreviewOrchestrator | undefined;

// Docker runtime + preview-server init, hoisted to module scope so the
// docker-access poller and setup commands can re-init the preview after
// docker becomes available — without a VS Code reload.
let dockerRuntime: DockerRuntime | undefined;
// Polls docker access after the install/setfacl flow so the preview can come
// up without a reload; started by the install / runtime-switch commands.
let dockerAccessPoller: DockerAccessPoller | undefined;
// Reassigned in activate(); the no-op default lets callers invoke it
// unconditionally (e.g. from the access poller before the first real init).
let initPreviewServer: (opts?: { promptOnDockerIssue?: boolean }) => Promise<void> = async () => {};
// Local runtime: watcher on the DALi prefix's lib dir, so a `make install`
// rebuild auto-restarts the resident native server (which holds the old libs).
let daliLibWatcher: vscode.FileSystemWatcher | undefined;
let daliLibWatchPrefix: string | undefined;
// Tracks whether a preview-server init has already been kicked off this session
// (so the activation eager-start and the on-focus lazy-start don't both fire,
// and we don't re-prompt for docker on every file switch). Module-scoped so the
// onOpen listener can be extracted; reset at the top of activate() so a fresh
// activation behaves like a fresh session.
let serverInitTriggered = false;

/**
 * Wait for Docker to become reachable in this session, showing a cancellable
 * progress notification. Resolves 'ok' the moment access is granted (setfacl,
 * no reload) or 'gaveup' on timeout/cancel. Used by the local→docker bootstrap.
 */
function waitForDockerReadyWithProgress(): Promise<'ok' | 'gaveup'> {
    return new Promise((resolve) => {
        void vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'DALi Preview · Docker setup',
                cancellable: true,
            },
            (progress, token) => new Promise<void>((done) => {
                progress.report({ message: 'Waiting for Docker to become available…' });
                const poller = new DockerAccessPoller({
                    onTick: (a, max) => progress.report({ message: `Waiting for Docker… (${a}/${max})` }),
                    onOk: () => { resolve('ok'); done(); },
                    onGiveUp: () => { resolve('gaveup'); done(); },
                });
                token.onCancellationRequested(() => { poller.stop(); resolve('gaveup'); done(); });
                poller.start();
            }),
        );
    });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Set up the output channel + logger FIRST, so the wrapper below can leave an
    // actionable breadcrumb if any of the synchronous activation spine throws —
    // otherwise the user only sees VS Code's generic "activation failed".
    outputChannel = vscode.window.createOutputChannel('DALi Preview');
    initLogger(outputChannel);
    const log = getLogger();
    try {
        await activateImpl(context);
    } catch (err: any) {
        const msg = err?.message ?? String(err);
        log.error('Extension', 'Activation failed', { err: msg });
        outputChannel.appendLine(`DALi Preview: activation failed — ${msg}`);
        outputChannel.show(true);
        throw err; // let VS Code still mark the extension as failed
    }
}

async function activateImpl(context: vscode.ExtensionContext): Promise<void> {
    const log = getLogger();
    log.info('Extension', 'DALi Preview extension activating...');

    // Load initial size from settings
    const initialCfg = ConfigurationService.getInstance();
    const initialWidth = initialCfg.previewWidth;
    const initialHeight = initialCfg.previewHeight;

    // Load persisted theme
    let initialTheme: 'light' | 'dark' = 'dark';
    const savedTheme = context.workspaceState.get<string>('daliPreview.theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        initialTheme = savedTheme;
    }

    // Load persisted background color
    let initialBgColor: string | undefined;
    const savedBgColor = context.workspaceState.get<string>('daliPreview.backgroundColor');
    if (savedBgColor && /^#[0-9a-fA-F]{6}$/.test(savedBgColor)) {
        initialBgColor = savedBgColor;
    }

    diagnosticCollection = vscode.languages.createDiagnosticCollection('dali-preview');
    context.subscriptions.push(diagnosticCollection);

    // Status bar (always visible)
    statusBar = new StatusBarManager(context);
    statusBar.showReady();

    // Theme status bar button (Secondary zone, right side)
    themeStatusBar = new ThemeStatusBarItem(context);
    themeStatusBar.update(initialTheme);

    // Select the build backend from runtimeMode. Default 'docker' renders inside
    // the container image (no host DALi install needed). 'local' compiles against
    // a host-installed DALi prefix and runs under Xvfb — for uifw developers who
    // rebuild DALi itself and want previews to reflect their fresh .so files.
    const runtimeMode = ConfigurationService.getInstance().runtimeMode;
    const isLocalRuntime = runtimeMode === 'local';

    // The xvfbManager instance is always created (the orchestrator and
    // getDisplay() fallbacks reference it), but host Xvfb is only STARTED when the
    // runtime actually renders on the host. In docker mode the container carries
    // its own X server, so starting host Xvfb here would do nothing useful and
    // only pop a spurious "Xvfb is not installed" warning to users who never need
    // it. Switching to local reloads the window (see localRuntimeCommand), so
    // activate() re-runs and starts Xvfb then.
    xvfbManager = new XvfbManager();
    if (hostXvfbNeeded(runtimeMode)) {
        const xvfbStarted = await xvfbManager.start();
        if (xvfbStarted) {
            outputChannel.appendLine(`Xvfb started on display ${xvfbManager.getDisplay()}`);
        } else if (!xvfbManager.isInstalled()) {
            // Missing Xvfb → offer the one-command install. Local preview stays
            // disabled until it's present (we never render on the real screen).
            outputChannel.appendLine('Xvfb not installed — local preview disabled until it is. Offering install.');
            void promptInstallXvfb();
        } else {
            // Installed but no free display in the band — surface it instead of
            // silently drawing on :0 (the old "window may flash" behaviour).
            outputChannel.appendLine('Xvfb installed but could not claim a virtual display (band busy) — local preview disabled.');
            const choice = await vscode.window.showWarningMessage(
                'DALi Preview could not start a virtual display (Xvfb) — the display band (:99–:114) is busy with '
                + 'leftover X servers. Close them or reload the window; until then local preview is disabled '
                + '(it will not draw on your real screen).',
                'Reload Window',
            );
            if (choice === 'Reload Window') { await vscode.commands.executeCommand('workbench.action.reloadWindow'); }
        }
    }

    let backend: BuildBackend;
    if (isLocalRuntime) {
        backend = new LocalBackend(xvfbManager);
        statusBar?.showMode('compile');
        outputChannel.appendLine(
            '[Runtime] Local DALi runtime mode — compiling against the host DALi prefix; ' +
            'docker / preview-server fast paths are disabled (every preview is a fresh one-shot build).',
        );
    } else {
        // Docker runtime — the DALi UI is rendered inside the container image.
        dockerRuntime = new DockerRuntime(ConfigurationService.getInstance().dockerImage);
        backend = new DockerBackend(dockerRuntime, outputChannel);
    }

    // Build runner
    buildRunner = new BuildRunner(context, outputChannel, backend);

    // Create the orchestrator (previewManager will be set later via ensurePreviewManager)
    // We pass a dummy previewManager initially; ensurePreviewManager will update it
    orchestrator = new PreviewOrchestrator(
        {
            buildRunner,
            previewManager: undefined as any,
            previewServer: undefined,
            xvfbManager,
            statusBar,
            outputChannel,
            diagnosticCollection,
            reportIssue: (ctx: string) => void reportIssueCommand(context, ctx),
        },
        {
            width: initialWidth,
            height: initialHeight,
            theme: initialTheme,
            bgColor: initialBgColor,
        },
    );

    // Throttle the docker-setup guidance popup so the two paths that surface it
    // (preview-server init on focus, and the preview-render gate on save) don't
    // double-prompt within seconds of each other. `Date.now()` is fine here —
    // this is ordinary extension code, not a workflow script.
    let lastDockerGuidanceTs = 0;
    const maybeShowDockerGuidance = async (access: DockerAccessResult) => {
        const now = Date.now();
        if (now - lastDockerGuidanceTs < 8000) {
            return;
        }
        lastDockerGuidanceTs = now;
        await showDockerSetupGuidance(access, outputChannel, startDockerSetupWatch);
    };

    // Local runtime: watch the DALi prefix's lib dir so a rebuild (`make install`)
    // restarts the resident native server, which otherwise keeps the previously
    // loaded core libs mapped. Debounced (a build touches many files); best-effort
    // (watching outside the workspace can fail — the "Restart DALi Runtime" command
    // is the reliable fallback). Re-arming for the same prefix is a no-op.
    const armDaliLibWatcher = (prefix: string): void => {
        if (daliLibWatcher && daliLibWatchPrefix === prefix) {
            return;
        }
        try {
            daliLibWatcher?.dispose();
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(path.join(prefix, 'lib'), 'libdali2-*.so'),
            );
            let debounce: ReturnType<typeof setTimeout> | undefined;
            const onLibChange = () => {
                if (debounce) { clearTimeout(debounce); }
                debounce = setTimeout(() => {
                    debounce = undefined;
                    outputChannel.appendLine('[PreviewServer] DALi libraries changed — restarting native runtime to pick them up.');
                    void initPreviewServer().catch((err) =>
                        outputChannel.appendLine(`[PreviewServer] restart after lib change failed: ${err?.message ?? err}`),
                    );
                }, 800);
            };
            watcher.onDidChange(onLibChange);
            watcher.onDidCreate(onLibChange);
            daliLibWatcher = watcher;
            daliLibWatchPrefix = prefix;
            context.subscriptions.push(watcher);
            outputChannel.appendLine(`[PreviewServer] Watching ${path.join(prefix, 'lib')} for DALi rebuilds.`);
        } catch (err: any) {
            outputChannel.appendLine(`[PreviewServer] Could not watch DALi libs (use "Restart DALi Runtime" manually): ${err?.message ?? err}`);
        }
    };

    // PreviewServer (dlopen mode) — start eagerly; falls back to Phase 1 if unavailable.
    // Honored at startup: when daliPreview.disablePreviewServer is true the server
    // is never spawned, so every preview goes through the full g++ harness path.
    initPreviewServer = async (opts?: { promptOnDockerIssue?: boolean }) => {
        // When invoked proactively at activation (onStartupFinished), suppress the
        // docker-setup guidance modal — the first-run onboarding owns that prompt,
        // so we don't double up. Command/poller callers keep the default (prompt).
        const promptOnDockerIssue = opts?.promptOnDockerIssue ?? true;
        // Re-callable after docker becomes available, a runtime switch, or a DALi
        // rebuild (local) — tear down any prior instance first so we don't leak a
        // process or leave a stale orchestrator reference.
        if (previewServer) {
            previewServer.stop();
            previewServer = undefined;
            orchestrator?.updatePreviewServer(undefined);
        }
        if (ConfigurationService.getInstance().disablePreviewServer) {
            outputChannel.appendLine('[PreviewServer] Skipped (daliPreview.disablePreviewServer is true) — using full harness path');
            statusBar?.showMode('compile');
            return;
        }

        // Local runtime: compile + spawn the native resident server (dlopen fast
        // path) against the host DALi prefix. Falls back to the one-shot harness
        // path (LocalBackend.capture) when no valid prefix is configured.
        if (isLocalRuntime) {
            const prefix = await findDaliPrefix();
            if (!prefix || !validateDaliPrefix(prefix)) {
                outputChannel.appendLine('[PreviewServer] Local: no valid DALi prefix — one-shot harness path. Set it via "DALi Preview: Use Local DALi Runtime".');
                statusBar?.showMode('compile');
                return;
            }
            const localTmpDir = BuildRunner.getWorkspaceTmpDir();
            // The resident server renders into this display. Without a managed
            // Xvfb display we must NOT start it on the inherited :0 — that pops a
            // persistent window on the user's screen. Skip to the one-shot path
            // (which itself blocks rather than drawing on :0).
            const serverDisplay = xvfbManager?.getDisplay();
            if (!serverDisplay) {
                outputChannel.appendLine('[PreviewServer] Local: no virtual display (Xvfb) — resident server not started (it would draw on your real screen). Install or free Xvfb to enable the fast path.');
                statusBar?.showMode('compile');
                return;
            }
            previewServer = new PreviewServer(
                context.extensionPath, outputChannel, localTmpDir,
                undefined, undefined, [],
                {
                    daliPrefix: prefix,
                    display: serverDisplay,
                    serverSrcPath: path.join(context.extensionPath, 'docker', 'preview_server.cpp'),
                    serverBinPath: path.join(localTmpDir, 'preview_server'),
                },
            );
            const started = await previewServer.start();
            if (started) {
                outputChannel.appendLine('[PreviewServer] Native resident server started (local runtime).');
                statusBar?.showMode('server');
                orchestrator?.updatePreviewServer(previewServer);
                armDaliLibWatcher(prefix);
            } else {
                outputChannel.appendLine('[PreviewServer] Native server unavailable — using one-shot harness path.');
                previewServer = undefined;
                statusBar?.showMode('compile');
            }
            return;
        }

        const cfg = ConfigurationService.getInstance();
        // Probe docker access before trying to spawn the server. The
        // common failure mode is "permission denied" right after install,
        // when the docker group hasn't propagated to this VS Code session
        // — give the user actionable guidance instead of a cryptic
        // PreviewServer timeout.
        const access = await checkDockerAccess();
        if (access.state !== 'ok') {
            outputChannel.appendLine(
                `[PreviewServer] Skipped — docker access state: ${access.state}`,
            );
            statusBar?.showMode('compile');
            if (promptOnDockerIssue) {
                await maybeShowDockerGuidance(access);
            }
            return;
        }
        // Ensure the runtime image is present BEFORE launching the
        // container. Otherwise `docker run` cold-pulls ~290 MB, blows past
        // the 15s READY timeout, and silently fails (then retries).
        if (dockerRuntime) {
            const imageReady = await ensureRuntimeImage(dockerRuntime, outputChannel);
            if (!imageReady) {
                outputChannel.appendLine('[PreviewServer] Skipped — runtime image unavailable.');
                statusBar?.showMode('compile');
                return;
            }
        }
        // Bind-mount workspace folders (read-only) into the container so
        // user code that references absolute asset paths (images, fonts)
        // can resolve them. Also include configured fontDirectories.
        const dockerExtraMounts: string[] = [];
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            dockerExtraMounts.push(folder.uri.fsPath);
        }
        for (const fontDir of cfg.fontDirectories) {
            if (fontDir) dockerExtraMounts.push(fontDir);
        }
        previewServer = new PreviewServer(
            context.extensionPath,
            outputChannel,
            BuildRunner.getWorkspaceTmpDir(),
            dockerRuntime,
            cfg.daliVersionTag,
            dockerExtraMounts,
        );
        const started = await previewServer.start();
        if (started) {
            outputChannel.appendLine('[PreviewServer] dlopen server started inside docker container');
            statusBar?.showMode('server');
            orchestrator?.updatePreviewServer(previewServer);
        } else {
            outputChannel.appendLine('[PreviewServer] Server unavailable, using Phase 1 fallback');
            previewServer = undefined;
        }
    };
    // Reset per-activation (declared at module scope above) so re-activation
    // behaves like a fresh session.
    serverInitTriggered = false;

    // Activation is now also driven by onStartupFinished (no preview file needed).
    // Two consequences handled here:
    //   1. Don't spin up the preview-server container in a window that has no
    //      DALi file — only eager-start when a previewable editor is in context.
    //      Other windows just run the first-run onboarding (below) and defer the
    //      container until a previewable file is actually opened.
    //   2. Don't double-prompt: when the first-run onboarding is going to offer
    //      docker setup (first run + docker mode), keep this init silent so its
    //      modal is the only prompt. Otherwise (already onboarded, or docker is
    //      fine) let this init surface docker-setup guidance on demand.
    const onboardingMayPrompt =
        !context.globalState.get<boolean>(DOCKER_ONBOARDING_KEY);
    const hasPreviewableContext =
        (!!vscode.window.activeTextEditor && isPreviewable(vscode.window.activeTextEditor.document)) ||
        vscode.window.visibleTextEditors.some((e) => isPreviewable(e.document));
    if (hasPreviewableContext) {
        serverInitTriggered = true;
        initPreviewServer({ promptOnDockerIssue: !onboardingMayPrompt }).catch(err =>
            outputChannel.appendLine(`[PreviewServer] init error: ${err?.message ?? err}`)
        );
    } else {
        outputChannel.appendLine(
            '[PreviewServer] Deferred server start — no previewable file open at activation.',
        );
    }

    // Watch for docker access after the install / setfacl flow, showing a
    // progress notification the whole time, and auto-continue (ensure image +
    // start the preview server) once it's reachable — no VS Code reload.
    const startDockerSetupWatch = (): void => {
        if (dockerAccessPoller?.isRunning) {
            return;
        }
        void vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'DALi Preview · Docker setup',
                cancellable: true,
            },
            (progress, token) => new Promise<void>((resolve) => {
                progress.report({ message: 'Installing Docker — waiting for it to become available…' });
                token.onCancellationRequested(() => {
                    dockerAccessPoller?.stop();
                    resolve();
                });
                dockerAccessPoller = new DockerAccessPoller({
                    onOk: async () => {
                        resolve(); // close the "waiting" notification before the image pull's own progress
                        outputChannel.appendLine('[DockerAccess] Access available — continuing setup.');
                        if (dockerRuntime) {
                            await ensureRuntimeImage(dockerRuntime, outputChannel);
                        }
                        await initPreviewServer();
                        void vscode.window.showInformationMessage(
                            'DALi Preview: Docker is ready — preview running. No reload needed.',
                        );
                    },
                    onGiveUp: () => {
                        resolve();
                        void vscode.window.showWarningMessage(
                            'DALi Preview: Docker did not become available. Run "DALi: Verify Docker" once it is ready.',
                        );
                    },
                });
                dockerAccessPoller.start();
            }),
        );
    };

    // Wire the preview-render docker gate into the orchestrator now that
    // startDockerSetupWatch exists. (Passing this at orchestrator construction
    // would hit a TDZ on the block-scoped startDockerSetupWatch const.) The
    // arrow reads previewServer/dockerAccessPoller at call time, so it always
    // reflects the current runtime state.
    if (isLocalRuntime) {
        // Local gate: validate the host DALi prefix + build deps before falling
        // through to a one-shot compile, surfacing actionable guidance (pick the
        // DALi folder / install xvfb) instead of a raw compiler error.
        const ensureLocalRuntimeReady = async (opts: { silent: boolean }): Promise<boolean> => {
            const issues = await backend.validate();
            if (issues.length === 0) {
                return true;
            }
            if (!opts.silent) {
                await presentLocalRuntimeIssues(issues);
            }
            return false;
        };
        orchestrator?.setEnsureRuntimeReady(ensureLocalRuntimeReady);
    } else {
        const ensureDockerReadyForPreview = (opts: { silent: boolean }): Promise<boolean> =>
            decidePreviewDockerGate({
                serverRunning: !!previewServer?.isRunning,
                pollerRunning: !!dockerAccessPoller?.isRunning,
                silent: opts.silent,
                checkAccess: checkDockerAccess,
                showGuidance: maybeShowDockerGuidance,
            });
        orchestrator?.setEnsureRuntimeReady(ensureDockerReadyForPreview);
    }

    // Once-a-day background check for a newer runtime image (docker mode only,
    // gated by the autoCheckRuntimeUpdate setting; silent on no-update/offline).
    if (dockerRuntime) {
        void maybeAutoCheckRuntimeUpdate(context, dockerRuntime, outputChannel, {
            onUpdateAvailable: () => statusBar?.showUpdateAvailable(),
            onUpdated: async () => { await initPreviewServer(); },
        });
    }

    // Command: DALi Preview: Toggle Theme
    const toggleThemeCmd = vscode.commands.registerCommand('dali.toggleTheme', () => {
        if (!orchestrator) { return; }
        orchestrator.theme = orchestrator.theme === 'dark' ? 'light' : 'dark';
        context.workspaceState.update('daliPreview.theme', orchestrator.theme);
        context.workspaceState.update('daliPreview.backgroundColor', undefined);
        themeStatusBar?.update(orchestrator.theme);
        if (previewManager) {
            previewManager.setTheme(orchestrator.theme);
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                orchestrator.runPreview(editor.document);
            }
        }
    });

    // Command: DALi: Open Preview
    const openCmd = vscode.commands.registerCommand('dali.openPreview', () => {
        ensurePreviewManager(context);
        previewManager!.show();
        if (orchestrator) {
            previewManager!.setTheme(orchestrator.theme);
            if (orchestrator.bgColor) {
                previewManager!.setBackgroundColor(orchestrator.bgColor);
            }
        }
    });

    // Command: DALi Preview: Open Settings
    const openSettingsCmd = vscode.commands.registerCommand('dali.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'daliPreview');
    });
    context.subscriptions.push(openSettingsCmd);

    // AI-agent helpers — scaffold an AGENTS.md guide, and a one-click pre-filled
    // GitHub issue report. Always registered.
    context.subscriptions.push(
        vscode.commands.registerCommand('dali.addAgentGuide', () =>
            addAgentGuideCommand(context),
        ),
        vscode.commands.registerCommand('dali.reportIssue', () =>
            reportIssueCommand(context),
        ),
    );

    // Docker maintenance commands — always registered so the user can recover
    // from a broken docker setup at any time.
    context.subscriptions.push(
        vscode.commands.registerCommand('dali.verifyDocker', () =>
            verifyDockerCommand(outputChannel, startDockerSetupWatch),
        ),
        vscode.commands.registerCommand('dali.cleanRuntimeImages', () =>
            cleanRuntimeImagesCommand(outputChannel),
        ),
        vscode.commands.registerCommand('dali.resetExtension', () =>
            resetExtensionCommand(outputChannel, context.globalState),
        ),
        vscode.commands.registerCommand('dali.installDocker', () =>
            installDockerCommand(startDockerSetupWatch),
        ),
        vscode.commands.registerCommand('dali.pullRuntimeImage', () =>
            dockerRuntime
                ? pullRuntimeImageCommand(dockerRuntime, outputChannel)
                : Promise.resolve(false),
        ),
        vscode.commands.registerCommand('dali.checkRuntimeUpdate', () =>
            dockerRuntime
                ? checkRuntimeUpdateCommand(dockerRuntime, outputChannel, async () => { await initPreviewServer(); })
                : Promise.resolve(),
        ),
        // "Select Runtime Version" is the Docker-mode entry point: in docker mode
        // it picks a container version and restarts the server on it; in local
        // mode it picks a version and switches INTO docker (then reloads).
        vscode.commands.registerCommand('dali.selectRuntimeVersion', async () => {
            if (!isLocalRuntime && dockerRuntime) {
                await selectRuntimeVersionCommand(dockerRuntime, outputChannel, async () => { await initPreviewServer(); });
                return;
            }
            // Local mode. If docker is reachable we can list versions and switch
            // (existing path). If not, bootstrap docker: pick from the registry,
            // install/fix, pull the chosen image, then switch to docker + reload.
            const cfg = ConfigurationService.getInstance();
            const runtime = new DockerRuntime(cfg.dockerImage);
            const access = await checkDockerAccess();

            if (decideLocalVersionAction({ accessState: access.state }) === 'list-and-switch') {
                const picked = await selectRuntimeVersionCommand(runtime, outputChannel, async () => {});
                if (!picked) {
                    return; // cancelled — stay in local mode
                }
                await cfg.update('runtimeMode', 'docker', vscode.ConfigurationTarget.Global);
                const choice = await vscode.window.showInformationMessage(
                    `DALi Preview: switching to the Docker runtime (${picked}). Reload the window to apply.`,
                    'Reload Window',
                );
                if (choice === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                return;
            }

            // Docker not usable yet — run the bootstrap flow.
            await runLocalDockerBootstrap({
                accessState: access.state,
                currentTag: cfg.daliVersionTag,
                listRemoteVersions: async () => {
                    try { return await listRemoteTags(runtime.getImageName()); }
                    catch { return []; }
                },
                pickVersion: async (tags, current) => {
                    // Docker is unusable, so nothing is cached locally → all "will download".
                    const items = buildVersionQuickPickItems(tags, {
                        current,
                        localSet: new Set<string>(),
                        versionByTag: new Map<string, string | undefined>(),
                    });
                    const pick = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select a DALi runtime version to install and preview with',
                        ignoreFocusOut: true,
                    });
                    return pick?.label;
                },
                confirmSetup: async (version) => {
                    const choice = await vscode.window.showInformationMessage(
                        `DALi Preview will install Docker, download the ${version} runtime image (~290 MB), ` +
                        'and switch to the Docker runtime. Enter your password once — the rest is automatic.',
                        { modal: true },
                        'Set Up Docker',
                    );
                    return choice === 'Set Up Docker';
                },
                confirmOfflineFallback: async (tag) => {
                    const choice = await vscode.window.showWarningMessage(
                        'Could not reach the registry to list versions. Install Docker and download the ' +
                        `current runtime image (${tag}) instead?`,
                        { modal: true },
                        'Set Up Docker',
                    );
                    return choice === 'Set Up Docker';
                },
                beginInstall: async (state) => {
                    if (decideInstallAction(state) === 'install') {
                        await installDockerCommand();
                    } else {
                        await showDockerSetupGuidance(access, outputChannel);
                    }
                },
                waitForDockerReady: () => waitForDockerReadyWithProgress(),
                pullImage: (tag) => ensureRuntimeImageForTag(runtime, tag, outputChannel),
                persistDockerMode: async (tag) => {
                    await cfg.update('daliVersionTag', tag, vscode.ConfigurationTarget.Global);
                    await cfg.update('runtimeMode', 'docker', vscode.ConfigurationTarget.Global);
                },
                reload: async () => { await vscode.commands.executeCommand('workbench.action.reloadWindow'); },
                warn: async (msg) => { await vscode.window.showWarningMessage(msg); },
                log: (msg) => outputChannel.appendLine(msg),
            });
        }),
        vscode.commands.registerCommand('dali.openExamples', () =>
            openExamplesCommand(context),
        ),
        vscode.commands.registerCommand('dali.installXvfb', () =>
            installXvfbCommand(),
        ),
        vscode.commands.registerCommand('dali.showReadme', () =>
            showReadmeCommand(context),
        ),
        vscode.commands.registerCommand('dali.rerunSetup', () =>
            openWalkthrough(),
        ),
        vscode.commands.registerCommand('dali.useLocalRuntime', () =>
            useLocalRuntimeCommand(isLocalRuntime),
        ),
        // Local runtime: rebuild-aware restart. After rebuilding DALi, run this to
        // respawn the resident server so it loads your latest libdali2-*.so. (The
        // lib watcher usually does this automatically.)
        vscode.commands.registerCommand('dali.restartDaliRuntime', async () => {
            if (!isLocalRuntime) {
                await vscode.window.showInformationMessage(
                    'Restart applies to the local DALi runtime. In Docker mode, use "DALi Preview: Select Runtime Version".',
                );
                return;
            }
            serverInitTriggered = true;
            await initPreviewServer();
            void vscode.window.showInformationMessage('DALi runtime restarted — using your latest DALi build.');
        }),
    );

    // First-launch onboarding — shown once per machine via globalState flag.
    // We proactively offer to install Docker + download the runtime image, so
    // the user no longer has to open a `.preview.dali.cpp` file first to
    // discover setup. Idempotent: rerun via "DALi Preview: Run Setup Walkthrough".
    // Docker mode only — local-runtime users configure a DALi prefix instead.
    if (!isLocalRuntime) {
        const onboardingCfg = ConfigurationService.getInstance();
        context.globalState.setKeysForSync([DOCKER_ONBOARDING_KEY]);
        maybeRunFirstRunDockerSetup({
            daliVersionTag: onboardingCfg.daliVersionTag,
            alreadyShown: !!context.globalState.get<boolean>(DOCKER_ONBOARDING_KEY),
            checkAccess: () => checkDockerAccess(),
            hasImage: (tag) => dockerRuntime ? dockerRuntime.hasImage(tag) : Promise.resolve(false),
            markShown: () => Promise.resolve(context.globalState.update(DOCKER_ONBOARDING_KEY, true)),
            confirmInstall: async () => {
                const choice = await vscode.window.showInformationMessage(
                    'DALi Preview renders your UI inside a Docker container. Set it up now? ' +
                    'This installs Docker (one password), then downloads the runtime image ' +
                    '(~290 MB) automatically — no reboot or reload needed.',
                    { modal: true },
                    'Set Up Now',
                );
                return choice === 'Set Up Now';
            },
            installDocker: async () => {
                // Re-probe so we run the right action: a fresh install vs. just a
                // socket-permission / daemon fix (both wired to start the access
                // poller, which auto-pulls the image and starts the server next).
                const access = await checkDockerAccess();
                if (access.state === 'docker-not-installed') {
                    await installDockerCommand(startDockerSetupWatch);
                } else {
                    await showDockerSetupGuidance(access, outputChannel, startDockerSetupWatch);
                }
            },
            log: (msg) => outputChannel.appendLine(msg),
        }).catch((err) =>
            outputChannel.appendLine(`[Onboarding] init error: ${err?.message ?? err}`),
        );
    }

    // Document/editor event listeners that drive auto-preview (save, focus,
    // live text change, config change). All state they touch is module-scoped.
    registerDocumentListeners(context);

    // CodeLens provider: show "Preview" buttons above DALi View-returning functions
    const codeLensProvider = new PreviewCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: 'cpp', scheme: 'file' },
            codeLensProvider
        )
    );

    // Command: DALi: Preview Function (invoked by CodeLens)
    const previewFunctionCmd = vscode.commands.registerCommand(
        'dali.previewFunction',
        async (uri: vscode.Uri, funcStartLine: number, funcEndLine: number) => {
            const doc = await vscode.workspace.openTextDocument(uri);
            const extraction = extractFunctionBody(doc, funcStartLine, funcEndLine);
            if (!extraction) {
                vscode.window.showWarningMessage('DALi: Could not extract function body for preview.');
                return;
            }
            // Remember which function was previewed for live preview updates
            orchestrator?.setLastCodeLensFunc({ uri: uri.toString(), startLine: funcStartLine, endLine: funcEndLine });
            // CodeLens targets are regular .cpp files (not isPreviewable), so the
            // focus-driven lazy start in onDidChangeActiveTextEditor never fires for
            // them — start the resident preview server here too. Without this, a
            // CodeLens-only workflow never spins up the server and every live edit
            // falls back to the ~1.7s full-harness compile. (No-op in local mode.)
            if (!previewServer && !serverInitTriggered) {
                serverInitTriggered = true;
                void initPreviewServer().catch((err) =>
                    outputChannel.appendLine(`[PreviewServer] lazy init error (codelens): ${err?.message ?? err}`),
                );
            }
            ensurePreviewManager(context);
            previewManager!.show(true);
            if (orchestrator) {
                previewManager!.setTheme(orchestrator.theme);
                if (orchestrator.bgColor) {
                    previewManager!.setBackgroundColor(orchestrator.bgColor);
                }
                await orchestrator.runPreview(doc, false, extraction);
            }
        }
    );
    context.subscriptions.push(previewFunctionCmd);

    context.subscriptions.push(toggleThemeCmd, openCmd, outputChannel);

    outputChannel.appendLine('DALi Preview extension activated.');
}

function ensurePreviewManager(context: vscode.ExtensionContext) {
    if (!previewManager) {
        previewManager = new PreviewManager(context, BuildRunner.getWorkspaceTmpDir());

        // Update the orchestrator's previewManager reference
        orchestrator?.updatePreviewManager(previewManager);

        // Resolve the document to rebuild against. activeTextEditor is undefined
        // while the webview panel itself has focus (the typical case when these UI
        // controls — resize, resolution, refresh, theme — are used), so fall back
        // to the orchestrator's last previewed doc.
        const resolveTargetDoc = (): vscode.TextDocument | undefined => {
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                return editor.document;
            }
            // lastDocument was ALREADY previewed (often via a CodeLens on a file with
            // no // @preview marker, e.g. cards.cpp). Don't re-gate it on isPreviewable
            // — that returned undefined for CodeLens targets, so resize/resolution from
            // the webview silently did nothing until the user pressed Ctrl+S.
            return orchestrator?.lastDocument;
        };

        // Handle resize from webview (panel drag / resolution dropdown)
        previewManager.onResize((width, height) => {
            outputChannel.appendLine(`Resize requested: ${width}x${height}`);
            if (orchestrator) {
                orchestrator.width = width;
                orchestrator.height = height;
                // The webview has focus → activeTextEditor is undefined → without this
                // fallback the resize wouldn't apply until the user pressed Ctrl+S.
                const doc = resolveTargetDoc();
                if (doc) { orchestrator.runPreview(doc); }
            }
        });

        // Handle refresh from webview
        previewManager.onRefresh(() => {
            const doc = resolveTargetDoc();
            if (doc) { orchestrator?.runPreview(doc); }
        });

        // Handle animation scrub from webview (RENDER_AT on the resident plugin)
        previewManager.onScrub((progress: number, epoch: number) => {
            orchestrator?.scrubAnimation(progress, epoch);
        });

        // Handle theme toggle from webview
        previewManager.onThemeToggle(() => {
            if (!orchestrator) { return; }
            orchestrator.theme = orchestrator.theme === 'dark' ? 'light' : 'dark';
            context.workspaceState.update('daliPreview.theme', orchestrator.theme);
            context.workspaceState.update('daliPreview.backgroundColor', undefined);
            themeStatusBar?.update(orchestrator.theme);
            previewManager!.setTheme(orchestrator.theme);
            const doc = resolveTargetDoc();
            if (doc) { orchestrator.runPreview(doc); }
        });

        // Handle background color change from webview
        previewManager.onBackgroundChange((color: string) => {
            if (!orchestrator) { return; }
            orchestrator.bgColor = color;
            context.workspaceState.update('daliPreview.backgroundColor', color);
            clearTimeout(bgColorDebounceTimer);
            bgColorDebounceTimer = setTimeout(() => {
                bgColorDebounceTimer = undefined;
                const doc = resolveTargetDoc();
                if (doc) { orchestrator?.runPreview(doc); }
            }, 300);
        });

        // Handle click-to-code from webview
        previewManager.onSelectElement((line: number) => {
            const lastDoc = orchestrator?.lastDocument;
            if (!lastDoc) {
                return;
            }
            if (line < 0 || line >= lastDoc.lineCount) {
                return;
            }

            const editor = vscode.window.visibleTextEditors.find(
                e => e.document.uri.toString() === lastDoc.uri.toString()
            );

            if (editor) {
                const range = new vscode.Range(line, 0, line, 0);
                editor.selection = new vscode.Selection(line, 0, line, 0);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

                // Briefly highlight the line
                const decoration = vscode.window.createTextEditorDecorationType({
                    backgroundColor: 'rgba(0, 122, 204, 0.3)',
                    isWholeLine: true,
                });
                const lineRange = new vscode.Range(line, 0, line, lastDoc.lineAt(line).text.length);
                editor.setDecorations(decoration, [lineRange]);
                setTimeout(() => decoration.dispose(), 2000);
            } else {
                vscode.window.showTextDocument(lastDoc.uri, {
                    viewColumn: vscode.ViewColumn.One,
                    selection: new vscode.Range(line, 0, line, 0),
                });
            }
        });

        // Inspector toggle state persistence
        context.subscriptions.push(
            previewManager.onInspectorToggle((visible: boolean) => {
                context.workspaceState.update('daliPreview.inspectorVisible', visible);
            })
        );

        // Restore Inspector visible state on panel creation
        const savedInspectorVisible = context.workspaceState.get<boolean>('daliPreview.inspectorVisible', false);
        if (savedInspectorVisible) {
            previewManager.setInspectorVisible(savedInspectorVisible);
        }

        // Code-to-Preview: editor cursor -> highlight element in preview + Inspector tree
        context.subscriptions.push(
            vscode.window.onDidChangeTextEditorSelection((e) => {
                if (!previewManager?.isVisible) {
                    return;
                }
                const lastDoc = orchestrator?.lastDocument;
                if (!lastDoc) {
                    return;
                }
                if (e.textEditor.document.uri.toString() !== lastDoc.uri.toString()) {
                    return;
                }
                const line = e.selections[0]?.active.line;
                if (typeof line !== 'number') {
                    return;
                }
                if (cursorHighlightTimer !== undefined) {
                    clearTimeout(cursorHighlightTimer);
                }
                cursorHighlightTimer = setTimeout(() => {
                    cursorHighlightTimer = undefined;
                    previewManager?.highlightElement(line);
                }, 200);
            })
        );
    }
}

/**
 * Register the document/editor event listeners that drive auto-preview: save,
 * focus change, debounced live text change, and config change. Every piece of
 * state they touch (orchestrator, previewManager, liveDebouncer, previewServer,
 * serverInitTriggered, ...) is module-scoped, so this is a pure relocation out
 * of activate().
 */
function registerDocumentListeners(context: vscode.ExtensionContext): void {
    // Auto-preview on save
    const onSave = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        // Live dependency reload: if the saved file is a cross-file source the last
        // preview collected (e.g. a widgets.cpp helper), re-run the active preview so
        // the edit shows up immediately — even though the saved file isn't itself a
        // preview target.
        if (orchestrator?.isPreviewDependency(doc.fileName)) {
            await orchestrator.repreviewLast();
            return;
        }
        if (!isPreviewable(doc)) {
            return;
        }
        ensurePreviewManager(context);
        previewManager!.show(true);
        if (orchestrator) {
            previewManager!.setTheme(orchestrator.theme);
            if (orchestrator.bgColor) {
                previewManager!.setBackgroundColor(orchestrator.bgColor);
            }

            await orchestrator.runPreview(doc);
        }
    });

    // Track the active editor: when the preview panel is already open, rebuild
    // for the newly-focused previewable file so the preview follows the user's
    // focus instead of going stale. Focusing a file does NOT auto-open a closed
    // panel — the user opens the preview via Ctrl+S / the Open Preview command /
    // the CodeLens button, and closing it with (×) keeps it closed.
    const onOpen = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor || !isPreviewable(editor.document)) { return; }
        // First time a previewable file is focused this session, make sure the
        // preview server is (being) started — and surface docker-setup guidance
        // if docker isn't ready yet. This is the "I skipped setup, then opened a
        // DALi file" path: even though the extension already activated (e.g. via
        // onStartupFinished with no file open), the install prompt still appears.
        if (!previewServer && !serverInitTriggered) {
            serverInitTriggered = true;
            void initPreviewServer().catch((err) =>
                outputChannel.appendLine(`[PreviewServer] lazy init error: ${err?.message ?? err}`),
            );
        }
        // Don't auto-open the preview on focus. Only follow focus when the panel
        // is already open; if the user closed it (or never opened it this
        // session), leave it closed instead of resurrecting it on every switch.
        if (!previewManager?.isVisible) { return; }
        previewManager.show(true);
        if (!orchestrator) { return; }
        previewManager.setTheme(orchestrator.theme);
        if (orchestrator.bgColor) {
            previewManager.setBackgroundColor(orchestrator.bgColor);
        }
        // Skip if we're already showing this exact doc to avoid redundant rebuilds
        // when the user re-focuses the same tab.
        const lastUri = orchestrator.lastDocument?.uri.toString();
        if (lastUri !== editor.document.uri.toString()) {
            orchestrator.runPreview(editor.document);
        }
    });

    // Live preview: auto-refresh on text change with debounce
    const onTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
        if (!orchestrator) { return; }
        const codeLensFunc = orchestrator.lastCodeLensFunc;
        const isCodeLensTarget = codeLensFunc && codeLensFunc.uri === event.document.uri.toString();
        if (!isCodeLensTarget && !isPreviewable(event.document)) {
            return;
        }
        // Live preview only refreshes an already-open panel — it never auto-opens
        // one. If the user closed the preview, typing won't bring it back.
        if (!previewManager?.isVisible) {
            liveDebouncer?.cancel();
            return;
        }
        const liveCfg = ConfigurationService.getInstance();
        if (!liveCfg.livePreview) {
            liveDebouncer?.cancel();
            return;
        }
        const debounceMs = liveCfg.livePreviewDebounce;
        if (!liveDebouncer) {
            outputChannel.appendLine(`[LivePreview] Debouncer created with debounce=${debounceMs}ms`);
            liveDebouncer = new LivePreviewDebouncer<vscode.TextDocument>(debounceMs, (doc) => {
                // The panel may have been closed during the debounce window — if
                // so, don't resurrect it.
                if (!previewManager?.isVisible) { return; }
                const debounceElapsed = Date.now() - (orchestrator!.lastTextChangeTime || 0);
                outputChannel.appendLine(`[Perf] T1 debounce fired — ${debounceElapsed}ms since last text change`);
                previewManager.show(true);
                orchestrator!.runPreview(doc, true);
            });
        }
        liveDebouncer.setDebounceMs(debounceMs);
        orchestrator.setLastTextChangeTime(Date.now());
        liveDebouncer.schedule(event.document);
    });

    // Recreate debouncer if live preview settings change
    const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('daliPreview.livePreviewDebounce') ||
            e.affectsConfiguration('daliPreview.livePreview')) {
            liveDebouncer?.dispose();
            liveDebouncer = undefined;
            const updatedCfg = ConfigurationService.getInstance();
            const newDebounceMs = updatedCfg.livePreviewDebounce;
            const liveEnabled = updatedCfg.livePreview;
            outputChannel.appendLine(
                `[LivePreview] Settings updated — livePreview=${liveEnabled}, debounce=${newDebounceMs}ms`
            );
        }
    });

    context.subscriptions.push(onSave, onOpen, onTextChange, onConfigChange);

    // If this window is a copied examples tour (opened by `dali.openExamples`
    // in a fresh window), greet the user with its index README. Fire-and-forget
    // — never block activation on it.
    void maybeShowExamplesReadme();
}

export function deactivate(): void {
    dockerAccessPoller?.stop();
    liveDebouncer?.dispose();
    orchestrator?.dispose();
    previewServer?.stop();
    previewManager?.dispose();
    buildRunner?.dispose();
    xvfbManager?.stop();
    statusBar?.dispose();
    themeStatusBar?.dispose();
}
