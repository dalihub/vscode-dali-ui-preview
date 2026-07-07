import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { createMockDocument } from '../helpers/mockDocument';
import { PreviewCodeLensProvider } from '../../src/previewCodeLens';
import { ConfigurationService } from '../../src/configurationService';

describe('PreviewCodeLensProvider', () => {
    let provider: PreviewCodeLensProvider;

    beforeEach(() => {
        provider = new PreviewCodeLensProvider();
    });

    afterEach(() => {
        sinon.restore();
    });

    /**
     * Helper: force the provider to treat the workspace as a DALi project
     * so we can test CodeLens scanning logic in isolation.
     */
    function makeDaliProject(): void {
        (provider as any)._isDaliProject = true;
    }

    /**
     * Helper: force the provider to treat the workspace as NOT a DALi project.
     */
    function makeNonDaliProject(): void {
        (provider as any)._isDaliProject = false;
    }

    // -----------------------------------------------------------------
    // provideCodeLenses()
    // -----------------------------------------------------------------
    describe('provideCodeLenses()', () => {
        it('returns empty for .preview.dali.cpp files', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/card.preview.dali.cpp', [
                'return View::New();',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('returns empty for non-.cpp/.h files', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/script.ts', [
                'View CreateUI() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('returns empty for .py files', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/main.py', 'print("hello")');

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('returns empty when not a DALi project', async () => {
            makeNonDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('shows the Preview CodeLens in DOCKER mode with NO local DALi install', async () => {
            // Regression: docker users have no host DALi (no setenv / daliPrefix / pkg-config),
            // so the old checkDaliProject() returned false and the Preview CodeLens never
            // appeared. The runtime container provides DALi, so docker mode must qualify.
            (provider as any)._isDaliProject = undefined; // let checkDaliProject() run
            sinon.stub(ConfigurationService.prototype, 'runtimeMode').get(() => 'docker');
            sinon.stub(vscode.workspace, 'workspaceFolders').value(undefined);
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
            expect(lenses[0].command!.title).to.include('Preview');
        });

        it('finds CodeLens for function returning View with ::New() in body', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
            expect(lenses[0].command!.title).to.include('Preview');
            expect(lenses[0].command!.command).to.equal('dali.previewFunction');
        });

        it('finds CodeLens for function returning FlexLayout', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'FlexLayout BuildCard() {',
                '    return FlexLayout::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('finds CodeLens for function returning TextLabel', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'TextLabel MakeLabel() {',
                '    return TextLabel::New("Hello");',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('finds CodeLens for function returning ImageView', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'ImageView MakeImage() {',
                '    return ImageView::New("photo.png");',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('finds CodeLens for function returning Control', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'Control MakeControl() {',
                '    return Control::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('finds CodeLens for function returning Actor', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'Actor MakeActor() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('does NOT add CodeLens for functions returning non-DALi types', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'int main() {',
                '    return 0;',
                '}',
                '',
                'std::string GetName() {',
                '    return "hello";',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('does NOT add CodeLens for functions whose body lacks ::New()', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI() {',
                '    View v;',
                '    v.SetBackgroundColor(Color::RED);',
                '    return v;',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('does NOT add CodeLens when body has non-DALi ::New() calls', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI() {',
                '    auto ptr = SomeOtherClass::New();',
                '    return View();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('handles multiple functions in one file', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateCard() {',
                '    return View::New();',
                '}',
                '',
                'int helper() {',
                '    return 42;',
                '}',
                '',
                'TextLabel MakeLabel() {',
                '    return TextLabel::New("hi");',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(2);
        });

        it('returns CodeLens with correct command and arguments', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);

            const cmd = lenses[0].command!;
            expect(cmd.command).to.equal('dali.previewFunction');
            expect(cmd.title).to.include('Preview');
            expect(cmd.arguments).to.be.an('array');
            expect(cmd.arguments).to.have.length(3);
            // arguments: [document.uri, funcStartLine, bodyEndLine]
            expect(cmd.arguments![0]).to.deep.equal(doc.uri);
            expect(cmd.arguments![1]).to.equal(0); // function starts at line 0
            expect(cmd.arguments![2]).to.equal(2); // closing brace at line 2
        });

        it('works with .h files', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/widget.h', [
                'View CreateWidget() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('handles function with parameters', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI(int width, const std::string& title) {',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('handles function with brace on next line', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI()',
                '{',
                '    return View::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            // The regex requires the opening brace to be optional on the signature line;
            // if the brace is on the next line, the function signature line may or may not
            // have a trailing {. The regex allows '{?' at end, so this depends on exact match.
            // With "View CreateUI()\n{" the first line is "View CreateUI()" which matches FUNC_RE.
            expect(lenses).to.have.length(1);
        });

        it('returns empty array for file with no functions', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                '#include <dali/dali.h>',
                '',
                '// just some comments',
                'const int X = 42;',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);
        });

        it('finds ScrollView return type', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'ScrollView MakeScroll() {',
                '    return ScrollView::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });

        it('finds Label return type', async () => {
            makeDaliProject();
            const doc = createMockDocument('/tmp/example.cpp', [
                'Label MakeLabel() {',
                '    return Label::New();',
                '}',
            ].join('\n'));

            const lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });
    });

    // -----------------------------------------------------------------
    // refresh()
    // -----------------------------------------------------------------
    describe('refresh()', () => {
        it('fires onDidChangeCodeLenses event', () => {
            // Access the internal emitter to spy on fire()
            const emitter = (provider as any)._onDidChange;
            const fireSpy = sinon.spy(emitter, 'fire');

            provider.refresh();

            expect(fireSpy.calledOnce).to.equal(true);
        });

        it('clears isDaliProject cache', () => {
            // Set cache to a known value
            (provider as any)._isDaliProject = true;

            provider.refresh();

            expect((provider as any)._isDaliProject).to.be.undefined;
        });

        it('allows re-detection after refresh', async () => {
            // First: mark as non-DALi project
            (provider as any)._isDaliProject = false;

            const doc = createMockDocument('/tmp/example.cpp', [
                'View CreateUI() {',
                '    return View::New();',
                '}',
            ].join('\n'));

            // Should return empty (not a DALi project)
            let lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(0);

            // Now refresh and set to DALi project
            provider.refresh();
            (provider as any)._isDaliProject = true;

            lenses = await provider.provideCodeLenses(doc as any);
            expect(lenses).to.have.length(1);
        });
    });

    // -----------------------------------------------------------------
    // checkDaliProject()
    // NOTE: checkDaliProject uses `fs.existsSync` / `fs.readFileSync`
    //       which are non-configurable in Node.js, so we use real temp
    //       files instead of sinon stubs.  The promisified `exec` is
    //       captured at module-load time so we cannot stub it either;
    //       for the pkg-config path we test the observable contract.
    // -----------------------------------------------------------------
    describe('checkDaliProject()', () => {
        let tmpDir: string;
        const mockVscode = require('vscode');

        before(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dali-test-'));
        });

        after(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('returns cached value on subsequent calls', async () => {
            (provider as any)._isDaliProject = true;
            const result = await (provider as any).checkDaliProject();
            expect(result).to.equal(true);
        });

        it('detects DALi project from setenv file with DESKTOP_PREFIX', async () => {
            // Reset cache
            (provider as any)._isDaliProject = undefined;

            // Create a real setenv file in a temp workspace folder
            const setenvPath = path.join(tmpDir, 'setenv');
            fs.writeFileSync(setenvPath, 'export DESKTOP_PREFIX=/opt/dali\n');

            // Set up workspace folders to point at our temp dir
            const origFolders = mockVscode.workspace.workspaceFolders;
            mockVscode.workspace.workspaceFolders = [
                { uri: { fsPath: tmpDir }, name: 'test', index: 0 },
            ];

            try {
                const result = await (provider as any).checkDaliProject();
                expect(result).to.equal(true);
                expect((provider as any)._isDaliProject).to.equal(true);
            } finally {
                mockVscode.workspace.workspaceFolders = origFolders;
                fs.unlinkSync(setenvPath);
            }
        });

        it('does not detect DALi from setenv file without DESKTOP_PREFIX', async () => {
            (provider as any)._isDaliProject = undefined;

            const setenvPath = path.join(tmpDir, 'setenv');
            fs.writeFileSync(setenvPath, '# no prefix here\nexport OTHER_VAR=1\n');

            const origFolders = mockVscode.workspace.workspaceFolders;
            mockVscode.workspace.workspaceFolders = [
                { uri: { fsPath: tmpDir }, name: 'test', index: 0 },
            ];

            // Also ensure config returns empty prefix so it falls through
            const origGetConfig = mockVscode.workspace.getConfiguration;
            mockVscode.workspace.getConfiguration = (_section?: string) => ({
                get: (key: string, defaultValue?: any) => defaultValue,
            });

            try {
                // This will fall through setenv check, config check, then try pkg-config.
                // On most dev machines pkg-config for dali2-ui-foundation will fail,
                // so this should return false (unless DALi is installed system-wide).
                const result = await (provider as any).checkDaliProject();
                // We cannot guarantee the pkg-config result, so just verify cache was set.
                expect((provider as any)._isDaliProject).to.be.a('boolean');
            } finally {
                mockVscode.workspace.workspaceFolders = origFolders;
                mockVscode.workspace.getConfiguration = origGetConfig;
                fs.unlinkSync(setenvPath);
            }
        });

        it('detects DALi project from daliPrefix config setting', async () => {
            (provider as any)._isDaliProject = undefined;

            mockVscode.workspace.workspaceFolders = undefined;

            // Override getConfiguration to return a non-empty daliPrefix
            const origGetConfig = mockVscode.workspace.getConfiguration;
            mockVscode.workspace.getConfiguration = (_section?: string) => ({
                get: (key: string, defaultValue?: any) => {
                    if (key === 'daliPrefix') {
                        return '/opt/dali';
                    }
                    return defaultValue;
                },
            });

            try {
                const result = await (provider as any).checkDaliProject();
                expect(result).to.equal(true);
            } finally {
                mockVscode.workspace.getConfiguration = origGetConfig;
            }
        });

        it('falls through to pkg-config when no setenv and no config', async () => {
            (provider as any)._isDaliProject = undefined;

            mockVscode.workspace.workspaceFolders = undefined;

            const origGetConfig = mockVscode.workspace.getConfiguration;
            mockVscode.workspace.getConfiguration = (_section?: string) => ({
                get: (key: string, defaultValue?: any) => defaultValue,
            });

            try {
                // pkg-config --exists dali2-ui-foundation may or may not succeed
                // depending on the machine. We just verify it returns a boolean
                // and sets the cache.
                const result = await (provider as any).checkDaliProject();
                expect(result).to.be.a('boolean');
                expect((provider as any)._isDaliProject).to.equal(result);
            } finally {
                mockVscode.workspace.getConfiguration = origGetConfig;
            }
        });

        it('caching prevents repeated file system checks', async () => {
            (provider as any)._isDaliProject = true;

            // Even with no workspace folders, cached value is returned
            mockVscode.workspace.workspaceFolders = undefined;
            const result = await (provider as any).checkDaliProject();
            expect(result).to.equal(true);
        });

        it('refresh() invalidates cache so checkDaliProject re-evaluates', async () => {
            (provider as any)._isDaliProject = true;
            provider.refresh();
            expect((provider as any)._isDaliProject).to.be.undefined;
        });
    });

    // -----------------------------------------------------------------
    // onDidChangeCodeLenses event
    // -----------------------------------------------------------------
    describe('onDidChangeCodeLenses', () => {
        it('is an event property on the provider', () => {
            expect(provider.onDidChangeCodeLenses).to.be.a('function');
        });
    });
});
