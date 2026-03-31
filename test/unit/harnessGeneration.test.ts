import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

// __dirname at runtime is out/test/unit, so we go up three levels to project root
const TEMPLATE_PATH = path.resolve(__dirname, '../../../server/preview_harness.cpp.template');

/**
 * Perform the same template substitution the extension does at runtime.
 */
function substituteTemplate(
    template: string,
    userCode: string,
    width: number,
    height: number,
    outputPath: string,
    metadataPath: string = '/tmp/preview_metadata.json',
    theme: 'light' | 'dark' = 'dark',
): string {
    const bgColor = theme === 'light'
        ? 'Vector4(1.0f, 1.0f, 1.0f, 1.0f)'
        : 'Vector4(0.1f, 0.1f, 0.12f, 1.0f)';
    return template
        .replace(/\{\{USER_CODE\}\}/g, userCode)
        .replace(/\{\{PREVIEW_WIDTH\}\}/g, `${width}.0f`)
        .replace(/\{\{PREVIEW_HEIGHT\}\}/g, `${height}.0f`)
        .replace(/\{\{OUTPUT_PATH\}\}/g, outputPath)
        .replace(/\{\{METADATA_PATH\}\}/g, metadataPath)
        .replace(/\{\{BACKGROUND_COLOR\}\}/g, bgColor);
}

describe('harnessGeneration', () => {
    let template: string;

    before(() => {
        template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    });

    it('template file exists and is non-empty', () => {
        expect(template.length).to.be.greaterThan(0);
    });

    it('template contains expected placeholders', () => {
        expect(template).to.include('{{USER_CODE}}');
        expect(template).to.include('{{PREVIEW_WIDTH}}');
        expect(template).to.include('{{PREVIEW_HEIGHT}}');
        expect(template).to.include('{{OUTPUT_PATH}}');
        expect(template).to.include('{{METADATA_PATH}}');
        expect(template).to.include('{{BACKGROUND_COLOR}}');
    });

    it('substitution replaces all placeholders', () => {
        const result = substituteTemplate(
            template,
            'return View::New();',
            1024,
            600,
            '/tmp/preview.png',
        );

        expect(result).to.not.include('{{USER_CODE}}');
        expect(result).to.not.include('{{PREVIEW_WIDTH}}');
        expect(result).to.not.include('{{PREVIEW_HEIGHT}}');
        expect(result).to.not.include('{{OUTPUT_PATH}}');

        // No remaining {{ }} placeholders
        expect(result).to.not.match(/\{\{[A-Z_]+\}\}/);
    });

    it('substitution inserts user code correctly', () => {
        const userCode = 'return View::New()\n    .SetBackgroundColor(Color::RED);';
        const result = substituteTemplate(template, userCode, 800, 600, '/tmp/out.png');

        expect(result).to.include(userCode);
    });

    it('substitution sets dimensions correctly', () => {
        const result = substituteTemplate(template, 'return View::New();', 1920, 1080, '/tmp/out.png');

        expect(result).to.include('1920');
        expect(result).to.include('1080');
    });

    it('substitution sets output path in all locations', () => {
        const result = substituteTemplate(template, 'return View::New();', 1024, 600, '/tmp/my_preview.png');

        // OUTPUT_PATH appears twice in template (capture start and OK: message)
        const count = (result.match(/\/tmp\/my_preview\.png/g) || []).length;
        expect(count).to.be.greaterThanOrEqual(2);
    });

    it('dark theme uses correct background color', () => {
        const result = substituteTemplate(template, 'return View::New();', 1024, 600, '/tmp/out.png', '/tmp/meta.json', 'dark');
        expect(result).to.include('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
        expect(result).to.not.include('Vector4(1.0f, 1.0f, 1.0f, 1.0f)');
    });

    it('light theme uses correct background color', () => {
        const result = substituteTemplate(template, 'return View::New();', 1024, 600, '/tmp/out.png', '/tmp/meta.json', 'light');
        expect(result).to.include('Vector4(1.0f, 1.0f, 1.0f, 1.0f)');
        expect(result).to.not.include('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
    });

    it('golden file matches expected output for red-box sample', () => {
        const samplePath = path.resolve(__dirname, '../../../test/samples/red-box.preview.dali.cpp');
        const goldenPath = path.resolve(__dirname, '../../../test/golden/red-box.harness.cpp');

        const userCode = fs.readFileSync(samplePath, 'utf-8');
        const generated = substituteTemplate(template, userCode, 1024, 600, '/tmp/preview.png');
        const golden = fs.readFileSync(goldenPath, 'utf-8');

        expect(generated).to.equal(golden);
    });
});
