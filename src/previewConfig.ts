export interface PreviewConfig {
    name: string;
    width?: number;
    height?: number;
    theme?: 'light' | 'dark';
    locale?: string;      // e.g. 'ko_KR', 'ja_JP'
    fontScale?: number;   // 0.5 ~ 2.0
    font?: string;        // e.g. 'NotoSansKR.ttf'
    animation?: boolean;  // enable animation capture mode
    duration?: number;    // animation duration in ms (500 ~ 10000, default 2000)
    fps?: number;         // frames per second (5 ~ 30, default 10)
}

/**
 * Parsed `// @preview-state:` directive (ADR-001). Only `focus` and `progress`
 * keys are part of the grammar — any other key is ignored (the general
 * key=value state grammar is deliberately CUT).
 *
 * `progress` is DECLARED here but applied in M5 (the M2 milestone parses it but
 * does not feed it to the renderer yet).
 */
export interface PreviewState {
    focus?: string;       // variable/handle name or "Name" of the node to focus
    progress?: number;    // 0..1 animation scrub position (declared only; applied in M5)
}

export interface MultiPreviewResult {
    config: PreviewConfig;
    success: boolean;
    pngPath?: string;
    gifPath?: string;
    metadataPath?: string;
    buildTimeMs: number;
    frameCount?: number;
    error?: string;
}
