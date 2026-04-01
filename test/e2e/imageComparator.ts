/**
 * Image comparison wrapper using pixelmatch + pngjs.
 * Uses require() to avoid compile-time type resolution of optional packages.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface ComparisonResult {
    match: boolean;
    diffPercent: number;
    diffPixels: number;
    totalPixels: number;
    diffImagePath?: string;
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PNG } = require('pngjs') as { PNG: PngModule };
    return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(img: PngImage, filePath: string): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PNG } = require('pngjs') as { PNG: PngModule };
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
export async function compareImages(
    goldenPath: string,
    actualPath: string,
    diffPath: string,
    threshold = 0.1
): Promise<ComparisonResult> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pixelmatch = require('pixelmatch') as (
        img1: Buffer,
        img2: Buffer,
        output: Buffer | null,
        width: number,
        height: number,
        options?: { threshold?: number }
    ) => number;

    const golden = readPng(goldenPath);
    const actual = readPng(actualPath);

    if (golden.width !== actual.width || golden.height !== actual.height) {
        return {
            match: false,
            diffPercent: 1.0,
            diffPixels: -1,
            totalPixels: golden.width * golden.height,
        };
    }

    const { width, height } = golden;
    const totalPixels = width * height;
    const diffData = Buffer.alloc(width * height * 4);

    const diffPixels = pixelmatch(golden.data, actual.data, diffData, width, height, { threshold });
    const diffPercent = diffPixels / totalPixels;
    const match = diffPercent < 0.01;

    if (!match) {
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
