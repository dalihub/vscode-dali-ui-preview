import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as daliEnv from '../../src/daliEnvironment';
import { ConfigurationService } from '../../src/configurationService';
import { useLocalRuntimeCommand, detectRuntimeModeShadow, resolveRuntimeModeShadow } from '../../src/localRuntimeCommand';

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

    it('overrides the shadowing scope with runtimeMode=local and reloads when the user picks "Switch Here to Local"', async () => {
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(DETECTED);
        sinon.stub(daliEnv, 'resolveDaliPrefix').returns(RESOLVED);
        const info = sinon.stub(vscode.window, 'showInformationMessage');
        info.onFirstCall().resolves('Use This' as any);       // "Use this?"
        info.onSecondCall().resolves('Reload Window' as any);  // reload prompt AFTER the override
        // A folder-scoped runtimeMode=docker shadows the Global write; the user chooses to override it here.
        sinon.stub(vscode.window, 'showWarningMessage').resolves('Switch Here to Local' as any);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();
        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            inspect: () => ({ workspaceFolderValue: 'docker' }),
        } as any);
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves();

        await useLocalRuntimeCommand(false);

        // runtimeMode=local is written to the WINNING (WorkspaceFolder) scope so it actually takes effect,
        // then the window reloads to apply it.
        expect(update.calledWith('runtimeMode', 'local', vscode.ConfigurationTarget.WorkspaceFolder)).to.equal(true);
        expect(exec.calledWith('workbench.action.reloadWindow')).to.equal(true);
    });

    it('writes to the Workspace scope (not Folder) when the shadow is workspace-scoped', async () => {
        sinon.stub(daliEnv, 'findDaliPrefix').resolves(DETECTED);
        sinon.stub(daliEnv, 'resolveDaliPrefix').returns(RESOLVED);
        const info = sinon.stub(vscode.window, 'showInformationMessage');
        info.onFirstCall().resolves('Use This' as any);
        info.onSecondCall().resolves(undefined as any); // dismiss the reload prompt
        sinon.stub(vscode.window, 'showWarningMessage').resolves('Switch Here to Local' as any);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();
        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            inspect: () => ({ workspaceValue: 'docker' }),
        } as any);
        sinon.stub(vscode.commands, 'executeCommand').resolves();

        await useLocalRuntimeCommand(false);

        expect(update.calledWith('runtimeMode', 'local', vscode.ConfigurationTarget.Workspace)).to.equal(true);
    });
});

describe('resolveRuntimeModeShadow (shared docker↔local shadow guard)', () => {
    afterEach(() => sinon.restore());

    const stubInspect = (inspected: any) =>
        sinon.stub(vscode.workspace, 'getConfiguration').returns({ inspect: () => inspected } as any);

    it("returns 'proceed' with no prompt when nothing shadows the desired mode", async () => {
        stubInspect({ globalValue: 'docker' }); // no workspace/folder pin
        const warn = sinon.stub(vscode.window, 'showWarningMessage');
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();

        expect(await resolveRuntimeModeShadow('docker')).to.equal('proceed');
        expect(warn.called).to.equal(false);
        expect(update.called).to.equal(false);
    });

    it("DOCKER: overrides the shadowing scope and returns 'proceed' on 'Switch Here to Docker'", async () => {
        stubInspect({ workspaceValue: 'local' }); // workspace pins local, shadows a docker switch
        const warn = sinon.stub(vscode.window, 'showWarningMessage').resolves('Switch Here to Docker' as any);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();

        const outcome = await resolveRuntimeModeShadow('docker');

        expect(outcome).to.equal('proceed');
        expect(warn.calledOnce).to.equal(true);
        expect(update.calledWith('runtimeMode', 'docker', vscode.ConfigurationTarget.Workspace)).to.equal(true);
    });

    it("DOCKER: returns 'abort' (no override write) when the user opens settings instead", async () => {
        stubInspect({ workspaceFolderValue: 'local' });
        sinon.stub(vscode.window, 'showWarningMessage').resolves('Open Settings' as any);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves();

        expect(await resolveRuntimeModeShadow('docker')).to.equal('abort');
        expect(update.calledWith('runtimeMode', 'docker', vscode.ConfigurationTarget.WorkspaceFolder)).to.equal(false);
        expect(exec.calledWith('workbench.action.openFolderSettings')).to.equal(true);
    });

    it("DOCKER: returns 'abort' when the warning is dismissed", async () => {
        stubInspect({ workspaceValue: 'local' });
        sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined as any);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();

        expect(await resolveRuntimeModeShadow('docker')).to.equal('abort');
        expect(update.called).to.equal(false);
    });

    it("LOCAL: overrides to the Folder scope and returns 'proceed' on 'Switch Here to Local'", async () => {
        stubInspect({ workspaceFolderValue: 'docker' }); // folder pins docker, shadows a local switch
        const warn = sinon.stub(vscode.window, 'showWarningMessage').resolves('Switch Here to Local' as any);
        const update = sinon.stub(ConfigurationService.prototype, 'update').resolves();

        expect(await resolveRuntimeModeShadow('local')).to.equal('proceed');
        expect(warn.calledOnce).to.equal(true);
        expect(update.calledWith('runtimeMode', 'local', vscode.ConfigurationTarget.WorkspaceFolder)).to.equal(true);
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
