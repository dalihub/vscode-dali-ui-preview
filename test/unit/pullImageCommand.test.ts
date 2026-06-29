import { expect } from 'chai';
import * as sinon from 'sinon';
import * as dockerAccessCheck from '../../src/dockerAccessCheck';
import { ensureRuntimeImage, pullRuntimeImageCommand, formatPullMessage, analyzePullError } from '../../src/pullImageCommand';

const fakeOut = { appendLine: () => {}, append: () => {}, show: () => {}, dispose: () => {} } as any;

function makeRuntime(over: Record<string, any> = {}) {
    return {
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
