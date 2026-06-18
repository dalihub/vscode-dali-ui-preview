import { expect } from 'chai';
import { createMockDocument } from '../helpers/mockDocument';
import { extractPreviewCode } from '../../src/codeExtractor';
import { expandPreset, PREVIEW_PRESETS } from '../../src/previewConfig';

// WU-M3.7 — `// @preview-preset: <name>` expands into multiple PreviewConfig
// entries (static registry). Pure parsing/expansion — no render.

describe('previewConfig — expandPreset() / PREVIEW_PRESETS', () => {
    it('expands light-dark into theme=light + theme=dark', () => {
        const out = expandPreset('light-dark');
        expect(out).to.not.be.null;
        expect(out!).to.have.length(2);
        expect(out![0].theme).to.equal('light');
        expect(out![1].theme).to.equal('dark');
    });

    it('expands screen-sizes into width/height device frames', () => {
        const out = expandPreset('screen-sizes');
        expect(out).to.not.be.null;
        expect(out!.length).to.be.greaterThan(1);
        // Every screen-size variant carries an explicit width+height.
        for (const v of out!) {
            expect(v.width, `width for ${v.name}`).to.be.a('number');
            expect(v.height, `height for ${v.name}`).to.be.a('number');
        }
    });

    it('expands locales into an LTR baseline + an RTL (ar) variant', () => {
        const out = expandPreset('locales');
        expect(out).to.not.be.null;
        expect(out!.some(v => v.locale === 'ar')).to.equal(true);
        expect(out!.some(v => v.locale === undefined)).to.equal(true);
    });

    it('returns null for an unregistered preset name', () => {
        expect(expandPreset('bogus')).to.equal(null);
        expect(expandPreset('')).to.equal(null);
    });

    it('returns FRESH copies so callers cannot corrupt the registry', () => {
        const a = expandPreset('light-dark')!;
        a[0].name = 'MUTATED';
        const b = expandPreset('light-dark')!;
        expect(b[0].name).to.not.equal('MUTATED');
        // The shared registry object is also untouched.
        expect(PREVIEW_PRESETS['light-dark'][0].name).to.not.equal('MUTATED');
    });
});

describe('codeExtractor — @preview-preset expansion', () => {
    it('expands a preset into multiple configs (preview-file mode)', () => {
        const content = [
            '// @preview-preset: light-dark',
            'return View::New();',
        ].join('\n');
        const doc = createMockDocument('/tmp/p.preview.dali.cpp', content);

        const result = extractPreviewCode(doc as any);
        expect(result).to.not.be.null;
        expect(result!.configs).to.have.length(2);
        expect(result!.configs![0].theme).to.equal('light');
        expect(result!.configs![1].theme).to.equal('dark');
    });

    it('excludes the @preview-preset line from the extracted code', () => {
        const content = [
            '// @preview-preset: light-dark',
            'return View::New();',
        ].join('\n');
        const doc = createMockDocument('/tmp/p.preview.dali.cpp', content);

        const result = extractPreviewCode(doc as any);
        expect(result!.code).to.not.include('@preview-preset');
        expect(result!.code.trim()).to.equal('return View::New();');
    });

    it('appends preset variants to explicit @preview-config lines (both combine)', () => {
        const content = [
            '// @preview-config: name="Watch", width=360, height=360',
            '// @preview-preset: light-dark',
            'return View::New();',
        ].join('\n');
        const doc = createMockDocument('/tmp/p.preview.dali.cpp', content);

        const result = extractPreviewCode(doc as any);
        // 1 explicit config + 2 from the preset = 3 total, in order.
        expect(result!.configs).to.have.length(3);
        expect(result!.configs![0].name).to.equal('Watch');
        expect(result!.configs![1].theme).to.equal('light');
        expect(result!.configs![2].theme).to.equal('dark');
    });

    it('expands a preset in marker mode (.cpp)', () => {
        const content = [
            '#include <dali/dali.h>',
            '// @dali-preview-begin',
            '// @preview-preset: light-dark',
            'return View::New();',
            '// @dali-preview-end',
        ].join('\n');
        const doc = createMockDocument('/tmp/x.cpp', content);

        const result = extractPreviewCode(doc as any);
        expect(result).to.not.be.null;
        expect(result!.mode).to.equal('marker');
        expect(result!.configs).to.have.length(2);
        expect(result!.code).to.not.include('@preview-preset');
    });

    it('ignores an unknown preset (no configs, line still stripped from code)', () => {
        const content = [
            '// @preview-preset: bogus',
            'return View::New();',
        ].join('\n');
        const doc = createMockDocument('/tmp/p.preview.dali.cpp', content);

        const result = extractPreviewCode(doc as any);
        // Unknown preset contributes no configs → single-render (configs undefined).
        expect(result!.configs).to.equal(undefined);
        // …but the directive line is not treated as preview code.
        expect(result!.code).to.not.include('@preview-preset');
        expect(result!.code.trim()).to.equal('return View::New();');
    });
});
