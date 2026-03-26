import * as vscode from 'vscode';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private revertTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.showReady();
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);
    }

    showReady(): void {
        this.clearRevertTimer();
        this.statusBarItem.text = '$(eye) DALi Preview';
        this.statusBarItem.tooltip = 'Click to open preview';
        this.statusBarItem.command = 'dali.openPreview';
        this.statusBarItem.color = undefined;
    }

    showBuilding(): void {
        this.clearRevertTimer();
        this.statusBarItem.text = '$(sync~spin) DALi: Building...';
        this.statusBarItem.tooltip = undefined;
        this.statusBarItem.command = undefined;
        this.statusBarItem.color = undefined;
    }

    showSuccess(timeMs: number): void {
        this.clearRevertTimer();
        const seconds = (timeMs / 1000).toFixed(1);
        const timestamp = new Date().toLocaleTimeString();
        this.statusBarItem.text = `$(check) DALi: Updated (${seconds}s)`;
        this.statusBarItem.tooltip = `Last updated at ${timestamp}`;
        this.statusBarItem.command = 'dali.openPreview';
        this.statusBarItem.color = undefined;

        this.revertTimer = setTimeout(() => {
            this.showReady();
        }, 5000);
    }

    showError(message: string): void {
        this.clearRevertTimer();
        this.statusBarItem.text = '$(error) DALi: Error';
        this.statusBarItem.tooltip = message;
        this.statusBarItem.command = 'dali.openPreview';
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
    }

    dispose(): void {
        this.clearRevertTimer();
        this.statusBarItem.dispose();
    }

    private clearRevertTimer(): void {
        if (this.revertTimer !== undefined) {
            clearTimeout(this.revertTimer);
            this.revertTimer = undefined;
        }
    }
}
