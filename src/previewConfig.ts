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
