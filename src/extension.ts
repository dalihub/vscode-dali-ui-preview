import * as vscode from 'vscode';
import { PreviewManager } from './previewManager';
import { BuildRunner } from './buildRunner';
import { PreviewServer } from './previewServer';
import { XvfbManager } from './xvfbManager';
import { StatusBarManager } from './statusBar';
import { extractPreviewCode, isPreviewable, instrumentCode } from './codeExtractor';
import { parseGccErrors, getHarnessCodeOffset, getPluginCodeOffset, formatErrorsForDisplay, errorsToDiagnostics } from './errorParser';
import { runSetupWizard, isDaliConfigured } from './setupWizard';
import * as fs from 'fs';
import * as path from 'path';

let previewManager: PreviewManager | undefined;
let buildRunner: BuildRunner | undefined;
let previewServer: PreviewServer | undefined;
let xvfbManager: XvfbManager | undefined;
let statusBar: StatusBarManager | undefined;
let diagnosticCollection: vscode.DiagnosticCollection;
let building = false;
let outputChannel: vscode.OutputChannel;
let lastPreviewedDoc: vscode.TextDocument | undefined;

// Current preview dimensions (managed directly, not via settings)
let currentWidth = 1024;
let currentHeight = 600;

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('DALi Preview');
    outputChannel.appendLine('DALi Preview extension activating...');

    // Load initial size from settings
    const config = vscode.workspace.getConfiguration('daliPreview');
    currentWidth = config.get('previewWidth', 1024);
    currentHeight = config.get('previewHeight', 600);

    diagnosticCollection = vscode.languages.createDiagnosticCollection('dali-preview');
    context.subscriptions.push(diagnosticCollection);

    // Status bar (always visible)
    statusBar = new StatusBarManager(context);
    statusBar.showReady();

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

    // Build runner
    buildRunner = new BuildRunner(context, xvfbManager, outputChannel);

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

    // Command: DALi: Open Preview
    const openCmd = vscode.commands.registerCommand('dali.openPreview', () => {
        ensurePreviewManager(context);
        previewManager!.show();
    });

    // Auto-preview on save
    const onSave = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (!isPreviewable(doc)) {
            return;
        }
        ensurePreviewManager(context);
        previewManager!.show();
        await runPreview(doc);
    });

    // Auto-open preview panel when opening a previewable file
    const onOpen = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isPreviewable(editor.document)) {
            ensurePreviewManager(context);
            previewManager!.show();
        }
    });

    context.subscriptions.push(openCmd, onSave, onOpen, outputChannel);

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
    }
}

async function runPreview(doc: vscode.TextDocument) {
    if (!buildRunner || !previewManager || building) {
        return;
    }

    // Extract code
    const extraction = extractPreviewCode(doc);
    if (!extraction) {
        return;
    }

    lastPreviewedDoc = doc;

    building = true;
    statusBar?.showBuilding();
    previewManager.showLoading();
    diagnosticCollection.delete(doc.uri);

    const startTime = Date.now();

    // Instrument code with line annotations for click-to-code
    const instrumented = instrumentCode(extraction.code, extraction.startLine);

    try {
        let result;
        let usedServerMode = false;

        // Phase 2: dlopen server mode
        if (previewServer?.isRunning) {
            const pluginResult = await buildRunner.compilePlugin(instrumented);
            if (pluginResult.success && pluginResult.soPath) {
                const pngPath      = '/tmp/dali_preview/preview.png';
                const metadataPath = '/tmp/dali_preview/preview_metadata.json';
                result = await previewServer.reload(
                    pluginResult.soPath, pngPath, metadataPath, currentWidth, currentHeight
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
                    previewManager.showError(formatErrorsForDisplay(errors));
                } else {
                    previewManager.showError(pluginResult.error || 'Plugin compile failed');
                }
                statusBar?.showError(pluginResult.error?.split('\n')[0] || 'Build failed');
                outputChannel.appendLine(`Plugin compile failed in ${(buildTimeMs / 1000).toFixed(1)}s`);
                return;
            }
        }

        // Phase 1 fallback: full harness compile + run
        if (!usedServerMode) {
            result = await buildRunner.buildAndRun(instrumented, currentWidth, currentHeight);
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
            previewManager.updateImage(result!.pngPath, buildTimeMs, metadata);
            const modeLabel = usedServerMode ? '⚡ server' : '🔨 compile';
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
                previewManager.showError(formatErrorsForDisplay(errors));
            } else {
                previewManager.showError(result!.error || 'Unknown error');
            }

            statusBar?.showError(result!.error?.split('\n')[0] || 'Build failed');
            outputChannel.appendLine(`Preview failed: ${result!.error?.substring(0, 200)}`);
        }
    } catch (err: any) {
        previewManager.showError(`Unexpected error: ${err.message || err}`);
        statusBar?.showError(err.message || 'Error');
    } finally {
        building = false;
    }
}

export function deactivate() {
    previewServer?.stop();
    previewManager?.dispose();
    buildRunner?.dispose();
    xvfbManager?.stop();
    statusBar?.dispose();
}
