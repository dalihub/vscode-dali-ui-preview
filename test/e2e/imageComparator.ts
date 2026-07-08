/**
 * Image comparison wrapper using pixelmatch + pngjs.
 * Uses require() to avoid compile-time type resolution of optional packages.
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PNG } = require('pngjs') as { PNG: PngModule };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pixelmatch = (require('pixelmatch').default ?? require('pixelmatch')) as (
    img1: Buffer,
    img2: Buffer,
    output: Buffer | null,
    width: number,
    height: number,
    options?: { threshold?: number }
) => number;

export interface ComparisonResult {
    match: boolean;
    diffPercent: number;
    /** Number of differing pixels, or -1 if images have different dimensions. */
    diffPixels: number;
    totalPixels: number;
    /** Only set on mismatch. */
    diffImagePath?: string;
    /** Set when images have different dimensions. */
    sizeMismatch?: { golden: string; actual: string };
}

interface PngImage {
    width: number;
    height: number;
    data: Buffer;
}

interface PngModule {
    sync: {
        read(buf: Buffer): PngImage;
        write(img: PngImage): Buffer;
    };
}

function readPng(filePath: string): PngImage {
    return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(img: PngImage, filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, PNG.sync.write(img));
}

/**
 * Compare two PNG files pixel-by-pixel.
 * Writes a diff image to diffPath on mismatch.
 */
export function compareImages(
    goldenPath: string,
    actualPath: string,
    diffPath: string,
    threshold = 0.1
): ComparisonResult {
    const golden = readPng(goldenPath);
    const actual = readPng(actualPath);

    if (golden.width !== actual.width || golden.height !== actual.height) {
        return {
            match: false,
            diffPercent: 1.0,
            diffPixels: -1,
            totalPixels: golden.width * golden.height,
            sizeMismatch: {
                golden: `${golden.width}x${golden.height}`,
                actual: `${actual.width}x${actual.height}`,
            },
        };
    }

    const { width, height } = golden;
    const totalPixels = width * height;

    // Fast path: count differing pixels without allocating a diff buffer.
    const diffPixels = pixelmatch(golden.data, actual.data, null, width, height, { threshold });
    const diffPercent = diffPixels / totalPixels;
    const match = diffPercent < 0.01;

    if (!match) {
        // Allocate diff buffer only when needed and write diff image.
        const diffData = Buffer.alloc(width * height * 4);
        pixelmatch(golden.data, actual.data, diffData, width, height, { threshold });
        writePng({ width, height, data: diffData }, diffPath);
    }

    return {
        match,
        diffPercent,
        diffPixels,
        totalPixels,
        diffImagePath: match ? undefined : diffPath,
    };
}

export interface Rect { x: number; y: number; w: number; h: number; }
export interface Rgb { r: number; g: number; b: number; }

/**
 * Count pixels within `tol` (per channel, 0-255) of `color` inside `region`.
 * Region is clamped to the image bounds. Used for positive-semantic render
 * assertions ("the image region actually painted this color"), not a
 * full-frame golden diff which a blank frame + blank golden would both pass.
 */
export function countRegionColor(pngPath: string, region: Rect, color: Rgb, tol = 24): number {
    const img = readPng(pngPath);
    const x0 = Math.max(0, Math.floor(region.x));
    const y0 = Math.max(0, Math.floor(region.y));
    const x1 = Math.min(img.width, Math.floor(region.x + region.w));
    const y1 = Math.min(img.height, Math.floor(region.y + region.h));
    let count = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * img.width + x) * 4;
            if (
                Math.abs(img.data[i] - color.r) <= tol &&
                Math.abs(img.data[i + 1] - color.g) <= tol &&
                Math.abs(img.data[i + 2] - color.b) <= tol
            ) {
                count++;
            }
        }
    }
    return count;
}

/**
 * Positive-semantic assertion: at least `minCount` pixels in `region` match
 * `color`. Returns an error string (for a runner TestResult) or null on pass.
 */
export function checkRegionColor(
    pngPath: string, region: Rect, color: Rgb, minCount: number, tol = 24,
): string | null {
    const n = countRegionColor(pngPath, region, color, tol);
    if (n < minCount) {
        return `region (${region.x},${region.y},${region.w}x${region.h}) has only ${n} px ` +
            `near rgb(${color.r},${color.g},${color.b}) (need >= ${minCount}) — image did not render`;
    }
    return null;
}
