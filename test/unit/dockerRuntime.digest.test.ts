import { expect } from 'chai';
import * as sinon from 'sinon';
import { DockerRuntime, parseRepoDigest, extractManifestDigest, parseLocalImageTags } from '../../src/dockerRuntime';

const SHA = (c: string) => 'sha256:' + c.repeat(64);

describe('dockerRuntime — digest helpers', () => {
    describe('parseRepoDigest', () => {
        it('extracts the sha256 from a repo@sha256 string', () => {
            expect(parseRepoDigest('ghcr.io/x/y@' + SHA('a'))).to.equal(SHA('a'));
        });
        it('returns undefined when there is no @ (e.g. "<no value>" / empty)', () => {
            expect(parseRepoDigest('<no value>')).to.equal(undefined);
            expect(parseRepoDigest('')).to.equal(undefined);
        });
        it('returns undefined for a malformed digest', () => {
            expect(parseRepoDigest('repo@notadigest')).to.equal(undefined);
        });
    });

    describe('extractManifestDigest', () => {
        it('reads .Descriptor.digest from a single object', () => {
            expect(extractManifestDigest(JSON.stringify({ Descriptor: { digest: SHA('b') } })))
                .to.equal(SHA('b'));
        });
        it('reads from the first entry of an array (multi-arch)', () => {
            expect(extractManifestDigest(JSON.stringify([{ Descriptor: { digest: SHA('c') } }])))
                .to.equal(SHA('c'));
        });
        it('returns undefined on invalid JSON or unexpected shape', () => {
            expect(extractManifestDigest('not json')).to.equal(undefined);
            expect(extractManifestDigest('{}')).to.equal(undefined);
        });
    });

    describe('isUpdateAvailable', () => {
        afterEach(() => sinon.restore());

        it('true when local and remote digests differ', async () => {
            const rt = new DockerRuntime('ghcr.io/test/img');
            sinon.stub(rt, 'getLocalDigest').resolves(SHA('a'));
            sinon.stub(rt, 'getRemoteDigest').resolves(SHA('b'));
            expect(await rt.isUpdateAvailable('latest')).to.equal(true);
        });

        it('false when digests are equal', async () => {
            const rt = new DockerRuntime('ghcr.io/test/img');
            sinon.stub(rt, 'getLocalDigest').resolves(SHA('a'));
            sinon.stub(rt, 'getRemoteDigest').resolves(SHA('a'));
            expect(await rt.isUpdateAvailable('latest')).to.equal(false);
        });

        it('false when either digest is unavailable (offline / not cached)', async () => {
            const rt = new DockerRuntime('ghcr.io/test/img');
            sinon.stub(rt, 'getLocalDigest').resolves(SHA('a'));
            sinon.stub(rt, 'getRemoteDigest').resolves(undefined);
            expect(await rt.isUpdateAvailable('latest')).to.equal(false);

            const rt2 = new DockerRuntime('ghcr.io/test/img');
            sinon.stub(rt2, 'getLocalDigest').resolves(undefined);
            sinon.stub(rt2, 'getRemoteDigest').resolves(SHA('b'));
            expect(await rt2.isUpdateAvailable('latest')).to.equal(false);
        });
    });
});

describe('dockerRuntime — parseLocalImageTags', () => {
    it('splits lines, trims, and preserves order', () => {
        expect(parseLocalImageTags('latest\ndali_2.5.24\ndali_2.5.18\n'))
            .to.deep.equal(['latest', 'dali_2.5.24', 'dali_2.5.18']);
    });
    it('drops <none> and blank lines', () => {
        expect(parseLocalImageTags('latest\n<none>\n\n  \ndali_2.5.24\n'))
            .to.deep.equal(['latest', 'dali_2.5.24']);
    });
    it('de-duplicates while keeping first occurrence', () => {
        expect(parseLocalImageTags('latest\ndali_2.5.24\nlatest\n'))
            .to.deep.equal(['latest', 'dali_2.5.24']);
    });
    it('returns [] for empty output', () => {
        expect(parseLocalImageTags('')).to.deep.equal([]);
    });
});
