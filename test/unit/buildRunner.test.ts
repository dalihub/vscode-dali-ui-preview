import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import { BuildRunner } from '../../src/buildRunner';

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

describe('BuildRunner.instrumentAnimations()', () => {
    it('injects registration after a named .Play();', () => {
        const out = BuildRunner.instrumentAnimations('anim.Play();');
        expect(out).to.include('anim.Play();');
        expect(out).to.include('__RegisterPreviewAnimation(anim);');
    });

    it('handles multiple named animations', () => {
        const out = BuildRunner.instrumentAnimations('a.Play();\nb.Play();');
        expect(out).to.include('__RegisterPreviewAnimation(a);');
        expect(out).to.include('__RegisterPreviewAnimation(b);');
    });

    it('leaves code without .Play() untouched', () => {
        const src = 'return View::New();';
        expect(BuildRunner.instrumentAnimations(src)).to.equal(src);
    });

    it('does not inject for method-chained temporaries (no handle to scrub)', () => {
        const out = BuildRunner.instrumentAnimations('Animation::New(1.0f).Play();');
        expect(out).to.not.include('__RegisterPreviewAnimation');
    });

    it('registers the full handle chain for member/qualified animations', () => {
        expect(BuildRunner.instrumentAnimations('this->fadeIn.Play();'))
            .to.include('__RegisterPreviewAnimation(this->fadeIn);');
        expect(BuildRunner.instrumentAnimations('state.anim.Play();'))
            .to.include('__RegisterPreviewAnimation(state.anim);');
    });
});

describe('BuildRunner — compilePlugin()', () => {
    afterEach(() => {
        sinon.restore();
    });

    // Docker-only: a fake DockerRuntime that records the request it was given
    // and reports success, so we can assert on path naming + {{USER_CODE}}
    // substitution without touching a real container.
    function makeFakeDocker(over: Partial<any> = {}) {
        return {
            isAvailable: sinon.stub().resolves(true),
            compilePlugin: sinon.stub().resolves({ success: true, output: '', elapsedMs: 1 }),
            ...over,
        } as any;
    }

    it('returns {success:false} when no DockerRuntime is provided', async () => {
        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        const result = await runner.compilePlugin('return Button::New();');

        expect(result.success).to.equal(false);
        expect(result.error).to.include('Docker');
    });

    it('substitutes {{USER_CODE}} in plugin template before compiling', async () => {
        const docker = makeFakeDocker();
        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel, docker);

        const userCode = 'return MyWidget::New();';
        await runner.compilePlugin(userCode);

        const req = docker.compilePlugin.firstCall.args[0];
        expect(req.source).to.include(userCode);
        expect(req.source).not.to.include('{{USER_CODE}}');
    });

    it('returns {success:false} with output on compile failure', async () => {
        const docker = makeFakeDocker({
            compilePlugin: sinon.stub().resolves({
                success: false,
                output: "error: use of undeclared identifier 'foo'",
                elapsedMs: 2,
            }),
        });
        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel, docker);

        const result = await runner.compilePlugin('return foo();');
        expect(result.success).to.equal(false);
        expect(result.error).to.include('foo');
    });

    it('uses config-named .so path when configName is provided', async () => {
        const docker = makeFakeDocker();
        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel, docker);

        const result = await runner.compilePlugin('return View::New();', 'Phone Light');
        expect(result.soPath).to.include('phone_light');
        expect(docker.compilePlugin.firstCall.args[0].soPath).to.include('phone_light');
    });

    it('uses default preview_plugin.so when no configName is provided', async () => {
        const docker = makeFakeDocker();
        const runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel, docker);

        await runner.compilePlugin('return View::New();');
        expect(docker.compilePlugin.firstCall.args[0].soPath).to.match(/preview_plugin\.so$/);
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
