import { expect } from 'chai';
import { StatusBarManager, ThemeStatusBarItem } from '../../src/statusBar';

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

describe('ThemeStatusBarItem', () => {
    function makeThemeItemWithSpy() {
        const item = {
            text: '',
            tooltip: undefined as string | undefined,
            command: undefined as string | undefined,
            shown: false,
            show: function() { this.shown = true; },
            hide: function() { this.shown = false; },
            dispose: () => {},
        };

        const vscode = require('vscode');
        const saved = vscode.window.createStatusBarItem;
        vscode.window.createStatusBarItem = () => item;

        const ctx = { subscriptions: [] } as any;
        const themeItem = new ThemeStatusBarItem(ctx);

        vscode.window.createStatusBarItem = saved;
        return { themeItem, item };
    }

    it('update("dark") sets moon icon and shows item', () => {
        const { themeItem, item } = makeThemeItemWithSpy();
        themeItem.update('dark');
        expect(item.text).to.equal('$(moon)');
        expect(item.shown).to.be.true;
    });

    it('update("light") sets sun icon and shows item', () => {
        const { themeItem, item } = makeThemeItemWithSpy();
        themeItem.update('light');
        expect(item.text).to.equal('$(sun)');
        expect(item.shown).to.be.true;
    });

    it('update("dark") tooltip mentions 다크 테마', () => {
        const { themeItem, item } = makeThemeItemWithSpy();
        themeItem.update('dark');
        expect(String(item.tooltip)).to.include('다크 테마');
    });

    it('update("light") tooltip mentions 라이트 테마', () => {
        const { themeItem, item } = makeThemeItemWithSpy();
        themeItem.update('light');
        expect(String(item.tooltip)).to.include('라이트 테마');
    });

    it('command is dali.toggleTheme', () => {
        const { item } = makeThemeItemWithSpy();
        expect(item.command).to.equal('dali.toggleTheme');
    });
});
