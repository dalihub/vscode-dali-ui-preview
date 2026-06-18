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

/**
 * Provenance entry (ADR-007) — one "the tool filled/approximated this" signal.
 * `kind` is a CLOSED enum of 6 (sample-data, image-substitute, bg-only-theme,
 * focus-approx, untranslated, stub); adding a kind means amending ADR-007. The
 * host merges these into the metadata JSON's top-level `provenance` array (no
 * new IPC channel); the visible badge chip is consumed by the webview in M5
 * (F5.3). M3 only PREPARES the `untranslated` channel (WU-M3.6).
 */
export interface ProvenanceEntry {
    kind:
        | 'sample-data'
        | 'image-substitute'
        | 'bg-only-theme'
        | 'focus-approx'
        | 'untranslated'
        | 'stub';
    detail: string;
}

/**
 * Locales that lay out right-to-left. Used to mirror a rendered ROW (ADR-004
 * F3.4 / WU-M3.5): when a config's `locale` is one of these, the build sets the
 * root view's LAYOUT_DIRECTION to RIGHT_TO_LEFT so a ROW FlexLayout mirrors.
 * This is LAYOUT mirroring only — NOT translation (no catalog; ADR-004 §2).
 * Matched by the BASE language subtag (the part before `_`/`-`), so `ar`,
 * `ar_EG`, and `ar-EG` all count as RTL.
 */
export const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Returns true when `locale` lays out right-to-left (Arabic/Hebrew/Persian/Urdu).
 * The base language subtag is compared (case-insensitive), so `ar_EG` → `ar`.
 */
export function isRtlLocale(locale?: string): boolean {
    if (!locale) {
        return false;
    }
    const base = locale.split(/[_-]/)[0].toLowerCase();
    return RTL_LOCALES.has(base);
}

/**
 * Static preset registry (ADR-001 §2): a `// @preview-preset: <name>` line
 * expands to these PreviewConfig variants and APPENDS them to `configs[]` (so a
 * preset can be combined with explicit `@preview-config` lines). The catalog IS
 * the surface — user-defined presets are CUT, so an unregistered name is ignored
 * with an outputChannel warning (see `expandPreset`). Kept SMALL and demo-worthy:
 *   - light-dark  → theme=light + theme=dark (the F3.2 token-reskin comparison)
 *   - locales     → an LTR baseline + an RTL (ar) variant (the F3.4 mirror)
 *   - font-sizes  → fontScale 1.0 + 1.5 (the F3.1 text-scale comparison)
 *   - screen-sizes→ a few common width/height device frames
 */
export const PREVIEW_PRESETS: Readonly<Record<string, PreviewConfig[]>> = {
    'light-dark': [
        { name: 'Light', theme: 'light' },
        { name: 'Dark', theme: 'dark' },
    ],
    locales: [
        { name: 'EN' },
        { name: 'Arabic', locale: 'ar' },
    ],
    'font-sizes': [
        { name: 'Default', fontScale: 1.0 },
        { name: 'Large', fontScale: 1.5 },
    ],
    'screen-sizes': [
        { name: 'Phone', width: 720, height: 1280 },
        { name: 'Watch', width: 360, height: 360 },
        { name: 'Tablet', width: 1280, height: 800 },
    ],
};

/**
 * Expand a `// @preview-preset: <name>` into its PreviewConfig variants, or
 * return null when the name is not in PREVIEW_PRESETS (the caller logs an
 * "unknown preset" warning and ignores the line — ADR-001 §2, no silent error).
 * Returns FRESH copies so callers can mutate variants without corrupting the
 * shared registry.
 */
export function expandPreset(name: string): PreviewConfig[] | null {
    const variants = PREVIEW_PRESETS[name];
    if (!variants) {
        return null;
    }
    return variants.map((v) => ({ ...v }));
}
