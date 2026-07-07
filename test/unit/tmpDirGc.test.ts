import { expect } from 'chai';
import { selectStaleTmpDirs } from '../../src/buildRunner';

/*
 * Leak guard (task-2 #5): getWorkspaceTmpDir() mints /tmp/dali_preview_<hash> per distinct
 * workspace root and nothing ever removes the old ones (in local mode each also retains a
 * multi-MB preview_server binary). selectStaleTmpDirs is the pure selector for the activate()
 * GC sweep: it must pick ONLY our tmp-dir family, never the active dir, only when stale, and
 * must never match unrelated /tmp entries.
 */
describe('selectStaleTmpDirs (tmp-dir GC selection)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const NOW = 1_000 * DAY; // arbitrary fixed "now"
    const MAX_AGE = 7 * DAY;

    it('selects OUR abandoned tmp dirs older than the max age (not the active one)', () => {
        const entries = [
            { name: 'dali_preview_aabbccdd', mtimeMs: NOW - 10 * DAY }, // stale sibling
            { name: 'dali_preview_11223344', mtimeMs: NOW - 8 * DAY },  // stale sibling
            { name: 'dali_preview_deadbeef', mtimeMs: NOW - 1 * DAY },  // fresh sibling → keep
            { name: 'dali_preview', mtimeMs: NOW - 30 * DAY },          // stale no-workspace dir
        ];
        const stale = selectStaleTmpDirs(entries, 'dali_preview_deadbeef', NOW, MAX_AGE);
        expect(stale).to.have.members(['dali_preview_aabbccdd', 'dali_preview_11223344', 'dali_preview']);
        expect(stale).to.not.include('dali_preview_deadbeef'); // fresh
    });

    it('never selects the ACTIVE tmp dir, even if old', () => {
        const entries = [{ name: 'dali_preview_aabbccdd', mtimeMs: NOW - 999 * DAY }];
        expect(selectStaleTmpDirs(entries, 'dali_preview_aabbccdd', NOW, MAX_AGE)).to.deep.equal([]);
    });

    it('never touches unrelated /tmp entries (only the dali_preview[_<hash>] family)', () => {
        const entries = [
            { name: 'dali_server_golden_xyz', mtimeMs: NOW - 30 * DAY }, // e2e runner dir — NOT ours to GC
            { name: 'dali_preview_report', mtimeMs: NOW - 30 * DAY },    // not an 8-hex suffix → skip
            { name: 'systemd-private-abc', mtimeMs: NOW - 30 * DAY },
            { name: 'dali_preview_ZZZZZZZZ', mtimeMs: NOW - 30 * DAY },  // not hex → skip
        ];
        expect(selectStaleTmpDirs(entries, 'dali_preview_active00', NOW, MAX_AGE)).to.deep.equal([]);
    });

    it('keeps recent dirs (within max age)', () => {
        const entries = [{ name: 'dali_preview_aabbccdd', mtimeMs: NOW - 3 * DAY }];
        expect(selectStaleTmpDirs(entries, 'dali_preview_active00', NOW, MAX_AGE)).to.deep.equal([]);
    });
});
