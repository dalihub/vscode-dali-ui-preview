import { expect } from 'chai';
import * as sinon from 'sinon';
import * as dockerAccessCheck from '../../src/dockerAccessCheck';
import { DockerAccessPoller } from '../../src/dockerAccessPoller';

describe('DockerAccessPoller', () => {
    let clock: sinon.SinonFakeTimers;
    let probe: sinon.SinonStub;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
        probe = sinon.stub(dockerAccessCheck, 'checkDockerAccess');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('fires onOk once and stops when docker access becomes ok', async () => {
        probe.resolves({ state: 'ok' } as any);
        const onOk = sinon.stub();
        const poller = new DockerAccessPoller({ intervalMs: 2000, onOk });

        poller.start();
        await clock.tickAsync(1);

        expect(onOk.calledOnce).to.equal(true);
        expect(poller.isRunning).to.equal(false);
    });

    it('keeps polling until ok, then fires onOk', async () => {
        probe.onCall(0).resolves({ state: 'permission-denied' } as any);
        probe.onCall(1).resolves({ state: 'permission-denied' } as any);
        probe.onCall(2).resolves({ state: 'ok' } as any);
        const onOk = sinon.stub();
        const poller = new DockerAccessPoller({ intervalMs: 2000, onOk });

        poller.start();
        await clock.tickAsync(1);      // attempt 1 (scheduled at 0)
        await clock.tickAsync(2000);   // attempt 2
        await clock.tickAsync(2000);   // attempt 3 -> ok

        expect(probe.callCount).to.equal(3);
        expect(onOk.calledOnce).to.equal(true);
    });

    it('does not fire onOk if stopped while a probe is in flight', async () => {
        let resolveProbe: (v: any) => void = () => {};
        probe.returns(new Promise((r) => { resolveProbe = r; }));
        const onOk = sinon.stub();
        const poller = new DockerAccessPoller({ intervalMs: 2000, onOk });

        poller.start();
        await clock.tickAsync(1);   // tick begins, awaits the pending probe
        poller.stop();
        resolveProbe({ state: 'ok' });
        await clock.tickAsync(1);

        expect(onOk.called).to.equal(false);
    });

    it('gives up after maxAttempts, firing onGiveUp (not onOk)', async () => {
        probe.resolves({ state: 'permission-denied' } as any);
        const onOk = sinon.stub();
        const onGiveUp = sinon.stub();
        const poller = new DockerAccessPoller({ intervalMs: 2000, maxAttempts: 3, onOk, onGiveUp });

        poller.start();
        await clock.tickAsync(1);
        await clock.tickAsync(2000);
        await clock.tickAsync(2000);
        await clock.tickAsync(2000);   // would be attempt 4 — must not happen

        expect(probe.callCount).to.equal(3);
        expect(onOk.called).to.equal(false);
        expect(onGiveUp.calledOnce).to.equal(true);
        expect(poller.isRunning).to.equal(false);
    });

    it('calls onTick before each probe with (attempt, maxAttempts)', async () => {
        probe.resolves({ state: 'permission-denied' } as any);
        const onTick = sinon.stub();
        const poller = new DockerAccessPoller({ intervalMs: 2000, maxAttempts: 3, onOk: sinon.stub(), onTick });

        poller.start();
        await clock.tickAsync(1);
        await clock.tickAsync(2000);

        expect(onTick.callCount).to.equal(2);
        expect(onTick.firstCall.args).to.deep.equal([1, 3]);
        expect(onTick.secondCall.args).to.deep.equal([2, 3]);
    });

    it('start() while already running is a no-op', async () => {
        probe.resolves({ state: 'permission-denied' } as any);
        const poller = new DockerAccessPoller({ intervalMs: 2000, onOk: sinon.stub() });

        poller.start();
        poller.start();   // second start must not add a second timer chain
        await clock.tickAsync(1);

        expect(probe.callCount).to.equal(1);
    });
});
