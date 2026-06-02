import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { installDockerCommand } from '../../src/installDocker';

describe('installDockerCommand', () => {
    afterEach(() => sinon.restore());

    it('pre-fills a setfacl chain (systemctl before setfacl), no reboot, modal first', async () => {
        const showInfo = sinon.stub(vscode.window, 'showInformationMessage').resolves('Open Terminal' as any);
        let sentText = '';
        const fakeTerminal = { name: '', show() {}, sendText(t: string) { sentText = t; }, dispose() {} };
        const createTerminal = sinon.stub(vscode.window, 'createTerminal').returns(fakeTerminal as any);
        const onStarted = sinon.stub();

        await installDockerCommand(onStarted);

        expect(sentText).to.contain('setfacl');
        expect(sentText).to.contain('systemctl enable --now docker');
        expect(sentText).to.contain('usermod -aG docker');
        // The socket must exist before the ACL is applied.
        expect(sentText.indexOf('systemctl enable --now docker'))
            .to.be.lessThan(sentText.indexOf('setfacl'));
        // No reboot in the no-reboot flow.
        expect(sentText.toLowerCase()).to.not.contain('reboot');
        // Modal explains "password once" before the terminal opens.
        expect(showInfo.calledBefore(createTerminal)).to.equal(true);
        expect(onStarted.calledOnce).to.equal(true);
    });

    it('does nothing if the user dismisses the pre-install modal', async () => {
        sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
        const createTerminal = sinon.stub(vscode.window, 'createTerminal');
        const onStarted = sinon.stub();

        await installDockerCommand(onStarted);

        expect(createTerminal.called).to.equal(false);
        expect(onStarted.called).to.equal(false);
    });
});
