import { expect } from 'chai';
import { sanitizeUnsupportedGlyphs } from '../../src/codeExtractor';

/**
 * The docker preview runtime has only DejaVu — emoji with no glyph abort DALi when
 * spread across separate Labels. sanitizeUnsupportedGlyphs replaces them with □ in
 * string literals (real devices have emoji fonts; preview doesn't). Box-drawing /
 * geometric / degree stay (they render fine).
 */
describe('sanitizeUnsupportedGlyphs (emoji → □ for preview font)', () => {
    it('replaces emoji in string literals', () => {
        const out = sanitizeUnsupportedGlyphs('return Label::New("☀ Sunny ⛅");');
        expect(out.replaced).to.equal(true);
        expect(out.code).to.include('"□ Sunny □"');
    });

    it('keeps box-drawing / geometric / degree (they render fine)', () => {
        const src = 'return Label::New("55° ━━━ ● ▮ 70°");';
        const out = sanitizeUnsupportedGlyphs(src);
        expect(out.replaced).to.equal(false);
        expect(out.code).to.equal(src);
    });
});
