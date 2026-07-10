import { expect } from 'chai';
import * as sinon from 'sinon';
import * as dockerAccessCheck from '../../src/dockerAccessCheck';
import { ensureRuntimeImage, ensureRuntimeImageForTag, pullRuntimeImageCommand, formatPullMessage, analyzePullError, describeFailure, buildDownloadFailureGuidance } from '../../src/pullImageCommand';

const fakeOut = { appendLine: () => {}, append: () => {}, show: () => {}, dispose: () => {} } as any;

function makeRuntime(over: Record<string, any> = {}) {
    return {
        getImageName: () => 'ghcr.io/test/dali-preview-runtime',
        imageRef: (tag: string) => `ghcr.io/test/dali-preview-runtime:${tag}`,
        hasImage: sinon.stub().resolves(false),
        pullImage: sinon.stub().resolves(undefined),
        ...over,
    } as any;
}

describe('ensureRuntimeImage', () => {
    afterEach(() => sinon.restore());

    it('returns true without pulling when the image is already cached', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(true) });
        const ok = await ensureRuntimeImage(rt, fakeOut);
        expect(ok).to.equal(true);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('returns false (no pull) when docker is not accessible', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'permission-denied' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(false) });
        const ok = await ensureRuntimeImage(rt, fakeOut);
        expect(ok).to.equal(false);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('pulls and returns true when the image is missing and docker is ok', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(false) });
        const ok = await ensureRuntimeImage(rt, fakeOut);
        expect(ok).to.equal(true);
        expect(rt.pullImage.calledOnce).to.equal(true);
    });

    it('coalesces concurrent pulls of the same tag into a single download', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        // A controllable pull that stays pending until we release it, so both
        // callers are genuinely in-flight at the same time.
        let release!: () => void;
        const pending = new Promise<void>((res) => { release = () => res(); });
        const pullStub = sinon.stub().returns(pending);
        const rt = makeRuntime({
            hasImage: sinon.stub().resolves(false),
            pullImage: pullStub,
        });

        const p1 = ensureRuntimeImage(rt, fakeOut);
        const p2 = ensureRuntimeImage(rt, fakeOut);
        release();
        const [a, b] = await Promise.all([p1, p2]);

        expect(a).to.equal(true);
        expect(b).to.equal(true);
        // The fix: the second caller joins the in-flight pull instead of
        // starting its own (which is what produced the duplicate popup).
        expect(pullStub.calledOnce).to.equal(true);
    });

    it('allows a fresh pull after the previous one settled (map is cleared)', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(false) });
        await ensureRuntimeImage(rt, fakeOut);
        await ensureRuntimeImage(rt, fakeOut);
        // Two sequential (non-overlapping) calls each pull — the in-flight entry
        // must be released once a pull completes.
        expect(rt.pullImage.calledTwice).to.equal(true);
    });
});

describe('formatPullMessage — honest, percentage-free progress', () => {
    it('shows "starting" (no number) before any layer is known', () => {
        // The whole point of A: never imply a precise position we don't have.
        expect(formatPullMessage(0, 0, 0)).to.equal('starting · 0:00 elapsed');
    });

    it('reports completed/total layers and mm:ss elapsed — and never a percent', () => {
        const msg = formatPullMessage(3, 12, 65_000);
        expect(msg).to.equal('3/12 layers · 1:05 elapsed');
        expect(msg).to.not.match(/%/);
    });

    it('zero-pads seconds and floors sub-second elapsed', () => {
        expect(formatPullMessage(1, 4, 4_200)).to.equal('1/4 layers · 0:04 elapsed');
        expect(formatPullMessage(9, 9, 600_000)).to.equal('9/9 layers · 10:00 elapsed');
    });

    it('clamps a negative elapsed (clock skew) to 0:00 instead of going backwards', () => {
        expect(formatPullMessage(0, 5, -1_000)).to.equal('0/5 layers · 0:00 elapsed');
    });
});

describe('pullRuntimeImageCommand — force mode', () => {
    afterEach(() => sinon.restore());

    it('re-pulls even when the tag is already cached, when force=true', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(true) });
        await pullRuntimeImageCommand(rt, fakeOut, true);
        expect(rt.pullImage.calledOnce).to.equal(true);
    });

    it('skips the pull when cached and force=false', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(true) });
        await pullRuntimeImageCommand(rt, fakeOut, false);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('returns false without pulling when docker is not accessible', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'docker-not-installed' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(false) });
        const ok = await pullRuntimeImageCommand(rt, fakeOut, true);
        expect(ok).to.equal(false);
        expect(rt.pullImage.called).to.equal(false);
    });
});

describe('analyzePullError', () => {
    it('categorizes auth/token failures as retryable auth errors', () => {
        for (const msg of [
            'failed to authorize: insufficient_scope',
            'failed to fetch anonymous token: Get "https://ghcr.io/token..."',
            'received unexpected HTTP status: 401 Unauthorized',
            'denied with 403 Forbidden',
        ]) {
            const a = analyzePullError(msg);
            expect(a.category, msg).to.equal('auth');
            expect(a.shouldRetry, msg).to.equal(true);
        }
    });

    it('categorizes connectivity failures as retryable network errors', () => {
        for (const msg of [
            'dial tcp: connection refused',
            'read: connection reset by peer',
            'context deadline exceeded (i/o timeout)',
            'Get "https://ghcr.io": net/http: request canceled (timeout)',
            'network is unreachable',
            'httpReadSeeker: failed open',
        ]) {
            const a = analyzePullError(msg);
            expect(a.category, msg).to.equal('network');
            expect(a.shouldRetry, msg).to.equal(true);
        }
    });

    it('categorizes a missing image as a non-retryable not-found error', () => {
        for (const msg of ['manifest not found', 'image not found', 'repository not found']) {
            const a = analyzePullError(msg);
            expect(a.category, msg).to.equal('notfound');
            expect(a.shouldRetry, msg).to.equal(false);
        }
    });

    it('falls back to a retryable unknown category and echoes the raw error', () => {
        const a = analyzePullError('some totally novel docker failure');
        expect(a.category).to.equal('unknown');
        expect(a.shouldRetry).to.equal(true);
        expect(a.details).to.equal('some totally novel docker failure');
    });

    it('matches registry error strings case-insensitively', () => {
        expect(analyzePullError('FAILED TO AUTHORIZE').category).to.equal('auth');
        expect(analyzePullError('I/O TIMEOUT').category).to.equal('network');
    });

    it('prefers auth over network when a message matches both (auth checked first)', () => {
        // GHCR token failures often arrive wrapped in an httpReadSeeker frame;
        // the auth diagnosis is the actionable one, so it must win.
        const a = analyzePullError('httpReadSeeker: failed open: failed to authorize: failed to fetch anonymous token');
        expect(a.category).to.equal('auth');
    });
});

describe('pullRuntimeImageCommand — auto-retry on transient failure', () => {
    afterEach(() => sinon.restore());

    it('retries after a transient network error and succeeds', async function () {
        // First attempt fails with a (retryable) network error; the backoff is
        // 2^0 = 1s, so allow headroom over the default 2s mocha timeout.
        this.timeout(8000);
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const pullStub = sinon.stub()
            .onFirstCall().rejects(new Error('docker pull exited 1: httpReadSeeker: failed open'))
            .onSecondCall().resolves(undefined);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(false), pullImage: pullStub });

        const ok = await pullRuntimeImageCommand(rt, fakeOut, true);

        expect(ok).to.equal(true);
        expect(pullStub.callCount).to.equal(2);
    });
});

describe('ensureRuntimeImageForTag', () => {
    afterEach(() => sinon.restore());

    it('returns false without pulling when docker is not accessible', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'permission-denied' } as any);
        const rt = makeRuntime();
        expect(await ensureRuntimeImageForTag(rt, 'dali_2.5.26', fakeOut)).to.equal(false);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('returns true without pulling when the tag is already cached', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({ hasImage: sinon.stub().resolves(true) });
        expect(await ensureRuntimeImageForTag(rt, 'dali_2.5.26', fakeOut)).to.equal(true);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('pulls the SPECIFIED tag when missing', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime();
        expect(await ensureRuntimeImageForTag(rt, 'dali_2.5.26', fakeOut)).to.equal(true);
        expect(rt.pullImage.calledOnce).to.equal(true);
        expect(rt.pullImage.firstCall.args[0]).to.equal('dali_2.5.26');
    });
});

describe('pickFallbackTag / isRollingTag (corp-proxy ":latest unavailable" fallback)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { pickFallbackTag, isRollingTag } = require('../../src/pullImageCommand');

    it('classifies rolling vs immutable tags', () => {
        expect(isRollingTag('latest')).to.equal(true);
        expect(isRollingTag('dali_2.5.28')).to.equal(true);
        expect(isRollingTag('dali_2.5.28-9d55242')).to.equal(false); // immutable
    });

    it('prefers the newest IMMUTABLE tag (the corp proxy serves it from cache; mutable tags fail there)', () => {
        // Mirrors the real registry: latest + moving dali_2.5.28 + immutable dali_2.5.28-<sha>.
        // The moving dali_2.5.28 is ALSO mutable → would also fail on the proxy, so we must pick
        // the immutable one — the exact tag the colleague pulled manually and succeeded with.
        const tags = ['latest', 'dali_2.5.26', 'dali_2.5.28', 'dali_2.5.28-9d55242', 'dali_2.5.26-aaaaaaa'];
        expect(pickFallbackTag(tags, 'latest')).to.equal('dali_2.5.28-9d55242');
    });

    it('falls back to a moving version tag only when NO immutable tag exists', () => {
        const tags = ['latest', 'dali_2.5.26', 'dali_2.5.28'];
        expect(pickFallbackTag(tags, 'latest')).to.equal('dali_2.5.28');
    });

    it('never returns the tag that just failed', () => {
        // failed on the moving version tag itself → fall back to an immutable, not back to it
        expect(pickFallbackTag(['dali_2.5.28', 'dali_2.5.28-9d55242'], 'dali_2.5.28'))
            .to.equal('dali_2.5.28-9d55242');
    });

    it('returns undefined when there is no usable concrete tag', () => {
        expect(pickFallbackTag(['latest'], 'latest')).to.equal(undefined);
        expect(pickFallbackTag([], 'latest')).to.equal(undefined);
    });

    // Regression: the runtime moved to a 4-part dali_X.Y.Z.BUILD[-sha] tag form. The old
    // 3-part-only regex matched NEITHER the 4-part immutable nor the pin, so the fallback
    // silently pinned an OLD 3-part dali_2.5.28 build. Guard the 4-part support.
    it('handles 4-part dali_X.Y.Z.BUILD tags and picks the newest immutable', () => {
        const tags = [
            'latest',
            'dali_2.5.28', 'dali_2.5.28.10837', 'dali_2.5.28.10837-c9bd5b1', 'dali_2.5.28-a3ede24',
            'dali_2.5.29', 'dali_2.5.29.10863', 'dali_2.5.29.10863-c9bd5b1',
        ];
        // Must be the newest 4-part IMMUTABLE, NOT the old dali_2.5.28-a3ede24 the buggy regex chose.
        expect(pickFallbackTag(tags, 'latest')).to.equal('dali_2.5.29.10863-c9bd5b1');
    });

    it('sorts 4-part tags by BUILD number (newest build wins within a minor)', () => {
        const tags = ['dali_2.5.29.10708-aaaaaaa', 'dali_2.5.29.10863-bbbbbbb'];
        expect(pickFallbackTag(tags, 'latest')).to.equal('dali_2.5.29.10863-bbbbbbb');
    });

    it('classifies the 4-part pin as rolling and the 4-part -sha as immutable', () => {
        expect(isRollingTag('dali_2.5.29.10863')).to.equal(true);         // per-build pin (moves per ext-sha)
        expect(isRollingTag('dali_2.5.29.10863-c9bd5b1')).to.equal(false); // fully immutable
    });
});

const BART = 'ghcr-docker-remote.bart.sec.samsung.net';

describe('analyzePullError — cert / dns categories', () => {
    it('classifies a TLS-trust failure as a non-retryable cert error', () => {
        for (const msg of [
            'x509: certificate signed by unknown authority',
            'tls: failed to verify certificate',
            'certificate has expired',
        ]) {
            const a = analyzePullError(msg);
            expect(a.category, msg).to.equal('cert');
            expect(a.shouldRetry, msg).to.equal(false);
        }
    });

    it('classifies a DNS-resolution failure as a non-retryable dns error', () => {
        for (const msg of ['dial tcp: lookup ghcr.io: no such host', 'server misbehaving']) {
            const a = analyzePullError(msg);
            expect(a.category, msg).to.equal('dns');
            expect(a.shouldRetry, msg).to.equal(false);
        }
    });

    it('keeps the existing categories stable (auth beats network; notfound; unknown)', () => {
        expect(analyzePullError('failed to authorize').category).to.equal('auth');
        expect(analyzePullError('httpReadSeeker: failed open: failed to authorize').category).to.equal('auth');
        expect(analyzePullError('i/o timeout').category).to.equal('network');
        expect(analyzePullError('manifest unknown').category).to.equal('notfound');
        expect(analyzePullError('totally novel').category).to.equal('unknown');
    });
});

describe('describeFailure — host-aware WHY/FIX', () => {
    it('tells a BART-host cert failure to bypass the corporate proxy for .samsung.net', () => {
        const g = describeFailure('cert', BART);
        expect(g.fix).to.match(/\.samsung\.net/);
        expect(g.fix.toLowerCase()).to.match(/no_proxy|directly|proxy/);
    });

    it('tells a GHCR-host cert failure to install the proxy CA into the system store', () => {
        expect(describeFailure('cert', 'ghcr.io').fix.toLowerCase()).to.match(/ca|trust store|update-ca-certificates/);
    });

    it('tells a BART-host dns failure it is off the corp network/VPN', () => {
        expect(describeFailure('dns', BART).fix.toLowerCase()).to.match(/vpn|corporate network/);
    });

    it('advises picking another tag on notfound', () => {
        expect(describeFailure('notfound', 'ghcr.io').fix.toLowerCase()).to.match(/version|select runtime/);
    });
});

describe('buildDownloadFailureGuidance — names every server tried', () => {
    it('lists each registry with a WHY and a FIX, and mentions the local runtime', () => {
        const text = buildDownloadFailureGuidance([
            { label: 'BART proxy (Samsung internal)', host: BART, error: 'x509: certificate signed by unknown authority' },
            { label: 'GHCR (GitHub)', host: 'ghcr.io', error: 'dial tcp: i/o timeout' },
        ]);
        expect(text).to.match(/BART proxy \(Samsung internal\)/);
        expect(text).to.match(/GHCR \(GitHub\)/);
        expect(text).to.match(/Why:/);
        expect(text).to.match(/Fix:/);
        expect(text).to.match(/all failed/);
        expect(text.toLowerCase()).to.match(/local.*runtime/);
    });

    it('uses the singular "Tried:" header for a single attempt', () => {
        const text = buildDownloadFailureGuidance([
            { label: 'GHCR (GitHub)', host: 'ghcr.io', error: 'manifest unknown' },
        ]);
        expect(text).to.match(/Tried:/);
        expect(text).to.not.match(/registries/);
    });
});

describe('pullWithFallback — cross-registry fallback (via ensureRuntimeImageForTag)', () => {
    afterEach(() => sinon.restore());

    // Immutable tag → isRollingTag is false → no listRemoteTags (network) in the path;
    // only the cross-REGISTRY fallback is exercised.
    const IMMUTABLE = 'dali_2.5.28-9d55242';

    it('falls back to the alternate registry and aliases it to the primary name', async function () {
        this.timeout(8000);
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const altPull = sinon.stub().resolves(undefined);
        const alt = {
            getImageName: () => 'ghcr.io/test/dali-preview-runtime',
            imageRef: (t: string) => `ghcr.io/test/dali-preview-runtime:${t}`,
            pullImage: altPull,
        };
        const tagImage = sinon.stub().resolves(undefined);
        const primaryPull = sinon.stub().rejects(new Error('x509: certificate signed by unknown authority'));
        const rt = makeRuntime({
            getImageName: () => `${BART}/test/dali-preview-runtime`,
            imageRef: (t: string) => `${BART}/test/dali-preview-runtime:${t}`,
            hasImage: sinon.stub().resolves(false),
            pullImage: primaryPull,
            alternateRuntime: () => alt,
            tagImage,
        });

        const ok = await ensureRuntimeImageForTag(rt, IMMUTABLE, fakeOut);

        expect(ok).to.equal(true);
        expect(primaryPull.called).to.equal(true);
        expect(altPull.calledOnce).to.equal(true);
        expect(tagImage.calledOnce).to.equal(true);
        expect(tagImage.firstCall.args).to.deep.equal([
            `ghcr.io/test/dali-preview-runtime:${IMMUTABLE}`,
            `${BART}/test/dali-preview-runtime:${IMMUTABLE}`,
        ]);
    });

    it('returns false when BOTH registries fail (no alias attempted)', async function () {
        this.timeout(8000);
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const alt = {
            getImageName: () => 'ghcr.io/test/dali-preview-runtime',
            imageRef: (t: string) => `ghcr.io/test/dali-preview-runtime:${t}`,
            pullImage: sinon.stub().rejects(new Error('dial tcp: lookup ghcr.io: no such host')),
        };
        const tagImage = sinon.stub().resolves(undefined);
        const rt = makeRuntime({
            getImageName: () => `${BART}/test/dali-preview-runtime`,
            imageRef: (t: string) => `${BART}/test/dali-preview-runtime:${t}`,
            hasImage: sinon.stub().resolves(false),
            pullImage: sinon.stub().rejects(new Error('x509: certificate signed by unknown authority')),
            alternateRuntime: () => alt,
            tagImage,
        });

        const ok = await ensureRuntimeImageForTag(rt, IMMUTABLE, fakeOut);

        expect(ok).to.equal(false);
        expect(tagImage.called).to.equal(false);
    });

    it('does not attempt fallback when the runtime has no alternate registry', async function () {
        this.timeout(8000);
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRuntime({
            pullImage: sinon.stub().rejects(new Error('x509: certificate signed by unknown authority')),
        });
        const ok = await ensureRuntimeImageForTag(rt, IMMUTABLE, fakeOut);
        expect(ok).to.equal(false);
    });

    it('tries the BART mirror FIRST when configured is ghcr.io (no wasted ghcr.io attempt)', async function () {
        this.timeout(8000);
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const ghcrPull = sinon.stub().resolves(undefined); // would work, but must NOT be reached first
        const bartPull = sinon.stub().resolves(undefined); // BART succeeds
        const bart = {
            getImageName: () => `${BART}/test/dali-preview-runtime`,
            imageRef: (t: string) => `${BART}/test/dali-preview-runtime:${t}`,
            pullImage: bartPull,
        };
        const tagImage = sinon.stub().resolves(undefined);
        const rt = makeRuntime({
            getImageName: () => 'ghcr.io/test/dali-preview-runtime',
            imageRef: (t: string) => `ghcr.io/test/dali-preview-runtime:${t}`,
            hasImage: sinon.stub().resolves(false),
            pullImage: ghcrPull,
            alternateRuntime: () => bart,
            tagImage,
        });
        const ok = await ensureRuntimeImageForTag(rt, IMMUTABLE, fakeOut);
        expect(ok).to.equal(true);
        expect(bartPull.calledOnce).to.equal(true);   // BART tried first and won
        expect(ghcrPull.called).to.equal(false);      // ghcr.io never reached
        expect(tagImage.firstCall.args).to.deep.equal([
            `${BART}/test/dali-preview-runtime:${IMMUTABLE}`,
            `ghcr.io/test/dali-preview-runtime:${IMMUTABLE}`,
        ]);
    });

    it('does ONE attempt per host then immediately falls back (no 3x same-host retry)', async function () {
        this.timeout(8000);
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const bartPull = sinon.stub().rejects(new Error('read: connection reset by peer')); // transient
        const ghcrPull = sinon.stub().resolves(undefined);
        const ghcr = {
            getImageName: () => 'ghcr.io/test/dali-preview-runtime',
            imageRef: (t: string) => `ghcr.io/test/dali-preview-runtime:${t}`,
            pullImage: ghcrPull,
        };
        const rt = makeRuntime({
            getImageName: () => `${BART}/test/dali-preview-runtime`,
            imageRef: (t: string) => `${BART}/test/dali-preview-runtime:${t}`,
            hasImage: sinon.stub().resolves(false),
            pullImage: bartPull,
            alternateRuntime: () => ghcr,
            tagImage: sinon.stub().resolves(undefined),
        });
        const ok = await ensureRuntimeImageForTag(rt, IMMUTABLE, fakeOut);
        expect(ok).to.equal(true);
        expect(bartPull.calledOnce).to.equal(true);   // ONE BART attempt (not 3)
        expect(ghcrPull.calledOnce).to.equal(true);   // immediate fallback to ghcr.io
    });
});
