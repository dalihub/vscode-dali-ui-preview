import { expect } from 'chai';
import { buildIssueBody, buildIssueUrl, IssueEnv } from '../../src/reportIssueCommand';

const ENV: IssueEnv = {
    extensionVersion: '0.49.0',
    vscodeVersion: '1.90.0',
    os: 'linux 6.8.0 x64',
    runtimeMode: 'docker',
    runtimeImage: 'ghcr.io/dalihub/dali-preview-runtime:latest',
};

describe('reportIssue: buildIssueBody', () => {
    it('includes the auto-collected environment footer', () => {
        const b = buildIssueBody(ENV);
        expect(b).to.contain('dali-preview v0.49.0');
        expect(b).to.contain('VS Code: 1.90.0');
        expect(b).to.contain('Runtime mode: docker');
        expect(b).to.contain('ghcr.io/dalihub/dali-preview-runtime:latest');
    });
    it('embeds the error context when one is given (failure-toast path)', () => {
        expect(buildIssueBody(ENV, 'Render failed: boom')).to.contain('Render failed: boom');
    });
});

describe('reportIssue: buildIssueUrl', () => {
    it('builds a GitHub new-issue URL with encoded title/body + the bug label', () => {
        const url = buildIssueUrl('[bug] x', buildIssueBody(ENV));
        expect(url).to.match(/^https:\/\/github\.com\/dalihub\/vscode-dali-ui-preview\/issues\/new\?/);
        expect(url).to.contain('labels=bug');
        expect(url).to.contain('title=' + encodeURIComponent('[bug] x'));
        expect(decodeURIComponent(url)).to.contain('dali-preview v0.49.0');
    });
    it('trims to the env footer when a huge error would overflow the URL', () => {
        const url = buildIssueUrl('[bug] big', buildIssueBody(ENV, 'x'.repeat(20000)));
        expect(url.length).to.be.lessThan(7001);
        expect(decodeURIComponent(url)).to.contain('Runtime mode: docker'); // footer kept
    });
});
