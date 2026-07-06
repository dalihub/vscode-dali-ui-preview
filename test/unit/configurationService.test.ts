import { expect } from 'chai';
import * as vscode from 'vscode';
import { ConfigurationService, hostXvfbNeeded } from '../../src/configurationService';

describe('hostXvfbNeeded', () => {
    it('returns false for docker mode (container has its own X server)', () => {
        expect(hostXvfbNeeded('docker')).to.equal(false);
    });
    it('returns true for local mode (host renders under Xvfb)', () => {
        expect(hostXvfbNeeded('local')).to.equal(true);
    });
});

describe('ConfigurationService — runtimeUpdatePolicy', () => {
    it('defaults to "notify" (matching the package.json manifest)', () => {
        // The vscode mock's getConfiguration().get(key, default) returns the
        // supplied default, so this asserts the getter passes 'notify'.
        expect(ConfigurationService.getInstance().runtimeUpdatePolicy).to.equal('notify');
    });
});

describe('ConfigurationService — runtimeMode / daliPrefix', () => {
    const realGetConfiguration = vscode.workspace.getConfiguration;
    afterEach(() => { (vscode.workspace as any).getConfiguration = realGetConfiguration; });

    // Override the vscode mock so a specific key returns a non-default value.
    function stubConfig(values: Record<string, any>): void {
        (vscode.workspace as any).getConfiguration = () => ({
            get: (key: string, dflt: any) => (key in values ? values[key] : dflt),
            update: () => Promise.resolve(),
        });
    }

    it('runtimeMode defaults to "docker" (matching the manifest)', () => {
        expect(ConfigurationService.getInstance().runtimeMode).to.equal('docker');
    });

    it('daliPrefix defaults to "" (empty → auto-detect)', () => {
        expect(ConfigurationService.getInstance().daliPrefix).to.equal('');
    });

    it('runtimeMode returns "local" when configured', () => {
        stubConfig({ runtimeMode: 'local' });
        expect(ConfigurationService.getInstance().runtimeMode).to.equal('local');
    });

    it('runtimeMode falls back to "docker" for an unrecognized value', () => {
        stubConfig({ runtimeMode: 'bogus' });
        expect(ConfigurationService.getInstance().runtimeMode).to.equal('docker');
    });
});

describe('ConfigurationService — daliVersionTag read-after-write override', () => {
    const realGetConfiguration = vscode.workspace.getConfiguration;
    afterEach(() => {
        (vscode.workspace as any).getConfiguration = realGetConfiguration;
        ConfigurationService.clearVersionTagOverride(); // don't leak static state
    });

    // Simulate VS Code's read-after-write lag: get() keeps returning the stale tag,
    // update() resolves without the model catching up in the same tick.
    function stubLaggyConfig(staleTag: string): void {
        (vscode.workspace as any).getConfiguration = () => ({
            get: (key: string, dflt: any) => (key === 'daliVersionTag' ? staleTag : dflt),
            update: () => Promise.resolve(),
            inspect: () => undefined,
        });
    }

    it('an immediate re-read after update() sees the NEW tag even if config.get() lags', async () => {
        stubLaggyConfig('latest');
        const cfg = ConfigurationService.getInstance();
        expect(cfg.daliVersionTag).to.equal('latest');
        await cfg.update('daliVersionTag', 'dali_2.5.28-a3ede24');
        // The bug this guards: without the override the runtime switch re-reads the
        // STALE tag and pulls the wrong (e.g. broken `latest`) image. With it, the
        // immediate re-read is the tag we just picked.
        expect(cfg.daliVersionTag).to.equal('dali_2.5.28-a3ede24');
    });

    it('clearVersionTagOverride() restores config as the source of truth', async () => {
        stubLaggyConfig('latest');
        const cfg = ConfigurationService.getInstance();
        await cfg.update('daliVersionTag', 'dali_2.5.28-a3ede24');
        expect(cfg.daliVersionTag).to.equal('dali_2.5.28-a3ede24');
        ConfigurationService.clearVersionTagOverride(); // config model caught up / external edit
        expect(cfg.daliVersionTag).to.equal('latest');
    });

    it('only daliVersionTag updates set the override (other keys unaffected)', async () => {
        stubLaggyConfig('latest');
        const cfg = ConfigurationService.getInstance();
        await cfg.update('previewWidth', 800);
        expect(cfg.daliVersionTag).to.equal('latest'); // no override from an unrelated key
    });
});
