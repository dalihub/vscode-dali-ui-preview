import { exec, execSync } from 'child_process';
import * as vscode from 'vscode';

export interface SdbDevice {
    serial: string;
    state: string;
    name?: string;
}

export class SdbManager {
    private sdbPath: string = 'sdb';

    constructor(private outputChannel: vscode.OutputChannel) {
        this.loadSdbPath();
    }

    private loadSdbPath(): void {
        const config = vscode.workspace.getConfiguration('daliPreview');
        const configuredPath = config.get<string>('sdbPath', '');
        if (configuredPath) {
            this.sdbPath = configuredPath;
        }
    }

    /**
     * Checks that 'sdb' is installed and on PATH (or at configured path).
     * Returns null if available, or an error message string.
     */
    static checkDependencies(): string | null {
        const config = vscode.workspace.getConfiguration('daliPreview');
        const sdbPath = config.get<string>('sdbPath', '') || 'sdb';
        try {
            execSync(`which "${sdbPath}"`, { stdio: 'pipe' });
            return null;
        } catch {
            return sdbPath === 'sdb'
                ? 'sdb not found in PATH. Install Tizen SDK or set daliPreview.sdbPath.'
                : `sdb not found at '${sdbPath}'. Check daliPreview.sdbPath setting.`;
        }
    }

    /**
     * Lists connected SDB devices.
     */
    async getDevices(): Promise<SdbDevice[]> {
        const { stdout } = await this.exec(['-s', '', 'devices']).catch(() =>
            this.exec(['devices'])
        );
        return this.parseDevices(stdout);
    }

    private parseDevices(output: string): SdbDevice[] {
        const devices: SdbDevice[] = [];
        const lines = output.split('\n');
        // Skip header line "List of devices attached"
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('List of') || trimmed.startsWith('*')) {
                continue;
            }
            // Format: "<serial>\t<state>" or "<serial>  <state>  [name]"
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                devices.push({
                    serial: parts[0],
                    state: parts[1],
                    name: parts.slice(2).join(' ') || undefined,
                });
            }
        }
        return devices;
    }

    /**
     * Prompt the user to select a connected SDB device via QuickPick.
     * Returns the selected device serial, or undefined if cancelled or no devices.
     */
    async selectDevice(): Promise<string | undefined> {
        let devices: SdbDevice[];
        try {
            devices = await this.getDevices();
        } catch (err: any) {
            vscode.window.showErrorMessage(`SDB: 디바이스 목록 조회 실패 — ${err.message}`);
            return undefined;
        }

        const connected = devices.filter(d => d.state === 'device');

        if (connected.length === 0) {
            vscode.window.showWarningMessage('SDB: 연결된 디바이스가 없습니다. 디바이스를 연결하고 SDB를 활성화하세요.');
            return undefined;
        }

        if (connected.length === 1) {
            return connected[0].serial;
        }

        const items = connected.map(d => ({
            label: d.serial,
            description: d.name || d.state,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: '프리뷰할 Tizen 디바이스를 선택하세요',
        });

        return picked?.label;
    }

    /**
     * Push a local file to the remote device.
     */
    async push(localPath: string, remotePath: string, serial?: string): Promise<void> {
        const args = serial
            ? ['-s', serial, 'push', localPath, remotePath]
            : ['push', localPath, remotePath];
        const { stderr } = await this.exec(args);
        if (stderr && stderr.toLowerCase().includes('error')) {
            throw new Error(`sdb push failed: ${stderr}`);
        }
        this.outputChannel.appendLine(`[SDB] push ${localPath} → ${remotePath}`);
    }

    /**
     * Pull a remote file from the device to local.
     */
    async pull(remotePath: string, localPath: string, serial?: string): Promise<void> {
        const args = serial
            ? ['-s', serial, 'pull', remotePath, localPath]
            : ['pull', remotePath, localPath];
        const { stderr } = await this.exec(args);
        if (stderr && stderr.toLowerCase().includes('error')) {
            throw new Error(`sdb pull failed: ${stderr}`);
        }
        this.outputChannel.appendLine(`[SDB] pull ${remotePath} → ${localPath}`);
    }

    /**
     * Run a shell command on the device and return stdout.
     */
    async shell(command: string, serial?: string, timeoutMs = 30000): Promise<string> {
        const args = serial
            ? ['-s', serial, 'shell', command]
            : ['shell', command];
        const { stdout, stderr } = await this.exec(args, timeoutMs);
        if (stderr && stderr.toLowerCase().includes('error')) {
            throw new Error(`sdb shell failed: ${stderr}`);
        }
        return stdout;
    }

    /**
     * Forward a local port to a device port (e.g. for VNC tunneling).
     */
    async forward(localPort: number, remotePort: number, serial?: string): Promise<void> {
        const portSpec = `tcp:${localPort} tcp:${remotePort}`;
        const args = serial
            ? ['-s', serial, 'forward', `tcp:${localPort}`, `tcp:${remotePort}`]
            : ['forward', `tcp:${localPort}`, `tcp:${remotePort}`];
        await this.exec(args);
        this.outputChannel.appendLine(`[SDB] forward ${portSpec}`);
    }

    /**
     * Remove a port forward rule.
     */
    async removeForward(localPort: number, serial?: string): Promise<void> {
        const args = serial
            ? ['-s', serial, 'forward', '--remove', `tcp:${localPort}`]
            : ['forward', '--remove', `tcp:${localPort}`];
        await this.exec(args).catch(() => { /* best effort */ });
    }

    private exec(
        args: string[],
        timeoutMs = 15000
    ): Promise<{ stdout: string; stderr: string }> {
        // Filter out empty serial placeholder from helper methods
        const filteredArgs = args.filter(a => a !== '');
        const cmd = `"${this.sdbPath}" ${filteredArgs.map(a => `"${a}"`).join(' ')}`;
        this.outputChannel.appendLine(`[SDB] $ ${cmd}`);

        return new Promise((resolve, reject) => {
            exec(cmd, { timeout: timeoutMs, shell: '/bin/bash' }, (error, stdout, stderr) => {
                if (error && !stdout) {
                    reject(new Error(stderr || error.message));
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    dispose(): void {
        // No persistent resources to clean up
    }
}
