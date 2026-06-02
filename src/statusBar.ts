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

    showMode(mode: 'server' | 'compile' | 'vnc' | 'parser' | 'device'): void {
        this.clearRevertTimer();
        const label = mode === 'parser'
            ? '⚡ Parser'
            : mode === 'server' ? '⚡ Server'
            : mode === 'vnc' ? '🖥 VNC'
            : mode === 'device' ? '📱 Device'
            : '🔨 Compile';
        if (mode === 'vnc') {
            this.statusBarItem.text = '$(vm-active) DALi: Interactive';
        } else if (mode === 'device') {
            this.statusBarItem.text = '$(device-mobile) DALi: Device';
        } else {
            this.statusBarItem.text = `$(zap) DALi: ${label}`;
        }
        this.statusBarItem.tooltip = `DALi Preview mode: ${label}`;
    }

    showError(message: string): void {
        this.clearRevertTimer();
        this.statusBarItem.text = '$(error) DALi: Error';
        this.statusBarItem.tooltip = message;
        this.statusBarItem.command = 'dali.openPreview';
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
    }

    /**
     * Persistent "a newer runtime image is available" affordance. Unlike the
     * transient modes, this stays until the user clicks it (which runs the
     * update check); after a successful update the caller restores the mode.
     */
    showUpdateAvailable(): void {
        this.clearRevertTimer();
        this.statusBarItem.text = '$(cloud-download) DALi: Update available';
        this.statusBarItem.tooltip = 'A newer DALi runtime image is available — click to update';
        this.statusBarItem.command = 'dali.checkRuntimeUpdate';
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
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

export class ThemeStatusBarItem {
    private item: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext) {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            99  // just to the left of the main DALi status item (priority 100)
        );
        this.item.command = 'dali.toggleTheme';
        context.subscriptions.push(this.item);
    }

    update(theme: 'light' | 'dark'): void {
        if (theme === 'light') {
            this.item.text = '$(sun)';
            this.item.tooltip = 'DALi Preview: Light theme — click to switch to dark';
        } else {
            this.item.text = '$(moon)';
            this.item.tooltip = 'DALi Preview: Dark theme — click to switch to light';
        }
        this.item.show();
    }

    hide(): void {
        this.item.hide();
    }

    dispose(): void {
        this.item.dispose();
    }
}
