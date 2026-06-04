import { expect } from 'chai';
import { listRemoteTags } from '../../src/registryClient';

describe('registryClient — listRemoteTags', () => {
    // Only the non-network branches are unit-tested; the real ghcr.io token +
    // tags/list flow is covered manually/integration (it hits the network).
    it('returns [] for a non-ghcr registry (no network call)', async () => {
        expect(await listRemoteTags('docker.io/library/alpine')).to.deep.equal([]);
    });

    it('returns [] for an imageName with no registry host', async () => {
        expect(await listRemoteTags('noslash')).to.deep.equal([]);
    });
});
