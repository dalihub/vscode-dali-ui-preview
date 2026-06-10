import { expect } from 'chai';
import { buildSlice, scanRefs } from '../../src/sliceBuilder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * M2 — SliceBuilder (Rung 2 heuristic). Asserts the "after" state that M0's
 * red baseline pinned as "before": the same-file fixtures become self-contained.
 * The decisive end-to-end proof (slice → 3-slot template → docker g++ exit 0) is
 * recorded in docs/autoplan/m2/exec-validation.md; here we lock the slice logic.
 */
describe('sliceBuilder (Rung 2)', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'slice');
    const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf-8');

    describe('buildSlice', () => {
        it('helper_same_file: collects the same-file helper, no stubs needed', () => {
            const r = buildSlice(read('helper_same_file.cpp'), 'helper_same_file.cpp');
            expect(r.rung).to.equal('heuristic');
            expect(r.globals).to.include('MakeChip');
            expect(r.unresolvedStubs).to.deep.equal([]);
        });

        it('theme_const: collects the namespace, no stubs needed', () => {
            const r = buildSlice(read('theme_const.cpp'), 'theme_const.cpp');
            expect(r.rung).to.equal('heuristic');
            expect(r.globals).to.include('namespace theme');
            expect(r.unresolvedStubs).to.deep.equal([]);
        });

        it('member_field: stubs unresolved members with BODIED weak defs (Inv-2 / RTLD_NOW)', () => {
            const r = buildSlice(read('member_field.cpp'), 'member_field.cpp');
            expect(r.unresolvedStubs).to.include.members(['mName', 'mAccent']);
            // string context → "Sample"; bodied so dlopen(RTLD_NOW) won't crash.
            expect(r.globals).to.include('std::string mName = "Sample"');
            expect(r.globals).to.match(/__attribute__\(\(weak\)\)/);
            // a stub must never be a bare declaration — it must carry a value/body.
            expect(r.globals).to.not.match(/__attribute__\(\(weak\)\)\s+[\w:]+\s+\w+\s*;/);
        });

        it('self-contained builder chain → single-fn passthrough (byte-identical floor)', () => {
            const code = 'return View::New().SetBackgroundColor(UiColor(0x1e1e2e));';
            const r = buildSlice(code, 'x.cpp');
            expect(r.rung).to.equal('single-fn');
            expect(r.globals).to.equal('');
            expect(r.includes).to.equal('');
            expect(r.body).to.equal(code);
        });
    });

    describe('scanRefs', () => {
        it('excludes dali/std symbols and scope members, keeps project-local refs', () => {
            const refs = scanRefs('return FlexLayout::New().Children({ MakeCard(theme::ACCENT) });');
            expect(refs.has('New')).to.equal(false);        // Type::New — scope member
            expect(refs.has('ACCENT')).to.equal(false);     // theme::ACCENT — scope member
            expect(refs.has('FlexLayout')).to.equal(false); // known dali type
            expect(refs.has('Children')).to.equal(false);   // .Children — method
            expect(refs.has('MakeCard')).to.equal(true);    // project-local call → resolve
            expect(refs.has('theme')).to.equal(true);       // scope head → resolve
        });
    });
});
