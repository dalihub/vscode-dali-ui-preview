import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { PreviewOrchestrator, OrchestratorDeps } from '../../src/previewOrchestrator';

/*
 * offerIssueReport() is the failure-toast wiring: on a genuine internal error,
 * surface a "Report Issue" toast that hands the error to the injected reportIssue
 * dep. (The pre-filled body/URL itself is covered in reportIssueCommand.test.ts.)
 */
function makeOrch(reportIssue?: (ctx: string) => void): PreviewOrchestrator {
    const deps: OrchestratorDeps = {
        buildRunner: {} as any,
        previewManager: {} as any,
        previewServer: undefined,
        xvfbManager: undefined,
        statusBar: undefined,
        outputChannel: { appendLine: () => {} } as any,
        diagnosticCollection: { delete: () => {}, set: () => {} } as any,
        reportIssue,
    };
    return new PreviewOrchestrator(deps, { width: 400, height: 400, theme: 'dark' });
}

describe('PreviewOrchestrator.offerIssueReport', () => {
    afterEach(() => sinon.restore());

    it('shows a toast and forwards the error when the user clicks Report Issue', async () => {
        const report = sinon.spy();
        const toast = sinon.stub(vscode.window, 'showErrorMessage').resolves('Report Issue' as any);
        (makeOrch(report) as any).offerIssueReport('Boom happened\nstack line 2');
        await new Promise<void>((r) => setImmediate(r)); // flush the toast .then
        expect(toast.calledOnce, 'toast shown').to.equal(true);
        expect(report.calledOnce, 'reportIssue called').to.equal(true);
        expect(report.firstCall.args[0]).to.contain('Boom happened');
    });

    it('does nothing if the user dismisses the toast', async () => {
        const report = sinon.spy();
        sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined as any);
        (makeOrch(report) as any).offerIssueReport('Boom');
        await new Promise<void>((r) => setImmediate(r));
        expect(report.called).to.equal(false);
    });

    it('is a no-op (no toast) when no reportIssue dep is injected', () => {
        const toast = sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined as any);
        (makeOrch(undefined) as any).offerIssueReport('Boom');
        expect(toast.called).to.equal(false);
    });
});
