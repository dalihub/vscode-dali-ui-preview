import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as daliEnv from '../../src/daliEnvironment';
import { ConfigurationService } from '../../src/configurationService';
import { useLocalRuntimeCommand, detectRuntimeModeShadow } from '../../src/localRuntimeCommand';

/*
 * localRuntimeCommand is wired into activation (the docker↔local runtime switch
 * that persists daliPrefix/runtimeMode and reloads the window). It was previously
 * untested; these cover the decision branches by stubbing the daliEnvironment
 * detection, the ConfigurationService singleton, and the vscode prompts.
 */
describe('useLocalRuntimeCommand', () => {
    const DETECTED = '/opt/dali-env';
    const RESOLVED = '/opt/dali-env/opt';

    afterEach(() => sinon.restore());

    it('saves the detected prefix, flips runtimeMode to local, and reloads (Use This → Reload)', async () => {
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(DETECTED);
        sinon.stub(daliEnv, 'resolveDaliPrefix').returns(RESOLVED);
        const info = sinon.stub(vscode.window, 'showInformationMessage');
        info.onFirstCall().resolves('Use This' as any);        // "Use this?"
        info.onSecondCall().resolves('Reload Window' as any);  // reload prompt
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves();

        await useLocalRuntimeCommand(false);

        expect(update.calledWith('daliPrefix', RESOLVED)).to.equal(true);
        expect(update.calledWith('runtimeMode', 'local')).to.equal(true);
        expect(exec.calledWith('workbench.action.reloadWindow')).to.equal(true);
    });

    it('does nothing when the detection confirm is dismissed', async () => {
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(DETECTED);
        sinon.stub(daliEnv, 'resolveDaliPrefix').returns(RESOLVED);
        sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();

        await useLocalRuntimeCommand(false);

        expect(update.called).to.equal(false);
    });

    it('no-ops (no save, no reload) when already local against the same prefix', async () => {
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(DETECTED);
        sinon.stub(daliEnv, 'resolveDaliPrefix').returns(RESOLVED);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Use This' as any);
        sinon.stub(ConfigurationService.prototype, 'daliPrefix').get(() => RESOLVED);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves();

        await useLocalRuntimeCommand(true); // activeModeIsLocal

        expect(update.called).to.equal(false);
        expect(exec.called).to.equal(false);
    });

    it('opens the folder picker and cancels cleanly when no prefix is detected', async () => {
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(null);
        const dialog = sinon.stub(vscode.window, 'showOpenDialog').resolves(undefined);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();

        await useLocalRuntimeCommand(false);

        expect(dialog.calledOnce).to.equal(true);
        expect(update.called).to.equal(false);
    });

    it('warns (no reload) when a folder-scoped setting shadows the Global runtimeMode write', async () => {
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(DETECTED);
        sinon.stub(daliEnv, 'resolveDaliPrefix').returns(RESOLVED);
        const info = sinon.stub(vscode.window, 'showInformationMessage');
        info.onFirstCall().resolves('Use This' as any); // "Use this?"
        const warn = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);
        sinon.stub(ConfigurationService.prototype, 'update').resolves();
        // A folder-scoped runtimeMode=docker outranks the User (Global) write of local.
        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            inspect: () => ({ workspaceFolderValue: 'docker' }),
        } as any);
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves();

        await useLocalRuntimeCommand(false);

        expect(warn.calledOnce).to.equal(true);
        // The reload prompt (2nd info) must NOT fire, and no reload is issued.
        expect(info.calledOnce).to.equal(true);
        expect(exec.calledWith('workbench.action.reloadWindow')).to.equal(false);
    });
});

describe('detectRuntimeModeShadow', () => {
    it('returns null when nothing is inspected', () => {
        expect(detectRuntimeModeShadow(undefined, 'local')).to.equal(null);
    });

    it('returns null when no higher-scope value is set (only User/Global applies)', () => {
        expect(detectRuntimeModeShadow({ globalValue: 'local' } as any, 'local')).to.equal(null);
    });

    it('flags a folder value that differs from the desired mode', () => {
        expect(detectRuntimeModeShadow({ workspaceFolderValue: 'docker' }, 'local'))
            .to.deep.equal({ scope: 'workspaceFolder', value: 'docker' });
    });

    it('flags a workspace value that differs from the desired mode', () => {
        expect(detectRuntimeModeShadow({ workspaceValue: 'docker' }, 'local'))
            .to.deep.equal({ scope: 'workspace', value: 'docker' });
    });

    it('does not flag when the higher-scope value already matches the desired mode', () => {
        expect(detectRuntimeModeShadow({ workspaceFolderValue: 'local' }, 'local')).to.equal(null);
        expect(detectRuntimeModeShadow({ workspaceValue: 'local' }, 'local')).to.equal(null);
    });

    it('folder scope wins over workspace: a matching folder value clears a differing workspace value', () => {
        expect(detectRuntimeModeShadow({ workspaceFolderValue: 'local', workspaceValue: 'docker' }, 'local'))
            .to.equal(null);
    });
});
