import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { showDockerSetupGuidance, decidePreviewDockerGate } from '../../src/dockerAccessCheck';

const fakeOut = { appendLine: () => {}, append: () => {}, show: () => {}, dispose: () => {} } as any;

describe('showDockerSetupGuidance — permission-denied', () => {
    afterEach(() => sinon.restore());

    it('offers an immediate setfacl fix (no install, no reboot) and triggers the callback', async () => {
        sinon.stub(vscode.window, 'showWarningMessage').resolves('Fix for this session' as any);
        let sentText = '';
        const fakeTerminal = { name: '', show() {}, sendText(t: string) { sentText = t; }, dispose() {} };
        sinon.stub(vscode.window, 'createTerminal').returns(fakeTerminal as any);
        const onChanged = sinon.stub();

        await showDockerSetupGuidance({ state: 'permission-denied' } as any, fakeOut, onChanged);

        expect(sentText).to.contain('setfacl');
        // Grant by numeric UID — resolves for LDAP/domain logins (not "u:$USER").
        expect(sentText).to.contain('u:$(id -u):rw');
        expect(sentText).to.not.contain('u:$USER');
        // The fix-only chain must NOT reinstall docker or tell the user to reboot.
        expect(sentText).to.not.contain('get.docker.com');
        expect(sentText.toLowerCase()).to.not.contain('reboot');
        expect(onChanged.calledOnce).to.equal(true);
    });

    it('does not trigger the callback when the user picks "Reboot guide"', async () => {
        sinon.stub(vscode.window, 'showWarningMessage').resolves('Reboot guide' as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
        const createTerminal = sinon.stub(vscode.window, 'createTerminal');
        const onChanged = sinon.stub();

        await showDockerSetupGuidance({ state: 'permission-denied' } as any, fakeOut, onChanged);

        expect(onChanged.called).to.equal(false);
        expect(createTerminal.called).to.equal(false);
    });

    it('returns immediately for state ok without showing any warning', async () => {
        const warn = sinon.stub(vscode.window, 'showWarningMessage');
        await showDockerSetupGuidance({ state: 'ok' } as any, fakeOut);
        expect(warn.called).to.equal(false);
    });
});

describe('showDockerSetupGuidance — docker-not-installed', () => {
    afterEach(() => sinon.restore());

    it('drives the no-reboot install flow when "Install via Terminal" is chosen', async () => {
        sinon.stub(vscode.window, 'showErrorMessage').resolves('Install via Terminal' as any);
        // installDockerCommand shows a modal, then opens a terminal.
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Open Terminal' as any);
        let sentText = '';
        const fakeTerminal = { name: '', show() {}, sendText(t: string) { sentText = t; }, dispose() {} };
        sinon.stub(vscode.window, 'createTerminal').returns(fakeTerminal as any);
        const onChanged = sinon.stub();

        await showDockerSetupGuidance({ state: 'docker-not-installed' } as any, fakeOut, onChanged);

        expect(sentText).to.contain('get.docker.com');
        expect(sentText).to.contain('setfacl');
        expect(onChanged.calledOnce).to.equal(true);   // poller started via onStarted
    });

    it('shows manual instructions (no terminal) when "Manual instructions" is chosen', async () => {
        sinon.stub(vscode.window, 'showErrorMessage').resolves('Manual instructions' as any);
        const createTerminal = sinon.stub(vscode.window, 'createTerminal');
        const onChanged = sinon.stub();

        await showDockerSetupGuidance({ state: 'docker-not-installed' } as any, fakeOut, onChanged);

        expect(createTerminal.called).to.equal(false);
        expect(onChanged.called).to.equal(false);
    });
});

describe('decidePreviewDockerGate', () => {
    afterEach(() => sinon.restore());

    const okAccess = { state: 'ok', serverVersion: '24.0' } as any;
    const missingAccess = { state: 'docker-not-installed' } as any;

    function makeDeps(over: {
        serverRunning?: boolean;
        pollerRunning?: boolean;
        silent?: boolean;
        accessResult?: any;
    } = {}) {
        const checkAccess = sinon.stub().resolves(over.accessResult ?? missingAccess);
        const showGuidance = sinon.stub().resolves();
        const deps = {
            serverRunning: over.serverRunning ?? false,
            pollerRunning: over.pollerRunning ?? false,
            silent: over.silent ?? false,
            checkAccess,
            showGuidance,
        };
        return { deps, checkAccess, showGuidance };
    }

    it('dlopen server running → proceeds without probing docker', async () => {
        const { deps, checkAccess } = makeDeps({ serverRunning: true });
        expect(await decidePreviewDockerGate(deps)).to.equal(true);
        expect(checkAccess.called).to.equal(false);
    });

    it('setup poller running → blocks render and does NOT re-prompt', async () => {
        const { deps, checkAccess, showGuidance } = makeDeps({ pollerRunning: true });
        expect(await decidePreviewDockerGate(deps)).to.equal(false);
        expect(checkAccess.called).to.equal(false);
        expect(showGuidance.called).to.equal(false);
    });

    it('docker access ok → proceeds, no guidance', async () => {
        const { deps, showGuidance } = makeDeps({ accessResult: okAccess });
        expect(await decidePreviewDockerGate(deps)).to.equal(true);
        expect(showGuidance.called).to.equal(false);
    });

    it('docker missing on an explicit render → blocks and shows guidance once', async () => {
        const { deps, showGuidance } = makeDeps({ silent: false });
        expect(await decidePreviewDockerGate(deps)).to.equal(false);
        expect(showGuidance.calledOnce).to.equal(true);
        expect(showGuidance.firstCall.args[0]).to.deep.equal(missingAccess);
    });

    it('docker missing on a live-preview (silent) render → blocks WITHOUT popping a modal', async () => {
        const { deps, showGuidance } = makeDeps({ silent: true });
        expect(await decidePreviewDockerGate(deps)).to.equal(false);
        expect(showGuidance.called).to.equal(false);
    });
});
