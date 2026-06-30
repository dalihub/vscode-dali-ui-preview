import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as daliEnv from '../../src/daliEnvironment';
import { ConfigurationService } from '../../src/configurationService';
import { useLocalRuntimeCommand } from '../../src/localRuntimeCommand';

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
});
