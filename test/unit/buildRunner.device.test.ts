import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildRunner } from '../../src/buildRunner';
import { SdbManager } from '../../src/sdbManager';
import * as daliEnv from '../../src/daliEnvironment';

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

describe('BuildRunner — buildAndRunOnDevice()', () => {
    let runner: BuildRunner;
    let sdbManager: SdbManager;

    beforeEach(() => {
        sinon.stub(daliEnv, 'validateDaliPrefix').returns(true);

        runner = new BuildRunner(makeContext(), undefined, fakeOutputChannel);
        (runner as any).daliPrefix = '/usr';

        // Stub compile step to succeed by default
        (runner as any).compile = async () => ({ success: true });

        sdbManager = new SdbManager(fakeOutputChannel);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('returns {success:false} when sdb push fails', async () => {
        // Stub shell (mkdir chmod) to succeed, push to fail
        sinon.stub(sdbManager, 'shell').resolves('');
        sinon.stub(sdbManager, 'push').rejects(new Error('connection refused'));

        const result = await runner.buildAndRunOnDevice(
            'return View::New();',
            sdbManager,
            'device-1234',
            800, 600
        );

        expect(result.success).to.equal(false);
        expect(result.error).to.include('SDB push failed');
        expect(result.error).to.include('connection refused');
    });

    it('returns {success:false} when device output does not contain OK:', async () => {
        sinon.stub(sdbManager, 'shell')
            .onFirstCall().resolves('')        // mkdir
            .onSecondCall().resolves('')       // chmod (via push side-effect shell call is separate)
            .resolves('FATAL: segfault at 0x0'); // execution output without OK:
        sinon.stub(sdbManager, 'push').resolves();

        const result = await runner.buildAndRunOnDevice(
            'return View::New();',
            sdbManager,
            'device-1234',
            800, 600
        );

        expect(result.success).to.equal(false);
        expect(result.error).to.include('Device runtime error');
    });

    it('returns {success:false} when sdb pull (PNG) fails', async () => {
        // shell: mkdir, chmod, execute (returns OK:), then pull fails
        sinon.stub(sdbManager, 'shell')
            .onFirstCall().resolves('')          // mkdir
            .onSecondCall().resolves('')         // chmod
            .resolves('OK: preview saved');      // execution succeeds
        sinon.stub(sdbManager, 'push').resolves();
        sinon.stub(sdbManager, 'pull').rejects(new Error('no such file'));

        const result = await runner.buildAndRunOnDevice(
            'return View::New();',
            sdbManager,
            'device-1234',
            800, 600
        );

        expect(result.success).to.equal(false);
        expect(result.error).to.include('SDB pull (PNG) failed');
        expect(result.error).to.include('no such file');
    });

    it('returns {success:true} with pngPath on full success path', async () => {
        sinon.stub(sdbManager, 'shell')
            .onFirstCall().resolves('')          // mkdir
            .onSecondCall().resolves('')         // chmod
            .resolves('OK: preview saved');      // execution succeeds
        sinon.stub(sdbManager, 'push').resolves();
        sinon.stub(sdbManager, 'pull').resolves(); // both PNG and metadata pull succeed

        const result = await runner.buildAndRunOnDevice(
            'return View::New();',
            sdbManager,
            'device-1234',
            800, 600
        );

        expect(result.success).to.equal(true);
        expect(result.pngPath).to.be.a('string');
        expect(result.pngPath).to.include('preview_device.png');
    });

    it('propagates cross-compile failure when tizenSysroot configured', async () => {
        const fakeConfig = { get: (key: string, def: any) => key === 'tizenSysroot' ? '/opt/tizen-sysroot' : def };
        sinon.stub(vscode.workspace, 'getConfiguration').returns(fakeConfig as any);

        (runner as any).compileCrossDevice = async () => ({ success: false, error: 'arm compiler not found' });

        const result = await runner.buildAndRunOnDevice(
            'return View::New();',
            sdbManager,
            'device-1234',
            800, 600
        );

        expect(result.success).to.equal(false);
        expect(result.error).to.include('arm compiler');
    });

    it('returns compile error without calling sdb when compile fails', async () => {
        (runner as any).compile = async () => ({ success: false, error: 'syntax error near line 5' });
        const pushSpy = sinon.stub(sdbManager, 'push').resolves();

        const result = await runner.buildAndRunOnDevice(
            'invalid code',
            sdbManager,
            'device-1234',
            800, 600
        );

        expect(result.success).to.equal(false);
        expect(result.error).to.include('syntax error');
        expect(pushSpy.called).to.equal(false);
    });
});
