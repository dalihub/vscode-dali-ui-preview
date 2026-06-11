import { expect } from 'chai';
import { buildSlice } from '../../src/sliceBuilder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Rung1 (heuristic cross-file): the preview target calls a helper whose
 * definition lives in ANOTHER file (#include'd). buildSlice resolves it from the
 * extraSources the orchestrator reads off the #include lines. Without those
 * sources it falls back to a weak stub (a blank banner) — the honest boundary.
 */
describe('sliceBuilder cross-file (Rung 1 heuristic)', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'slice-xfile');
    const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

    it('collects a helper defined in another #include\'d source (.cpp)', () => {
        const slice = buildSlice(read('entry.cpp'), 'entry.cpp', undefined, [
            { path: 'widgets.h', text: read('widgets.h') },
            { path: 'widgets.cpp', text: read('widgets.cpp') },
        ]);
        expect(slice.rung).to.equal('heuristic');
        expect(slice.unresolvedStubs).to.deep.equal([]);          // MakeBanner resolved
        expect(slice.globals).to.include('MakeBanner');
        expect(slice.globals).to.include('Label::New(text)');     // the REAL def, not a stub
        expect(slice.sourcePaths).to.include('widgets.cpp');
    });

    it('without extraSources the cross-file helper falls back to a weak stub', () => {
        const slice = buildSlice(read('entry.cpp'), 'entry.cpp');
        expect(slice.unresolvedStubs).to.deep.equal(['MakeBanner']);
        expect(slice.globals).to.match(/__attribute__\(\(weak\)\).*MakeBanner/);
    });
});
