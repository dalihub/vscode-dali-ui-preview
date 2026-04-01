export interface PreviewConfig {
    name: string;
    width?: number;
    height?: number;
    theme?: 'light' | 'dark';
    locale?: string;      // e.g. 'ko_KR', 'ja_JP'
    fontScale?: number;   // 0.5 ~ 2.0
    font?: string;        // e.g. 'NotoSansKR.ttf'
}

export interface MultiPreviewResult {
    config: PreviewConfig;
    success: boolean;
    pngPath?: string;
    metadataPath?: string;
    buildTimeMs: number;
    error?: string;
}
