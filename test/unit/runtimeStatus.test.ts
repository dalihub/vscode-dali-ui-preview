import { expect } from 'chai';
import { computeVerdict, noProxyCoversInternal, formatRuntimeStatus, RuntimeStatus } from '../../src/runtimeStatus';

const BART = 'ghcr-docker-remote.bart.sec.samsung.net';
const GHCR = 'ghcr.io';

describe('runtimeStatus.noProxyCoversInternal', () => {
    it('true when .samsung.net is present', () => {
        expect(noProxyCoversInternal('.samsung.net,localhost,127.0.0.1')).to.equal(true);
        expect(noProxyCoversInternal('localhost,samsung.net')).to.equal(true);
    });
    it('false when internal is not covered', () => {
        expect(noProxyCoversInternal('localhost,127.0.0.1')).to.equal(false);
        expect(noProxyCoversInternal('')).to.equal(false);
    });
});

describe('runtimeStatus.computeVerdict (daemon-reality truth table)', () => {
    it('daemon unreachable → error (regardless of the rest)', () => {
        const v = computeVerdict({ daemonReachable: false, installed: false, host: BART, daemonHasProxy: false, noProxyCoversInternal: false });
        expect(v.level).to.equal('error');
    });

    it('already installed → ok (no download needed)', () => {
        const v = computeVerdict({ daemonReachable: true, installed: true, host: GHCR, daemonHasProxy: false, noProxyCoversInternal: false });
        expect(v.level).to.equal('ok');
        expect(v.headline.toLowerCase()).to.contain('installed');
    });

    it('BART primary, not installed, no daemon proxy → ok (BART needs no proxy)', () => {
        const v = computeVerdict({ daemonReachable: true, installed: false, host: BART, daemonHasProxy: false, noProxyCoversInternal: false });
        expect(v.level).to.equal('ok');
    });

    it('BART primary but daemon proxy does NOT bypass internal → warn', () => {
        const v = computeVerdict({ daemonReachable: true, installed: false, host: BART, daemonHasProxy: true, noProxyCoversInternal: false });
        expect(v.level).to.equal('warn');
        expect(v.detail).to.contain('.samsung.net');
    });

    it('GHCR primary, not installed, NO daemon proxy → warn (the colleague failure)', () => {
        const v = computeVerdict({ daemonReachable: true, installed: false, host: GHCR, daemonHasProxy: false, noProxyCoversInternal: false });
        expect(v.level).to.equal('warn');
        expect(v.headline.toLowerCase()).to.contain('fail');
        expect(v.detail.toLowerCase()).to.contain('proxy');
    });

    it('GHCR primary, not installed, daemon HAS proxy → ok (pulls via proxy)', () => {
        const v = computeVerdict({ daemonReachable: true, installed: false, host: GHCR, daemonHasProxy: true, noProxyCoversInternal: true });
        expect(v.level).to.equal('ok');
    });
});

describe('runtimeStatus.formatRuntimeStatus', () => {
    it('renders the key fields + verdict', () => {
        const s: RuntimeStatus = {
            mode: 'docker',
            daemonReachable: true,
            daemonVersion: '24.0.7',
            imageName: `${GHCR}/lwc0917/dali-preview-runtime`,
            host: GHCR,
            registryLabel: 'GHCR (GitHub)',
            tag: 'latest',
            installed: false,
            daemonProxy: { http: '', https: '', noProxy: '' },
            verdict: { level: 'warn', headline: 'X will likely FAIL', detail: 'configure the daemon proxy' },
        };
        const out = formatRuntimeStatus(s);
        expect(out).to.contain('Runtime Status');
        expect(out).to.contain('latest');
        expect(out).to.contain(GHCR);
        expect(out).to.contain('NONE'); // no daemon proxy line
        expect(out).to.contain('will likely FAIL');
    });
});
