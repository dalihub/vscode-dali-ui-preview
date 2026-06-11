import * as vscode from 'vscode';
import { PreviewManager } from './previewManager';
import { BuildRunner } from './buildRunner';
import { PreviewServer } from './previewServer';
import { XvfbManager } from './xvfbManager';
import { VncManager } from './vncManager';
import { SdbManager } from './sdbManager';
import { StatusBarManager, ThemeStatusBarItem } from './statusBar';
import { extractFunctionBody, isPreviewable } from './codeExtractor';
import { PreviewCodeLensProvider } from './previewCodeLens';
import { runSetupWizard, isDaliConfigured } from './setupWizard';
import { validateEnvironment, findDaliPrefix } from './daliEnvironment';
import { LivePreviewDebouncer } from './livePreviewDebouncer';
import { initLogger, getLogger } from './logger';
import { ConfigurationService } from './configurationService';
import { DockerRuntime } from './dockerRuntime';
import { checkDockerAccess, showDockerSetupGuidance, verifyDockerCommand, decidePreviewDockerGate, DockerAccessResult } from './dockerAccessCheck';
import { cleanRuntimeImagesCommand, resetExtensionCommand } from './dockerMaintenance';
import { installDockerCommand } from './installDocker';
import { pullRuntimeImageCommand, ensureRuntimeImage } from './pullImageCommand';
import { openSampleCommand, openExamplesCommand, useDockerRuntimeCommand, useNativeRuntimeCommand, showReadmeCommand } from './sampleCommand';
import { isFirstLaunch, maybeOpenWalkthrough, openWalkthrough } from './walkthroughController';
import { maybeRunFirstRunDockerSetup, DOCKER_ONBOARDING_KEY } from './dockerOnboarding';
import { PreviewOrchestrator } from './previewOrchestrator';
import { DockerAccessPoller } from './dockerAccessPoller';
import { checkRuntimeUpdateCommand, maybeAutoCheckRuntimeUpdate, selectRuntimeVersionCommand } from './checkUpdateCommand';

let previewManager: PreviewManager | undefined;
let buildRunner: BuildRunner | undefined;
let previewServer: PreviewServer | undefined;
let xvfbManager: XvfbManager | undefined;
let vncManager: VncManager | undefined;
let sdbManager: SdbManager | undefined;
let statusBar: StatusBarManager | undefined;
let themeStatusBar: ThemeStatusBarItem | undefined;
let currentDeviceSerial: string | undefined;
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

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('DALi Preview');
    initLogger(outputChannel);
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

    // Xvfb (start in background)
    xvfbManager = new XvfbManager();
    const xvfbStarted = await xvfbManager.start();
    if (xvfbStarted) {
        outputChannel.appendLine(`Xvfb started on display ${xvfbManager.getDisplay()}`);
    } else {
        outputChannel.appendLine('Xvfb not available, using real display (window may flash)');
    }

    // Suppress all legacy first-run popups when:
    //   - this machine has never seen the walkthrough (firstLaunch) — the
    //     walkthrough alone drives the initial UX, no competing modals; OR
    //   - runtimeMode is docker — the runtime lives in the container image,
    //     host DALi prefix and host g++/Xvfb don't apply.
    // Only an existing-user-on-native-mode-without-prefix combination still
    // surfaces the legacy setup wizard / env validation toasts.
    const isDockerMode = ConfigurationService.getInstance().runtimeMode === 'docker';
    const suppressLegacyFirstRun = isDockerMode || isFirstLaunch(context);

    try {
        if (!suppressLegacyFirstRun && !isDaliConfigured(context)) {
            const daliPath = await runSetupWizard(context);
            if (!daliPath) {
                outputChannel.appendLine('DALi not configured. Preview will not work until configured.');
            }
        }
    } catch (err: any) {
        outputChannel.appendLine(`Setup wizard error: ${err.message || err}`);
    }

    // Validate runtime environment and show actionable messages for missing
    // deps. Skipped in docker mode (the docker image carries its own
    // toolchain — host doesn't need g++/Xvfb/etc.) and on first launch
    // (walkthrough handles guidance; no competing toasts).
    if (suppressLegacyFirstRun) {
        outputChannel.appendLine(`[Environment] Validation skipped (${isDockerMode ? 'runtimeMode=docker' : 'first-launch — walkthrough drives'})`);
    } else try {
        const daliPrefixForCheck = await findDaliPrefix();
        const envIssues = await validateEnvironment(daliPrefixForCheck);
        if (envIssues.length > 0) {
            for (const issue of envIssues) {
                outputChannel.appendLine(`[Environment warning] ${issue.message} → ${issue.action}`);
            }
            const criticalDeps = envIssues.filter(i => i.kind === 'missing_dep');
            if (criticalDeps.length > 0) {
                const lines = criticalDeps.map(i => `• ${i.message}\n  Action: ${i.action}`).join('\n');
                const choice = await vscode.window.showWarningMessage(
                    `DALi Preview: Required dependencies are missing. Preview may not work.\n${lines}`,
                    'View Output'
                );
                if (choice === 'View Output') {
                    outputChannel.show();
                }
            }
        }
    } catch (err: any) {
        outputChannel.appendLine(`[Environment validation] Error: ${err?.message ?? err}`);
    }

    // Docker runtime (used when daliPreview.runtimeMode === 'docker')
    dockerRuntime = new DockerRuntime(ConfigurationService.getInstance().dockerImage);

    // Build runner
    buildRunner = new BuildRunner(context, xvfbManager, outputChannel, dockerRuntime);

    // SDB manager
    sdbManager = new SdbManager(outputChannel);

    // VNC manager
    vncManager = new VncManager(outputChannel);
    vncManager.onDaliAppExitCallback = () => {
        if (orchestrator?.isInteractiveMode) {
            orchestrator.setVncModeOff();
            previewManager?.stopVncMode();
            statusBar?.showReady();
            outputChannel.appendLine('[VNC] DALi app exited unexpectedly — interactive mode stopped');
        }
    };

    // Create the orchestrator (previewManager will be set later via ensurePreviewManager)
    // We pass a dummy previewManager initially; ensurePreviewManager will update it
    orchestrator = new PreviewOrchestrator(
        {
            buildRunner,
            previewManager: undefined as any,
            previewServer: undefined,
            xvfbManager,
            vncManager,
            sdbManager,
            statusBar,
            outputChannel,
            diagnosticCollection,
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

    // PreviewServer (dlopen mode) — start eagerly; falls back to Phase 1 if unavailable.
    // Honored at startup: when daliPreview.disablePreviewServer is true the server
    // is never spawned, so every preview goes through the full g++ harness path.
    initPreviewServer = async (opts?: { promptOnDockerIssue?: boolean }) => {
        // When invoked proactively at activation (onStartupFinished), suppress the
        // docker-setup guidance modal — the first-run onboarding owns that prompt,
        // so we don't double up. Command/poller callers keep the default (prompt).
        const promptOnDockerIssue = opts?.promptOnDockerIssue ?? true;
        // Re-callable after docker becomes available (or a runtime switch):
        // tear down any prior instance first so we don't leak a process or
        // leave a stale orchestrator reference.
        if (previewServer) {
            previewServer.stop();
            previewServer = undefined;
            orchestrator?.updatePreviewServer(undefined);
        }
        if (ConfigurationService.getInstance().disablePreviewServer) {
            outputChannel.appendLine('[PreviewServer] Skipped (daliPreview.disablePreviewServer is true) — using Phase 1 full harness path');
            statusBar?.showMode('compile');
            return;
        }

        const cfg = ConfigurationService.getInstance();
        const isDocker = cfg.runtimeMode === 'docker';
        let daliPrefix = '';
        if (isDocker) {
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
        } else {
            const found = await buildRunner!.getDaliPrefix();
            if (!found) {
                return;
            }
            daliPrefix = found;
        }
        const display = xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
        // Bind-mount workspace folders (read-only) into the container so
        // user code that references absolute asset paths (images, fonts)
        // can resolve them. Also include configured fontDirectories.
        const dockerExtraMounts: string[] = [];
        if (isDocker) {
            for (const folder of vscode.workspace.workspaceFolders ?? []) {
                dockerExtraMounts.push(folder.uri.fsPath);
            }
            for (const fontDir of cfg.fontDirectories) {
                if (fontDir) dockerExtraMounts.push(fontDir);
            }
        }
        previewServer = new PreviewServer(
            context.extensionPath,
            daliPrefix,
            display,
            outputChannel,
            BuildRunner.getWorkspaceTmpDir(),
            isDocker ? dockerRuntime : undefined,
            isDocker ? cfg.daliVersionTag : undefined,
            dockerExtraMounts,
        );
        const started = await previewServer.start();
        if (started) {
            const where = isDocker ? 'inside docker container' : '(Phase 2 mode)';
            outputChannel.appendLine(`[PreviewServer] dlopen server started ${where}`);
            statusBar?.showMode('server');
            orchestrator?.updatePreviewServer(previewServer);
        } else {
            outputChannel.appendLine('[PreviewServer] Server unavailable, using Phase 1 fallback');
            previewServer = undefined;
        }
    };
    // Tracks whether we've already kicked off a preview-server init in this
    // session (so the activation eager-start and the on-focus lazy-start below
    // don't both fire, and we don't re-prompt for docker on every file switch).
    let serverInitTriggered = false;

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
        ConfigurationService.getInstance().runtimeMode === 'docker' &&
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
            '[PreviewServer] Deferred container start — no previewable file open at activation.',
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
    const ensureDockerReadyForPreview = (opts: { silent: boolean }): Promise<boolean> =>
        decidePreviewDockerGate({
            runtimeMode: ConfigurationService.getInstance().runtimeMode,
            serverRunning: !!previewServer?.isRunning,
            pollerRunning: !!dockerAccessPoller?.isRunning,
            silent: opts.silent,
            checkAccess: checkDockerAccess,
            showGuidance: maybeShowDockerGuidance,
        });
    orchestrator?.setEnsureDockerReady(ensureDockerReadyForPreview);

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

    // Command: DALi: Toggle Interactive Mode (VNC)
    const toggleInteractiveCmd = vscode.commands.registerCommand('dali.toggleInteractiveMode', async () => {
        if (!orchestrator || !buildRunner || !previewManager || !vncManager) {
            return;
        }
        if (orchestrator.isInteractiveMode) {
            await orchestrator.stopVncMode();
        } else {
            await orchestrator.startVncMode();
        }
    });

    context.subscriptions.push(toggleInteractiveCmd);

    // Command: DALi Preview: Open Settings
    const openSettingsCmd = vscode.commands.registerCommand('dali.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'daliPreview');
    });
    context.subscriptions.push(openSettingsCmd);

    // Docker maintenance commands (no-op in native mode but always registered
    // so the user can recover from a broken docker setup at any time).
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
        vscode.commands.registerCommand('dali.selectRuntimeVersion', () =>
            dockerRuntime
                ? selectRuntimeVersionCommand(dockerRuntime, outputChannel, async () => { await initPreviewServer(); })
                : Promise.resolve(),
        ),
        vscode.commands.registerCommand('dali.openSample', () =>
            openSampleCommand(context),
        ),
        vscode.commands.registerCommand('dali.openExamples', () =>
            openExamplesCommand(context),
        ),
        vscode.commands.registerCommand('dali.useDockerRuntime', () =>
            useDockerRuntimeCommand(async () => {
                const access = await checkDockerAccess();
                if (access.state !== 'ok') {
                    await showDockerSetupGuidance(access, outputChannel, startDockerSetupWatch);
                    return;
                }
                if (dockerRuntime) {
                    await ensureRuntimeImage(dockerRuntime, outputChannel);
                }
                await initPreviewServer();
            }),
        ),
        vscode.commands.registerCommand('dali.useNativeRuntime', () =>
            useNativeRuntimeCommand(),
        ),
        vscode.commands.registerCommand('dali.showReadme', () =>
            showReadmeCommand(context),
        ),
        vscode.commands.registerCommand('dali.rerunSetup', () =>
            openWalkthrough(),
        ),
    );

    // First-launch onboarding — shown once per machine via globalState flag.
    // In docker mode (the default) we proactively offer to install Docker +
    // download the runtime image, so the user no longer has to open a
    // `.preview.dali.cpp` file first to discover setup. Native users get the
    // setup walkthrough instead. Both are idempotent: rerun via
    // "DALi Preview: Run Setup Walkthrough".
    const onboardingCfg = ConfigurationService.getInstance();
    if (onboardingCfg.runtimeMode === 'docker') {
        context.globalState.setKeysForSync([DOCKER_ONBOARDING_KEY]);
        maybeRunFirstRunDockerSetup({
            runtimeMode: 'docker',
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
    } else {
        maybeOpenWalkthrough(context).catch((err) =>
            outputChannel.appendLine(`[Walkthrough] init error: ${err?.message ?? err}`),
        );
    }

    // Command: DALi: Select Target Device
    const selectDeviceCmd = vscode.commands.registerCommand('dali.selectDevice', async () => {
        if (!sdbManager) {
            return;
        }
        const missingDep = SdbManager.checkDependencies();
        if (missingDep) {
            vscode.window.showErrorMessage(`DALi Device Preview: ${missingDep}`);
            return;
        }
        const serial = await sdbManager.selectDevice();
        if (serial) {
            currentDeviceSerial = serial;
            const config = vscode.workspace.getConfiguration('daliPreview');
            await config.update('targetDevice', serial, vscode.ConfigurationTarget.Workspace);
            statusBar?.showMode('device');
            outputChannel.appendLine(`[SDB] Target device selected: ${serial}`);
            vscode.window.showInformationMessage(`DALi: Device selected — ${serial}`);
        }
    });
    context.subscriptions.push(selectDeviceCmd);

    // Command: DALi: Device Preview
    const devicePreviewCmd = vscode.commands.registerCommand('dali.devicePreview', async () => {
        const missingDep = SdbManager.checkDependencies();
        if (missingDep) {
            vscode.window.showErrorMessage(`DALi Device Preview: ${missingDep}`);
            return;
        }
        if (!currentDeviceSerial) {
            // Auto-select if only one device connected
            if (sdbManager) {
                const serial = await sdbManager.selectDevice();
                if (!serial) {
                    return;
                }
                currentDeviceSerial = serial;
            } else {
                return;
            }
        }
        const editor = vscode.window.activeTextEditor;
        const doc = editor && isPreviewable(editor.document) ? editor.document : orchestrator?.lastDocument;
        if (!doc) {
            vscode.window.showWarningMessage('DALi: No previewable file found. Please open a .preview.dali.cpp file.');
            return;
        }
        ensurePreviewManager(context);
        previewManager!.show();
        await orchestrator?.runDevicePreview(doc);
    });
    context.subscriptions.push(devicePreviewCmd);

    // Restore persisted device serial from settings (same storage as selectDevice write path)
    const savedDeviceSerial = vscode.workspace.getConfiguration('daliPreview').get<string>('targetDevice', '') || undefined;
    if (savedDeviceSerial) {
        currentDeviceSerial = savedDeviceSerial;
        outputChannel.appendLine(`[SDB] Saved target device: ${savedDeviceSerial}`);
    }

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

            // VNC mode: hot reload the DALi app
            if (orchestrator.isInteractiveMode && vncManager?.isRunning) {
                await orchestrator.hotReloadVnc(doc);
                return;
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
            // VNC mode: hot reload the DALi app for the new doc
            if (orchestrator.isInteractiveMode && vncManager?.isRunning) {
                orchestrator.hotReloadVnc(editor.document);
            } else {
                orchestrator.runPreview(editor.document);
            }
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
        if (orchestrator.isInteractiveMode) {
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

    context.subscriptions.push(toggleThemeCmd, openCmd, onSave, onOpen, onTextChange, onConfigChange, outputChannel);

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

        // VNC: webview requests start/stop
        context.subscriptions.push(
            previewManager.onStartVnc(async () => {
                if (orchestrator && !orchestrator.isInteractiveMode) {
                    await orchestrator.startVncMode();
                }
            })
        );
        context.subscriptions.push(
            previewManager.onStopVnc(async () => {
                if (orchestrator?.isInteractiveMode) {
                    await orchestrator.stopVncMode();
                }
            })
        );
        context.subscriptions.push(
            previewManager.onVncConnected(() => {
                outputChannel.appendLine('[VNC] Client connected');
            })
        );
        context.subscriptions.push(
            previewManager.onVncDisconnected((reason) => {
                outputChannel.appendLine(`[VNC] Client disconnected: ${reason}`);
            })
        );

        // Show VNC toggle if dependencies are present
        if (VncManager.checkDependencies() === null) {
            previewManager.notifyVncAvailable();
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

export function deactivate() {
    dockerAccessPoller?.stop();
    liveDebouncer?.dispose();
    orchestrator?.dispose();
    previewServer?.stop();
    vncManager?.dispose();
    sdbManager?.dispose();
    previewManager?.dispose();
    buildRunner?.dispose();
    xvfbManager?.stop();
    statusBar?.dispose();
    themeStatusBar?.dispose();
}
