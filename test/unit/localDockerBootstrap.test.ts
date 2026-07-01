import { expect } from 'chai';
import * as sinon from 'sinon';
import {
    decideLocalVersionAction,
    decideInstallAction,
    runLocalDockerBootstrap,
    LocalDockerBootstrapDeps,
} from '../../src/localDockerBootstrap';

describe('decideLocalVersionAction', () => {
    it('returns list-and-switch when docker is ok', () => {
        expect(decideLocalVersionAction({ accessState: 'ok' })).to.equal('list-and-switch');
    });
    it('returns setup-then-switch for every not-ok state', () => {
        for (const s of ['docker-not-installed', 'daemon-not-running', 'permission-denied', 'unknown-error']) {
            expect(decideLocalVersionAction({ accessState: s })).to.equal('setup-then-switch');
        }
    });
});

describe('decideInstallAction', () => {
    it('routes docker-not-installed to a fresh install', () => {
        expect(decideInstallAction('docker-not-installed')).to.equal('install');
    });
    it('routes daemon/permission problems to guidance (docker already present)', () => {
        expect(decideInstallAction('daemon-not-running')).to.equal('guidance');
        expect(decideInstallAction('permission-denied')).to.equal('guidance');
    });
});

describe('runLocalDockerBootstrap', () => {
    function makeDeps(over: Partial<LocalDockerBootstrapDeps> = {}): LocalDockerBootstrapDeps {
        return {
            accessState: 'docker-not-installed',
            currentTag: 'dali_2.5.26',
            listRemoteVersions: sinon.stub().resolves(['latest', 'dali_2.5.26']),
            pickVersion: sinon.stub().resolves('latest'),
            confirmSetup: sinon.stub().resolves(true),
            confirmOfflineFallback: sinon.stub().resolves(true),
            beginInstall: sinon.stub().resolves(undefined),
            waitForDockerReady: sinon.stub().resolves('ok'),
            pullImage: sinon.stub().resolves(true),
            persistDockerMode: sinon.stub().resolves(undefined),
            reload: sinon.stub().resolves(undefined),
            warn: sinon.stub().resolves(undefined),
            ...over,
        };
    }
    afterEach(() => sinon.restore());

    it('happy path: pick → install → wait → pull → persist(tag) → reload', async () => {
        const deps = makeDeps();
        const outcome = await runLocalDockerBootstrap(deps);
        expect(outcome).to.equal('switched');
        expect((deps.beginInstall as sinon.SinonStub).calledOnceWith('docker-not-installed')).to.equal(true);
        expect((deps.pullImage as sinon.SinonStub).calledOnceWith('latest')).to.equal(true);
        expect((deps.persistDockerMode as sinon.SinonStub).calledOnceWith('latest')).to.equal(true);
        expect((deps.reload as sinon.SinonStub).calledOnce).to.equal(true);
        // persist must happen before reload
        expect((deps.persistDockerMode as sinon.SinonStub).calledBefore(deps.reload as sinon.SinonStub)).to.equal(true);
    });

    it('cancelled picker: no install, no persist, no reload', async () => {
        const deps = makeDeps({ pickVersion: sinon.stub().resolves(undefined) });
        expect(await runLocalDockerBootstrap(deps)).to.equal('cancelled-pick');
        expect((deps.beginInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
        expect((deps.reload as sinon.SinonStub).called).to.equal(false);
    });

    it('declined confirm: stops before install', async () => {
        const deps = makeDeps({ confirmSetup: sinon.stub().resolves(false) });
        expect(await runLocalDockerBootstrap(deps)).to.equal('declined');
        expect((deps.beginInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
    });

    it('poller gives up: warns, stays local (no persist/reload)', async () => {
        const deps = makeDeps({ waitForDockerReady: sinon.stub().resolves('gaveup') });
        expect(await runLocalDockerBootstrap(deps)).to.equal('setup-gaveup');
        expect((deps.pullImage as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
        expect((deps.reload as sinon.SinonStub).called).to.equal(false);
        expect((deps.warn as sinon.SinonStub).calledOnce).to.equal(true);
    });

    it('pull fails: warns, does NOT switch mode', async () => {
        const deps = makeDeps({ pullImage: sinon.stub().resolves(false) });
        expect(await runLocalDockerBootstrap(deps)).to.equal('pull-failed');
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
        expect((deps.reload as sinon.SinonStub).called).to.equal(false);
        expect((deps.warn as sinon.SinonStub).calledOnce).to.equal(true);
    });

    it('offline (no remote versions) + fallback accepted: installs with current tag', async () => {
        const deps = makeDeps({
            listRemoteVersions: sinon.stub().resolves([]),
            confirmOfflineFallback: sinon.stub().resolves(true),
        });
        expect(await runLocalDockerBootstrap(deps)).to.equal('switched');
        expect((deps.pickVersion as sinon.SinonStub).called).to.equal(false);
        expect((deps.pullImage as sinon.SinonStub).calledOnceWith('dali_2.5.26')).to.equal(true);
        expect((deps.persistDockerMode as sinon.SinonStub).calledOnceWith('dali_2.5.26')).to.equal(true);
    });

    it('offline + fallback declined: no-versions, nothing changes', async () => {
        const deps = makeDeps({
            listRemoteVersions: sinon.stub().resolves([]),
            confirmOfflineFallback: sinon.stub().resolves(false),
        });
        expect(await runLocalDockerBootstrap(deps)).to.equal('no-versions');
        expect((deps.beginInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
    });
});
