import { expect } from 'chai';
import * as sinon from 'sinon';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { XvfbManager } from '../../src/xvfbManager';

describe('XvfbManager', () => {
    let mgr: XvfbManager;

    beforeEach(() => {
        mgr = new XvfbManager();
    });

    afterEach(() => {
        mgr.stop();
        sinon.restore();
    });

    // -----------------------------------------------------------------
    // start()
    // -----------------------------------------------------------------
    describe('start()', () => {
        it('returns true if already running (isAlive)', async () => {
            // Simulate a running process by setting the internal fields
            const fakeChild = { pid: 99999, kill: sinon.stub() } as any;
            (mgr as any).process = fakeChild;

            // Stub isProcessAlive to return true (so isAlive() returns true)
            sinon.stub(mgr as any, 'isProcessAlive').returns(true);

            const result = await mgr.start();
            expect(result).to.equal(true);
        });

        it('returns false (no UI) if Xvfb not installed — caller offers install', async () => {
            // start() no longer shows its own warning; activate() decides how to
            // surface it (offer install / warn busy). It must NOT fall to :0.
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(false);
            const showWarningSpy = sinon.spy(vscode.window, 'showWarningMessage');

            const result = await mgr.start();
            expect(result).to.equal(false);
            expect(showWarningSpy.called).to.equal(false);
        });

        it('tries a wide band of candidate displays starting at :99', async () => {
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(true);

            // Track which displays were tried
            const triedDisplays: string[] = [];
            sinon.stub(mgr as any, 'isDisplayInUse').returns(false);
            sinon.stub(mgr as any, 'tryStart').callsFake((async (...args: unknown[]) => {
                triedDisplays.push(args[0] as string);
                return false; // all fail
            }) as any);

            await mgr.start();
            // A wide band so leftover Xvfb servers on :97–:99 can't exhaust it and
            // force a :0 fallback (the screen-hijack bug).
            expect(triedDisplays[0]).to.equal(':99');
            expect(triedDisplays.length).to.be.greaterThan(3);
            expect(triedDisplays).to.include(':110');
        });

        it('skips displays that are in use', async () => {
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(true);

            // Display 99 is in use; the next candidate (:100) is free.
            const isDisplayInUseStub = sinon.stub(mgr as any, 'isDisplayInUse').returns(false);
            isDisplayInUseStub.withArgs(99).returns(true);

            const triedDisplays: string[] = [];
            sinon.stub(mgr as any, 'tryStart').callsFake((async (...args: unknown[]) => {
                const display = args[0] as string;
                triedDisplays.push(display);
                if (display === ':100') {
                    return true;
                }
                return false;
            }) as any);

            const result = await mgr.start();
            expect(result).to.equal(true);
            // :99 should NOT appear in tried displays since it was in use
            expect(triedDisplays).to.not.include(':99');
            expect(triedDisplays).to.include(':100');
        });

        it('returns false (no UI) if all candidate displays fail', async () => {
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(true);
            sinon.stub(mgr as any, 'isDisplayInUse').returns(false);
            sinon.stub(mgr as any, 'tryStart').resolves(false);
            const showWarningSpy = sinon.spy(vscode.window, 'showWarningMessage');

            const result = await mgr.start();
            expect(result).to.equal(false);
            // Messaging moved to activate(); start() stays UI-free.
            expect(showWarningSpy.called).to.equal(false);
        });

        it('sets display when a candidate succeeds', async () => {
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(true);
            sinon.stub(mgr as any, 'isDisplayInUse').returns(false);

            // First display (:99) fails, the next (:100) succeeds.
            const tryStartStub = sinon.stub(mgr as any, 'tryStart').resolves(false);
            tryStartStub.withArgs(':99').resolves(false);
            tryStartStub.withArgs(':100').resolves(true);

            const result = await mgr.start();
            expect(result).to.equal(true);
            expect((mgr as any).display).to.equal(':100');
        });
    });

    // -----------------------------------------------------------------
    // stop()
    // -----------------------------------------------------------------
    describe('stop()', () => {
        it('kills the process and clears display', () => {
            const killStub = sinon.stub();
            (mgr as any).process = { pid: 12345, kill: killStub };
            (mgr as any).display = ':99';

            mgr.stop();

            expect(killStub.calledOnce).to.equal(true);
            expect(killStub.firstCall.args[0]).to.equal('SIGTERM');
            expect((mgr as any).process).to.be.undefined;
            expect((mgr as any).display).to.be.undefined;
        });

        it('handles already-stopped state gracefully (no throw)', () => {
            // No process set, stop() should not throw
            expect(() => mgr.stop()).to.not.throw();
            expect((mgr as any).process).to.be.undefined;
            expect((mgr as any).display).to.be.undefined;
        });

        it('handles kill error gracefully', () => {
            (mgr as any).process = {
                pid: 12345,
                kill: sinon.stub().throws(new Error('No such process')),
            };
            (mgr as any).display = ':99';

            // Should not throw even when kill fails
            expect(() => mgr.stop()).to.not.throw();
            expect((mgr as any).process).to.be.undefined;
            expect((mgr as any).display).to.be.undefined;
        });
    });

    // -----------------------------------------------------------------
    // getDisplay()
    // -----------------------------------------------------------------
    describe('getDisplay()', () => {
        it('returns the managed Xvfb display when running', () => {
            const fakeChild = { pid: 99999 } as any;
            (mgr as any).process = fakeChild;
            (mgr as any).display = ':98';
            sinon.stub(mgr as any, 'isProcessAlive').returns(true);

            expect(mgr.getDisplay()).to.equal(':98');
        });

        it('returns undefined (NOT the real DISPLAY) when not running', () => {
            // The critical anti-screen-hijack contract: no managed Xvfb → undefined,
            // so render paths refuse rather than draw on the user's real screen.
            const originalDisplay = process.env.DISPLAY;
            process.env.DISPLAY = ':0';
            try {
                expect(mgr.getDisplay()).to.equal(undefined);
            } finally {
                if (originalDisplay !== undefined) {
                    process.env.DISPLAY = originalDisplay;
                } else {
                    delete process.env.DISPLAY;
                }
            }
        });

        it('returns undefined when the process exists but is no longer alive', () => {
            const fakeChild = { pid: 99999 } as any;
            (mgr as any).process = fakeChild;
            (mgr as any).display = ':98';
            sinon.stub(mgr as any, 'isProcessAlive').returns(false);

            expect(mgr.getDisplay()).to.equal(undefined);
        });
    });

    // -----------------------------------------------------------------
    // isInstalled() — public guard so local-mode setup can offer install
    // -----------------------------------------------------------------
    describe('isInstalled()', () => {
        it('returns a boolean reflecting Xvfb presence on PATH', () => {
            const result = mgr.isInstalled();
            expect(result).to.be.a('boolean');
        });

        it('mirrors the private isXvfbInstalled() probe', () => {
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(false);
            expect(mgr.isInstalled()).to.equal(false);
        });
    });

    // -----------------------------------------------------------------
    // isDisplayInUse() — tested with real temp lock files
    // NOTE: isDisplayInUse() does `const fs = require('fs')` internally,
    //       so we cannot sinon-stub the top-level fs import. Instead we
    //       create / remove real lock files in /tmp for a high display number
    //       that is very unlikely to collide with actual X displays.
    // -----------------------------------------------------------------
    describe('isDisplayInUse()', () => {
        const testDisplayNum = 77; // unlikely to collide with real displays
        const lockFile = `/tmp/.X${testDisplayNum}-lock`;

        afterEach(() => {
            try { fs.unlinkSync(lockFile); } catch (_e) { /* noop */ }
        });

        it('detects active display from lock file with live PID', () => {
            // Write our own PID to the lock file (we are alive)
            fs.writeFileSync(lockFile, `  ${process.pid}  `);

            const result = (mgr as any).isDisplayInUse(testDisplayNum);
            expect(result).to.equal(true);
        });

        it('handles stale lock file (dead PID)', () => {
            // Use a PID that almost certainly doesn't exist
            fs.writeFileSync(lockFile, '  4999999  ');

            const result = (mgr as any).isDisplayInUse(testDisplayNum);
            expect(result).to.equal(false);
        });

        it('handles missing lock file', () => {
            // Ensure no lock file exists
            try { fs.unlinkSync(lockFile); } catch (_e) { /* noop */ }

            const result = (mgr as any).isDisplayInUse(testDisplayNum);
            expect(result).to.equal(false);
        });

        it('handles lock file with invalid (non-numeric) PID', () => {
            fs.writeFileSync(lockFile, '  not-a-number  ');

            const result = (mgr as any).isDisplayInUse(testDisplayNum);
            // parseInt returns NaN, isNaN check causes it to return false
            expect(result).to.equal(false);
        });
    });

    // -----------------------------------------------------------------
    // isXvfbInstalled()
    // NOTE: execSync is non-configurable in Node.js so sinon cannot
    //       stub it directly. We test the observable contract instead.
    // -----------------------------------------------------------------
    describe('isXvfbInstalled()', () => {
        it('returns a boolean', () => {
            // Xvfb may or may not be installed on the test machine;
            // we just verify the return type.
            const result = (mgr as any).isXvfbInstalled();
            expect(result).to.be.a('boolean');
        });

        it('behavior tested through start() — false returns false without UI', async () => {
            // Stub the private method to control the path
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(false);
            const showWarningSpy = sinon.spy(vscode.window, 'showWarningMessage');

            const result = await mgr.start();
            expect(result).to.equal(false);
            expect(showWarningSpy.called).to.equal(false); // activate() owns the messaging now
        });

        it('behavior tested through start() — true proceeds to display search', async () => {
            sinon.stub(mgr as any, 'isXvfbInstalled').returns(true);
            const tryStartStub = sinon.stub(mgr as any, 'tryStart').resolves(true);
            sinon.stub(mgr as any, 'isDisplayInUse').returns(false);

            const result = await mgr.start();
            expect(result).to.equal(true);
            expect(tryStartStub.called).to.equal(true);
        });
    });

    // -----------------------------------------------------------------
    // isAlive()
    // -----------------------------------------------------------------
    describe('isAlive()', () => {
        it('returns false when no process exists', () => {
            expect((mgr as any).isAlive()).to.equal(false);
        });

        it('returns true when process exists and pid is killable', () => {
            const fakeChild = { pid: 99999 } as any;
            (mgr as any).process = fakeChild;
            sinon.stub(mgr as any, 'isProcessAlive').returns(true);
            expect((mgr as any).isAlive()).to.equal(true);
        });

        it('returns false when process exists but pid is not killable', () => {
            const fakeChild = { pid: 99999 } as any;
            (mgr as any).process = fakeChild;
            sinon.stub(mgr as any, 'isProcessAlive').returns(false);
            expect((mgr as any).isAlive()).to.equal(false);
        });
    });

    // -----------------------------------------------------------------
    // isProcessAlive()
    // -----------------------------------------------------------------
    describe('isProcessAlive()', () => {
        it('returns false when child has no pid', () => {
            const fakeChild = { pid: undefined } as any;
            expect((mgr as any).isProcessAlive(fakeChild)).to.equal(false);
        });

        it('returns true when process.kill(pid, 0) succeeds', () => {
            const originalKill = process.kill;
            (process as any).kill = (pid: number, signal: number) => {
                if (signal === 0) {
                    return true;
                }
                return originalKill.call(process, pid, signal);
            };
            try {
                const fakeChild = { pid: process.pid } as any; // use our own PID (always alive)
                expect((mgr as any).isProcessAlive(fakeChild)).to.equal(true);
            } finally {
                (process as any).kill = originalKill;
            }
        });

        it('returns false when process.kill(pid, 0) throws', () => {
            const originalKill = process.kill;
            (process as any).kill = (pid: number, signal: number) => {
                if (signal === 0) {
                    throw new Error('ESRCH');
                }
                return originalKill.call(process, pid, signal);
            };
            try {
                const fakeChild = { pid: 88888 } as any;
                expect((mgr as any).isProcessAlive(fakeChild)).to.equal(false);
            } finally {
                (process as any).kill = originalKill;
            }
        });
    });
});
