import { expect } from 'chai';
import { parseChainExpression, clearParserCache, SceneNode } from '../../src/cppParser';
import * as fs from 'fs';
import * as path from 'path';

describe('cppParser', () => {

    beforeEach(() => {
        clearParserCache();
    });

    // -----------------------------------------------------------------------
    // Basic parsing
    // -----------------------------------------------------------------------

    describe('parseChainExpression()', () => {
        it('parses a simple View::New() with no methods', () => {
            const code = 'return View::New();';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.type).to.equal('View');
            expect(node!.constructorArgs).to.deep.equal([]);
            expect(node!.children).to.deep.equal([]);
        });

        it('parses type and properties', () => {
            const code = [
                'return View::New()',
                '    .SetBackgroundColor(UiColor(0xFFFF00))',
                '    .SetRequestedWidth(200.0f)',
                '    .SetRequestedHeight(200.0f);',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.type).to.equal('View');
            expect(node!.properties['SetBackgroundColor']).to.deep.equal(['UiColor(0xFFFF00)']);
            expect(node!.properties['SetRequestedWidth']).to.deep.equal(['200.0f']);
            expect(node!.properties['SetRequestedHeight']).to.deep.equal(['200.0f']);
        });

        it('parses a Label with string constructor arg', () => {
            const code = 'return Label::New("Hello DALi!").SetFontSize(48);';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.type).to.equal('Label');
            expect(node!.constructorArgs).to.deep.equal(['"Hello DALi!"']);
            expect(node!.properties['SetFontSize']).to.deep.equal(['48']);
        });

        it('parses enum method arguments', () => {
            const code = 'return FlexLayout::New().Direction(FlexDirection::COLUMN).AlignItems(FlexAlign::CENTER);';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['Direction']).to.deep.equal(['FlexDirection::COLUMN']);
            expect(node!.properties['AlignItems']).to.deep.equal(['FlexAlign::CENTER']);
        });

        it('parses MATCH_PARENT and WRAP_CONTENT constants', () => {
            const code = [
                'return FlexLayout::New()',
                '    .SetRequestedWidth(MATCH_PARENT)',
                '    .SetRequestedHeight(WRAP_CONTENT);',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetRequestedWidth']).to.deep.equal(['MATCH_PARENT']);
            expect(node!.properties['SetRequestedHeight']).to.deep.equal(['WRAP_CONTENT']);
        });

        it('parses UiColor constructor argument', () => {
            const code = 'return View::New().SetBackgroundColor(UiColor(0x1e1e2e));';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetBackgroundColor']).to.deep.equal(['UiColor(0x1e1e2e)']);
        });

        it('parses Extents constructor argument', () => {
            const code = 'return View::New().SetViewPadding(Extents(30, 30, 30, 30));';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetViewPadding']).to.deep.equal(['Extents(30, 30, 30, 30)']);
        });

        it('parses nested children', () => {
            const code = [
                'return FlexLayout::New()',
                '    .Direction(FlexDirection::COLUMN)',
                '    .Children({',
                '        Label::New("Hi").SetFontSize(20),',
                '        View::New().SetBackgroundColor(UiColor(0xFF0000)),',
                '    });',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.children).to.have.length(2);
            expect(node!.children[0].type).to.equal('Label');
            expect(node!.children[0].constructorArgs).to.deep.equal(['"Hi"']);
            expect(node!.children[1].type).to.equal('View');
        });

        it('parses deeply nested children', () => {
            const code = [
                'return FlexLayout::New()',
                '    .Children({',
                '        FlexLayout::New()',
                '            .Children({',
                '                Label::New("Nested"),',
                '            }),',
                '    });',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.children).to.have.length(1);
            expect(node!.children[0].type).to.equal('FlexLayout');
            expect(node!.children[0].children).to.have.length(1);
            expect(node!.children[0].children[0].type).to.equal('Label');
        });

        it('parses StackLayout with orientation constructor arg', () => {
            const code = [
                'return StackLayout::New(StackOrientation::VERTICAL)',
                '    .Spacing(0.0f)',
                '    .SetRequestedWidth(MATCH_PARENT);',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.type).to.equal('StackLayout');
            expect(node!.constructorArgs).to.deep.equal(['StackOrientation::VERTICAL']);
            expect(node!.properties['Spacing']).to.deep.equal(['0.0f']);
        });

        it('parses float with f-suffix', () => {
            const code = 'return View::New().SetRequestedWidth(150.0f).SetRequestedHeight(150.0f);';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetRequestedWidth']).to.deep.equal(['150.0f']);
        });

        it('skips C++ line comments', () => {
            const code = [
                'return FlexLayout::New()',
                '    // some comment',
                '    .Direction(FlexDirection::ROW);',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['Direction']).to.deep.equal(['FlexDirection::ROW']);
        });

        it('parses hex numbers in arguments', () => {
            const code = 'return View::New().SetBackgroundColor(UiColor(0x1a1a2e));';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetBackgroundColor']).to.deep.equal(['UiColor(0x1a1a2e)']);
        });

        it('parses integer arguments (no f suffix)', () => {
            const code = 'return Label::New("T").SetFontSize(100);';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetFontSize']).to.deep.equal(['100']);
        });
    });

    // -----------------------------------------------------------------------
    // Unsupported patterns → returns null (compile fallback)
    // -----------------------------------------------------------------------

    describe('unsupported patterns → null', () => {
        it('returns null for ternary operator', () => {
            const code = 'return (x > 0) ? View::New() : Label::New("x");';
            expect(parseChainExpression(code)).to.be.null;
        });

        it('returns null for if statement', () => {
            const code = 'if (true) { return View::New(); }';
            expect(parseChainExpression(code)).to.be.null;
        });

        it('returns null for auto keyword', () => {
            const code = 'auto v = View::New();';
            expect(parseChainExpression(code)).to.be.null;
        });

        it('returns null for preprocessor directive', () => {
            const code = '#include <dali/dali.h>\nreturn View::New();';
            expect(parseChainExpression(code)).to.be.null;
        });

        it('returns null for unknown ClassName (without ::New)', () => {
            const code = 'return CreateHeader();';
            expect(parseChainExpression(code)).to.be.null;
        });

        it('returns null for trailing non-EOF tokens', () => {
            const code = 'return View::New(); View::New();';
            expect(parseChainExpression(code)).to.be.null;
        });
    });

    // -----------------------------------------------------------------------
    // LRU cache
    // -----------------------------------------------------------------------

    describe('LRU cache', () => {
        it('returns the same result on repeated calls', () => {
            const code = 'return View::New();';
            const first  = parseChainExpression(code);
            const second = parseChainExpression(code);
            expect(first).to.equal(second); // same object reference (cached)
        });

        it('caches null result', () => {
            const code = 'if (x) {}';
            expect(parseChainExpression(code)).to.be.null;
            expect(parseChainExpression(code)).to.be.null; // from cache
        });

        it('evicts oldest entry when cache exceeds 10 entries', () => {
            // Fill cache with 10 distinct entries
            for (let i = 0; i < 10; i++) {
                parseChainExpression(`return View::New().SetRequestedWidth(${i}.0f);`);
            }
            // First entry should still be in cache (exactly 10 entries)
            const first = parseChainExpression('return View::New().SetRequestedWidth(0.0f);');
            expect(first).to.not.be.null;

            // Adding an 11th entry should evict the oldest
            parseChainExpression('return View::New().SetRequestedWidth(100.0f);');
            // Now the first entry has been evicted — re-parsing should still work
            const refetched = parseChainExpression('return View::New().SetRequestedWidth(0.0f);');
            expect(refetched).to.not.be.null;
        });
    });

    // -----------------------------------------------------------------------
    // Real sample files
    // -----------------------------------------------------------------------

    describe('real sample files', () => {
        // __dirname = out/test/unit → go up 3 levels to project root → test/samples
        const samplesDir = path.join(__dirname, '..', '..', '..', 'test', 'samples');

        const simpleFiles = [
            'hello-label.preview.dali.cpp',
            'red-box.preview.dali.cpp',
            'weather.preview.dali.cpp',
        ];

        for (const file of simpleFiles) {
            it(`parses ${file} successfully`, () => {
                const code = fs.readFileSync(path.join(samplesDir, file), 'utf-8').trim();
                const node = parseChainExpression(code);
                expect(node, `${file} should parse successfully`).to.not.be.null;
                expect(node!.type).to.be.a('string').and.not.be.empty;
            });
        }

        it('parses tv-home.preview.dali.cpp (complex nesting)', () => {
            const code = fs.readFileSync(
                path.join(samplesDir, 'tv-home.preview.dali.cpp'), 'utf-8').trim();
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.type).to.equal('StackLayout');
            expect(node!.children.length).to.be.greaterThan(0);
        });

        it('parses gallery.preview.dali.cpp (deep nesting)', () => {
            const code = fs.readFileSync(
                path.join(samplesDir, 'gallery.preview.dali.cpp'), 'utf-8').trim();
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
        });
    });
});
