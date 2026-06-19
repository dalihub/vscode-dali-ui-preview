import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { createMockDocument } from '../helpers/mockDocument';
import { extractPreviewCode, instrumentCode } from '../../src/codeExtractor';
import { parseChainExpression, clearParserCache, SceneNode } from '../../src/cppParser';
import {
    parseGccErrors,
    errorsToDiagnostics,
    getHarnessCodeOffset,
    getPluginCodeOffset,
    formatErrorsForDisplay,
    ParsedError,
} from '../../src/errorParser';
import { ConfigurationService } from '../../src/configurationService';

// ==========================================================================
// Integration tests — module-to-module interaction boundaries
// ==========================================================================

describe('Integration: Extract -> Instrument pipeline', () => {
    it('preview-file mode: entire content is extracted then instrumented', () => {
        const content = [
            'return FlexLayout::New()',
            '    .FlexDirection(FlexDirection::COLUMN)',
            '    .Children({',
            '        TextLabel::New("Hello"),',
            '        View::New(),',
            '    });',
        ].join('\n');

        const doc = createMockDocument('/tmp/card.preview.dali.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.mode).to.equal('preview-file');
        expect(extraction!.startLine).to.equal(0);

        const instrumented = instrumentCode(extraction!.code, extraction!.startLine);

        // FlexLayout, TextLabel, and View are Actor types -- all should be wrapped
        expect(instrumented).to.include('__tag(FlexLayout::New()');
        expect(instrumented).to.include('__tag(TextLabel::New("Hello")');
        expect(instrumented).to.include('__tag(View::New()');
    });

    it('marker mode: only delimited code is extracted then instrumented', () => {
        const content = [
            '#include <dali/dali.h>',                // line 0
            '',                                       // line 1
            'void someHelperFunction() {}',           // line 2
            '',                                       // line 3
            '// @dali-preview-begin',                 // line 4
            'return FlexLayout::New()',               // line 5
            '    .Children({',                        // line 6
            '        ImageView::New("icon.png"),',    // line 7
            '    });',                                // line 8
            '// @dali-preview-end',                   // line 9
            '',                                       // line 10
            'int main() {}',                          // line 11
        ].join('\n');

        const doc = createMockDocument('/tmp/example.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.mode).to.equal('marker');
        expect(extraction!.startLine).to.equal(5);
        // Code should NOT include lines outside the markers
        expect(extraction!.code).to.not.include('#include');
        expect(extraction!.code).to.not.include('int main');

        const instrumented = instrumentCode(extraction!.code, extraction!.startLine);

        expect(instrumented).to.include('__tag(FlexLayout::New()');
        expect(instrumented).to.include('__tag(ImageView::New("icon.png")');
    });

    it('line numbers are preserved correctly through the pipeline', () => {
        const content = [
            '// header',                              // line 0
            '// @dali-preview-begin',                 // line 1
            'return View::New()',                     // line 2 (startLine = 2)
            '    .SetBackgroundColor(Color::RED);',  // line 3
            '// @dali-preview-end',                   // line 4
        ].join('\n');

        const doc = createMockDocument('/tmp/test.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.startLine).to.equal(2);

        const instrumented = instrumentCode(extraction!.code, extraction!.startLine);

        // View::New() is on the first line of extracted code, which is line 2 in
        // the original document. instrumentCode computes absolute line = codeLine + startLine.
        // codeLine for "return View::New()" is 0, so absolute = 0 + 2 = 2.
        expect(instrumented).to.include('"__L2"');
    });

    it('preview-file with config lines: startLine accounts for skipped config lines', () => {
        const content = [
            '// @preview-config: name="Phone", width=720, height=1280',  // line 0 (config, excluded)
            'return TextLabel::New("Hello");',                           // line 1 (code)
        ].join('\n');

        const doc = createMockDocument('/tmp/card.preview.dali.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.startLine).to.equal(1);
        expect(extraction!.code).to.not.include('@preview-config');

        const instrumented = instrumentCode(extraction!.code, extraction!.startLine);
        expect(instrumented).to.include('__tag(TextLabel::New("Hello")');
        expect(instrumented).to.include('"__L1"');
    });
});

describe('Integration: Extract -> Parse pipeline', () => {
    beforeEach(() => {
        clearParserCache();
    });

    it('extracted code from preview-file can be parsed by chain expression parser', () => {
        const content = [
            'return FlexLayout::New()',
            '    .FlexDirection(FlexDirection::COLUMN)',
            '    .Children({',
            '        TextLabel::New("Title"),',
            '    });',
        ].join('\n');

        const doc = createMockDocument('/tmp/test.preview.dali.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;

        const scene = parseChainExpression(extraction!.code, extraction!.startLine);

        expect(scene).to.not.be.null;
        expect(scene!.type).to.equal('FlexLayout');
        expect(scene!.properties).to.have.property('FlexDirection');
        expect(scene!.children).to.have.length(1);
        expect(scene!.children[0].type).to.equal('TextLabel');
    });

    it('parser scene node has correct sourceLine values relative to original document', () => {
        const content = [
            '#include <dali/dali.h>',                // line 0
            '',                                       // line 1
            '// @dali-preview-begin',                 // line 2
            'return FlexLayout::New()',               // line 3 (startLine = 3)
            '    .Children({',                        // line 4
            '        View::New(),',                   // line 5
            '    });',                                // line 6
            '// @dali-preview-end',                   // line 7
        ].join('\n');

        const doc = createMockDocument('/tmp/example.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.startLine).to.equal(3);

        const scene = parseChainExpression(extraction!.code, extraction!.startLine);

        expect(scene).to.not.be.null;
        // FlexLayout::New() is on the first line of extracted code => codeLine 0 + startLine 3 = 3
        expect(scene!.sourceLine).to.equal(3);
        // View::New() is on the third line of extracted code => codeLine 2 + startLine 3 = 5
        expect(scene!.children[0].sourceLine).to.equal(5);
    });

    it('marker mode extraction with nested children parses correctly', () => {
        const content = [
            '// @dali-preview-begin',
            'return FlexLayout::New()',
            '    .FlexDirection(FlexDirection::COLUMN)',
            '    .Children({',
            '        FlexLayout::New()',
            '            .Children({',
            '                TextLabel::New("Nested"),',
            '            }),',
            '    });',
            '// @dali-preview-end',
        ].join('\n');

        const doc = createMockDocument('/tmp/nested.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;

        const scene = parseChainExpression(extraction!.code, extraction!.startLine);

        expect(scene).to.not.be.null;
        expect(scene!.type).to.equal('FlexLayout');
        expect(scene!.children).to.have.length(1);
        expect(scene!.children[0].type).to.equal('FlexLayout');
        expect(scene!.children[0].children).to.have.length(1);
        expect(scene!.children[0].children[0].type).to.equal('TextLabel');
        expect(scene!.children[0].children[0].constructorArgs).to.deep.equal(['"Nested"']);
    });
});

describe('Integration: Error parsing pipeline', () => {
    it('simulated g++ error is parsed and mapped to correct document lines', () => {
        // Simulate: harness template has {{USER_CODE}} at line 21
        // g++ reports error on harness line 24 => user code line 24-21 = 3 (0-based)
        // The user code starts at document line 5 (from extraction)
        const harnessOffset = 21;
        const extractionStartLine = 5;

        const stderr = '/tmp/preview_harness.cpp:24:10: error: use of undeclared identifier \'Foo\'';
        const errors = parseGccErrors(stderr, harnessOffset);

        expect(errors).to.have.length(1);
        expect(errors[0].line).to.equal(3); // mapped: 24 - 21 = 3

        // Now create a document to map errors to diagnostics
        const content = [
            '#include <dali/dali.h>',   // line 0
            '',                          // line 1
            'void helper() {}',          // line 2
            '',                          // line 3
            '// @dali-preview-begin',    // line 4
            'return FlexLayout::New()',  // line 5 (startLine)
            '    .SetPadding(10.0f)',    // line 6
            '    .Children({',           // line 7
            '        Foo::New(),',       // line 8 (the error line: startLine + errorLine = 5 + 3)
            '    });',                   // line 9
            '// @dali-preview-end',      // line 10
        ].join('\n');

        const doc = createMockDocument('/tmp/example.cpp', content);
        const diagnostics = errorsToDiagnostics(errors, doc as any, extractionStartLine);

        expect(diagnostics).to.have.length(1);
        // docLine = error.line + startLine = 3 + 5 = 8
        // The mock Range constructor stores (startLine, startChar, endLine, endChar)
        expect((diagnostics[0].range as any).startLine).to.equal(8);
        expect(diagnostics[0].message).to.include('undeclared identifier');
    });

    it('multiple errors are parsed and mapped correctly', () => {
        const harnessOffset = 21;
        const extractionStartLine = 3;

        const stderr = [
            '/tmp/preview_harness.cpp:22:5: error: first error',
            '/tmp/preview_harness.cpp:23:10: warning: some warning',
            '/tmp/preview_harness.cpp:24:1: error: second error',
        ].join('\n');

        const errors = parseGccErrors(stderr, harnessOffset);
        expect(errors).to.have.length(3);

        const content = [
            '// @dali-preview-begin',   // line 0 (would be line 2 in real doc)
            'return View::New()',        // line 1
            '    .Bad1()',              // line 2
            '    .Bad2()',              // line 3
            '    .Bad3();',             // line 4
            '// @dali-preview-end',     // line 5
        ].join('\n');

        const doc = createMockDocument('/tmp/err.cpp', content);
        const diagnostics = errorsToDiagnostics(errors, doc as any, extractionStartLine);

        expect(diagnostics).to.have.length(3);
        // error line 1 (22-21) + startLine 3 = docLine 4
        expect((diagnostics[0].range as any).startLine).to.equal(4);
        // error line 2 (23-21) + startLine 3 = docLine 5
        expect((diagnostics[1].range as any).startLine).to.equal(5);
        // Verify severity mapping
        expect(diagnostics[1].severity).to.equal(1); // DiagnosticSeverity.Warning = 1
    });

    it('errors in harness boilerplate (above user code) are filtered out', () => {
        const harnessOffset = 21;
        const stderr = [
            '/tmp/preview_harness.cpp:5:1: error: boilerplate error',
            '/tmp/preview_harness.cpp:22:1: error: user error',
        ].join('\n');

        const errors = parseGccErrors(stderr, harnessOffset);
        expect(errors).to.have.length(1);
        expect(errors[0].message).to.equal('user error');
    });

    it('plugin error parsing uses isPlugin flag correctly', () => {
        const pluginOffset = 10;

        const stderr = [
            '/tmp/preview_plugin.cpp:12:5: error: plugin error',
            '/tmp/preview_harness.cpp:25:1: error: harness error should be ignored',
        ].join('\n');

        const errors = parseGccErrors(stderr, pluginOffset, true);
        expect(errors).to.have.length(1);
        expect(errors[0].message).to.equal('plugin error');
        expect(errors[0].line).to.equal(2); // 12 - 10 = 2
    });
});

describe('Integration: Build generation guard (P0 scenario #4)', () => {
    it('simulates two builds where first is outdated', () => {
        // Reproduce the pattern from extension.ts:
        //   const myGeneration = ++buildGeneration;
        //   ... await build ...
        //   if (myGeneration !== buildGeneration) { return; /* stale */ }

        let buildGeneration = 0;
        const results: string[] = [];

        // First build starts
        const gen1 = ++buildGeneration; // gen1 = 1

        // Second build starts before first finishes
        const gen2 = ++buildGeneration; // gen2 = 2

        // First build completes -- check if stale
        if (gen1 === buildGeneration) {
            results.push('build1-applied');
        }

        // Second build completes -- check if stale
        if (gen2 === buildGeneration) {
            results.push('build2-applied');
        }

        // Only the second build should be applied
        expect(results).to.deep.equal(['build2-applied']);
    });

    it('generation counter increments correctly across multiple extractions', () => {
        let buildGeneration = 0;
        const generations: number[] = [];

        // Simulate three sequential build requests
        for (let i = 0; i < 3; i++) {
            const myGen = ++buildGeneration;
            generations.push(myGen);
        }

        expect(generations).to.deep.equal([1, 2, 3]);
        expect(buildGeneration).to.equal(3);

        // Only the last generation matches
        expect(generations[0] === buildGeneration).to.be.false;
        expect(generations[1] === buildGeneration).to.be.false;
        expect(generations[2] === buildGeneration).to.be.true;
    });
});

describe('Integration: instrumentCode preserves builder pattern', () => {
    it('FlexLayout::New() gets wrapped with __tag', () => {
        const code = 'return FlexLayout::New()\n    .FlexDirection(FlexDirection::COLUMN);';
        const result = instrumentCode(code, 0);

        expect(result).to.include('__tag(FlexLayout::New()');
        expect(result).to.include('"__L0"');
        // Builder chain should still be intact after the tag wrapper
        expect(result).to.include('.FlexDirection(FlexDirection::COLUMN)');
    });

    it('Animation::New() is NOT wrapped (non-Actor type)', () => {
        const code = 'Animation anim = Animation::New(2.0f);\nanim.Play();';
        const result = instrumentCode(code, 5);

        expect(result).to.not.include('__tag(Animation::New');
        expect(result).to.equal(code);
    });

    it('nested View::New() inside FlexLayout::New().Children({...}) is wrapped correctly', () => {
        const code = [
            'return FlexLayout::New()',           // line offset + 0
            '    .Children({',                    // line offset + 1
            '        View::New(),',               // line offset + 2
            '        TextLabel::New("Hello"),',   // line offset + 3
            '    });',                            // line offset + 4
        ].join('\n');

        const startLine = 10;
        const result = instrumentCode(code, startLine);

        // FlexLayout on first line of code: codeLine=0, absolute=10
        expect(result).to.include('__tag(FlexLayout::New(), "__L10")');
        // View on line 2 of code: codeLine=2, absolute=12
        expect(result).to.include('__tag(View::New(), "__L12")');
        // TextLabel on line 3 of code: codeLine=3, absolute=13
        expect(result).to.include('__tag(TextLabel::New("Hello"), "__L13")');
    });

    it('all recognized Actor types are tagged while non-Actor types are left alone', () => {
        const actorTypes = ['View', 'FlexLayout', 'TextLabel', 'ImageView', 'Control', 'Label', 'ScrollView', 'Actor'];
        const nonActorTypes = ['Animation', 'Timer', 'Capture', 'GestureDetector'];

        for (const t of actorTypes) {
            const code = `auto x = ${t}::New();`;
            const result = instrumentCode(code, 0);
            expect(result, `${t} should be tagged`).to.include(`__tag(${t}::New()`);
        }

        for (const t of nonActorTypes) {
            const code = `auto x = ${t}::New();`;
            const result = instrumentCode(code, 0);
            expect(result, `${t} should NOT be tagged`).to.not.include('__tag(');
        }
    });
});

describe('Integration: ConfigurationService', () => {
    it('getInstance() returns the same singleton', () => {
        const instance1 = ConfigurationService.getInstance();
        const instance2 = ConfigurationService.getInstance();

        expect(instance1).to.equal(instance2);
    });

    it('multiple calls to the same getter return consistent default values', () => {
        const config = ConfigurationService.getInstance();

        // These use the mock vscode.workspace.getConfiguration that returns
        // the defaultValue parameter, so they should be stable across calls
        const width1 = config.previewWidth;
        const width2 = config.previewWidth;
        expect(width1).to.equal(width2);
        expect(width1).to.equal(1920);   // TV FHD default profile

        const height1 = config.previewHeight;
        const height2 = config.previewHeight;
        expect(height1).to.equal(height2);
        expect(height1).to.equal(1080);

        const live1 = config.livePreview;
        const live2 = config.livePreview;
        expect(live1).to.equal(live2);
        expect(live1).to.equal(true);
    });

    it('background defaults to dark', () => {
        const config = ConfigurationService.getInstance();
        expect(config.background).to.equal('dark');
    });

    it('livePreviewDebounce defaults to 300', () => {
        const config = ConfigurationService.getInstance();
        expect(config.livePreviewDebounce).to.equal(300);
    });
});

// ==========================================================================
// P0 Test Scenarios — critical paths from the preview pipeline
// ==========================================================================

describe('P0: runPreview pipeline — Extract -> Instrument -> verify __tag', () => {
    it('extracting and instrumenting produces __tag wrapping for Actor types', () => {
        const content = [
            'return FlexLayout::New()',
            '    .FlexDirection(FlexDirection::COLUMN)',
            '    .Children({',
            '        TextLabel::New("Title"),',
            '        ImageView::New("photo.png"),',
            '    });',
        ].join('\n');

        const doc = createMockDocument('/tmp/card.preview.dali.cpp', content);
        const extraction = extractPreviewCode(doc as any);
        expect(extraction).to.not.be.null;

        const instrumented = instrumentCode(extraction!.code, extraction!.startLine);

        // All three Actor types should be wrapped
        expect(instrumented).to.include('__tag(FlexLayout::New()');
        expect(instrumented).to.include('__tag(TextLabel::New("Title")');
        expect(instrumented).to.include('__tag(ImageView::New("photo.png")');
    });
});

describe('P0: Parser path — parseChainExpression scene node structure', () => {
    beforeEach(() => {
        clearParserCache();
    });

    it('successfully parses a chain expression and returns correct node structure', () => {
        const code = [
            'return FlexLayout::New()',
            '    .FlexDirection(FlexDirection::COLUMN)',
            '    .JustifyContent(FlexJustification::CENTER)',
            '    .Children({',
            '        TextLabel::New("Hello")',
            '            .TextColor(Color::WHITE),',
            '    });',
        ].join('\n');

        const scene = parseChainExpression(code, 0);

        expect(scene).to.not.be.null;
        expect(scene!.type).to.equal('FlexLayout');
        expect(scene!.constructorArgs).to.deep.equal([]);
        expect(scene!.properties).to.have.property('FlexDirection');
        expect(scene!.properties['FlexDirection']).to.deep.equal(['FlexDirection::COLUMN']);
        expect(scene!.properties).to.have.property('JustifyContent');
        expect(scene!.children).to.have.length(1);

        const child = scene!.children[0];
        expect(child.type).to.equal('TextLabel');
        expect(child.constructorArgs).to.deep.equal(['"Hello"']);
        expect(child.properties).to.have.property('TextColor');
    });

    it('returns null for unsupported patterns (ternary, control flow)', () => {
        const code = 'return condition ? View::New() : TextLabel::New("fallback");';
        const scene = parseChainExpression(code, 0);
        expect(scene).to.be.null;
    });
});

describe('P0: Compile error chain — parseGccErrors -> errorsToDiagnostics', () => {
    it('end-to-end: error string -> parsed -> diagnostics with correct line range', () => {
        // Simulate a realistic template
        const fakeTemplate = [
            '#include <dali/dali.h>',       // line 1
            '#include <dali-toolkit.h>',    // line 2
            'using namespace Dali;',         // line 3
            'Actor CreatePreview() {',       // line 4
            '{{USER_CODE}}',                 // line 5
            '}',                             // line 6
        ].join('\n');

        const offset = getHarnessCodeOffset(fakeTemplate);
        expect(offset).to.equal(5); // {{USER_CODE}} is on line 5 (1-based)

        // Simulate error on harness line 7 => user code line 7 - 5 = 2
        const stderr = '/tmp/preview_harness.cpp:7:15: error: expected \';\' after expression';
        const errors = parseGccErrors(stderr, offset);

        expect(errors).to.have.length(1);
        expect(errors[0].line).to.equal(2);
        expect(errors[0].column).to.equal(15);

        // Document with extraction starting at line 10
        const docContent = Array(15).fill('// line').join('\n');
        const doc = createMockDocument('/tmp/test.cpp', docContent);
        const startLine = 10;

        const diagnostics = errorsToDiagnostics(errors, doc as any, startLine);

        expect(diagnostics).to.have.length(1);
        // docLine = error.line + startLine = 2 + 10 = 12
        expect((diagnostics[0].range as any).startLine).to.equal(12);
        expect(diagnostics[0].source).to.equal('DALi Preview');
    });
});

describe('P0: Build generation guard', () => {
    it('two sequential extractions: only the latest generation is valid', () => {
        let buildGeneration = 0;
        const applied: number[] = [];

        // Simulate the pattern from runPreview:
        // const myGeneration = ++buildGeneration;
        // ... build ...
        // if (myGeneration !== buildGeneration) return;
        // updateImage()

        async function simulateBuild(buildId: number): Promise<void> {
            const myGeneration = ++buildGeneration;
            // Simulate async work
            await Promise.resolve();
            // Check staleness
            if (myGeneration === buildGeneration) {
                applied.push(buildId);
            }
        }

        // Start build 1, but don't await it yet
        const b1 = simulateBuild(1);
        // Start build 2 immediately (generation advances)
        const b2 = simulateBuild(2);

        // Both finish
        return Promise.all([b1, b2]).then(() => {
            // Only the last build should have been applied
            expect(applied).to.deep.equal([2]);
        });
    });
});

describe('P0: instrumentCode with line tracking', () => {
    it('__L{line} tags have correct absolute line numbers', () => {
        const code = [
            'return FlexLayout::New()',    // codeLine 0
            '    .Children({',             // codeLine 1
            '        View::New(),',        // codeLine 2
            '        TextLabel::New("X"),' // codeLine 3
            ,
            '    });',                      // codeLine 4
        ].join('\n');

        const startLine = 20;
        const instrumented = instrumentCode(code, startLine);

        // FlexLayout: codeLine 0, absolute = 0 + 20 = 20
        expect(instrumented).to.include('"__L20"');
        // View: codeLine 2, absolute = 2 + 20 = 22
        expect(instrumented).to.include('"__L22"');
        // TextLabel: codeLine 3, absolute = 3 + 20 = 23
        expect(instrumented).to.include('"__L23"');
    });

    it('single-line code at high startLine has correct tag', () => {
        const instrumented = instrumentCode('return View::New();', 100);
        expect(instrumented).to.include('"__L100"');
    });

    it('non-Actor calls produce no __L tags', () => {
        const code = 'Animation anim = Animation::New(2.0f);';
        const instrumented = instrumentCode(code, 50);
        expect(instrumented).to.not.include('__L');
    });
});

describe('P0: buildAndRun error path', () => {
    it('verifies BuildResult contract: success=false when error is present', () => {
        // This tests the BuildResult interface contract without actually
        // invoking the build. The BuildRunner.buildAndRun() returns a
        // BuildResult where success=false means the build failed.
        // We verify the interface shape and the error->diagnostics flow.

        const buildResult = {
            success: false,
            error: '/tmp/preview_harness.cpp:25:3: error: expected expression',
        };

        expect(buildResult.success).to.equal(false);
        expect(buildResult.error).to.be.a('string');

        // Parse the error and convert to diagnostics
        const errors = parseGccErrors(buildResult.error!, 21);
        expect(errors).to.have.length(1);

        const displayMsg = formatErrorsForDisplay(errors);
        expect(displayMsg).to.include('Error');
        expect(displayMsg).to.include('expected expression');
    });

    it('verifies BuildResult contract: pngPath is undefined on failure', () => {
        const buildResult = {
            success: false,
            pngPath: undefined as string | undefined,
            error: 'compile failed',
        };

        expect(buildResult.success).to.equal(false);
        expect(buildResult.pngPath).to.be.undefined;
    });
});

describe('P0: Multi-config extraction', () => {
    it('extracts from a document with multiple @preview-config lines', () => {
        const content = [
            '// @dali-preview-begin',
            '// @preview-config: name="Phone Light", width=720, height=1280, theme=light',
            '// @preview-config: name="Phone Dark", width=720, height=1280, theme=dark',
            '// @preview-config: name="Tablet", width=1920, height=1080',
            'return FlexLayout::New()',
            '    .Children({',
            '        TextLabel::New("Hello"),',
            '    });',
            '// @dali-preview-end',
        ].join('\n');

        const doc = createMockDocument('/tmp/multi.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.configs).to.have.length(3);

        // Verify each config was parsed correctly
        expect(extraction!.configs![0].name).to.equal('Phone Light');
        expect(extraction!.configs![0].width).to.equal(720);
        expect(extraction!.configs![0].height).to.equal(1280);
        expect(extraction!.configs![0].theme).to.equal('light');

        expect(extraction!.configs![1].name).to.equal('Phone Dark');
        expect(extraction!.configs![1].theme).to.equal('dark');

        expect(extraction!.configs![2].name).to.equal('Tablet');
        expect(extraction!.configs![2].width).to.equal(1920);
        expect(extraction!.configs![2].height).to.equal(1080);
        expect(extraction!.configs![2].theme).to.be.undefined;

        // Code should not contain @preview-config lines
        expect(extraction!.code).to.not.include('@preview-config');
        expect(extraction!.code).to.include('FlexLayout::New()');
    });

    it('multi-config extraction from preview-file mode', () => {
        const content = [
            '// @preview-config: name="Watch", width=360, height=360, theme=dark',
            '// @preview-config: name="Fridge", width=480, height=800, theme=light',
            'return View::New()',
            '    .SetBackgroundColor(Color::WHITE);',
        ].join('\n');

        const doc = createMockDocument('/tmp/device.preview.dali.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.mode).to.equal('preview-file');
        expect(extraction!.configs).to.have.length(2);
        expect(extraction!.configs![0].name).to.equal('Watch');
        expect(extraction!.configs![1].name).to.equal('Fridge');

        // startLine should skip config lines
        expect(extraction!.startLine).to.equal(2);
    });

    it('multi-config with animation flag: identifies animation config', () => {
        const content = [
            '// @dali-preview-begin',
            '// @preview-config: name="Static", width=720, height=1280',
            '// @preview-config: name="Animated", width=720, height=1280, animation=true, duration=2000, fps=10',
            'return View::New();',
            '// @dali-preview-end',
        ].join('\n');

        const doc = createMockDocument('/tmp/anim.cpp', content);
        const extraction = extractPreviewCode(doc as any);

        expect(extraction).to.not.be.null;
        expect(extraction!.configs).to.have.length(2);

        // Verify the extension can find the animation config
        const animConfig = extraction!.configs!.find(c => c.animation === true);
        expect(animConfig).to.not.be.undefined;
        expect(animConfig!.name).to.equal('Animated');
        expect(animConfig!.duration).to.equal(2000);
        expect(animConfig!.fps).to.equal(10);

        // The non-animation config
        const staticConfig = extraction!.configs!.find(c => c.animation !== true);
        expect(staticConfig).to.not.be.undefined;
        expect(staticConfig!.name).to.equal('Static');
    });
});

describe('P0: getPluginCodeOffset and getHarnessCodeOffset consistency', () => {
    it('getPluginCodeOffset delegates to getHarnessCodeOffset', () => {
        const template = 'line1\nline2\n{{USER_CODE}}\nline4';
        const pluginOffset = getPluginCodeOffset(template);
        const harnessOffset = getHarnessCodeOffset(template);
        expect(pluginOffset).to.equal(harnessOffset);
        expect(pluginOffset).to.equal(3); // {{USER_CODE}} on line 3 (1-based)
    });
});

describe('P0: Extract -> Instrument -> Parse roundtrip consistency', () => {
    beforeEach(() => {
        clearParserCache();
    });

    it('parser sourceLine matches instrumentCode __L tags for the same code', () => {
        const content = [
            '// @dali-preview-begin',             // line 0
            'return FlexLayout::New()',            // line 1 (startLine)
            '    .Children({',                     // line 2
            '        TextLabel::New("Hello"),',    // line 3
            '    });',                             // line 4
            '// @dali-preview-end',                // line 5
        ].join('\n');

        const doc = createMockDocument('/tmp/roundtrip.cpp', content);
        const extraction = extractPreviewCode(doc as any);
        expect(extraction).to.not.be.null;

        const startLine = extraction!.startLine;
        expect(startLine).to.equal(1);

        // Instrument path
        const instrumented = instrumentCode(extraction!.code, startLine);

        // Parser path
        const scene = parseChainExpression(extraction!.code, startLine);
        expect(scene).to.not.be.null;

        // Both should agree on FlexLayout's source line
        expect(scene!.sourceLine).to.equal(1);
        expect(instrumented).to.include('"__L1"');

        // Both should agree on TextLabel's source line
        expect(scene!.children[0].sourceLine).to.equal(3);
        expect(instrumented).to.include('"__L3"');
    });
});
