import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { openExamplesCommand } from '../../src/sampleCommand';

// fs.existsSync / fs.promises.* are non-configurable and can't be stubbed, so
// these tests run against a real temp filesystem and assert on actual copies.
describe('openExamplesCommand', () => {
    let tmpRoot: string;
    let extDir: string;
    let pickDir: string;
    let ctx: any;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dali-ex-'));
        extDir = path.join(tmpRoot, 'ext');
        const src = path.join(extDir, 'examples', '01-preview-file');
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(path.join(extDir, 'examples', 'README.md'), '# index');
        fs.writeFileSync(path.join(src, 'hello.preview.dali.cpp'), 'return X;');
        pickDir = path.join(tmpRoot, 'picked');
        fs.mkdirSync(pickDir, { recursive: true });
        ctx = { extensionPath: extDir };
    });
    afterEach(() => {
        sinon.restore();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('errors and does not prompt when bundled examples are missing', async () => {
        const noExamplesCtx = { extensionPath: path.join(tmpRoot, 'nope') };
        const err = sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined as any);
        const dialog = sinon.stub(vscode.window, 'showOpenDialog');
        await openExamplesCommand(noExamplesCtx as any);
        expect(err.calledOnce).to.equal(true);
        expect(dialog.called).to.equal(false);
    });

    it('does nothing when the folder picker is cancelled', async () => {
        sinon.stub(vscode.window, 'showOpenDialog').resolves(undefined as any);
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined as any);
        await openExamplesCommand(ctx);
        expect(fs.existsSync(path.join(pickDir, 'dali-examples'))).to.equal(false);
        expect(exec.called).to.equal(false);
    });

    it('copies examples and opens them in a NEW window', async () => {
        sinon.stub(vscode.window, 'showOpenDialog').resolves([{ fsPath: pickDir }] as any);
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined as any);
        await openExamplesCommand(ctx);
        const dest = path.join(pickDir, 'dali-examples');
        expect(fs.existsSync(path.join(dest, 'README.md'))).to.equal(true);
        expect(fs.existsSync(path.join(dest, '01-preview-file', 'hello.preview.dali.cpp'))).to.equal(true);
        expect(exec.calledOnce).to.equal(true);
        expect(exec.firstCall.args[0]).to.equal('vscode.openFolder');
        expect((exec.firstCall.args[1] as any).fsPath).to.equal(dest);
        expect(exec.firstCall.args[2]).to.deep.equal({ forceNewWindow: true });
    });

    it('existing dir + "Open Existing" opens without re-copying', async () => {
        const dest = path.join(pickDir, 'dali-examples');
        fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'marker.txt'), 'keep me');
        sinon.stub(vscode.window, 'showOpenDialog').resolves([{ fsPath: pickDir }] as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Open Existing' as any);
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined as any);
        await openExamplesCommand(ctx);
        expect(fs.existsSync(path.join(dest, 'marker.txt'))).to.equal(true); // preserved
        expect(fs.existsSync(path.join(dest, 'README.md'))).to.equal(false); // not copied
        expect(exec.calledOnce).to.equal(true);
    });

    it('existing dir + "Replace" removes then re-copies', async () => {
        const dest = path.join(pickDir, 'dali-examples');
        fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'marker.txt'), 'stale');
        sinon.stub(vscode.window, 'showOpenDialog').resolves([{ fsPath: pickDir }] as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Replace' as any);
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined as any);
        await openExamplesCommand(ctx);
        expect(fs.existsSync(path.join(dest, 'marker.txt'))).to.equal(false); // stale gone
        expect(fs.existsSync(path.join(dest, 'README.md'))).to.equal(true);   // fresh copy
        expect(exec.calledOnce).to.equal(true);
    });

    it('existing dir + "Cancel" does nothing further', async () => {
        const dest = path.join(pickDir, 'dali-examples');
        fs.mkdirSync(dest, { recursive: true });
        sinon.stub(vscode.window, 'showOpenDialog').resolves([{ fsPath: pickDir }] as any);
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Cancel' as any);
        const exec = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined as any);
        await openExamplesCommand(ctx);
        expect(exec.called).to.equal(false);
    });
});
