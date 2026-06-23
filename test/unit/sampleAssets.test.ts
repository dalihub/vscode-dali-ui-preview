/*
 * sampleAssets.test.ts — guard against the "all image samples render broken"
 * regression class.
 *
 * Every local-file image referenced by a sample (ImageView::New("…") /
 * SetResourceUrl("…")) MUST resolve relative to the sample file's directory, so
 * the asset-staging step (BuildRunner.stageImageAssets) can copy it into the
 * build mount and the preview renders the real image instead of the gray
 * broken-image placeholder.
 *
 * This is a pure-fs test (no vscode / no docker): it scans the shipped samples
 * and fails fast if a sample points at a path that does not exist — exactly the
 * stale `/home/woochan/tizen/paperclip/...assets/...` paths that shipped broken.
 * Remote/custom-scheme URLs (http(s)://, foo://) and the intentional
 * unreachable-URL demo (broken-image.preview.dali.cpp) are allowed to not exist.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const SAMPLES_DIR = path.resolve(__dirname, '../../../test/samples');

/** Pull every ImageView::New("…") / SetResourceUrl("…") string-literal arg. */
function imageUrlsIn(code: string): string[] {
    const re = /(?:ImageView\s*::\s*New|SetResourceUrl)\s*\(\s*"([^"]*)"/g;
    const urls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) { urls.push(m[1]); }
    return urls;
}

function isRemote(url: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);
}

describe('sample image assets resolve', () => {
    const files = fs
        .readdirSync(SAMPLES_DIR)
        .filter((f) => f.endsWith('.cpp') || f.endsWith('.h'))
        .map((f) => path.join(SAMPLES_DIR, f));

    it('scans at least one sample (sanity)', () => {
        expect(files.length).to.be.greaterThan(0);
    });

    for (const file of files) {
        const code = fs.readFileSync(file, 'utf8');
        const local = imageUrlsIn(code).filter((u) => u && !isRemote(u));
        if (local.length === 0) { continue; }

        it(`${path.basename(file)}: every local image path exists`, () => {
            const dir = path.dirname(file);
            for (const url of local) {
                const resolved = path.isAbsolute(url) ? url : path.resolve(dir, url);
                expect(
                    fs.existsSync(resolved),
                    `${path.basename(file)} references "${url}" which does not resolve to a file ` +
                    `(looked at ${resolved}). Use a path relative to the sample, e.g. "assets/<name>".`,
                ).to.equal(true);
            }
        });
    }
});
