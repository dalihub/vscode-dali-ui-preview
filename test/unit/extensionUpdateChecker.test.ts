import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
    buildUpdateCommand,
    parseTagFromLocation,
    isNewerVersion,
    checkExtensionUpdateCommand,
    maybeAutoCheckExtensionUpdate,
    LAST_EXT_UPDATE_CHECK_KEY,
} from '../../src/extensionUpdateChecker';
import { ConfigurationService } from '../../src/configurationService';

const fakeOut = { appendLine: () => {} } as any;

function makeContext(lastCheck = 0) {
    return {
        globalState: {
            get: sinon.stub().returns(lastCheck),
            update: sinon.stub().resolves(undefined),
        },
    } as any;
}

describe('extensionUpdateChecker', () => {
    afterEach(() => sinon.restore());

    describe('buildUpdateCommand()', () => {
        it('re-runs the one-line installer via curl | bash', () => {
            const cmd = buildUpdateCommand();
            expect(cmd).to.include('curl -fsSL');
            expect(cmd).to.include('dalihub/vscode-dali-ui-preview');
            expect(cmd).to.include('install.sh');
            expect(cmd).to.match(/\|\s*bash\s*$/);
        });
    });

    describe('parseTagFromLocation()', () => {
        it('extracts the tag from a releases/tag redirect URL', () => {
            expect(parseTagFromLocation(
                'https://github.com/dalihub/vscode-dali-ui-preview/releases/tag/v0.52.0',
            )).to.equal('v0.52.0');
        });

        it('ignores a trailing query/fragment', () => {
            expect(parseTagFromLocation(
                'https://github.com/x/y/releases/tag/v1.2.3?foo=bar#z',
            )).to.equal('v1.2.3');
        });

        it('returns null when there is no /tag/ segment (repo has no releases)', () => {
            expect(parseTagFromLocation('https://github.com/x/y/releases')).to.equal(null);
        });

        it('returns null for undefined / empty input', () => {
            expect(parseTagFromLocation(undefined)).to.equal(null);
            expect(parseTagFromLocation('')).to.equal(null);
        });
    });

    describe('isNewerVersion()', () => {
        it('is true when the latest release is a higher version', () => {
            expect(isNewerVersion('0.52.0', '0.51.1')).to.equal(true);
            expect(isNewerVersion('1.0.0', '0.99.99')).to.equal(true);
            expect(isNewerVersion('0.51.2', '0.51.1')).to.equal(true);
        });

        it('is false when equal or older', () => {
            expect(isNewerVersion('0.51.1', '0.51.1')).to.equal(false);
            expect(isNewerVersion('0.51.0', '0.51.1')).to.equal(false);
            expect(isNewerVersion('0.50.9', '0.51.0')).to.equal(false);
        });

        it("strips a leading 'v' on either side", () => {
            expect(isNewerVersion('v0.52.0', '0.51.1')).to.equal(true);
            expect(isNewerVersion('v0.51.1', 'v0.51.1')).to.equal(false);
        });

        it('compares numerically, not lexically (10 > 9)', () => {
            expect(isNewerVersion('0.10.0', '0.9.0')).to.equal(true);
            expect(isNewerVersion('0.9.0', '0.10.0')).to.equal(false);
        });

        it('is false on unparseable input (fail safe — never nags on garbage)', () => {
            expect(isNewerVersion('', '0.51.1')).to.equal(false);
            expect(isNewerVersion('not-a-version', '0.51.1')).to.equal(false);
        });
    });

    describe('checkExtensionUpdateCommand() [manual]', () => {
        it('reports "up to date" when the latest equals the current version', async () => {
            const info = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
            await checkExtensionUpdateCommand({
                currentVersion: '0.51.1',
                fetchLatest: async () => '0.51.1',
            }, fakeOut);
            expect(info.calledOnce).to.equal(true);
            expect(String(info.firstCall.args[0])).to.match(/up to date/i);
        });

        it('offers the update and runs the installer in a terminal on "Update now"', async () => {
            sinon.stub(vscode.window, 'showInformationMessage').resolves('Update now' as any);
            const sendText = sinon.stub();
            const term = { show: sinon.stub(), sendText, dispose: sinon.stub() };
            const createTerminal = sinon.stub(vscode.window, 'createTerminal').returns(term as any);

            await checkExtensionUpdateCommand({
                currentVersion: '0.51.1',
                fetchLatest: async () => '0.52.0',
            }, fakeOut);

            expect(createTerminal.calledOnce).to.equal(true);
            expect(sendText.calledOnce).to.equal(true);
            expect(sendText.firstCall.args[0]).to.equal(buildUpdateCommand());
        });

        it('does not open a terminal when the user dismisses the prompt', async () => {
            sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
            const createTerminal = sinon.spy(vscode.window, 'createTerminal');
            await checkExtensionUpdateCommand({
                currentVersion: '0.51.1',
                fetchLatest: async () => '0.52.0',
            }, fakeOut);
            expect(createTerminal.called).to.equal(false);
        });

        it('warns (does not throw) when the version cannot be fetched', async () => {
            const warn = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);
            await checkExtensionUpdateCommand({
                currentVersion: '0.51.1',
                fetchLatest: async () => null,
            }, fakeOut);
            expect(warn.calledOnce).to.equal(true);
        });
    });

    describe('maybeAutoCheckExtensionUpdate() [activation]', () => {
        it('does nothing when policy is off', async () => {
            sinon.stub(ConfigurationService.prototype, 'extensionUpdatePolicy').get(() => 'off');
            const fetchLatest = sinon.stub().resolves('0.52.0');
            await maybeAutoCheckExtensionUpdate(makeContext(0), { currentVersion: '0.51.1', fetchLatest }, fakeOut);
            expect(fetchLatest.called).to.equal(false);
        });

        it('does nothing within the once-a-day throttle window', async () => {
            sinon.stub(ConfigurationService.prototype, 'extensionUpdatePolicy').get(() => 'notify');
            const fetchLatest = sinon.stub().resolves('0.52.0');
            await maybeAutoCheckExtensionUpdate(makeContext(Date.now()), { currentVersion: '0.51.1', fetchLatest }, fakeOut);
            expect(fetchLatest.called).to.equal(false);
        });

        it('records the check timestamp before probing (backs off even if offline)', async () => {
            sinon.stub(ConfigurationService.prototype, 'extensionUpdatePolicy').get(() => 'notify');
            const ctx = makeContext(0);
            const fetchLatest = sinon.stub().resolves(null);
            await maybeAutoCheckExtensionUpdate(ctx, { currentVersion: '0.51.1', fetchLatest }, fakeOut);
            expect(ctx.globalState.update.calledWith(LAST_EXT_UPDATE_CHECK_KEY)).to.equal(true);
        });

        it('notifies when a newer version is available', async () => {
            sinon.stub(ConfigurationService.prototype, 'extensionUpdatePolicy').get(() => 'notify');
            const info = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
            const fetchLatest = sinon.stub().resolves('0.52.0');
            await maybeAutoCheckExtensionUpdate(makeContext(0), { currentVersion: '0.51.1', fetchLatest }, fakeOut);
            expect(info.calledOnce).to.equal(true);
            expect(String(info.firstCall.args[0])).to.include('0.52.0');
        });

        it('stays silent when already up to date', async () => {
            sinon.stub(ConfigurationService.prototype, 'extensionUpdatePolicy').get(() => 'notify');
            const info = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
            const fetchLatest = sinon.stub().resolves('0.51.1');
            await maybeAutoCheckExtensionUpdate(makeContext(0), { currentVersion: '0.51.1', fetchLatest }, fakeOut);
            expect(info.called).to.equal(false);
        });

        it('never throws when the fetch rejects (fully fail-silent)', async () => {
            sinon.stub(ConfigurationService.prototype, 'extensionUpdatePolicy').get(() => 'notify');
            const fetchLatest = sinon.stub().rejects(new Error('network down'));
            // Should resolve without throwing.
            await maybeAutoCheckExtensionUpdate(makeContext(0), { currentVersion: '0.51.1', fetchLatest }, fakeOut);
        });
    });
});
