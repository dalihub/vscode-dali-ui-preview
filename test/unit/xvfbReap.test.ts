import { expect } from 'chai';
import { isOurXvfbProcess } from '../../src/xvfbManager';

/*
 * Leak guard (task-2 #2): on a non-graceful exit our detached Xvfb survives and squats a
 * display; over ~16 such exits the :99–:114 band fills and local preview is disabled. The
 * fix reaps OUR previous Xvfb (a per-workspace-recorded PID) on the next start — but only if
 * that PID is actually one of OUR Xvfb servers, never another tool's or another window's live
 * Xvfb. isOurXvfbProcess is that safety check: it must match ONLY an Xvfb started with our
 * exact 2048x2048x24 screen signature.
 */
describe('isOurXvfbProcess (safe Xvfb reaping)', () => {
    it('matches our Xvfb (our 2048x2048x24 signature)', () => {
        expect(isOurXvfbProcess('Xvfb :101 -screen 0 2048x2048x24 -nolisten tcp -ac')).to.equal(true);
        expect(isOurXvfbProcess('/usr/bin/Xvfb :99 -screen 0 2048x2048x24 -nolisten tcp -ac')).to.equal(true);
    });

    it('does NOT match another tool\'s Xvfb (different geometry) — must never kill it', () => {
        expect(isOurXvfbProcess('Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp')).to.equal(false);
        expect(isOurXvfbProcess('Xvfb :5 -screen 0 1920x1080x24')).to.equal(false);
    });

    it('does NOT match a non-Xvfb process that reused the PID (defensive)', () => {
        expect(isOurXvfbProcess('/usr/bin/node /some/app.js 2048x2048x24')).to.equal(false); // has geometry but not Xvfb
        expect(isOurXvfbProcess('bash -c something')).to.equal(false);
        expect(isOurXvfbProcess('')).to.equal(false);
    });
});
