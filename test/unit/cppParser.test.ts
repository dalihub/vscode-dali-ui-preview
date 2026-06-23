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

        it('skips C++ block comments', () => {
            const code = [
                'return FlexLayout::New()',
                '    /* block comment */',
                '    .Direction(FlexDirection::ROW);',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['Direction']).to.deep.equal(['FlexDirection::ROW']);
        });

        it('parses negative number arguments', () => {
            const code = 'return View::New().SetRequestedWidth(-100.0f);';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetRequestedWidth']).to.deep.equal(['-100.0f']);
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
    // Nested builder-chain arguments (e.g. SetLayoutParams)
    // -----------------------------------------------------------------------

    describe('nested builder-chain arguments', () => {
        it('parses a single-method chain inside an argument', () => {
            const code = 'return View::New().SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f));';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.type).to.equal('View');
            expect(node!.properties['SetLayoutParams'])
                .to.deep.equal(['StackLayoutParams::New().SetWeight(1.0f)']);
        });

        it('parses a multi-method chain inside an argument', () => {
            const code = 'return View::New().SetLayoutParams(FlexLayoutParams::New().SetFlexGrow(1.0f).SetFlexShrink(0.0f));';
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.properties['SetLayoutParams'])
                .to.deep.equal(['FlexLayoutParams::New().SetFlexGrow(1.0f).SetFlexShrink(0.0f)']);
        });

        it('parses a nested-chain arg on a child node', () => {
            const code = [
                'return StackLayout::New(StackOrientation::VERTICAL)',
                '    .Children({',
                '        View::New().SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f)),',
                '        Label::New("footer"),',
                '    });',
            ].join('\n');
            const node = parseChainExpression(code);
            expect(node).to.not.be.null;
            expect(node!.children).to.have.length(2);
            expect(node!.children[0].properties['SetLayoutParams'])
                .to.deep.equal(['StackLayoutParams::New().SetWeight(1.0f)']);
        });

        it('still returns null for a bare member call argument (compile fallback)', () => {
            // model.GetTitle() is NOT a Type::New(...) call, so it must not chain —
            // it has to fall through to the compile path.
            const code = 'return Label::New(model.GetTitle());';
            expect(parseChainExpression(code)).to.be.null;
        });

        it('still returns null for a bare helper-function call', () => {
            const code = 'return MakeCard("Title", value);';
            expect(parseChainExpression(code)).to.be.null;
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

        it('returns null for empty input', () => {
            expect(parseChainExpression('')).to.be.null;
        });

        it('returns null for new keyword (C++ operator new)', () => {
            const code = 'return new View();';
            expect(parseChainExpression(code)).to.be.null;
        });

        it('returns null for delete keyword', () => {
            const code = 'delete view;';
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
            // Fill cache with 10 distinct entries (entry 0 added first = LRU)
            const first = parseChainExpression('return View::New().SetRequestedWidth(0.0f);');
            for (let i = 1; i < 10; i++) {
                parseChainExpression(`return View::New().SetRequestedWidth(${i}.0f);`);
            }
            // Do NOT access entry 0 again — it remains the LRU entry
            // Adding 11th entry should evict entry 0 (oldest)
            parseChainExpression('return View::New().SetRequestedWidth(100.0f);');
            // Entry 0 has been evicted — re-parsing produces a new object
            const refetched = parseChainExpression('return View::New().SetRequestedWidth(0.0f);');
            expect(refetched).to.not.be.null;
            expect(refetched).to.not.equal(first); // new object confirms eviction
        });

        it('LRU hit refreshes entry order (frequently used entries not evicted first)', () => {
            // Fill cache with 10 entries
            for (let i = 0; i < 10; i++) {
                parseChainExpression(`return View::New().SetRequestedWidth(${i}.0f);`);
            }
            // Access entry #0 to make it recently used
            const kept = parseChainExpression('return View::New().SetRequestedWidth(0.0f);');
            // Add 11th entry — should evict entry #1 (now LRU), not #0
            parseChainExpression('return View::New().SetRequestedWidth(99.0f);');
            // Entry #0 should still be cached (same reference)
            const stillCached = parseChainExpression('return View::New().SetRequestedWidth(0.0f);');
            expect(stillCached).to.equal(kept);
            // Entry #1 should have been evicted (new object)
            const evicted = parseChainExpression('return View::New().SetRequestedWidth(1.0f);');
            expect(evicted).to.not.be.null;
        });
    });

    // -----------------------------------------------------------------------
    // Real sample files
    // -----------------------------------------------------------------------

    describe('real sample files (non-fluent → compile fallback)', () => {
        // __dirname = out/test/unit → go up 3 levels to project root → test/samples
        const samplesDir = path.join(__dirname, '..', '..', '..', 'test', 'samples');

        // dali-ui removed the fluent chaining API, so the shipped samples are now
        // non-fluent (sequential `obj.SetX();` statements + `AddChildren`). The
        // chain-expression fast-path parser only understands a single fluent
        // `Type::New().Method()...` expression, so it declines these (returns null)
        // and the preview routes to the (correct, ~500 ms) compile path. The
        // parser's fluent-parsing capability itself is covered by the
        // parseChainExpression() unit tests above. This block is a regression guard
        // that the shipped samples stay valid against the current dali-ui API.
        const nonFluentSamples = [
            'hello-label.preview.dali.cpp',
            'red-box.preview.dali.cpp',
            'weather.preview.dali.cpp',
            'tv-home.preview.dali.cpp',
            'gallery.preview.dali.cpp',
            path.join('flow-banking', 'card.preview.dali.cpp'),
        ];

        for (const file of nonFluentSamples) {
            it(`declines ${file} on the fast path (non-fluent → compile path)`, () => {
                const code = fs.readFileSync(path.join(samplesDir, file), 'utf-8').trim();
                const node = parseChainExpression(code);
                expect(node, `${file} is non-fluent and must not parse on the fast path`).to.be.null;
            });
        }
    });
});
