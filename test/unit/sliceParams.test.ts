import { expect } from 'chai';
import { buildSlice, findPreviewFunction } from '../../src/sliceBuilder';
import * as fs from 'fs';
import * as path from 'path';

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
        expect(slice.globals).to.include('label = "Sample"');
    });

    it('a const-value param is stubbed WITHOUT const (weak needs external linkage)', () => {
        const slice = buildSlice(cards, 'cards.cpp', statBody, extra,
            [{ type: 'const std::string&', name: 'label' }]);
        expect(slice.globals).to.include('std::string label = "Sample"');
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
