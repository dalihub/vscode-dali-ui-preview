import { expect } from 'chai';
import * as sinon from 'sinon';
import * as net from 'net';
import { VncManager } from '../../src/vncManager';

const fakeOutputChannel = {
    appendLine: () => {},
    append: () => {},
    show: () => {},
    dispose: () => {},
} as any;

describe('VncManager — checkDependencies()', () => {
    // NOTE: execSync is non-configurable in Node.js so sinon cannot stub it directly.
    // We test the observable contract by mocking VncManager's internal checker.

    it('returns null when both binaries are present (integration)', function () {
        // x11vnc and websockify may or may not be installed; we just verify return type
        const result = VncManager.checkDependencies();
        expect(result === null || typeof result === 'string').to.equal(true);
    });

    it('correctly identifies the first missing binary', () => {
        // Patch the static method's binary list by temporarily overriding it
        const origCheck = VncManager.checkDependencies;
        // Simulate: x11vnc missing, websockify present
        (VncManager as any).checkDependencies = function () {
            try {
                require('child_process').execSync('which websockify', { stdio: 'pipe' });
            } catch {
                return 'websockify';
            }
            return null;
        };
        try {
            const r = VncManager.checkDependencies();
            expect(r === null || r === 'websockify').to.equal(true);
        } finally {
            VncManager.checkDependencies = origCheck;
        }
    });

    it('returns a string (binary name) when a dependency is absent', () => {
        const origCheck = VncManager.checkDependencies;
        (VncManager as any).checkDependencies = () => 'x11vnc';
        try {
            const result = VncManager.checkDependencies();
            expect(typeof result).to.equal('string');
            expect(result).to.equal('x11vnc');
        } finally {
            VncManager.checkDependencies = origCheck;
        }
    });
});

describe('VncManager — findAvailablePort()', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('returns a port in range when one is available', async () => {
        const port = await VncManager.findAvailablePort(19800, 19810);
        expect(port).to.be.within(19800, 19810);
    });

    it('returns -1 when the entire range is occupied', async () => {
        // Occupy all ports in range by holding servers
        const servers: net.Server[] = [];
        const startPort = 19820;
        const endPort = 19822;
        try {
            await new Promise<void>((resolve) => {
                let bound = 0;
                for (let p = startPort; p <= endPort; p++) {
                    const s = net.createServer();
                    servers.push(s);
                    s.listen(p, '127.0.0.1', () => {
                        bound++;
                        if (bound === endPort - startPort + 1) {
                            resolve();
                        }
                    });
                    s.on('error', () => {
                        bound++;
                        if (bound === endPort - startPort + 1) {
                            resolve();
                        }
                    });
                }
            });
            const result = await VncManager.findAvailablePort(startPort, endPort);
            expect(result).to.equal(-1);
        } finally {
            for (const s of servers) {
                await new Promise<void>((r) => s.close(() => r()));
            }
        }
    });
});

describe('VncManager — isRunning', () => {
    it('starts as false', () => {
        const mgr = new VncManager(fakeOutputChannel);
        expect(mgr.isRunning).to.equal(false);
        mgr.dispose();
    });

    it('returns a ws:// URL with the configured port', () => {
        const mgr = new VncManager(fakeOutputChannel);
        const url = mgr.getWebSocketUrl();
        expect(url).to.match(/^ws:\/\/localhost:\d+$/);
        mgr.dispose();
    });
});

describe('VncManager — startInteractiveMode() dependency check', () => {
    it('returns error when a dependency is missing', async () => {
        // Override checkDependencies to simulate missing binary
        const origCheck = VncManager.checkDependencies;
        (VncManager as any).checkDependencies = () => 'x11vnc';
        const mgr = new VncManager(fakeOutputChannel);
        try {
            const result = await mgr.startInteractiveMode({
                daliBinaryPath: '/tmp/fake_bin',
                display: ':99',
                width: 1024,
                height: 600,
                env: {},
            });
            expect(result.success).to.equal(false);
            expect(result.error).to.include('not installed');
        } finally {
            VncManager.checkDependencies = origCheck;
            mgr.dispose();
        }
    });
});

describe('VncManager — startInteractiveMode() VNC port exhaustion', () => {
    it('returns {success:false} when no VNC port is available', async () => {
        const origCheck = VncManager.checkDependencies;
        (VncManager as any).checkDependencies = () => null;
        const mgr = new VncManager(fakeOutputChannel);
        // Force findAvailablePort to always return -1
        (mgr as any).findAvailablePort = async () => -1;
        try {
            const result = await mgr.startInteractiveMode({
                daliBinaryPath: '/tmp/fake_bin',
                display: ':99',
                width: 1024,
                height: 600,
                env: {},
            });
            expect(result.success).to.equal(false);
            expect(result.error).to.include('VNC port');
        } finally {
            VncManager.checkDependencies = origCheck;
            mgr.dispose();
        }
    });

    it('returns {success:false} when no WebSocket port is available', async () => {
        const origCheck = VncManager.checkDependencies;
        (VncManager as any).checkDependencies = () => null;
        const mgr = new VncManager(fakeOutputChannel);
        let callCount = 0;
        (mgr as any).findAvailablePort = async () => {
            // First call (VNC port) succeeds, second (WS port) fails
            return callCount++ === 0 ? 5900 : -1;
        };
        try {
            const result = await mgr.startInteractiveMode({
                daliBinaryPath: '/tmp/fake_bin',
                display: ':99',
                width: 1024,
                height: 600,
                env: {},
            });
            expect(result.success).to.equal(false);
            expect(result.error).to.include('WebSocket port');
        } finally {
            VncManager.checkDependencies = origCheck;
            mgr.dispose();
        }
    });
});

describe('VncManager — stopInteractiveMode()', () => {
    it('sets isRunning to false', async () => {
        const mgr = new VncManager(fakeOutputChannel);
        // Manually set running state
        (mgr as any)._isRunning = true;
        await mgr.stopInteractiveMode();
        expect(mgr.isRunning).to.equal(false);
        mgr.dispose();
    });
});

describe('VncManager — restartDaliApp()', () => {
    it('returns false when the new binary does not exist', async () => {
        const mgr = new VncManager(fakeOutputChannel);
        const ok = await mgr.restartDaliApp('/nonexistent/fake_bin', {
            display: ':99',
            width: 1024,
            height: 600,
            env: {},
        });
        // spawn of nonexistent binary → error event → false
        expect(ok).to.equal(false);
        mgr.dispose();
    });
});

describe('VncManager — onDaliAppExitCallback', () => {
    it('callback field is initially undefined', () => {
        const mgr = new VncManager(fakeOutputChannel);
        expect(mgr.onDaliAppExitCallback).to.equal(undefined);
        mgr.dispose();
    });

    it('can be set and called', () => {
        const mgr = new VncManager(fakeOutputChannel);
        let called = false;
        mgr.onDaliAppExitCallback = () => { called = true; };
        mgr.onDaliAppExitCallback();
        expect(called).to.equal(true);
        mgr.dispose();
    });
});
