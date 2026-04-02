import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { BuildRunner } from '../../src/buildRunner';
import * as daliEnv from '../../src/daliEnvironment';

const PROJECT_ROOT_FOR_SANITIZE = path.resolve(__dirname, '../../..');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function makeContext(extensionPath = PROJECT_ROOT) {
    return {
        extensionPath,
        subscriptions: [],
        globalState: { get: () => undefined, update: () => Promise.resolve() },
    } as any;
}

const fakeOutputChannel = {
    appendLine: () => {},
    append: () => {},
    show: () => {},
    dispose: () => {},
} as any;

describe('BuildRunner — compilePlugin()', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('returns {success:false} when dali prefix is not found', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(false);
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(null);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        const result = await runner.compilePlugin('return Button::New();');

        expect(result.success).to.equal(false);
        expect(result.error).to.include('DALi');
    });

    it('substitutes {{USER_CODE}} in plugin template before compiling', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        let capturedSourceContent = '';
        // Override compileShared to capture what was written and skip actual compilation
        (runner as any).compileShared = async (srcPath: string) => {
            capturedSourceContent = fs.readFileSync(srcPath, 'utf-8');
            return { success: true };
        };

        const userCode = 'return MyWidget::New();';
        await runner.compilePlugin(userCode);

        expect(capturedSourceContent).to.include(userCode);
        expect(capturedSourceContent).not.to.include('{{USER_CODE}}');
    });

    it('returns {success:false} with stderr on compile failure', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        const stderrMsg = "error: use of undeclared identifier 'foo'";
        (runner as any).compileShared = async () => ({
            success: false,
            error: stderrMsg,
        });

        const result = await runner.compilePlugin('return foo();');
        expect(result.success).to.equal(false);
        expect(result.error).to.include('foo');
    });

    it('uses config-named .so path when configName is provided', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        let capturedSoPath = '';
        (runner as any).compileShared = async (_srcPath: string, soPath: string) => {
            capturedSoPath = soPath;
            return { success: true };
        };

        const result = await runner.compilePlugin('return View::New();', 'Phone Light');
        expect(result.soPath).to.include('phone_light');
        expect(capturedSoPath).to.include('phone_light');
    });

    it('uses default preview_plugin.so when no configName is provided', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        let capturedSoPath = '';
        (runner as any).compileShared = async (_srcPath: string, soPath: string) => {
            capturedSoPath = soPath;
            return { success: true };
        };

        await runner.compilePlugin('return View::New();');
        expect(capturedSoPath).to.match(/preview_plugin\.so$/);
    });
});

describe('BuildRunner.themeToBackgroundColor()', () => {
    it('returns dark color for dark theme', () => {
        expect(BuildRunner.themeToBackgroundColor('dark')).to.equal('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
    });

    it('returns white color for light theme', () => {
        expect(BuildRunner.themeToBackgroundColor('light')).to.equal('Vector4(1.0f, 1.0f, 1.0f, 1.0f)');
    });
});

describe('BuildRunner.hexToVector4()', () => {
    it('converts red #ff0000 correctly', () => {
        expect(BuildRunner.hexToVector4('#ff0000')).to.equal('Vector4(1.0000f, 0.0000f, 0.0000f, 1.0f)');
    });

    it('converts black #000000 correctly', () => {
        expect(BuildRunner.hexToVector4('#000000')).to.equal('Vector4(0.0000f, 0.0000f, 0.0000f, 1.0f)');
    });

    it('converts white #ffffff correctly', () => {
        expect(BuildRunner.hexToVector4('#ffffff')).to.equal('Vector4(1.0000f, 1.0000f, 1.0000f, 1.0f)');
    });

    it('converts uppercase hex #FF0000 correctly', () => {
        expect(BuildRunner.hexToVector4('#FF0000')).to.equal('Vector4(1.0000f, 0.0000f, 0.0000f, 1.0f)');
    });

    it('converts mid-range color #804020 correctly', () => {
        expect(BuildRunner.hexToVector4('#804020')).to.equal('Vector4(0.5020f, 0.2510f, 0.1255f, 1.0f)');
    });

    it('returns dark fallback for empty string', () => {
        expect(BuildRunner.hexToVector4('')).to.equal('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
    });

    it('returns dark fallback for string without # prefix', () => {
        expect(BuildRunner.hexToVector4('ff0000')).to.equal('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
    });

    it('returns dark fallback for too-short hex string', () => {
        expect(BuildRunner.hexToVector4('#abc')).to.equal('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
    });

    it('returns dark fallback for too-long hex string', () => {
        expect(BuildRunner.hexToVector4('#1234567')).to.equal('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
    });

    it('returns dark fallback for non-hex characters', () => {
        expect(BuildRunner.hexToVector4('#GGHHII')).to.equal('Vector4(0.1f, 0.1f, 0.12f, 1.0f)');
    });
});

describe('BuildRunner — buildAndRun() fontSetup', () => {
    let tmpFontDir: string;

    before(() => {
        tmpFontDir = path.join(require('os').tmpdir(), 'dali-test-fonts-' + Date.now());
        fs.mkdirSync(tmpFontDir, { recursive: true });
        fs.writeFileSync(path.join(tmpFontDir, 'NotoSansKR.ttf'), '');
    });

    after(() => {
        fs.rmSync(tmpFontDir, { recursive: true, force: true });
    });

    afterEach(() => {
        sinon.restore();
    });

    it('injects FontClient::Get().AddCustomFontDirectory when font is found in fontDirectories', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const fakeConfig = { get: (_key: string, def: string[]) => [tmpFontDir] };
        sinon.stub(vscode.workspace, 'getConfiguration').returns(fakeConfig as any);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        let capturedHarnessContent = '';
        (runner as any).compile = async (harnessPath: string) => {
            capturedHarnessContent = fs.readFileSync(harnessPath, 'utf-8');
            return { success: false, error: 'stub' };
        };

        await runner.buildAndRun('return View::New();', 720, 1280, 'dark', undefined, undefined, undefined, 'NotoSansKR.ttf');

        expect(capturedHarnessContent).to.include(`FontClient::Get().AddCustomFontDirectory("${tmpFontDir}")`);
    });

    it('omits FontClient snippet when font is not specified', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        let capturedHarnessContent = '';
        (runner as any).compile = async (harnessPath: string) => {
            capturedHarnessContent = fs.readFileSync(harnessPath, 'utf-8');
            return { success: false, error: 'stub' };
        };

        await runner.buildAndRun('return View::New();', 720, 1280, 'dark');

        expect(capturedHarnessContent).to.not.include('FontClient::Get().AddCustomFontDirectory');
    });

    it('escapes double-quotes in fontDir before C++ injection', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        // Use a directory containing a double-quote in the name (valid on Linux)
        const quotedDir = path.join(require('os').tmpdir(), 'fonts-"test-' + Date.now());
        fs.mkdirSync(quotedDir, { recursive: true });
        fs.writeFileSync(path.join(quotedDir, 'Test.ttf'), '');

        const fakeConfig = { get: (_key: string, def: string[]) => [quotedDir] };
        sinon.stub(vscode.workspace, 'getConfiguration').returns(fakeConfig as any);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        let capturedHarnessContent = '';
        (runner as any).compile = async (harnessPath: string) => {
            capturedHarnessContent = fs.readFileSync(harnessPath, 'utf-8');
            return { success: false, error: 'stub' };
        };

        await runner.buildAndRun('return View::New();', 720, 1280, 'dark', undefined, undefined, undefined, 'Test.ttf');

        fs.rmSync(quotedDir, { recursive: true, force: true });

        // Compute the correctly escaped version to verify escaping was applied
        const expectedEscaped = quotedDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        expect(capturedHarnessContent).to.include(`AddCustomFontDirectory("${expectedEscaped}")`);
        // Also verify the raw (unescaped) double-quote is NOT present in the AddCustomFontDirectory call
        const rawFontDirInCall = `AddCustomFontDirectory("${quotedDir}")`;
        expect(capturedHarnessContent).to.not.include(rawFontDirInCall);
    });
});

describe('BuildRunner.sanitizeConfigName()', () => {
    it('lowercases the name', () => {
        expect(BuildRunner.sanitizeConfigName('Phone Light')).to.equal('phone_light');
    });

    it('replaces spaces with underscores', () => {
        expect(BuildRunner.sanitizeConfigName('My Config Name')).to.equal('my_config_name');
    });

    it('replaces special characters with underscores', () => {
        expect(BuildRunner.sanitizeConfigName('1080p/60fps')).to.equal('1080p_60fps');
    });

    it('collapses multiple separators into one underscore', () => {
        expect(BuildRunner.sanitizeConfigName('Phone  --  Light')).to.equal('phone_light');
    });

    it('strips leading and trailing underscores', () => {
        expect(BuildRunner.sanitizeConfigName('_test_')).to.equal('test');
    });
});

describe('BuildRunner — buildInteractive()', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('returns {success:false} when DALi prefix is not found', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(false);
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(null);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        const result = await runner.buildInteractive('return Button::New();');

        expect(result.success).to.equal(false);
        expect(result.error).to.include('DALi');
    });

    it('substitutes USER_CODE, PREVIEW_WIDTH, PREVIEW_HEIGHT, BACKGROUND_COLOR in template', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        let capturedContent = '';
        (runner as any).compile = async (srcPath: string) => {
            capturedContent = fs.readFileSync(srcPath, 'utf-8');
            return { success: true };
        };

        const userCode = 'return TextLabel::New("hello");';
        await runner.buildInteractive(userCode, 800, 480, 'dark');

        expect(capturedContent).to.include(userCode);
        expect(capturedContent).not.to.include('{{USER_CODE}}');
        expect(capturedContent).to.include('800.0f');
        expect(capturedContent).to.include('480.0f');
        expect(capturedContent).not.to.include('{{PREVIEW_WIDTH}}');
        expect(capturedContent).not.to.include('{{PREVIEW_HEIGHT}}');
        expect(capturedContent).not.to.include('{{BACKGROUND_COLOR}}');
    });

    it('returns {success:false, error} when compile fails', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        const stderrMsg = "error: 'Foo' was not declared";
        (runner as any).compile = async () => ({ success: false, error: stderrMsg });

        const result = await runner.buildInteractive('return Foo::New();', 1024, 600);

        expect(result.success).to.equal(false);
        expect(result.error).to.equal(stderrMsg);
    });

    it('returns {success:true, binPath} when compile succeeds', async () => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        (runner as any).compile = async (_srcPath: string, binPath: string) => {
            return { success: true };
        };

        const result = await runner.buildInteractive('return View::New();', 1024, 600);

        expect(result.success).to.equal(true);
        expect(result.binPath).to.be.a('string');
        expect(result.binPath).to.include('preview_interactive_bin');
    });
});
