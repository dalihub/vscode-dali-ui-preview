import { expect } from 'chai';
import { buildSlice, scanRefs, findPreviewFunction } from '../../src/sliceBuilder';
import { parseChainExpression, clearParserCache } from '../../src/cppParser';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SliceBuilder core: the same-file slice logic (Rung 2 heuristic), ref scanning,
 * and arg-receiving (parameterised) UI stubbing — plus the M0 "red baseline" that
 * motivates the whole slice path. Cross-file lives in sliceBuilder.crossfile,
 * member synthesis in sliceBuilder.member, the orchestrator path in
 * sliceBuilder.integration.
 */

/**
 * M0 red baseline (why the slice path exists).
 *
 * Pins the "before" state: the three slice fixtures (a same-file helper call,
 * a class with unresolved member fields, and namespace-scoped theme constants)
 * are NOT previewable by the single-expression T1 parser — it returns null for
 * each, so each is demoted to the compile path, which then fails with undefined
 * symbols. The "after" state (slicing makes them self-contained) is locked by
 * the `sliceBuilder (Rung 2)` block below; this stays as the regression floor
 * proving we started from "cannot preview".
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
            // string context → placeholder named after the field (mName → "Name");
            // bodied so dlopen(RTLD_NOW) won't crash.
            expect(r.globals).to.include('std::string mName = "Name"');
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

/**
 * Arg-receiving UI (P1/P14 factories like MakeStatCard(label, value, accent)).
 * Hybrid strategy (benchmarked against Compose @PreviewParameter / SwiftUI #Preview):
 *  - auto stub: preview the factory directly, params filled with sample values;
 *  - wrapper: a `// @preview` fn that calls it with meaningful literals wins.
 * Plus the two bugs that made it render nothing: param mismatch + const-value weak.
 */
describe('sliceBuilder param stubs — arg-receiving UI (cards.cpp)', () => {
    const app = path.join(__dirname, '..', '..', '..', 'samples', 'flow-wallet');
    const cards = fs.readFileSync(path.join(app, 'widgets', 'cards.cpp'), 'utf8');
    const extra = [
        { path: 'tokens.h', text: fs.readFileSync(path.join(app, 'theme', 'tokens.h'), 'utf8') },
        { path: 'cards.h', text: fs.readFileSync(path.join(app, 'widgets', 'cards.h'), 'utf8') },
    ];
    // The body extractFunctionBody returns when a CodeLens targets MakeStatCard.
    const statBody = 'return FlexLayout::New().SetDirection(FlexDirection::COLUMN).SetBackgroundColor(UiColor(theme::SURFACE)).SetCornerRadius(theme::RADIUS_CARD).SetPadding(Extents(49,49,42,42)).SetRequestedWidth(553.0f).Children({ Label::New(label.c_str()).SetFontSize(39).SetTextColor(UiColor(theme::MUTED)), Label::New(value.c_str()).SetFontSize(63).SetTextColor(UiColor(accent)) });';

    it('entryParams (CodeLens-targeted fn) win over the first-function guess', () => {
        // cards.cpp's FIRST fn is MakeSectionHeader(title) but we preview MakeStatCard.
        const slice = buildSlice(cards, 'cards.cpp', statBody, extra,
            [{ type: 'const std::string&', name: 'label' }, { type: 'const std::string&', name: 'value' }, { type: 'uint32_t', name: 'accent' }]);
        expect(slice.unresolvedStubs).to.deep.equal([]);
        expect(slice.globals).to.not.match(/\btitle\b/);             // no bogus first-fn param
        expect(slice.globals).to.include('label = "Label"');         // placeholder named after the field
    });

    it('a const-value param is stubbed WITHOUT const (weak needs external linkage)', () => {
        const slice = buildSlice(cards, 'cards.cpp', statBody, extra,
            [{ type: 'const std::string&', name: 'label' }]);
        expect(slice.globals).to.include('std::string label = "Label"');
        expect(slice.globals).to.not.include('const std::string label');  // would be a link error
    });

    it('an unsigned param defaults to a visible colour (not 0/black)', () => {
        const slice = buildSlice(cards, 'cards.cpp', statBody, extra,
            [{ type: 'uint32_t', name: 'accent' }]);
        expect(slice.globals).to.include('uint32_t accent = 0x888888');
    });

    it('a // @preview wrapper wins and keeps the real literal args', () => {
        const wrapper = cards.replace('} // namespace wallet',
            '// @preview\nView StatCardPreview() { return MakeStatCard("Food", "$428", 0xff5555); }\n} // namespace wallet');
        expect(findPreviewFunction(wrapper)?.fnName).to.equal('StatCardPreview');
        const slice = buildSlice(wrapper, 'cards.cpp', undefined, extra);
        expect(slice.unresolvedStubs).to.deep.equal([]);             // MakeStatCard resolved
        expect(slice.body).to.match(/Food/);                          // real literal kept
        expect(slice.globals).to.include('View MakeStatCard');        // def collected
    });
});
