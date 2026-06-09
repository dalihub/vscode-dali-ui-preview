import { expect } from 'chai';
import { PullProgressTracker, parsePullFraction } from '../../src/dockerRuntime';

describe('parsePullFraction', () => {
    it('reads a literal percent', () => {
        expect(parsePullFraction('[===>      ]  45%')).to.be.closeTo(0.45, 1e-9);
    });
    it('reads the current/total byte form', () => {
        expect(parsePullFraction('[==>   ]  12MB/24MB')).to.be.closeTo(0.5, 1e-9);
    });
    it('handles mixed units (kB over MB)', () => {
        expect(parsePullFraction('500kB/1MB')).to.be.closeTo(0.5, 1e-6);
    });
    it('clamps an over-unity ratio to 1', () => {
        expect(parsePullFraction('30MB/24MB')).to.equal(1);
    });
    it('returns undefined when there is no numeric detail', () => {
        expect(parsePullFraction('Verifying Checksum')).to.equal(undefined);
        expect(parsePullFraction('Pull complete')).to.equal(undefined);
    });
});

describe('PullProgressTracker — off-TTY milestone parsing', () => {
    // The exact lines `docker pull` prints to a pipe: discrete per-layer
    // milestones only, never byte/percent progress. (Verified empirically
    // against `docker pull` with a redirected, non-TTY stdout.)
    const feed = (lines: string[]) => {
        const t = new PullProgressTracker('latest');
        return lines.map((l) => t.push(l));
    };

    it('reports a partial percentage while some layers are still pending', () => {
        // Two layers known; one fully pulled, one only queued. The OLD parser
        // reported 100% here (it averaged only completed layers) — this 0→100
        // jump is exactly the bug being fixed.
        const snaps = feed([
            'a1b2c3d4e5f6: Pulling fs layer',
            'b2c3d4e5f6a7: Pulling fs layer',
            'a1b2c3d4e5f6: Download complete',
            'a1b2c3d4e5f6: Pull complete',
        ]);
        const last = snaps[snaps.length - 1];
        expect(last.totalLayers).to.equal(2);
        expect(last.completedLayers).to.equal(1);
        // one layer done (1.0) + one queued (0.0), averaged over two = 50%.
        expect(last.percent).to.be.closeTo(50, 1e-6);
    });

    it('never moves backwards when a late layer registers', () => {
        const snaps = feed([
            'aaaaaaaaaaaa: Pulling fs layer',
            'aaaaaaaaaaaa: Download complete',
            'aaaaaaaaaaaa: Pull complete',     // 1 layer @ 100% → 100%
            'bbbbbbbbbbbb: Pulling fs layer',  // a naive mean would drop to 50%
        ]);
        const pcts = snaps.map((s) => s.percent);
        for (let i = 1; i < pcts.length; i++) {
            expect(pcts[i]).to.be.at.least(pcts[i - 1]);
        }
        // held at the previous max rather than dropping back to 50.
        expect(pcts[pcts.length - 1]).to.equal(100);
    });

    it('advances in steps across a multi-layer pull (not one 0→100 jump)', () => {
        const snaps = feed([
            'aaaaaaaaaaaa: Pulling fs layer',
            'bbbbbbbbbbbb: Pulling fs layer',
            'cccccccccccc: Pulling fs layer',
            'aaaaaaaaaaaa: Download complete',
            'bbbbbbbbbbbb: Download complete',
            'cccccccccccc: Download complete',
            'aaaaaaaaaaaa: Pull complete',
            'bbbbbbbbbbbb: Pull complete',
            'cccccccccccc: Pull complete',
        ]);
        const distinct = new Set(snaps.map((s) => Math.round(s.percent)));
        // multiple intermediate values between 0 and 100 — the whole point.
        expect(distinct.size).to.be.greaterThan(2);
        expect(Math.max(...snaps.map((s) => s.percent))).to.be.at.most(100);
    });

    it('ignores non-layer lines (Pulling from / Digest / Status)', () => {
        const snaps = feed([
            'latest: Pulling from lwc0917/dali-preview-runtime',
            'Digest: sha256:abc',
            'Status: Downloaded newer image for ghcr.io/x:latest',
        ]);
        expect(snaps.every((s) => s.totalLayers === 0)).to.equal(true);
        expect(snaps.every((s) => s.percent === 0)).to.equal(true);
    });

    it('treats "Already exists" as a completed layer', () => {
        const [snap] = feed(['eeeeeeeeeeee: Already exists']);
        expect(snap.completedLayers).to.equal(1);
        expect(snap.percent).to.equal(100);
    });

    it('refines the download band when byte detail IS present (TTY fallback)', () => {
        // download phase maps to 0..0.6; a half-downloaded single layer → 0.3.
        const [snap] = feed(['aaaaaaaaaaaa: Downloading [====>   ]  12MB/24MB']);
        expect(snap.percent).to.be.closeTo(30, 1e-6);
    });

    it('complete() forces 100% on a clean exit', () => {
        const t = new PullProgressTracker('latest');
        t.push('aaaaaaaaaaaa: Pulling fs layer');
        t.push('bbbbbbbbbbbb: Pulling fs layer');
        const done = t.complete();
        expect(done.percent).to.equal(100);
        expect(done.completedLayers).to.equal(2);
        expect(done.totalLayers).to.equal(2);
    });
});
