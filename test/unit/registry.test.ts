import { expect } from 'chai';
import {
    GHCR_HOST,
    BART_PROXY_HOST,
    IMAGE_REPO_PATH,
    GHCR_IMAGE,
    BART_PROXY_IMAGE,
    alternateImage,
    describeRegistry,
} from '../../src/registry';

describe('registry', () => {
    it('composes the GHCR and BART proxy images from the shared repo path', () => {
        expect(GHCR_IMAGE).to.equal(`${GHCR_HOST}/${IMAGE_REPO_PATH}`);
        expect(BART_PROXY_IMAGE).to.equal(`${BART_PROXY_HOST}/${IMAGE_REPO_PATH}`);
    });

    it('differs only in the host — the repo path is identical, so switching is a prefix swap', () => {
        expect(GHCR_IMAGE.slice(GHCR_HOST.length)).to.equal(BART_PROXY_IMAGE.slice(BART_PROXY_HOST.length));
        expect(GHCR_IMAGE.slice(GHCR_HOST.length)).to.equal(`/${IMAGE_REPO_PATH}`);
    });
});

describe('registry.alternateImage — cross-registry counterpart', () => {
    it('maps the BART proxy image to its GHCR counterpart (same repo path)', () => {
        expect(alternateImage(BART_PROXY_IMAGE)).to.equal(GHCR_IMAGE);
    });

    it('maps the GHCR image to its BART proxy counterpart (same repo path)', () => {
        expect(alternateImage(GHCR_IMAGE)).to.equal(BART_PROXY_IMAGE);
    });

    it('preserves the repo path and swaps only the host', () => {
        expect(alternateImage(`${GHCR_HOST}/foo/bar`)).to.equal(`${BART_PROXY_HOST}/foo/bar`);
        expect(alternateImage(`${BART_PROXY_HOST}/foo/bar`)).to.equal(`${GHCR_HOST}/foo/bar`);
    });

    it('returns undefined for a custom/unknown registry (no known counterpart)', () => {
        expect(alternateImage('docker.io/library/ubuntu')).to.equal(undefined);
        expect(alternateImage('registry.example.com/team/img')).to.equal(undefined);
    });

    it('returns undefined for a bare name with no host segment', () => {
        expect(alternateImage('ubuntu')).to.equal(undefined);
    });

    it('round-trips: alternate(alternate(x)) === x for both known hosts', () => {
        expect(alternateImage(alternateImage(GHCR_IMAGE)!)).to.equal(GHCR_IMAGE);
        expect(alternateImage(alternateImage(BART_PROXY_IMAGE)!)).to.equal(BART_PROXY_IMAGE);
    });
});

describe('registry.describeRegistry — human label for the download source', () => {
    it('labels the BART proxy and GHCR hosts, and echoes an unknown host', () => {
        expect(describeRegistry(BART_PROXY_IMAGE).label).to.match(/BART/);
        expect(describeRegistry(GHCR_IMAGE).label).to.match(/GHCR/);
        expect(describeRegistry('registry.example.com/x').host).to.equal('registry.example.com');
    });
});
