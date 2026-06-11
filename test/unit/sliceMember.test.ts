import { expect } from 'chai';
import { buildSlice, findPreviewFunction } from '../../src/sliceBuilder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * P5 — class member function with a struct member field (the dominant real-world
 * shape). A qualified `Class::Build()` referencing `this->mProfile` must: recognise
 * the member function, stub mProfile with its EXACT type (Profile), and collect the
 * Profile struct definition. Previously mProfile got a fuzzy vector<int> stub and
 * mProfile.name/.color failed to compile.
 */
describe('sliceBuilder member function (P5)', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'slice-member');
    const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

    it('recognises a qualified Class::Build() as the preview target', () => {
        const fn = findPreviewFunction(read('card.cpp'));
        expect(fn?.fnName).to.equal('Build');
    });

    it('stubs a struct member with its exact type + collects the struct def', () => {
        const slice = buildSlice(read('card.cpp'), 'card.cpp');
        expect(slice.rung).to.equal('heuristic');
        expect(slice.unresolvedStubs).to.deep.equal([]);          // mProfile resolved (member)
        expect(slice.globals).to.include('struct Profile');        // struct def collected
        expect(slice.globals).to.include('Profile mProfile{}');    // exact-type member stub
    });

    it('leaves scalar/string members to the context-based stub (no regression)', () => {
        const mf = fs.readFileSync(path.join(dir, '..', 'slice', 'member_field.cpp'), 'utf8');
        const slice = buildSlice(mf, 'member_field.cpp');
        // std::string mName / uint32_t mAccent are known scalar/string types, so they
        // stay weak (context) stubs rather than member-takeover.
        expect(slice.unresolvedStubs).to.include.members(['mName', 'mAccent']);
    });
});
