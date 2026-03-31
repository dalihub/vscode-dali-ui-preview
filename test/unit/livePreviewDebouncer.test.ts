import { expect } from 'chai';
import * as sinon from 'sinon';
import { LivePreviewDebouncer } from '../../src/livePreviewDebouncer';

describe('LivePreviewDebouncer', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it('calls trigger after debounce ms', () => {
        const spy = sinon.spy();
        const debouncer = new LivePreviewDebouncer<string>(300, spy);

        debouncer.schedule('hello');
        expect(spy.callCount).to.equal(0);

        clock.tick(299);
        expect(spy.callCount).to.equal(0);

        clock.tick(1);
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal('hello');

        debouncer.dispose();
    });

    it('resets timer on repeated schedule calls (debounce behavior)', () => {
        const spy = sinon.spy();
        const debouncer = new LivePreviewDebouncer<string>(300, spy);

        debouncer.schedule('first');
        clock.tick(200);
        debouncer.schedule('second');
        clock.tick(200);
        expect(spy.callCount).to.equal(0);

        clock.tick(100);
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal('second');

        debouncer.dispose();
    });

    it('does not call trigger if cancelled before debounce ms', () => {
        const spy = sinon.spy();
        const debouncer = new LivePreviewDebouncer<string>(300, spy);

        debouncer.schedule('hello');
        clock.tick(150);
        debouncer.cancel();
        clock.tick(300);

        expect(spy.callCount).to.equal(0);
        debouncer.dispose();
    });

    it('isPending returns true while waiting, false after trigger fires', () => {
        const debouncer = new LivePreviewDebouncer<number>(300, () => { /* noop */ });

        expect(debouncer.isPending).to.equal(false);
        debouncer.schedule(1);
        expect(debouncer.isPending).to.equal(true);

        clock.tick(300);
        expect(debouncer.isPending).to.equal(false);

        debouncer.dispose();
    });

    it('isPending returns false after cancel', () => {
        const debouncer = new LivePreviewDebouncer<number>(300, () => { /* noop */ });

        debouncer.schedule(1);
        expect(debouncer.isPending).to.equal(true);

        debouncer.cancel();
        expect(debouncer.isPending).to.equal(false);

        debouncer.dispose();
    });

    it('dispose cancels pending trigger', () => {
        const spy = sinon.spy();
        const debouncer = new LivePreviewDebouncer<string>(300, spy);

        debouncer.schedule('hello');
        debouncer.dispose();
        clock.tick(500);

        expect(spy.callCount).to.equal(0);
    });

    it('setDebounceMs updates the delay for subsequent schedules', () => {
        const spy = sinon.spy();
        const debouncer = new LivePreviewDebouncer<string>(300, spy);

        debouncer.setDebounceMs(100);
        debouncer.schedule('fast');
        clock.tick(100);

        expect(spy.callCount).to.equal(1);
        debouncer.dispose();
    });

    it('calls trigger with the most recently scheduled value', () => {
        const spy = sinon.spy();
        const debouncer = new LivePreviewDebouncer<number>(300, spy);

        debouncer.schedule(1);
        debouncer.schedule(2);
        debouncer.schedule(3);
        clock.tick(300);

        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal(3);

        debouncer.dispose();
    });

    it('can schedule again after trigger fires', () => {
        const spy = sinon.spy();
        const debouncer = new LivePreviewDebouncer<string>(300, spy);

        debouncer.schedule('first');
        clock.tick(300);
        expect(spy.callCount).to.equal(1);

        debouncer.schedule('second');
        clock.tick(300);
        expect(spy.callCount).to.equal(2);
        expect(spy.secondCall.args[0]).to.equal('second');

        debouncer.dispose();
    });
});
