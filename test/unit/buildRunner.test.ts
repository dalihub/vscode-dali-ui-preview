import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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

    // A fake BuildBackend that records the compilePlugin request it was given
    // and echoes the soPath back on success, so we can assert on path naming +
    // {{USER_CODE}} substitution without touching docker or a host compiler.
    function makeFakeBackend(over: Partial<any> = {}) {
        return {
            kind: 'docker',
            supportsResidentServer: true,
            outputPaths: (workDir: string) => ({
                pngEmbed: '/work/preview.png',
                metadataEmbed: '/work/preview_metadata.json',
                pngHost: path.join(workDir, 'preview.png'),
                metadataHost: path.join(workDir, 'preview_metadata.json'),
            }),
            validate: sinon.stub().resolves([]),
            capture: sinon.stub().resolves({ success: true }),
            compilePlugin: sinon.stub().callsFake(async (req: any) => ({ success: true, soPath: req.soPath })),
            ...over,
        } as any;
    }

    it('returns {success:false} when the backend has no dlopen support (local mode)', async () => {
        const backend = makeFakeBackend({ kind: 'local', supportsResidentServer: false, compilePlugin: undefined });
        const runner = new BuildRunner(makeContext(), fakeOutputChannel, backend);
        const result = await runner.compilePlugin('return Button::New();');

        expect(result.success).to.equal(false);
        expect(result.error).to.include('not supported');
    });

    it('substitutes {{USER_CODE}} in plugin template before compiling', async () => {
        const backend = makeFakeBackend();
        const runner = new BuildRunner(makeContext(), fakeOutputChannel, backend);

        const userCode = 'return MyWidget::New();';
        await runner.compilePlugin(userCode);

        const req = backend.compilePlugin.firstCall.args[0];
        expect(req.source).to.include(userCode);
        expect(req.source).not.to.include('{{USER_CODE}}');
    });

    it('returns {success:false} with the backend error on compile failure', async () => {
        const backend = makeFakeBackend({
            compilePlugin: sinon.stub().resolves({
                success: false,
                error: "Plugin compile failed:\nerror: use of undeclared identifier 'foo'",
            }),
        });
        const runner = new BuildRunner(makeContext(), fakeOutputChannel, backend);

        const result = await runner.compilePlugin('return foo();');
        expect(result.success).to.equal(false);
        expect(result.error).to.include('foo');
    });

    it('uses config-named .so path when configName is provided', async () => {
        const backend = makeFakeBackend();
        const runner = new BuildRunner(makeContext(), fakeOutputChannel, backend);

        const result = await runner.compilePlugin('return View::New();', 'Phone Light');
        expect(result.soPath).to.include('phone_light');
        expect(backend.compilePlugin.firstCall.args[0].soPath).to.include('phone_light');
    });

    it('uses default preview_plugin.so when no configName is provided', async () => {
        const backend = makeFakeBackend();
        const runner = new BuildRunner(makeContext(), fakeOutputChannel, backend);

        await runner.compilePlugin('return View::New();');
        expect(backend.compilePlugin.firstCall.args[0].soPath).to.match(/preview_plugin\.so$/);
    });
});

describe('BuildRunner — buildAndRun() backend seam', () => {
    afterEach(() => sinon.restore());

    it('bakes the backend embed paths into the harness and reads back the host paths', async () => {
        const capture = sinon.stub().resolves({ success: true, pngPath: '/host/p.png', metadataPath: '/host/m.json' });
        const backend = {
            kind: 'local',
            supportsResidentServer: false,
            outputPaths: () => ({
                pngEmbed: 'EMBED_PNG_PATH',
                metadataEmbed: 'EMBED_META_PATH',
                pngHost: '/host/p.png',
                metadataHost: '/host/m.json',
            }),
            validate: sinon.stub().resolves([]),
            capture,
        } as any;
        const runner = new BuildRunner(makeContext(), fakeOutputChannel, backend);

        const result = await runner.buildAndRun('return View::New();', 100, 100);

        const req = capture.firstCall.args[0];
        // OUTPUT_PATH/METADATA_PATH substituted with the backend's embed paths…
        expect(req.source).to.include('EMBED_PNG_PATH');
        expect(req.source).to.not.include('{{OUTPUT_PATH}}');
        // …while the host paths are passed through for reading the result back.
        expect(req.pngPathHost).to.equal('/host/p.png');
        expect(result.success).to.equal(true);
        expect(result.pngPath).to.equal('/host/p.png');
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

describe('BuildRunner ADR-004 install slots (M3)', () => {
    describe('buildPaletteDefs()', () => {
        it('is empty by default (no theme) — byte-neutral', () => {
            expect(BuildRunner.buildPaletteDefs()).to.equal('');
            expect(BuildRunner.buildPaletteDefs('light')).to.equal('');
        });

        it('emits a no-capture __DarkPalette free function for theme=dark', () => {
            const out = BuildRunner.buildPaletteDefs('dark');
            expect(out).to.include('static bool __DarkPalette(Dali::StringView id, Dali::Vector4& out)');
            // Maps the dali-ui token ids so UiColor::PRIMARY / UiColor("Background") reskin.
            expect(out).to.include('{"Primary", Dali::Vector4(');
            expect(out).to.include('{"Background", Dali::Vector4(');
            expect(out).to.include('{"OnSurface", Dali::Vector4(');
            // Honest boundary: unmapped ids fall through (return false), hex untouched.
            expect(out).to.include('return false;');
            // No captures (plain function — required by ColorOverrideFunc).
            expect(out).to.not.include('[&]');
            expect(out).to.not.include('[=]');
        });
    });

    describe('buildUiConfigSetup()', () => {
        it('is empty by default — byte-neutral', () => {
            expect(BuildRunner.buildUiConfigSetup()).to.equal('');
            expect(BuildRunner.buildUiConfigSetup(0)).to.equal('');
        });

        it('emits a SetScalingFactor statement on __uiConfig for fontScale (scales _spx units)', () => {
            // dali-ui removed fluent chaining (setters return void), so the slot is a
            // standalone statement on the harness __uiConfig local, not a `.SetX()` suffix.
            expect(BuildRunner.buildUiConfigSetup(1.5)).to.equal('  __uiConfig.SetScalingFactor(1.5f);');
            // Integer scale gets a decimal point so it is a valid float literal.
            expect(BuildRunner.buildUiConfigSetup(2)).to.equal('  __uiConfig.SetScalingFactor(2.0f);');
        });

        it('emits a SetBrokenImageUrl statement when a placeholder path is given', () => {
            const out = BuildRunner.buildUiConfigSetup(undefined, '/work/broken.png');
            expect(out).to.equal('  __uiConfig.SetBrokenImageUrl(UiConfig::BrokenImageType::NORMAL, "/work/broken.png");');
        });
    });

    describe('buildPreBuildInstall()', () => {
        it('is empty by default — byte-neutral', () => {
            expect(BuildRunner.buildPreBuildInstall()).to.equal('');
        });

        it('installs the dark color override for theme=dark (harness path)', () => {
            const out = BuildRunner.buildPreBuildInstall('dark');
            expect(out).to.include('Dali::Ui::UiColorManager::Get().SetColorOverride(&__DarkPalette);');
            // Harness path does NOT emit the runtime SetScale (it uses the frozen
            // SetScalingFactor in {{UI_CONFIG_SETUP}} instead).
            expect(out).to.not.include('SetScale');
        });

        it('emits the runtime SetScale only on the plugin/warm path', () => {
            const plugin = BuildRunner.buildPreBuildInstall('dark', 1.5, true);
            expect(plugin).to.include('Dali::Ui::UiScaleManager::Get().SetScale(1.5f);');
            const harness = BuildRunner.buildPreBuildInstall('dark', 1.5, false);
            expect(harness).to.not.include('SetScale');
        });
    });
});

describe('BuildRunner.stageImageAssets()', () => {
    // Regression coverage for "all image samples render broken": docker only
    // bind-mounts tmpDir at /work, so local-file ImageView assets must be copied
    // in and their URLs rewritten to the in-container path. Before this, no user
    // asset was ever staged, so every local-file ImageView fell back to the gray
    // broken-image placeholder.
    let srcDir: string;
    let runnerTmp: string | undefined;

    beforeEach(() => {
        srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dali-asset-src-'));
        fs.mkdirSync(path.join(srcDir, 'assets'), { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'assets', 'pic.jpg'), 'JPEGBYTES');
    });
    afterEach(() => {
        try { fs.rmSync(srcDir, { recursive: true, force: true }); } catch { /* ignore */ }
        // Drop the staged copy so each case starts clean.
        if (runnerTmp) { try { fs.rmSync(path.join(runnerTmp, 'pic.jpg'), { force: true }); } catch { /* ignore */ } }
    });

    function makeRunner(kind: 'docker' | 'local'): BuildRunner {
        const runner = new BuildRunner(makeContext(), fakeOutputChannel, { kind } as any);
        runnerTmp = runner.getTmpDir();
        return runner;
    }

    it('docker: copies a relative asset into tmpDir and rewrites the URL to /work/<name>', () => {
        const runner = makeRunner('docker');
        const out = runner.stageImageAssets('ImageView::New("assets/pic.jpg");', srcDir);
        expect(out).to.equal('ImageView::New("/work/pic.jpg");');
        expect(fs.existsSync(path.join(runner.getTmpDir(), 'pic.jpg')), 'asset copied into /work').to.equal(true);
    });

    it('local: rewrites the URL to the staged host path', () => {
        const runner = makeRunner('local');
        const out = runner.stageImageAssets('ImageView::New("assets/pic.jpg");', srcDir);
        const staged = path.join(runner.getTmpDir(), 'pic.jpg');
        expect(out).to.equal(`ImageView::New("${staged}");`);
        expect(fs.existsSync(staged)).to.equal(true);
    });

    it('stages an absolute asset path that exists (no sourceDir needed)', () => {
        const runner = makeRunner('docker');
        const abs = path.join(srcDir, 'assets', 'pic.jpg');
        const out = runner.stageImageAssets(`x.SetResourceUrl("${abs}");`, undefined);
        expect(out).to.equal('x.SetResourceUrl("/work/pic.jpg");');
    });

    it('leaves remote/custom-scheme URLs untouched (placeholder handles them)', () => {
        const runner = makeRunner('docker');
        for (const url of ['https://x.invalid/y.jpg', 'http://a/b.png', 'foo://bar']) {
            const code = `ImageView::New("${url}");`;
            expect(runner.stageImageAssets(code, srcDir)).to.equal(code);
        }
    });

    it('leaves unresolvable local paths untouched', () => {
        const runner = makeRunner('docker');
        const code = 'ImageView::New("assets/does-not-exist.jpg");';
        expect(runner.stageImageAssets(code, srcDir)).to.equal(code);
    });

    it('dedupes and rewrites every occurrence of the same asset', () => {
        const runner = makeRunner('docker');
        const code = 'ImageView::New("assets/pic.jpg"); ImageView::New("assets/pic.jpg");';
        const out = runner.stageImageAssets(code, srcDir);
        expect(out).to.equal('ImageView::New("/work/pic.jpg"); ImageView::New("/work/pic.jpg");');
    });

    it('returns the code unchanged when there are no image refs', () => {
        const runner = makeRunner('docker');
        const code = 'FlexLayout root = FlexLayout::New();\nreturn root;';
        expect(runner.stageImageAssets(code, srcDir)).to.equal(code);
    });
});
