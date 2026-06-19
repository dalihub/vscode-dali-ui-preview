import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { buildXvfbInstallCommand, installXvfbCommand, promptInstallXvfb } from '../../src/installXvfb';

describe('installXvfb', () => {
    afterEach(() => sinon.restore());

    describe('buildXvfbInstallCommand()', () => {
        it('installs the xvfb package non-interactively via apt-get', () => {
            const cmd = buildXvfbInstallCommand();
            expect(cmd).to.include('apt-get update');
            expect(cmd).to.include('apt-get install -y xvfb');
            expect(cmd).to.include('sudo');
        });

        it('chains with && so a failed update aborts the install', () => {
            expect(buildXvfbInstallCommand()).to.match(/apt-get update\s*&&\s*sudo apt-get install -y xvfb/);
        });
    });

    describe('installXvfbCommand()', () => {
        it('does nothing if the user dismisses the modal', async () => {
            sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
            const createTerminal = sinon.spy(vscode.window, 'createTerminal');
            await installXvfbCommand();
            expect(createTerminal.called).to.equal(false);
        });

        it('opens a terminal and runs the install when confirmed', async () => {
            sinon.stub(vscode.window, 'showInformationMessage').resolves('Open Terminal' as any);
            const sendText = sinon.stub();
            const term = { show: sinon.stub(), sendText, dispose: sinon.stub() };
            const createTerminal = sinon.stub(vscode.window, 'createTerminal').returns(term as any);

            await installXvfbCommand();

            expect(createTerminal.calledOnce).to.equal(true);
            expect(sendText.calledOnce).to.equal(true);
            expect(sendText.firstCall.args[0]).to.include('apt-get install -y xvfb');
            expect(sendText.firstCall.args[1]).to.equal(true); // auto-run
        });
    });

    describe('promptInstallXvfb()', () => {
        it('offers install and runs it when accepted', async () => {
            sinon.stub(vscode.window, 'showWarningMessage').resolves('Install Xvfb' as any);
            const info = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
            await promptInstallXvfb();
            // Accepting the warning leads into installXvfbCommand()'s modal.
            expect(info.calledOnce).to.equal(true);
        });

        it('does nothing when the warning is dismissed', async () => {
            sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);
            const info = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
            await promptInstallXvfb();
            expect(info.called).to.equal(false);
        });
    });
});
