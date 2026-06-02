import { expect } from 'chai';
import * as sinon from 'sinon';
import * as dockerAccessCheck from '../../src/dockerAccessCheck';
import { ensureRuntimeImage, pullRuntimeImageCommand } from '../../src/pullImageCommand';

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
