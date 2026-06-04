import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as dockerAccessCheck from '../../src/dockerAccessCheck';
import * as registryClient from '../../src/registryClient';
import { ConfigurationService } from '../../src/configurationService';
import {
    checkRuntimeUpdateCommand,
    maybeAutoCheckRuntimeUpdate,
    selectRuntimeVersionCommand,
} from '../../src/checkUpdateCommand';

const fakeOut = { appendLine: () => {}, append: () => {}, show: () => {}, dispose: () => {} } as any;

function makeRuntime(over: Record<string, any> = {}) {
    return {
        isUpdateAvailable: sinon.stub().resolves(false),
        hasImage: sinon.stub().resolves(false),
        pullImage: sinon.stub().resolves(undefined),
        imageRef: (t: string) => `ghcr.io/test/img:${t}`,
        getImageName: () => 'ghcr.io/test/img',
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
    let cb: { onUpdateAvailable: sinon.SinonStub; onUpdated: sinon.SinonStub };

    beforeEach(() => {
        // mock config defaults runtimeMode to 'native'; force docker mode.
        sinon.stub(ConfigurationService.prototype, 'runtimeMode').get(() => 'docker');
        cb = { onUpdateAvailable: sinon.stub(), onUpdated: sinon.stub().resolves() };
    });
    afterEach(() => sinon.restore());

    it('does nothing when policy is off', async () => {
        sinon.stub(ConfigurationService.prototype, 'runtimeUpdatePolicy').get(() => 'off');
        const rt = makeRuntime();
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, cb);
        expect(rt.isUpdateAvailable.called).to.equal(false);
    });

    it('does nothing within the once-a-day throttle window', async () => {
        sinon.stub(ConfigurationService.prototype, 'runtimeUpdatePolicy').get(() => 'notify');
        const rt = makeRuntime();
        await maybeAutoCheckRuntimeUpdate(makeContext(Date.now()), rt, fakeOut, cb);
        expect(rt.isUpdateAvailable.called).to.equal(false);
    });

    it('does nothing when docker is not accessible', async () => {
        sinon.stub(ConfigurationService.prototype, 'runtimeUpdatePolicy').get(() => 'notify');
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'permission-denied' } as any);
        const rt = makeRuntime();
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, cb);
        expect(rt.isUpdateAvailable.called).to.equal(false);
    });

    it('notify: shows the badge (not auto-pulled) when an update exists', async () => {
        sinon.stub(ConfigurationService.prototype, 'runtimeUpdatePolicy').get(() => 'notify');
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as any);
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().resolves(true) });
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, cb);
        expect(cb.onUpdateAvailable.calledOnce).to.equal(true);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('notify + "Update now": force-pulls and restarts', async () => {
        sinon.stub(ConfigurationService.prototype, 'runtimeUpdatePolicy').get(() => 'notify');
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Update now' as any);
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().resolves(true), hasImage: sinon.stub().resolves(true) });
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, cb);
        expect(rt.pullImage.calledOnce).to.equal(true);
        expect(cb.onUpdated.calledOnce).to.equal(true);
    });

    it('auto: force-pulls and restarts without prompting first', async () => {
        sinon.stub(ConfigurationService.prototype, 'runtimeUpdatePolicy').get(() => 'auto');
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().resolves(true), hasImage: sinon.stub().resolves(true) });
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, cb);
        expect(rt.pullImage.calledOnce).to.equal(true);
        expect(cb.onUpdated.calledOnce).to.equal(true);
        expect(cb.onUpdateAvailable.called).to.equal(false);
    });

    it('never throws when the update probe rejects', async () => {
        sinon.stub(ConfigurationService.prototype, 'runtimeUpdatePolicy').get(() => 'notify');
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().rejects(new Error('boom')) });
        await maybeAutoCheckRuntimeUpdate(makeContext(0), rt, fakeOut, cb);
        expect(cb.onUpdated.called).to.equal(false);
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

    it('force-pulls and runs onUpdated on "Update now"', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Update now' as any);
        const onUpdated = sinon.stub().resolves();
        const rt = makeRuntime({ isUpdateAvailable: sinon.stub().resolves(true), hasImage: sinon.stub().resolves(true) });
        await checkRuntimeUpdateCommand(rt, fakeOut, onUpdated);
        expect(rt.pullImage.calledOnce).to.equal(true);
        expect(onUpdated.calledOnce).to.equal(true);
    });
});

describe('selectRuntimeVersionCommand', () => {
    afterEach(() => sinon.restore());

    it('lists tags, sets the chosen tag, pulls, and restarts', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        sinon.stub(registryClient, 'listRemoteTags').resolves(['latest', 'dali_2.5.18']);
        sinon.stub(vscode.window, 'showQuickPick').resolves({ label: 'dali_2.5.18' } as any);
        const updateCfg = sinon.stub(ConfigurationService.prototype, 'update').resolves();
        const onSelected = sinon.stub().resolves();
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(false) });
        await selectRuntimeVersionCommand(rt, fakeOut, onSelected);
        expect(updateCfg.calledWith('daliVersionTag', 'dali_2.5.18')).to.equal(true);
        expect(rt.pullImage.calledOnce).to.equal(true);
        expect(onSelected.calledOnce).to.equal(true);
    });

    it('does nothing when the registry returns no tags', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        sinon.stub(registryClient, 'listRemoteTags').resolves([]);
        const warn = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);
        const onSelected = sinon.stub().resolves();
        await selectRuntimeVersionCommand(makeRuntime(), fakeOut, onSelected);
        expect(warn.calledOnce).to.equal(true);
        expect(onSelected.called).to.equal(false);
    });

    it('warns and does not query the registry when docker is not accessible', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'daemon-not-running' } as any);
        const warn = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);
        const tags = sinon.stub(registryClient, 'listRemoteTags');
        await selectRuntimeVersionCommand(makeRuntime(), fakeOut, sinon.stub().resolves());
        expect(warn.calledOnce).to.equal(true);
        expect(tags.called).to.equal(false);
    });
});
