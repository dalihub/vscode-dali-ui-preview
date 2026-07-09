import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PNG } = require('pngjs');
import { countRegionColor, checkRegionColor } from '../e2e/imageComparator';

function writeRegionPng(
    file: string, w: number, h: number,
    region: { x: number; y: number; w: number; h: number },
    rgb: { r: number; g: number; b: number },
): void {
    const png = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const inRegion = x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h;
            png.data[i] = inRegion ? rgb.r : 0;
            png.data[i + 1] = inRegion ? rgb.g : 0;
            png.data[i + 2] = inRegion ? rgb.b : 0;
            png.data[i + 3] = 255;
        }
    }
    fs.writeFileSync(file, PNG.sync.write(png));
}

describe('countRegionColor / checkRegionColor', () => {
    const tmp = path.join(os.tmpdir(), 'region-color-test');
    const magenta = { r: 255, g: 0, b: 255 };
    const region = { x: 10, y: 10, w: 20, h: 20 };
    before(() => fs.mkdirSync(tmp, { recursive: true }));

    it('counts pixels of the target color inside the region', () => {
        const f = path.join(tmp, 'magenta.png');
        writeRegionPng(f, 40, 40, region, magenta);
        assert.strictEqual(countRegionColor(f, region, magenta), 400);
    });

    it('passes when the region actually painted', () => {
        const f = path.join(tmp, 'ok.png');
        writeRegionPng(f, 40, 40, region, magenta);
        assert.strictEqual(checkRegionColor(f, region, magenta, 300), null);
    });

    it('fails on a blank frame (image did not render)', () => {
        const f = path.join(tmp, 'blank.png');
        writeRegionPng(f, 40, 40, { x: 0, y: 0, w: 0, h: 0 }, magenta);
        const err = checkRegionColor(f, region, magenta, 300);
        assert.ok(err && /did not render/.test(err), `expected failure, got: ${err}`);
    });
});
