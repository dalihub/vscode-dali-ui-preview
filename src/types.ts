// Re-export existing types from their source modules
export { BuildResult, AnimationBuildResult, InteractiveBuildResult } from './buildRunner';
export { PreviewConfig, MultiPreviewResult } from './previewConfig';
export { ExtractionResult } from './codeExtractor';

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
