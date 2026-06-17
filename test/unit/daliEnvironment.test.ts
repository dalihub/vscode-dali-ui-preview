import { expect } from 'chai';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { validateDaliPrefix, validateEnvironment, resolveDaliPrefix, findDaliPrefix } from '../../src/daliEnvironment';

describe('daliEnvironment.findDaliPrefix() — priority', () => {
    const realGetConfiguration = vscode.workspace.getConfiguration;
    afterEach(() => { (vscode.workspace as any).getConfiguration = realGetConfiguration; });

    it('returns the explicit daliPreview.daliPrefix setting first (highest priority)', async () => {
        (vscode.workspace as any).getConfiguration = () => ({
            get: (key: string, dflt: any) => (key === 'daliPrefix' ? '/custom/dali/prefix' : dflt),
            update: () => Promise.resolve(),
        });
        // Explicit setting short-circuits before any env / system probing.
        expect(await findDaliPrefix()).to.equal('/custom/dali/prefix');
    });
});

describe('daliEnvironment.validateDaliPrefix()', () => {
    it('returns false for a non-existent prefix', () => {
        expect(validateDaliPrefix('/no/such/dali/prefix')).to.equal(false);
    });
});

describe('daliEnvironment.resolveDaliPrefix()', () => {
    let tmpRoot: string;
    let prefix: string;
    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dali-prefix-test-'));
        prefix = path.join(tmpRoot, 'dali-env', 'opt');
        fs.mkdirSync(path.join(prefix, 'lib', 'pkgconfig'), { recursive: true });
        fs.writeFileSync(path.join(prefix, 'lib', 'libdali2-core.so'), '');
        fs.writeFileSync(path.join(prefix, 'lib', 'pkgconfig', 'dali2-ui-foundation.pc'), '');
    });
    afterEach(() => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

    it('resolves the prefix when the exact dali-env/opt folder is picked', () => {
        expect(resolveDaliPrefix(prefix)).to.equal(prefix);
    });

    it('resolves dali-env/opt when the parent folder is picked', () => {
        // The exact mistake the user hit: picking …/generativeUI instead of …/dali-env/opt.
        expect(resolveDaliPrefix(tmpRoot)).to.equal(prefix);
    });

    it('returns null when no DALi install is anywhere under the pick', () => {
        expect(resolveDaliPrefix('/no/such/dali/area')).to.equal(null);
    });
});

describe('daliEnvironment.validateEnvironment()', () => {
    const allDeps = { gcc: true, pkgconfig: true, xvfb: true, ccache: true };

    it('flags every missing dependency and the missing DALi prefix', async () => {
        const issues = await validateEnvironment(null, { gcc: false, pkgconfig: false, xvfb: false, ccache: false });
        expect(issues.find(i => i.message.includes('g++'))).to.exist;
        expect(issues.find(i => i.message.includes('pkg-config'))).to.exist;
        expect(issues.find(i => i.message.includes('Xvfb'))).to.exist;
        expect(issues.find(i => i.kind === 'missing_dali')).to.exist;
    });

    it('returns only the DALi issue when deps are present but no prefix is set', async () => {
        const issues = await validateEnvironment(null, allDeps);
        expect(issues).to.have.lengthOf(1);
        expect(issues[0].kind).to.equal('missing_dali');
    });

    it('flags an invalid (non-existent) prefix even when deps are present', async () => {
        const issues = await validateEnvironment('/no/such/dali/prefix', allDeps);
        expect(issues).to.have.lengthOf(1);
        expect(issues[0].kind).to.equal('missing_dali');
        expect(issues[0].message).to.include('/no/such/dali/prefix');
    });
});
