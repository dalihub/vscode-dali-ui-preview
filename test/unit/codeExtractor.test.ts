import { expect } from 'chai';
import { createMockDocument } from '../helpers/mockDocument';
import { extractPreviewCode, isPreviewable, instrumentCode } from '../../src/codeExtractor';

describe('codeExtractor', () => {
    // -----------------------------------------------------------------
    // extractPreviewCode
    // -----------------------------------------------------------------
    describe('extractPreviewCode()', () => {
        it('returns full content for .preview.dali.cpp files', () => {
            const content = 'return View::New()\n    .SetBackgroundColor(Color::RED);';
            const doc = createMockDocument('/tmp/card.preview.dali.cpp', content);

            const result = extractPreviewCode(doc as any);
            expect(result).to.not.be.null;
            expect(result!.code).to.equal(content);
            expect(result!.mode).to.equal('preview-file');
            expect(result!.startLine).to.equal(0);
        });

        it('extracts code between @dali-preview-begin/end markers in .cpp', () => {
            const content = [
                '#include <dali/dali.h>',
                '',
                '// @dali-preview-begin',
                'return View::New();',
                '// @dali-preview-end',
                '',
                'int main() {}',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.code).to.equal('return View::New();');
            expect(result!.mode).to.equal('marker');
            expect(result!.startLine).to.equal(3);
        });

        it('extracts code between markers in .h files', () => {
            const content = [
                '#pragma once',
                '// @dali-preview-begin',
                'return TextLabel::New("Hello");',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/widget.h', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.code).to.equal('return TextLabel::New("Hello");');
            expect(result!.mode).to.equal('marker');
            expect(result!.startLine).to.equal(2);
        });

        it('strips variable declaration and adds return', () => {
            const content = [
                '// @dali-preview-begin',
                'View card = FlexLayout::New()',
                '    .SetPadding(10.0f);',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            // The variable decl "View card = " should be replaced with "return "
            expect(result!.code).to.match(/^return FlexLayout::New\(\)/);
            expect(result!.code).to.not.include('View card');
        });

        it('strips auto variable declaration', () => {
            const content = [
                '// @dali-preview-begin',
                'auto widget = ImageView::New("icon.png");',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.code).to.match(/^return ImageView::New/);
            expect(result!.code).to.not.include('auto widget');
        });

        it('does not strip when code already starts with return', () => {
            const content = [
                '// @dali-preview-begin',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.code).to.equal('return View::New();');
        });

        it('returns null for .cpp files without markers', () => {
            const content = '#include <dali/dali.h>\nint main() {}';
            const doc = createMockDocument('/tmp/main.cpp', content);

            const result = extractPreviewCode(doc as any);
            expect(result).to.be.null;
        });

        it('returns null for non-C++ files', () => {
            const content = 'console.log("hello");';
            const doc = createMockDocument('/tmp/script.ts', content);

            const result = extractPreviewCode(doc as any);
            expect(result).to.be.null;
        });

        it('returns null for .py files', () => {
            const content = 'print("hello")';
            const doc = createMockDocument('/tmp/script.py', content);

            const result = extractPreviewCode(doc as any);
            expect(result).to.be.null;
        });

        it('returns null when markers exist but region is empty', () => {
            const content = [
                '// @dali-preview-begin',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/empty.cpp', content);
            const result = extractPreviewCode(doc as any);
            expect(result).to.be.null;
        });

        it('uses only the first marker pair', () => {
            const content = [
                '// @dali-preview-begin',
                'return View::New();',
                '// @dali-preview-end',
                '// @dali-preview-begin',
                'return TextLabel::New("second");',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/multi.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.code).to.equal('return View::New();');
        });
    });

    // -----------------------------------------------------------------
    // @preview-config parsing
    // -----------------------------------------------------------------
    describe('@preview-config parsing', () => {
        it('parses a single @preview-config in marker mode', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Phone Light", width=720, height=1280, theme=light',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].name).to.equal('Phone Light');
            expect(result!.configs![0].width).to.equal(720);
            expect(result!.configs![0].height).to.equal(1280);
            expect(result!.configs![0].theme).to.equal('light');
        });

        it('parses multiple @preview-config lines in marker mode', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Phone Light", width=720, height=1280, theme=light',
                '// @preview-config: name="Phone Dark", width=720, height=1280, theme=dark',
                '// @preview-config: name="Tablet", width=1920, height=1080',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(3);
            expect(result!.configs![1].theme).to.equal('dark');
            expect(result!.configs![2].theme).to.be.undefined;
        });

        it('excludes @preview-config lines from extracted code', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Watch", width=360, height=360',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.code).to.not.include('@preview-config');
            expect(result!.code).to.include('View::New()');
        });

        it('returns undefined configs when no @preview-config lines exist', () => {
            const content = [
                '// @dali-preview-begin',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.be.undefined;
        });

        it('parses @preview-config in .preview.dali.cpp files', () => {
            const content = [
                '// @preview-config: name="Phone Light", width=720, height=1280',
                '// @preview-config: name="Phone Dark", width=720, height=1280, theme=dark',
                'return View::New();',
            ].join('\n');

            const doc = createMockDocument('/tmp/card.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(2);
            expect(result!.configs![0].name).to.equal('Phone Light');
            expect(result!.code).to.not.include('@preview-config');
        });

        it('ignores malformed @preview-config lines (missing name)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: width=720, height=1280',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            // Malformed config line should be treated as code (not parsed)
            expect(result!.configs).to.be.undefined;
        });

        it('parses optional width/height as undefined when not provided', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Minimal"',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].name).to.equal('Minimal');
            expect(result!.configs![0].width).to.be.undefined;
            expect(result!.configs![0].height).to.be.undefined;
        });

        it('parses locale parameter', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Korean", width=720, height=1280, locale=ko_KR',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].locale).to.equal('ko_KR');
        });

        it('parses fontScale parameter within valid range', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Large Text", width=720, height=1280, fontScale=1.5',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].fontScale).to.equal(1.5);
        });

        it('ignores fontScale below minimum range (0.1)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Too Small", fontScale=0.1',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].fontScale).to.be.undefined;
        });

        it('ignores fontScale above maximum range (3.0)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Too Large", fontScale=3.0',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].fontScale).to.be.undefined;
        });

        it('accepts fontScale at lower boundary (0.5)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Min Scale", fontScale=0.5',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].fontScale).to.equal(0.5);
        });

        it('accepts fontScale at upper boundary (2.0)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Max Scale", fontScale=2.0',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].fontScale).to.equal(2.0);
        });

        it('ignores fontScale just below lower boundary (0.49)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Below Min", fontScale=0.49',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].fontScale).to.be.undefined;
        });

        it('ignores fontScale just above upper boundary (2.01)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Above Max", fontScale=2.01',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].fontScale).to.be.undefined;
        });

        it('parses font parameter', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Custom Font", width=720, height=1280, font=NotoSansKR.ttf',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].font).to.equal('NotoSansKR.ttf');
        });

        it('parses font without interfering with fontScale', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="All Params", width=720, height=1280, fontScale=1.5, font=NotoSansKR.ttf',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].fontScale).to.equal(1.5);
            expect(result!.configs![0].font).to.equal('NotoSansKR.ttf');
        });

        it('parses all new params together with existing params', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Full Config", width=720, height=1280, theme=light, locale=ko_KR, fontScale=1.5, font=NotoSansKR.ttf',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            const cfg = result!.configs![0];
            expect(cfg.name).to.equal('Full Config');
            expect(cfg.width).to.equal(720);
            expect(cfg.height).to.equal(1280);
            expect(cfg.theme).to.equal('light');
            expect(cfg.locale).to.equal('ko_KR');
            expect(cfg.fontScale).to.equal(1.5);
            expect(cfg.font).to.equal('NotoSansKR.ttf');
        });

        it('keeps locale/fontScale/font as undefined when not present (backward compat)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Legacy", width=720, height=1280, theme=dark',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            const cfg = result!.configs![0];
            expect(cfg.locale).to.be.undefined;
            expect(cfg.fontScale).to.be.undefined;
            expect(cfg.font).to.be.undefined;
        });

        it('parses animation=true parameter', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="AnimTest", animation=true',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            expect(result!.configs![0].animation).to.equal(true);
        });

        it('parses animation=false parameter', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="StaticTest", animation=false',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.configs![0].animation).to.equal(false);
        });

        it('parses duration parameter within valid range', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="DurTest", animation=true, duration=3000',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].duration).to.equal(3000);
        });

        it('ignores duration below minimum (499)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="DurMin", animation=true, duration=499',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].duration).to.be.undefined;
        });

        it('ignores duration above maximum (10001)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="DurMax", animation=true, duration=10001',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].duration).to.be.undefined;
        });

        it('parses fps parameter within valid range', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="FpsTest", animation=true, fps=15',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].fps).to.equal(15);
        });

        it('ignores fps below minimum (4)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="FpsMin", animation=true, fps=4',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].fps).to.be.undefined;
        });

        it('ignores fps above maximum (31)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="FpsMax", animation=true, fps=31',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result!.configs![0].fps).to.be.undefined;
        });

        it('parses all animation params together', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="FullAnim", width=360, height=640, animation=true, duration=2000, fps=10',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            const cfg = result!.configs![0];
            expect(cfg.name).to.equal('FullAnim');
            expect(cfg.width).to.equal(360);
            expect(cfg.height).to.equal(640);
            expect(cfg.animation).to.equal(true);
            expect(cfg.duration).to.equal(2000);
            expect(cfg.fps).to.equal(10);
        });

        it('animation/duration/fps are undefined when not present (backward compat)', () => {
            const content = [
                '// @dali-preview-begin',
                '// @preview-config: name="Static", width=720',
                'return View::New();',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            const cfg = result!.configs![0];
            expect(cfg.animation).to.be.undefined;
            expect(cfg.duration).to.be.undefined;
            expect(cfg.fps).to.be.undefined;
        });
    });

    // -----------------------------------------------------------------
    // Mode 2: // @preview single-line marker
    // -----------------------------------------------------------------
    describe('// @preview single-line marker', () => {
        it('extracts function body following // @preview marker', () => {
            const content = [
                '#include <dali/dali.h>',
                '',
                '// @preview',
                'View CreateUI()',
                '{',
                '    return View::New();',
                '}',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('single-marker');
            expect(result!.code.trim()).to.equal('return View::New();');
        });

        it('extracts function body when opening brace is on same line as signature', () => {
            const content = [
                '// @preview',
                'View CreateUI() {',
                '    return FlexLayout::New();',
                '}',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('single-marker');
            expect(result!.code.trim()).to.equal('return FlexLayout::New();');
        });

        it('strips variable declaration and adds return (single-marker mode)', () => {
            const content = [
                '// @preview',
                'View BuildCard() {',
                '    View card = FlexLayout::New()',
                '        .SetPadding(10.0f);',
                '}',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.code).to.match(/^return FlexLayout::New\(\)/);
            expect(result!.code).to.not.include('View card');
        });

        it('single-marker mode works in .h files', () => {
            const content = [
                '#pragma once',
                '// @preview',
                'View CreateCard() {',
                '    return TextLabel::New("Hello");',
                '}',
            ].join('\n');

            const doc = createMockDocument('/tmp/widget.h', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('single-marker');
            expect(result!.code.trim()).to.equal('return TextLabel::New("Hello");');
        });

        it('single-marker mode takes priority over @dali-preview-begin/end markers', () => {
            const content = [
                '// @preview',
                'View CreateUI() {',
                '    return View::New();',
                '}',
                '// @dali-preview-begin',
                'return TextLabel::New("second");',
                '// @dali-preview-end',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('single-marker');
            expect(result!.code.trim()).to.equal('return View::New();');
        });

        it('returns null when // @preview has no function below it', () => {
            const content = [
                '// @preview',
                '// just a comment, no function here',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            // Falls through to marker mode, which also finds nothing → null
            expect(result).to.be.null;
        });

        it('handles nested braces correctly in single-marker mode', () => {
            const content = [
                '// @preview',
                'View CreateUI() {',
                '    auto inner = FlexLayout::New().Children({',
                '        View::New(),',
                '    });',
                '    return inner;',
                '}',
            ].join('\n');

            const doc = createMockDocument('/tmp/example.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('single-marker');
            expect(result!.code).to.include('FlexLayout::New()');
            expect(result!.code).to.include('return inner;');
        });

        it('extracts code from test/samples/single-marker.cpp', () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require('fs');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('path');
            const samplePath = path.resolve(__dirname, '../../../test/samples/single-marker.cpp');
            const content = fs.readFileSync(samplePath, 'utf-8');
            const doc = createMockDocument('/tmp/single-marker.cpp', content);
            const result = extractPreviewCode(doc as any);

            expect(result).to.not.be.null;
            expect(result!.mode).to.equal('single-marker');
            expect(result!.code).to.include('FlexLayout::New()');
            expect(result!.code).to.include('Hello, DALi!');
        });
    });

    // -----------------------------------------------------------------
    // isPreviewable
    // -----------------------------------------------------------------
    describe('isPreviewable()', () => {
        it('returns true for .preview.dali.cpp files', () => {
            const doc = createMockDocument('/tmp/card.preview.dali.cpp', 'return View::New();');
            expect(isPreviewable(doc as any)).to.be.true;
        });

        it('returns true for .cpp with markers', () => {
            const content = '// @dali-preview-begin\nreturn View::New();\n// @dali-preview-end';
            const doc = createMockDocument('/tmp/example.cpp', content);
            expect(isPreviewable(doc as any)).to.be.true;
        });

        it('returns true for .h with markers', () => {
            const content = '// @dali-preview-begin\nreturn View::New();\n// @dali-preview-end';
            const doc = createMockDocument('/tmp/widget.h', content);
            expect(isPreviewable(doc as any)).to.be.true;
        });

        it('returns true for .cpp with // @preview marker', () => {
            const content = '// @preview\nView CreateUI() {\n    return View::New();\n}';
            const doc = createMockDocument('/tmp/example.cpp', content);
            expect(isPreviewable(doc as any)).to.be.true;
        });

        it('returns true for .h with // @preview marker', () => {
            const content = '// @preview\nView CreateCard() {\n    return View::New();\n}';
            const doc = createMockDocument('/tmp/widget.h', content);
            expect(isPreviewable(doc as any)).to.be.true;
        });

        it('returns false for .cpp without markers', () => {
            const doc = createMockDocument('/tmp/main.cpp', 'int main() {}');
            expect(isPreviewable(doc as any)).to.be.false;
        });

        it('returns false for non-C++ files', () => {
            const doc = createMockDocument('/tmp/script.ts', 'console.log("hello");');
            expect(isPreviewable(doc as any)).to.be.false;
        });

        it('returns false for .json files', () => {
            const doc = createMockDocument('/tmp/package.json', '{}');
            expect(isPreviewable(doc as any)).to.be.false;
        });
    });

    // -----------------------------------------------------------------------
    // Space-separated @preview-config format (no commas)
    // -----------------------------------------------------------------------

    describe('@preview-config space-separated format', () => {
        it('parses animation params from space-separated config (no commas)', () => {
            const content = [
                '// @preview-config: name="AnimTest" width=360 height=640 animation=true duration=2000 fps=10',
                'return View::New();',
            ].join('\n');
            const doc = createMockDocument('/tmp/test.preview.dali.cpp', content);
            const result = extractPreviewCode(doc as any);
            expect(result).to.not.be.null;
            expect(result!.configs).to.have.length(1);
            const cfg = result!.configs![0];
            expect(cfg.name).to.equal('AnimTest');
            expect(cfg.width).to.equal(360);
            expect(cfg.height).to.equal(640);
            expect(cfg.animation).to.equal(true);
            expect(cfg.duration).to.equal(2000);
            expect(cfg.fps).to.equal(10);
        });
    });
});

describe('instrumentCode() — Actor allowlist', () => {
    it('wraps Actor-derived ::New() calls with __tag', () => {
        const result = instrumentCode('auto root = FlexLayout::New();', 1);
        expect(result).to.include('__tag(FlexLayout::New()');
        expect(result).to.include('"__L1"');
    });

    it('leaves Animation::New() untouched so preview compiles', () => {
        const code = 'Animation anim = Animation::New(2.0f);';
        expect(instrumentCode(code, 15)).to.equal(code);
    });

    it('leaves Timer::New() untouched', () => {
        const code = 'Timer t = Timer::New(500);';
        expect(instrumentCode(code, 1)).to.equal(code);
    });

    it('leaves Capture::New() untouched', () => {
        const code = 'Capture c = Capture::New();';
        expect(instrumentCode(code, 1)).to.equal(code);
    });

    it('handles mixed Actor and non-Actor calls in the same snippet', () => {
        const code = [
            'auto box = View::New();',
            'Animation anim = Animation::New(2.0f);',
            'anim.Play();',
        ].join('\n');
        const result = instrumentCode(code, 10);
        expect(result).to.include('__tag(View::New()');
        expect(result).to.include('"__L10"');
        expect(result).to.not.include('__tag(Animation::New');
        expect(result).to.include('Animation::New(2.0f)');
    });

    it('tags each of View, TextLabel, ImageView, ScrollView, Control', () => {
        for (const t of ['View', 'TextLabel', 'ImageView', 'ScrollView', 'Control']) {
            const result = instrumentCode(`auto x = ${t}::New();`, 1);
            expect(result, `${t} should be tagged`).to.include(`__tag(${t}::New()`);
        }
    });
});
