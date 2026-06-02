import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as dockerAccessCheck from '../../src/dockerAccessCheck';
import { ConfigurationService } from '../../src/configurationService';
import { checkRuntimeUpdateCommand, maybeAutoCheckRuntimeUpdate } from '../../src/checkUpdateCommand';

const fakeOut = { appendLine: () => {}, append: () => {}, show: () => {}, dispose: () => {} } as any;

function makeRuntime(over: Record<string, any> = {}) {
    return {
        isUpdateAvailable: sinon.stub().resolves(false),
        hasImage: sinon.stub().resolves(true),
        pullImage: sinon.stub().resolves(undefined),
        imageRef: (t: string) => `ghcr.io/test/img:${t}`,
        ...over,
    } as any;
}

function makeContext(lastCheck = 0) {
    return {
        globalState: {
            get: sinon.stub().returns(lastCheck),
            update: sinon.stub().resolves(undefined),
        },
    } as any;
}

describe('maybeAutoCheckRuntimeUpdate', () => {
    beforeEach(() => {
        // The vscode mock returns config defaults; runtimeMode's default is
        // 'native', so force docker mode for these tests.
        sinon.stub(ConfigurationService.prototype, 'runtimeMode').get(() => 'docker');
    });
    afterEach(() => sinon.restore());

    it('does nothing when still within the once-a-day throttle window', async () => {
        const rt = makeRuntime();
        const onAvail = sinon.stub();
        // last check just now → throttled
        await maybeAutoCheckRuntimeUpdate(makeContext(Date.now()), rt, fakeOut, onAvail);
        expect(rt.isUpdateAvailable.called).to.equal(false);
        expect(onAvail.called).to.equal(false);
    });

    it('does nothing when docker is not accessible', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'permission-denied' } as any);
        const rt = makeRuntime();
        const onAvail = sinon.stub();
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, onAvail);
        expect(rt.isUpdateAvailable.called).to.equal(false);
        expect(onAvail.called).to.equal(false);
    });

    it('fires onUpdateAvailable and records the timestamp when an update exists', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().resolves(true) });
        const onAvail = sinon.stub();
        const ctx = makeContext(0);
        await maybeAutoCheckRuntimeUpdate(ctx, rt, fakeOut, onAvail);
        expect(onAvail.calledOnce).to.equal(true);
        expect(ctx.globalState.update.called).to.equal(true);
    });

    it('never throws when the update probe rejects', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().rejects(new Error('boom')) });
        const onAvail = sinon.stub();
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, onAvail);
        expect(onAvail.called).to.equal(false);
    });
});

describe('checkRuntimeUpdateCommand', () => {
    afterEach(() => sinon.restore());

    it('reports "up to date" when there is no update', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const info = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().resolves(false) });
        await checkRuntimeUpdateCommand(rt, fakeOut);
        expect(info.calledOnce).to.equal(true);
        expect(info.firstCall.args[0] as string).to.contain('up to date');
    });

    it('force-pulls and runs onUpdated when the user picks "Update now"', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Update now' as any);
        const onUpdated = sinon.stub().resolves();
        const rt = makeRuntime({
            isUpdateAvailable: sinon.stub().resolves(true),
            hasImage: sinon.stub().resolves(true),
        });
        await checkRuntimeUpdateCommand(rt, fakeOut, onUpdated);
        expect(rt.pullImage.calledOnce).to.equal(true);   // force re-pull despite cached
        expect(onUpdated.calledOnce).to.equal(true);
    });

    it('warns and does not probe when docker is not accessible', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'daemon-not-running' } as any);
        const warn = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);
        const rt = makeRuntime();
        await checkRuntimeUpdateCommand(rt, fakeOut);
        expect(warn.calledOnce).to.equal(true);
        expect(rt.isUpdateAvailable.called).to.equal(false);
    });
});
