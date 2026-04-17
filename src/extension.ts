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
import { PropertyEditor } from './propertyEditor';
import { initLogger, getLogger } from './logger';
import { ConfigurationService } from './configurationService';
import { PreviewOrchestrator } from './previewOrchestrator';

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

    // Check DALi configuration on first run
    try {
        if (!isDaliConfigured(context)) {
            const daliPath = await runSetupWizard(context);
            if (!daliPath) {
                outputChannel.appendLine('DALi not configured. Preview will not work until configured.');
            }
        }
    } catch (err: any) {
        outputChannel.appendLine(`Setup wizard error: ${err.message || err}`);
    }

    // Validate runtime environment and show actionable messages for missing deps
    try {
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

    // Build runner
    buildRunner = new BuildRunner(context, xvfbManager, outputChannel);

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

    // PreviewServer (dlopen mode) — start eagerly; falls back to Phase 1 if unavailable
    const initPreviewServer = async () => {
        const daliPrefix = await buildRunner!.getDaliPrefix();
        if (!daliPrefix) {
            return;
        }
        const display = xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
        previewServer = new PreviewServer(context.extensionPath, daliPrefix, display, outputChannel, BuildRunner.getWorkspaceTmpDir());
        const started = await previewServer.start();
        if (started) {
            outputChannel.appendLine('[PreviewServer] dlopen server started (Phase 2 mode)');
            statusBar?.showMode('server');
            orchestrator?.updatePreviewServer(previewServer);
        } else {
            outputChannel.appendLine('[PreviewServer] Server unavailable, using Phase 1 fallback');
            previewServer = undefined;
        }
    };
    initPreviewServer().catch(err =>
        outputChannel.appendLine(`[PreviewServer] init error: ${err?.message ?? err}`)
    );

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

    // Auto-open preview panel when opening a previewable file
    const onOpen = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isPreviewable(editor.document)) {
            ensurePreviewManager(context);
            previewManager!.show(true);
            if (orchestrator) {
                previewManager!.setTheme(orchestrator.theme);
                if (orchestrator.bgColor) {
                    previewManager!.setBackgroundColor(orchestrator.bgColor);
                }
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
                const debounceElapsed = Date.now() - (orchestrator!.lastTextChangeTime || 0);
                outputChannel.appendLine(`[Perf] T1 debounce fired — ${debounceElapsed}ms since last text change`);
                ensurePreviewManager(context);
                previewManager!.show(true);
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

        // Handle resize from webview
        previewManager.onResize((width, height) => {
            outputChannel.appendLine(`Resize requested: ${width}x${height}`);
            if (orchestrator) {
                orchestrator.width = width;
                orchestrator.height = height;
                // Re-run preview with new size
                const editor = vscode.window.activeTextEditor;
                if (editor && isPreviewable(editor.document)) {
                    orchestrator.runPreview(editor.document);
                }
            }
        });

        // Handle refresh from webview
        previewManager.onRefresh(() => {
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                orchestrator?.runPreview(editor.document);
            }
        });

        // Handle theme toggle from webview
        previewManager.onThemeToggle(() => {
            if (!orchestrator) { return; }
            orchestrator.theme = orchestrator.theme === 'dark' ? 'light' : 'dark';
            context.workspaceState.update('daliPreview.theme', orchestrator.theme);
            context.workspaceState.update('daliPreview.backgroundColor', undefined);
            themeStatusBar?.update(orchestrator.theme);
            previewManager!.setTheme(orchestrator.theme);
            // Rebuild with new theme
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                orchestrator.runPreview(editor.document);
            }
        });

        // Handle background color change from webview
        previewManager.onBackgroundChange((color: string) => {
            if (!orchestrator) { return; }
            orchestrator.bgColor = color;
            context.workspaceState.update('daliPreview.backgroundColor', color);
            clearTimeout(bgColorDebounceTimer);
            bgColorDebounceTimer = setTimeout(() => {
                bgColorDebounceTimer = undefined;
                const editor = vscode.window.activeTextEditor;
                if (editor && isPreviewable(editor.document)) {
                    orchestrator?.runPreview(editor.document);
                }
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

        // Property editing: webview -> source code modification via WorkspaceEdit
        const propertyEditor = new PropertyEditor();
        context.subscriptions.push(
            previewManager.onEditProperty(async (sourceLine, propName, value) => {
                const lastDoc = orchestrator?.lastDocument;
                if (!lastDoc) {
                    return;
                }
                try {
                    const result = await propertyEditor.applyEdit(lastDoc, sourceLine, propName, value);
                    if (!result.success) {
                        outputChannel.appendLine(`[PropertyEditor] ${result.reason}`);
                        vscode.window.showWarningMessage(`Property edit failed: ${result.reason}`);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    outputChannel.appendLine(`[PropertyEditor] Unexpected error: ${msg}`);
                    vscode.window.showWarningMessage(`Error during property edit: ${msg}`);
                }
            })
        );

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
