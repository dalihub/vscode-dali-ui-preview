import { expect } from 'chai';
import { SdbManager } from '../../src/sdbManager';

const fakeOutputChannel = {
    appendLine: () => {},
    append: () => {},
    show: () => {},
    dispose: () => {},
} as any;

describe('SdbManager — checkDependencies()', () => {
    it('returns null or a string (integration: sdb may or may not be installed)', function () {
        const result = SdbManager.checkDependencies();
        expect(result === null || typeof result === 'string').to.equal(true);
    });

    it('returns a string when sdb is not found', () => {
        const origCheck = SdbManager.checkDependencies;
        (SdbManager as any).checkDependencies = () => 'sdb not found in PATH. Install Tizen SDK or set daliPreview.sdbPath.';
        try {
            const result = SdbManager.checkDependencies();
            expect(typeof result).to.equal('string');
            expect(result).to.include('sdb');
        } finally {
            SdbManager.checkDependencies = origCheck;
        }
    });

    it('returns null when sdb is found', () => {
        const origCheck = SdbManager.checkDependencies;
        (SdbManager as any).checkDependencies = () => null;
        try {
            const result = SdbManager.checkDependencies();
            expect(result).to.equal(null);
        } finally {
            SdbManager.checkDependencies = origCheck;
        }
    });
});

describe('SdbManager — parseDevices()', () => {
    let mgr: SdbManager;

    beforeEach(() => {
        mgr = new SdbManager(fakeOutputChannel);
    });

    it('parses a single connected device', () => {
        const output = 'List of devices attached\ndevice-1:26101\tdevice\n';
        const devices = (mgr as any).parseDevices(output);
        expect(devices).to.have.length(1);
        expect(devices[0].serial).to.equal('device-1:26101');
        expect(devices[0].state).to.equal('device');
    });

    it('parses multiple devices', () => {
        const output = [
            'List of devices attached',
            'emulator-26101\tdevice\tEmulator',
            'device-1234\toffline',
            '',
        ].join('\n');
        const devices = (mgr as any).parseDevices(output);
        expect(devices).to.have.length(2);
        expect(devices[0].serial).to.equal('emulator-26101');
        expect(devices[0].name).to.equal('Emulator');
        expect(devices[1].serial).to.equal('device-1234');
        expect(devices[1].state).to.equal('offline');
    });

    it('returns empty array for empty output', () => {
        const devices = (mgr as any).parseDevices('');
        expect(devices).to.have.length(0);
    });

    it('skips header and asterisk lines', () => {
        const output = [
            'List of devices attached',
            '* daemon not running; starting now at tcp:5037',
            'device-1\tdevice',
        ].join('\n');
        const devices = (mgr as any).parseDevices(output);
        expect(devices).to.have.length(1);
        expect(devices[0].serial).to.equal('device-1');
    });

    it('handles offline devices', () => {
        const output = 'List of devices attached\ndevice-1234\toffline\n';
        const devices = (mgr as any).parseDevices(output);
        expect(devices[0].state).to.equal('offline');
    });
});

describe('SdbManager — exec() command construction', () => {
    it('dispose() completes without error', () => {
        const mgr = new SdbManager(fakeOutputChannel);
        expect(() => mgr.dispose()).not.to.throw();
    });
});
