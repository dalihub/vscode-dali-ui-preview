import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs';
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
