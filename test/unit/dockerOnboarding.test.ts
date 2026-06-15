import { expect } from 'chai';
import * as sinon from 'sinon';
import {
    classifyOnboarding,
    maybeRunFirstRunDockerSetup,
    FirstRunDockerSetupDeps,
} from '../../src/dockerOnboarding';

describe('classifyOnboarding', () => {
    it('returns need-docker when docker is unreachable', () => {
        expect(classifyOnboarding({ dockerAccessOk: false, hasImage: false }))
            .to.equal('need-docker');
    });

    it('returns need-image when docker is ok but the image is missing', () => {
        expect(classifyOnboarding({ dockerAccessOk: true, hasImage: false }))
            .to.equal('need-image');
    });

    it('returns already-set-up when docker and image are both present', () => {
        expect(classifyOnboarding({ dockerAccessOk: true, hasImage: true }))
            .to.equal('already-set-up');
    });
});

describe('maybeRunFirstRunDockerSetup', () => {
    function makeDeps(over: Partial<FirstRunDockerSetupDeps> = {}): FirstRunDockerSetupDeps {
        return {
            daliVersionTag: 'latest',
            alreadyShown: false,
            checkAccess: sinon.stub().resolves({ state: 'docker-not-installed' }),
            hasImage: sinon.stub().resolves(false),
            markShown: sinon.stub().resolves(undefined),
            confirmInstall: sinon.stub().resolves(true),
            installDocker: sinon.stub().resolves(undefined),
            ...over,
        };
    }

    afterEach(() => sinon.restore());

    it('does nothing when the prompt was already shown', async () => {
        const deps = makeDeps({ alreadyShown: true });
        const state = await maybeRunFirstRunDockerSetup(deps);
        expect(state).to.equal('already-shown');
        expect((deps.checkAccess as sinon.SinonStub).called).to.equal(false);
        expect((deps.markShown as sinon.SinonStub).called).to.equal(false);
    });

    it('prompts and installs when docker is missing and the user consents', async () => {
        const deps = makeDeps({
            checkAccess: sinon.stub().resolves({ state: 'docker-not-installed' }),
            confirmInstall: sinon.stub().resolves(true),
        });
        const state = await maybeRunFirstRunDockerSetup(deps);
        expect(state).to.equal('need-docker');
        expect((deps.markShown as sinon.SinonStub).calledOnce).to.equal(true);
        expect((deps.installDocker as sinon.SinonStub).calledOnce).to.equal(true);
    });

    it('prompts but does not install when the user declines', async () => {
        const deps = makeDeps({
            checkAccess: sinon.stub().resolves({ state: 'docker-not-installed' }),
            confirmInstall: sinon.stub().resolves(false),
        });
        const state = await maybeRunFirstRunDockerSetup(deps);
        expect(state).to.equal('need-docker');
        // Still marked shown so we don't nag on every startup.
        expect((deps.markShown as sinon.SinonStub).calledOnce).to.equal(true);
        expect((deps.installDocker as sinon.SinonStub).called).to.equal(false);
    });

    it('does not prompt when docker is ready but the image is missing (auto-pull elsewhere)', async () => {
        const deps = makeDeps({
            checkAccess: sinon.stub().resolves({ state: 'ok' }),
            hasImage: sinon.stub().resolves(false),
        });
        const state = await maybeRunFirstRunDockerSetup(deps);
        expect(state).to.equal('need-image');
        expect((deps.confirmInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.installDocker as sinon.SinonStub).called).to.equal(false);
        expect((deps.markShown as sinon.SinonStub).calledOnce).to.equal(true);
    });

    it('does nothing visible when docker and image are already present', async () => {
        const deps = makeDeps({
            checkAccess: sinon.stub().resolves({ state: 'ok' }),
            hasImage: sinon.stub().resolves(true),
        });
        const state = await maybeRunFirstRunDockerSetup(deps);
        expect(state).to.equal('already-set-up');
        expect((deps.confirmInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.markShown as sinon.SinonStub).calledOnce).to.equal(true);
    });
});
