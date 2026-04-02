import * as vscode from 'vscode';
import { PreviewManager } from './previewManager';
import { BuildRunner } from './buildRunner';
import { PreviewServer } from './previewServer';
import { XvfbManager } from './xvfbManager';
import { VncManager } from './vncManager';
import { StatusBarManager, ThemeStatusBarItem } from './statusBar';
import { extractPreviewCode, isPreviewable, instrumentCode } from './codeExtractor';
import { parseChainExpression } from './cppParser';
import { parseGccErrors, getHarnessCodeOffset, getPluginCodeOffset, formatErrorsForDisplay, formatRawError, errorsToDiagnostics } from './errorParser';
import { PreviewConfig, MultiPreviewResult } from './previewConfig';
import { runSetupWizard, isDaliConfigured } from './setupWizard';
import { validateEnvironment, findDaliPrefix } from './daliEnvironment';
import { LivePreviewDebouncer } from './livePreviewDebouncer';
import { PropertyEditor } from './propertyEditor';
import * as fs from 'fs';
import * as path from 'path';

let previewManager: PreviewManager | undefined;
let buildRunner: BuildRunner | undefined;
let previewServer: PreviewServer | undefined;
let xvfbManager: XvfbManager | undefined;
let vncManager: VncManager | undefined;
let statusBar: StatusBarManager | undefined;
let themeStatusBar: ThemeStatusBarItem | undefined;
let isVncMode = false;
let vncStarting = false;
let hotReloading = false;
let diagnosticCollection: vscode.DiagnosticCollection;
let building = false;
let outputChannel: vscode.OutputChannel;
let lastPreviewedDoc: vscode.TextDocument | undefined;
let liveDebouncer: LivePreviewDebouncer<vscode.TextDocument> | undefined;
let buildGeneration = 0;
let pendingRebuildDoc: vscode.TextDocument | undefined;
let errorDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let bgColorDebounceTimer: ReturnType<typeof setTimeout> | undefined;

// Current preview dimensions (managed directly, not via settings)
let currentWidth = 1024;
let currentHeight = 600;

// Current theme (persisted in workspaceState)
let currentTheme: 'light' | 'dark' = 'dark';

// Current background color (persisted in workspaceState)
let currentBgColor: string | undefined;

// Code-to-Preview debounce timer
let cursorHighlightTimer: ReturnType<typeof setTimeout> | undefined;

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('DALi Preview');
    outputChannel.appendLine('DALi Preview extension activating...');

    // Load initial size from settings
    const config = vscode.workspace.getConfiguration('daliPreview');
    currentWidth = config.get('previewWidth', 1024);
    currentHeight = config.get('previewHeight', 600);

    // Load persisted theme
    const savedTheme = context.workspaceState.get<string>('daliPreview.theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        currentTheme = savedTheme;
    }

    // Load persisted background color
    const savedBgColor = context.workspaceState.get<string>('daliPreview.backgroundColor');
    if (savedBgColor && /^#[0-9a-fA-F]{6}$/.test(savedBgColor)) {
        currentBgColor = savedBgColor;
    }

    diagnosticCollection = vscode.languages.createDiagnosticCollection('dali-preview');
    context.subscriptions.push(diagnosticCollection);

    // Status bar (always visible)
    statusBar = new StatusBarManager(context);
    statusBar.showReady();

    // Theme status bar button (Secondary zone, right side)
    themeStatusBar = new ThemeStatusBarItem(context);
    themeStatusBar.update(currentTheme);

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
                outputChannel.appendLine(`[환경 경고] ${issue.message} → ${issue.action}`);
            }
            const criticalDeps = envIssues.filter(i => i.kind === 'missing_dep');
            if (criticalDeps.length > 0) {
                const lines = criticalDeps.map(i => `• ${i.message}\n  조치: ${i.action}`).join('\n');
                const choice = await vscode.window.showWarningMessage(
                    `DALi Preview: 필수 의존성이 없어 프리뷰가 동작하지 않을 수 있습니다.\n${lines}`,
                    '출력 패널 보기'
                );
                if (choice === '출력 패널 보기') {
                    outputChannel.show();
                }
            }
        }
    } catch (err: any) {
        outputChannel.appendLine(`[환경 검증] 오류: ${err?.message ?? err}`);
    }

    // Build runner
    buildRunner = new BuildRunner(context, xvfbManager, outputChannel);

    // VNC manager
    vncManager = new VncManager(outputChannel);
    vncManager.onDaliAppExitCallback = () => {
        if (isVncMode) {
            isVncMode = false;
            previewManager?.stopVncMode();
            statusBar?.showReady();
            outputChannel.appendLine('[VNC] DALi app exited unexpectedly — interactive mode stopped');
        }
    };

    // PreviewServer (dlopen mode) — start eagerly; falls back to Phase 1 if unavailable
    const initPreviewServer = async () => {
        const daliPrefix = await buildRunner!.getDaliPrefix();
        if (!daliPrefix) {
            return;
        }
        const display = xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
        previewServer = new PreviewServer(context.extensionPath, daliPrefix, display, outputChannel);
        const started = await previewServer.start();
        if (started) {
            outputChannel.appendLine('[PreviewServer] dlopen server started (Phase 2 mode)');
            statusBar?.showMode('server');
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
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        context.workspaceState.update('daliPreview.theme', currentTheme);
        currentBgColor = undefined;
        context.workspaceState.update('daliPreview.backgroundColor', undefined);
        themeStatusBar?.update(currentTheme);
        if (previewManager) {
            previewManager.setTheme(currentTheme);
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                runPreview(editor.document);
            }
        }
    });

    // Command: DALi: Open Preview
    const openCmd = vscode.commands.registerCommand('dali.openPreview', () => {
        ensurePreviewManager(context);
        previewManager!.show();
        previewManager!.setTheme(currentTheme);
        if (currentBgColor) {
            previewManager!.setBackgroundColor(currentBgColor);
        }
    });

    // Command: DALi: Toggle Interactive Mode (VNC)
    const toggleInteractiveCmd = vscode.commands.registerCommand('dali.toggleInteractiveMode', async () => {
        if (!buildRunner || !previewManager || !vncManager) {
            return;
        }
        if (isVncMode) {
            await stopVncMode();
        } else {
            await startVncMode();
        }
    });

    context.subscriptions.push(toggleInteractiveCmd);

    // Auto-preview on save
    const onSave = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (!isPreviewable(doc)) {
            return;
        }
        ensurePreviewManager(context);
        previewManager!.show(true);
        previewManager!.setTheme(currentTheme);
        if (currentBgColor) {
            previewManager!.setBackgroundColor(currentBgColor);
        }

        // VNC mode: hot reload the DALi app
        if (isVncMode && vncManager?.isRunning) {
            await hotReloadVnc(doc);
            return;
        }

        await runPreview(doc);
    });

    // Auto-open preview panel when opening a previewable file
    const onOpen = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isPreviewable(editor.document)) {
            ensurePreviewManager(context);
            previewManager!.show(true);
            previewManager!.setTheme(currentTheme);
            if (currentBgColor) {
                previewManager!.setBackgroundColor(currentBgColor);
            }
        }
    });

    // Live preview: auto-refresh on text change with debounce
    const onTextChange = vscode.workspace.onDidChangeTextDocument((event) => {
        if (!isPreviewable(event.document)) {
            return;
        }
        if (isVncMode) {
            return;
        }
        const config = vscode.workspace.getConfiguration('daliPreview');
        if (!config.get<boolean>('livePreview', true)) {
            liveDebouncer?.cancel();
            return;
        }
        const debounceMs = config.get<number>('livePreviewDebounce', 300);
        if (!liveDebouncer) {
            liveDebouncer = new LivePreviewDebouncer<vscode.TextDocument>(debounceMs, (doc) => {
                ensurePreviewManager(context);
                previewManager!.show(true);
                runPreview(doc, true);
            });
        }
        liveDebouncer.setDebounceMs(debounceMs);
        liveDebouncer.schedule(event.document);
    });

    // Recreate debouncer if live preview settings change
    const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('daliPreview.livePreviewDebounce') ||
            e.affectsConfiguration('daliPreview.livePreview')) {
            liveDebouncer?.dispose();
            liveDebouncer = undefined;
        }
    });

    context.subscriptions.push(toggleThemeCmd, openCmd, onSave, onOpen, onTextChange, onConfigChange, outputChannel);

    outputChannel.appendLine('DALi Preview extension activated.');
}

function ensurePreviewManager(context: vscode.ExtensionContext) {
    if (!previewManager) {
        previewManager = new PreviewManager(context);

        // Handle resize from webview
        previewManager.onResize((width, height) => {
            outputChannel.appendLine(`Resize requested: ${width}x${height}`);
            currentWidth = width;
            currentHeight = height;
            // Re-run preview with new size
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                runPreview(editor.document);
            }
        });

        // Handle refresh from webview
        previewManager.onRefresh(() => {
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                runPreview(editor.document);
            }
        });

        // Handle theme toggle from webview
        previewManager.onThemeToggle(() => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            context.workspaceState.update('daliPreview.theme', currentTheme);
            currentBgColor = undefined;
            context.workspaceState.update('daliPreview.backgroundColor', undefined);
            themeStatusBar?.update(currentTheme);
            previewManager!.setTheme(currentTheme);
            // Rebuild with new theme
            const editor = vscode.window.activeTextEditor;
            if (editor && isPreviewable(editor.document)) {
                runPreview(editor.document);
            }
        });

        // Handle background color change from webview
        previewManager.onBackgroundChange((color: string) => {
            currentBgColor = color;
            context.workspaceState.update('daliPreview.backgroundColor', color);
            clearTimeout(bgColorDebounceTimer);
            bgColorDebounceTimer = setTimeout(() => {
                bgColorDebounceTimer = undefined;
                const editor = vscode.window.activeTextEditor;
                if (editor && isPreviewable(editor.document)) {
                    runPreview(editor.document);
                }
            }, 300);
        });

        // Handle click-to-code from webview
        previewManager.onSelectElement((line: number) => {
            if (!lastPreviewedDoc) {
                return;
            }
            if (line < 0 || line >= lastPreviewedDoc.lineCount) {
                return;
            }

            const editor = vscode.window.visibleTextEditors.find(
                e => e.document.uri.toString() === lastPreviewedDoc!.uri.toString()
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
                const lineRange = new vscode.Range(line, 0, line, lastPreviewedDoc.lineAt(line).text.length);
                editor.setDecorations(decoration, [lineRange]);
                setTimeout(() => decoration.dispose(), 2000);
            } else {
                vscode.window.showTextDocument(lastPreviewedDoc.uri, {
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

        // Property editing: webview → source code modification via WorkspaceEdit
        const propertyEditor = new PropertyEditor();
        context.subscriptions.push(
            previewManager.onEditProperty(async (sourceLine, propName, value) => {
                if (!lastPreviewedDoc) {
                    return;
                }
                try {
                    const result = await propertyEditor.applyEdit(lastPreviewedDoc, sourceLine, propName, value);
                    if (!result.success) {
                        outputChannel.appendLine(`[PropertyEditor] ${result.reason}`);
                        vscode.window.showWarningMessage(`속성 편집 실패: ${result.reason}`);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    outputChannel.appendLine(`[PropertyEditor] 예기치 않은 오류: ${msg}`);
                    vscode.window.showWarningMessage(`속성 편집 중 오류 발생: ${msg}`);
                }
            })
        );

        // VNC: webview requests start/stop
        context.subscriptions.push(
            previewManager.onStartVnc(async () => {
                if (!isVncMode) {
                    await startVncMode();
                }
            })
        );
        context.subscriptions.push(
            previewManager.onStopVnc(async () => {
                if (isVncMode) {
                    await stopVncMode();
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

        // Code-to-Preview: editor cursor → highlight element in preview + Inspector tree
        context.subscriptions.push(
            vscode.window.onDidChangeTextEditorSelection((e) => {
                if (!previewManager?.isVisible) {
                    return;
                }
                if (!lastPreviewedDoc) {
                    return;
                }
                if (e.textEditor.document.uri.toString() !== lastPreviewedDoc.uri.toString()) {
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

function scheduleShowError(message: string): void {
    if (errorDebounceTimer !== undefined) {
        clearTimeout(errorDebounceTimer);
    }
    errorDebounceTimer = setTimeout(() => {
        errorDebounceTimer = undefined;
        previewManager?.showError(message);
    }, 500);
}

function cancelErrorDebounce(): void {
    if (errorDebounceTimer !== undefined) {
        clearTimeout(errorDebounceTimer);
        errorDebounceTimer = undefined;
    }
    previewManager?.clearError();
}

async function runPreview(doc: vscode.TextDocument, livePreview = false) {
    if (!buildRunner || !previewManager) {
        return;
    }

    // If a build is already in progress, queue this doc and return
    if (building) {
        if (livePreview) {
            pendingRebuildDoc = doc;
        }
        return;
    }

    // Extract code
    const extraction = extractPreviewCode(doc);
    if (!extraction) {
        return;
    }

    lastPreviewedDoc = doc;

    const myGeneration = ++buildGeneration;
    building = true;

    // For save-triggered builds show the loading overlay; live preview builds are silent
    if (!livePreview) {
        statusBar?.showBuilding();
        previewManager.showLoading();
    }
    diagnosticCollection.delete(doc.uri);

    const startTime = Date.now();

    // Instrument code with line annotations for click-to-code
    const instrumented = instrumentCode(extraction.code, extraction.startLine);

    try {
        // Multi-config path: build each config independently
        if (extraction.configs && extraction.configs.length > 0) {
            await runMultiPreview(doc, extraction.configs, instrumented, extraction.startLine, myGeneration, startTime);
            return;
        }

        let result;
        let usedServerMode = false;
        let usedParserMode = false;

        // Phase 4-2: Parser-first path (~200ms) — try before compile
        if (previewServer?.isRunning) {
            const scene = parseChainExpression(extraction.code);
            if (scene) {
                const pngPath      = '/tmp/dali_preview/preview.png';
                const metadataPath = '/tmp/dali_preview/preview_metadata.json';
                result = await previewServer.renderJson(
                    scene, pngPath, metadataPath, currentWidth, currentHeight, currentTheme, currentBgColor
                );

                if (myGeneration !== buildGeneration) { return; }

                if (result.success) {
                    usedServerMode = true;
                    usedParserMode = true;
                } else {
                    // Parser path failed at render time → fall through to compile
                    outputChannel.appendLine('[Parser] renderJson failed, falling back to compile path');
                    result = undefined;
                    if (myGeneration !== buildGeneration) { return; }
                }
            }
        }

        // Phase 2: dlopen server mode
        if (!usedServerMode && previewServer?.isRunning) {
            const pluginResult = await buildRunner.compilePlugin(instrumented);

            // Discard stale result if a newer build was queued during this compile
            if (myGeneration !== buildGeneration) {
                return;
            }

            if (pluginResult.success && pluginResult.soPath) {
                const pngPath      = '/tmp/dali_preview/preview.png';
                const metadataPath = '/tmp/dali_preview/preview_metadata.json';
                result = await previewServer.reload(
                    pluginResult.soPath, pngPath, metadataPath, currentWidth, currentHeight, currentTheme, currentBgColor
                );
                usedServerMode = true;
            } else {
                // .so compile failed — parse errors against plugin template
                const pluginTemplate = buildRunner.getPluginTemplateContent();
                const offset = getPluginCodeOffset(pluginTemplate);
                const errors = parseGccErrors(pluginResult.error || '', offset, true);
                const buildTimeMs = Date.now() - startTime;
                if (errors.length > 0) {
                    const diagnostics = errorsToDiagnostics(errors, doc, extraction.startLine);
                    diagnosticCollection.set(doc.uri, diagnostics);
                    scheduleShowError(formatErrorsForDisplay(errors));
                } else {
                    scheduleShowError(formatRawError(pluginResult.error || ''));
                }
                statusBar?.showError(pluginResult.error?.split('\n')[0] || 'Build failed');
                outputChannel.appendLine(`Plugin compile failed in ${(buildTimeMs / 1000).toFixed(1)}s`);
                return;
            }
        }

        // Phase 1 fallback: full harness compile + run
        if (!usedServerMode) {
            result = await buildRunner.buildAndRun(instrumented, currentWidth, currentHeight, currentTheme, currentBgColor);
        }

        // Discard stale result if a newer build was queued
        if (myGeneration !== buildGeneration) {
            return;
        }

        const buildTimeMs = Date.now() - startTime;

        if (result!.success && result!.pngPath) {
            // Load scene graph metadata for click-to-code overlay
            let metadata: object | null = null;
            if (result!.metadataPath) {
                try {
                    metadata = JSON.parse(fs.readFileSync(result!.metadataPath, 'utf-8'));
                } catch { /* metadata is optional */ }
            }
            cancelErrorDebounce();
            previewManager.updateImage(result!.pngPath, buildTimeMs, metadata);
            const modeLabel = usedParserMode ? '⚡ parser' : usedServerMode ? '⚡ server' : '🔨 compile';
            statusBar?.showMode(usedParserMode ? 'parser' : usedServerMode ? 'server' : 'compile');
            statusBar?.showSuccess(buildTimeMs);
            outputChannel.appendLine(`Preview updated in ${(buildTimeMs / 1000).toFixed(1)}s [${modeLabel}] (${currentWidth}x${currentHeight})`);
        } else {
            // Parse errors and show in editor
            const templatePath = path.join(
                buildRunner.getExtensionPath(), 'server', 'preview_harness.cpp.template');
            let template = '';
            try { template = fs.readFileSync(templatePath, 'utf-8'); } catch { /* ignore */ }
            const offset = getHarnessCodeOffset(template);
            const errors = parseGccErrors(result!.error || '', offset, false);

            if (errors.length > 0) {
                const diagnostics = errorsToDiagnostics(errors, doc, extraction.startLine);
                diagnosticCollection.set(doc.uri, diagnostics);
                scheduleShowError(formatErrorsForDisplay(errors));
            } else {
                scheduleShowError(formatRawError(result!.error || ''));
            }

            statusBar?.showError(result!.error?.split('\n')[0] || 'Build failed');
            outputChannel.appendLine(`Preview failed: ${result!.error?.substring(0, 200)}`);
        }
    } catch (err: any) {
        if (myGeneration === buildGeneration) {
            scheduleShowError(`Unexpected error: ${err.message || err}`);
            statusBar?.showError(err.message || 'Error');
        }
    } finally {
        building = false;
        // Process pending rebuild queued during this build
        if (pendingRebuildDoc) {
            const nextDoc = pendingRebuildDoc;
            pendingRebuildDoc = undefined;
            setImmediate(() => runPreview(nextDoc, true));
        }
    }
}

async function runMultiPreview(
    doc: vscode.TextDocument,
    configs: PreviewConfig[],
    instrumented: string,
    startLine: number,
    myGeneration: number,
    startTime: number
) {
    if (!buildRunner || !previewManager) {
        return;
    }

    const results: MultiPreviewResult[] = [];

    for (const config of configs) {
        if (myGeneration !== buildGeneration) {
            return; // stale — a newer build was triggered
        }

        const configStart = Date.now();
        const width     = config.width     ?? currentWidth;
        const height    = config.height    ?? currentHeight;
        const theme     = config.theme     ?? currentTheme;
        const locale    = config.locale;
        const fontScale = config.fontScale;
        const font      = config.font;

        // Resolve font filename to its absolute directory for the IPC server path.
        // The server's C++ code expects an absolute directory in the font field, not a bare filename.
        // (buildRunner.buildAndRun() does its own resolution for the harness path.)
        let fontDir: string | undefined;
        if (font) {
            const fontCfg = vscode.workspace.getConfiguration('daliPreview');
            const fontDirs = fontCfg.get<string[]>('fontDirectories', []);
            fontDir = fontDirs.find(d => {
                try { return fs.existsSync(path.join(d, font)); }
                catch { return false; }
            });
            // If not found in configured directories, omit (don't fall back to '.', which is useless)
        }

        try {
            if (previewServer?.isRunning) {
                const pluginResult = await buildRunner.compilePlugin(instrumented, config.name);

                if (myGeneration !== buildGeneration) {
                    return;
                }

                if (pluginResult.success && pluginResult.soPath) {
                    const pngPath      = `/tmp/dali_preview/preview_${sanitizeForPath(config.name)}.png`;
                    const metadataPath = `/tmp/dali_preview/preview_${sanitizeForPath(config.name)}_metadata.json`;
                    const reloadResult = await previewServer.reload(
                        pluginResult.soPath, pngPath, metadataPath, width, height, theme, currentBgColor,
                        locale, fontScale, fontDir
                    );
                    results.push({
                        config,
                        success: reloadResult.success,
                        pngPath: reloadResult.success ? pngPath : undefined,
                        metadataPath: reloadResult.success ? metadataPath : undefined,
                        buildTimeMs: Date.now() - configStart,
                        error: reloadResult.success ? undefined : (reloadResult.error || 'Reload failed'),
                    });
                } else {
                    const pluginTemplate = buildRunner.getPluginTemplateContent();
                    const offset = getPluginCodeOffset(pluginTemplate);
                    const errors = parseGccErrors(pluginResult.error || '', offset, true);
                    const errorMsg = errors.length > 0
                        ? formatErrorsForDisplay(errors)
                        : (pluginResult.error || 'Plugin compile failed');
                    results.push({ config, success: false, buildTimeMs: Date.now() - configStart, error: errorMsg });
                }
            } else {
                // Phase 1 fallback
                const result = await buildRunner.buildAndRun(
                    instrumented, width, height, theme, currentBgColor,
                    locale, fontScale, font
                );
                results.push({
                    config,
                    success: result.success,
                    pngPath: result.pngPath,
                    metadataPath: result.metadataPath,
                    buildTimeMs: Date.now() - configStart,
                    error: result.error,
                });
            }
        } catch (err: any) {
            results.push({ config, success: false, buildTimeMs: Date.now() - configStart, error: err.message || String(err) });
        }
    }

    if (myGeneration !== buildGeneration) {
        return;
    }

    previewManager.updateMultiImage(results);

    const totalMs = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    statusBar?.showSuccess(totalMs);
    outputChannel.appendLine(
        `Multi-preview: ${successCount}/${results.length} succeeded in ${(totalMs / 1000).toFixed(1)}s`
    );
}

function sanitizeForPath(name: string): string {
    return BuildRunner.sanitizeConfigName(name);
}

async function startVncMode() {
    if (!buildRunner || !previewManager || !vncManager) {
        return;
    }
    if (vncStarting) {
        return;
    }
    vncStarting = true;
    try {
        const editor = vscode.window.activeTextEditor;
        const doc = editor && isPreviewable(editor.document) ? editor.document : lastPreviewedDoc;
        if (!doc) {
            vscode.window.showWarningMessage('DALi: 프리뷰 가능한 파일이 없습니다. 먼저 .preview.dali.cpp 파일을 열어주세요.');
            return;
        }

        const extraction = extractPreviewCode(doc);
        if (!extraction) {
            return;
        }

        statusBar?.showBuilding();
        previewManager.showLoading();

        const instrumented = instrumentCode(extraction.code, extraction.startLine);
        const buildResult = await buildRunner.buildInteractive(
            instrumented, currentWidth, currentHeight, currentTheme, currentBgColor
        );

        if (!buildResult.success || !buildResult.binPath) {
            statusBar?.showError('VNC 빌드 실패');
            const interactiveTemplate = buildRunner.getInteractiveTemplateContent();
            const offset = getHarnessCodeOffset(interactiveTemplate);
            const errors = parseGccErrors(buildResult.error || '', offset, false, true);
            if (errors.length > 0) {
                const diagnostics = errorsToDiagnostics(errors, doc, extraction.startLine);
                diagnosticCollection.set(doc.uri, diagnostics);
                scheduleShowError(formatErrorsForDisplay(errors));
            } else {
                scheduleShowError(buildResult.error || 'Interactive build failed');
            }
            return;
        }

        const display = xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
        const env = {
            ...buildRunner.buildEnv(display),
            DALI_WINDOW_WIDTH: String(currentWidth),
            DALI_WINDOW_HEIGHT: String(currentHeight),
        };

        const vncResult = await vncManager.startInteractiveMode({
            daliBinaryPath: buildResult.binPath,
            display,
            width: currentWidth,
            height: currentHeight,
            env,
        });

        if (!vncResult.success || !vncResult.wsUrl) {
            statusBar?.showError('VNC 시작 실패');
            scheduleShowError(vncResult.error || 'Failed to start VNC');
            return;
        }

        isVncMode = true;
        previewManager.startVncMode(vncResult.wsUrl);
        statusBar?.showMode('vnc');
        outputChannel.appendLine(`[VNC] Interactive mode started: ${vncResult.wsUrl}`);
    } finally {
        vncStarting = false;
    }
}

async function stopVncMode() {
    if (!vncManager || !previewManager) {
        return;
    }
    await vncManager.stopInteractiveMode();
    isVncMode = false;
    previewManager.stopVncMode();
    statusBar?.showReady();
    outputChannel.appendLine('[VNC] Interactive mode stopped');
}

async function hotReloadVnc(doc: vscode.TextDocument) {
    if (!buildRunner || !previewManager || !vncManager) {
        return;
    }
    if (hotReloading) {
        return;
    }
    hotReloading = true;
    try {
        const extraction = extractPreviewCode(doc);
        if (!extraction) {
            return;
        }

        previewManager.notifyVncReloading();
        const instrumented = instrumentCode(extraction.code, extraction.startLine);
        const buildResult = await buildRunner.buildInteractive(
            instrumented, currentWidth, currentHeight, currentTheme, currentBgColor
        );

        if (!buildResult.success || !buildResult.binPath) {
            outputChannel.appendLine('[VNC] Hot reload build failed');
            return;
        }

        const display = xvfbManager?.getDisplay() || process.env.DISPLAY || ':0';
        const env = {
            ...buildRunner.buildEnv(display),
            DALI_WINDOW_WIDTH: String(currentWidth),
            DALI_WINDOW_HEIGHT: String(currentHeight),
        };

        const ok = await vncManager.restartDaliApp(buildResult.binPath, {
            display,
            width: currentWidth,
            height: currentHeight,
            env,
        });

        if (ok) {
            previewManager.notifyVncReloaded(vncManager.getWebSocketUrl());
            outputChannel.appendLine('[VNC] Hot reload succeeded');
        } else {
            outputChannel.appendLine('[VNC] Hot reload: DALi app restart failed');
        }
    } finally {
        hotReloading = false;
    }
}

export function deactivate() {
    liveDebouncer?.dispose();
    previewServer?.stop();
    vncManager?.dispose();
    previewManager?.dispose();
    buildRunner?.dispose();
    xvfbManager?.stop();
    statusBar?.dispose();
    themeStatusBar?.dispose();
}
