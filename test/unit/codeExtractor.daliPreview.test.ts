import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { createMockDocument } from '../helpers/mockDocument';
import { extractPreviewCode, isPreviewable } from '../../src/codeExtractor';
import { findPreviewFunction } from '../../src/sliceBuilder';

/**
 * WU-M2.2 — `// @dali-preview` zero-arg entry marker (ADR-001).
 *
 * The marker is recognised by EXACT line match so it does NOT collide with the
 * `// @dali-preview-begin` region marker. Extraction shares the `// @preview`
 * body-extraction path (next function body + leading-var-decl → `return`), and
 * keeps `mode: 'single-marker'` (build routing unchanged).
 */
describe('codeExtractor — @dali-preview zero-arg entry', () => {
    it('keeps a self-returning factory body verbatim (no var-decl rewrite)', () => {
        const content = [
            '// @dali-preview',
            'View MakeHomePreview() {',
            '    View card = View::New();',
            '    card.SetCornerRadius(24.0f);',
            '    return card;',
            '}',
        ].join('\n');
        const doc = createMockDocument('/tmp/x.cpp', content);
        const result = extractPreviewCode(doc as any);

        expect(result).to.not.be.null;
        expect(result!.mode).to.equal('single-marker');
        // The body already returns (non-fluent multi-statement style), so it is
        // used verbatim — rewriting the leading `View card =` to `return` would
        // strip the declaration and leave `return card;` referencing nothing.
        expect(result!.code).to.include('View card = View::New();');
        expect(result!.code).to.include('card.SetCornerRadius(24.0f);');
        expect(result!.code.trimEnd()).to.match(/return card;$/);
    });

    it('rewrites a single bare var-decl body (no return) to a return', () => {
        const content = [
            '// @dali-preview',
            'View MakeHomePreview() {',
            '    View card = View::New();',
            '}',
        ].join('\n');
        const doc = createMockDocument('/tmp/x.cpp', content);
        const result = extractPreviewCode(doc as any);

        expect(result).to.not.be.null;
        // No statement-level return present → leading `View card =` becomes `return`.
        expect(result!.code).to.match(/^return View::New\(\)/);
        expect(result!.code).to.not.include('View card');
    });

    it('extracts when the opening brace is on the signature line', () => {
        const content = [
            '// @dali-preview',
            'View MakeHomePreview() { return TextLabel::New("Hi"); }',
        ].join('\n');
        const doc = createMockDocument('/tmp/x.cpp', content);
        const result = extractPreviewCode(doc as any);

        expect(result).to.not.be.null;
        expect(result!.mode).to.equal('single-marker');
        expect(result!.code).to.include('TextLabel::New("Hi")');
    });

    it('does NOT match @dali-preview-begin as a zero-arg marker (falls to Mode 3 region)', () => {
        const content = [
            '// @dali-preview-begin',
            'return View::New();',
            '// @dali-preview-end',
        ].join('\n');
        const doc = createMockDocument('/tmp/x.cpp', content);
        const result = extractPreviewCode(doc as any);

        expect(result).to.not.be.null;
        // Region extraction, NOT mistaken for the zero-arg single-marker path.
        expect(result!.mode).to.equal('marker');
        expect(result!.code).to.equal('return View::New();');
    });

    it('isPreviewable() is true for an exact // @dali-preview line', () => {
        const content = [
            '// @dali-preview',
            'View MakeHomePreview() { return View::New(); }',
        ].join('\n');
        const doc = createMockDocument('/tmp/x.cpp', content);
        expect(isPreviewable(doc as any)).to.be.true;
    });

    it('extracts from test/samples/zero-arg-entry.cpp', () => {
        const samplePath = path.resolve(__dirname, '../../../test/samples/zero-arg-entry.cpp');
        const content = fs.readFileSync(samplePath, 'utf-8');
        const doc = createMockDocument('/tmp/zero-arg-entry.cpp', content);
        const result = extractPreviewCode(doc as any);

        expect(result).to.not.be.null;
        expect(result!.mode).to.equal('single-marker');
        // Non-fluent body returns explicitly, so it is kept verbatim.
        expect(result!.code).to.include('View card = View::New();');
        expect(result!.code.trimEnd()).to.match(/return card;$/);
    });

    describe('sliceBuilder.findPreviewFunction()', () => {
        it('picks the function AFTER a // @dali-preview marker', () => {
            const src = [
                'View Decoy() { return View::New(); }',
                '',
                '// @dali-preview',
                'View MakeHomePreview() {',
                '    return TextLabel::New("home");',
                '}',
            ].join('\n');
            const fn = findPreviewFunction(src);

            expect(fn).to.not.be.null;
            expect(fn!.fnName).to.equal('MakeHomePreview');
            expect(fn!.body).to.include('TextLabel::New("home")');
        });

        it('still picks the function after a // @preview marker (unchanged)', () => {
            const src = [
                '// @preview',
                'View CreateUI() {',
                '    return View::New();',
                '}',
            ].join('\n');
            const fn = findPreviewFunction(src);

            expect(fn!.fnName).to.equal('CreateUI');
        });

        it('does NOT treat // @dali-preview-begin as the entry marker', () => {
            // The region marker must not anchor the search; the function below the
            // region is still found via the normal first-function fallback, but the
            // marker token itself must not be matched as an entry.
            const src = [
                '// @dali-preview-begin',
                'View RegionFn() { return View::New(); }',
                '// @dali-preview-end',
            ].join('\n');
            const fn = findPreviewFunction(src);

            // It resolves to a function (first-fn fallback), and crucially does not
            // throw / mis-anchor. The region marker is not an entry marker.
            expect(fn).to.not.be.null;
            expect(fn!.fnName).to.equal('RegionFn');
        });
    });
});
