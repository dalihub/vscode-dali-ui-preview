import { expect } from 'chai';
import { StatusBarManager } from '../../src/statusBar';

describe('StatusBarManager — showMode()', () => {
    function makeManagerWithSpy() {
        const item = {
            text: '',
            tooltip: undefined as string | undefined,
            command: undefined as string | undefined,
            color: undefined as any,
            show: () => {},
            hide: () => {},
            dispose: () => {},
        };

        // Temporarily override createStatusBarItem in the mock to return our spy item
        const vscode = require('vscode');
        const saved = vscode.window.createStatusBarItem;
        vscode.window.createStatusBarItem = () => item;

        const ctx = { subscriptions: [] } as any;
        const mgr = new StatusBarManager(ctx);

        vscode.window.createStatusBarItem = saved;
        return { mgr, item };
    }

    it('showMode("server") sets tooltip containing "Server"', () => {
        const { mgr, item } = makeManagerWithSpy();
        mgr.showMode('server');
        expect(String(item.tooltip)).to.include('Server');
    });

    it('showMode("compile") sets tooltip containing "Compile"', () => {
        const { mgr, item } = makeManagerWithSpy();
        mgr.showMode('compile');
        expect(String(item.tooltip)).to.include('Compile');
    });
});
