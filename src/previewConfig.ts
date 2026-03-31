export interface PreviewConfig {
    name: string;
    width?: number;
    height?: number;
    theme?: 'light' | 'dark';
}

export interface MultiPreviewResult {
    config: PreviewConfig;
    success: boolean;
    pngPath?: string;
    metadataPath?: string;
    buildTimeMs: number;
    error?: string;
}
