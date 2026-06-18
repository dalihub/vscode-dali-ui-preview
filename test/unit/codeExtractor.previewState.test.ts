import { expect } from 'chai';
import { createMockDocument } from '../helpers/mockDocument';
import { extractPreviewCode } from '../../src/codeExtractor';

/**
 * WU-M2.1 — `// @preview-state: focus=` parsing (ADR-001).
 *
 * The directive is collected the same way `@preview-config` lines are: filtered
 * out of the extracted code and surfaced on `ExtractionResult.state`. Only the
 * `focus` and `progress` keys are recognised (the general key=value grammar is
 * CUT). `progress` is parsed but only APPLIED in M5.
 */
describe('codeExtractor — @preview-state parsing', () => {
    describe('preview-file mode (.preview.dali.cpp)', () => {
        it('parses focus=card (bare identifier)', () => {
            const content = [
                '// @preview-state: focus=card',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.state).to.not.be.undefined;
            expect(result!.state!.focus).to.equal('card');
        });

        it('parses focus="Card1" (quoted string, quotes stripped)', () => {
            const content = [
                '// @preview-state: focus="Card1"',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.state!.focus).to.equal('Card1');
        });

        it('ignores an unregistered key (playing=true) → focus undefined', () => {
            const content = [
                '// @preview-state: playing=true',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            // No recognised key carries a value → state stays undefined.
            expect(result!.state).to.be.undefined;
            expect(result!.state?.focus).to.be.undefined;
        });

        it('ignores an empty focus= value', () => {
            const content = [
                '// @preview-state: focus=',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.state?.focus).to.be.undefined;
        });

        it('rejects a focus value containing whitespace (IPC-injection safety)', () => {
            const content = [
                '// @preview-state: focus="a b"',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.state?.focus).to.be.undefined;
        });

        it('parses progress=0.4 (declared only — applied in M5)', () => {
            const content = [
                '// @preview-state: progress=0.4',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.state).to.not.be.undefined;
            expect(result!.state!.progress).to.equal(0.4);
        });

        it('parses focus and progress together (comma-separated)', () => {
            const content = [
                '// @preview-state: focus=card2, progress=0.5',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.state!.focus).to.equal('card2');
            expect(result!.state!.progress).to.equal(0.5);
        });

        it('strips the @preview-state line from the returned code', () => {
            const content = [
                '// @preview-state: focus=card',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.code).to.not.include('@preview-state');
            expect(result!.code).to.include('View::New()');
        });

        it('leaves state undefined when no @preview-state line exists', () => {
            const content = 'return View::New();';
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.state).to.be.undefined;
        });

        // Policy: when several @preview-state lines are present, the LAST valid
        // one wins (state is single, unlike configs which accumulate).
        it('last valid @preview-state line wins', () => {
            const content = [
                '// @preview-state: focus=card1',
                '// @preview-state: focus=card3',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.state!.focus).to.equal('card3');
        });
    });

    describe('marker mode (.cpp region)', () => {
        it('collects @preview-state inside a @dali-preview-begin/end region', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-state: focus=card',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('marker');
            expect(result!.state!.focus).to.equal('card');
            expect(result!.code).to.not.include('@preview-state');
            expect(result!.code).to.equal('return View::New();');
        });
    });

    describe('single-marker mode (// @preview)', () => {
        it('collects @preview-state when it sits inside the function body', () => {
            const content = [
                '// @preview',
                'View CreateUI() {',
                '    // @preview-state: focus=card',
                '    return View::New();',
                '}',
            ].join('\n');
            const doc = createMockDocument('/tmp/x.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('single-marker');
            expect(result!.state!.focus).to.equal('card');
            expect(result!.code).to.not.include('@preview-state');
            expect(result!.code.trim()).to.equal('return View::New();');
        });
    });
});
