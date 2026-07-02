/*
 * exampleTourSettings.test.ts — guard the "samples render smaller than the TV
 * target" regression.
 *
 * The bundled `examples/` tour is TV-targeted (1920×1080 FHD). `Open Samples`
 * copies it into a chosen folder and opens it in a NEW window, so the tour must
 * carry its own workspace `.vscode/settings.json` pinning the canvas size —
 * otherwise it inherits whatever `daliPreview.previewWidth/Height` the user set
 * globally (e.g. a 600×400 fast-iteration override) and every sample renders at
 * the wrong, smaller resolution instead of TV FHD.
 *
 * Pure-fs test: asserts the shipped settings pin the FHD canvas.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const EXAMPLES_SETTINGS = path.resolve(
    __dirname,
    '../../../examples/.vscode/settings.json',
);

describe('examples tour pins the TV FHD canvas', () => {
    it('ships examples/.vscode/settings.json', () => {
        expect(
            fs.existsSync(EXAMPLES_SETTINGS),
            `Missing ${EXAMPLES_SETTINGS}. The TV samples tour must pin its canvas ` +
            `size so it does not inherit a smaller global daliPreview override.`,
        ).to.equal(true);
    });

    it('pins previewWidth/Height to 1920×1080', () => {
        const cfg = JSON.parse(fs.readFileSync(EXAMPLES_SETTINGS, 'utf8'));
        expect(cfg['daliPreview.previewWidth'], 'previewWidth').to.equal(1920);
        expect(cfg['daliPreview.previewHeight'], 'previewHeight').to.equal(1080);
    });
});
