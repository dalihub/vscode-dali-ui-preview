import { expect } from 'chai';
import { parseChainExpression, clearParserCache } from '../../src/cppParser';
import * as fs from 'fs';
import * as path from 'path';

/**
 * M0 red baseline.
 *
 * Pins the "before" state: the three slice fixtures (a same-file helper call,
 * a class with unresolved member fields, and namespace-scoped theme constants)
 * are NOT previewable by the current pipeline. The single-expression T1 parser
 * returns null for each — a bare helper call / member field / namespace constant
 * is not a builder chain it can resolve — so each is demoted to the compile
 * path, which then fails with undefined symbols.
 *
 * M2's SliceBuilder makes these self-contained (collect same-file definitions
 * into the globals slot, auto-stub the unresolved members). When that lands,
 * sliceBuilder.test.ts asserts the "after" state. This file stays as the
 * regression floor proving we started from "cannot preview".
 */
describe('M0 red baseline — current pipeline cannot preview non-self-contained code', () => {
    // __dirname = out/test/unit → up 3 → project root → test/fixtures/slice
    const dir = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'slice');
    const fixtures = ['helper_same_file.cpp', 'member_field.cpp', 'theme_const.cpp'];

    beforeEach(() => clearParserCache());

    for (const f of fixtures) {
        it(`${f}: T1 parser returns null (needs slice extraction)`, () => {
            const code = fs.readFileSync(path.join(dir, f), 'utf-8');
            expect(parseChainExpression(code), `${f} should not yet be previewable`).to.be.null;
        });
    }

    it('all three fixtures exist on disk', () => {
        for (const f of fixtures) {
            expect(fs.existsSync(path.join(dir, f)), `${f} missing`).to.be.true;
        }
    });
});
