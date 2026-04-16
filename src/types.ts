import * as vscode from 'vscode';

// Re-export existing types from their source modules
export { BuildResult, AnimationBuildResult, InteractiveBuildResult } from './buildRunner';
export { PreviewConfig, MultiPreviewResult } from './previewConfig';
export { ExtractionResult } from './codeExtractor';

/**
 * Full context needed to execute a single preview build cycle.
 */
export interface PreviewContext {
    document: vscode.TextDocument;
    extraction: import('./codeExtractor').ExtractionResult;
    width: number;
    height: number;
    theme: 'light' | 'dark';
    bgColor?: string;
    opId: string;
}

/**
 * The rendering pipeline used for the current preview.
 *
 * - `parser`  — AST-based fast path via cppParser + PreviewServer.renderJson
 * - `server`  — dlopen-based path via PreviewServer.reload
 * - `compile` — full harness compile + execute (Phase 1 fallback)
 * - `vnc`     — interactive VNC mode
 * - `device`  — on-device preview via SDB
 */
export type PreviewMode = 'parser' | 'server' | 'compile' | 'vnc' | 'device';

/**
 * Snapshot of the extension's preview-related runtime state.
 */
export interface PreviewState {
    building: boolean;
    isVncMode: boolean;
    vncStarting: boolean;
    hotReloading: boolean;
    devicePreviewRunning: boolean;
    buildGeneration: number;
    currentWidth: number;
    currentHeight: number;
    currentTheme: 'light' | 'dark';
    currentBgColor?: string;
}
