import { expect } from 'chai';
import { validateEnvironment, EnvironmentIssue } from '../../src/daliEnvironment';

// All tests inject fake deps to avoid spawning real shell commands.
const ALL_PRESENT = { gcc: true, xvfb: true, ccache: false, pkgconfig: true };

describe('daliEnvironment', () => {
    describe('validateEnvironment()', () => {
        it('returns no issues when all required deps are present and dali prefix is set', async () => {
            const issues = await validateEnvironment('/some/dali/prefix', ALL_PRESENT);
            expect(issues).to.have.length(0);
        });

        it('reports missing_dali when dali prefix is null', async () => {
            const issues = await validateEnvironment(null, ALL_PRESENT);
            const daliIssue = issues.find((i: EnvironmentIssue) => i.kind === 'missing_dali');
            expect(daliIssue).to.exist;
        });

        it('reports missing_dep for gcc when gcc is not found', async () => {
            const deps = { ...ALL_PRESENT, gcc: false };
            const issues = await validateEnvironment('/some/dali/prefix', deps);
            const gccIssue = issues.find((i: EnvironmentIssue) => i.message.includes('g++'));
            expect(gccIssue).to.exist;
            expect(gccIssue!.kind).to.equal('missing_dep');
        });

        it('reports missing_dep for pkg-config when pkg-config is not found', async () => {
            const deps = { ...ALL_PRESENT, pkgconfig: false };
            const issues = await validateEnvironment('/some/dali/prefix', deps);
            const pkgIssue = issues.find((i: EnvironmentIssue) => i.message.includes('pkg-config'));
            expect(pkgIssue).to.exist;
            expect(pkgIssue!.kind).to.equal('missing_dep');
        });

        it('reports missing_dep for Xvfb when Xvfb is not found', async () => {
            const deps = { ...ALL_PRESENT, xvfb: false };
            const issues = await validateEnvironment('/some/dali/prefix', deps);
            const xvfbIssue = issues.find((i: EnvironmentIssue) => i.message.includes('Xvfb'));
            expect(xvfbIssue).to.exist;
            expect(xvfbIssue!.kind).to.equal('missing_dep');
        });

        it('each issue has a non-empty action field', async () => {
            const deps = { gcc: false, xvfb: false, ccache: false, pkgconfig: false };
            const issues = await validateEnvironment(null, deps);
            expect(issues.length).to.be.greaterThan(0);
            for (const issue of issues) {
                expect(issue.action).to.be.a('string').and.have.length.greaterThan(0);
            }
        });

        it('ccache absence does not produce an issue', async () => {
            const deps = { ...ALL_PRESENT, ccache: false };
            const issues = await validateEnvironment('/some/dali/prefix', deps);
            const ccacheIssue = issues.find((i: EnvironmentIssue) => i.message.includes('ccache'));
            expect(ccacheIssue).to.be.undefined;
        });
    });
});
