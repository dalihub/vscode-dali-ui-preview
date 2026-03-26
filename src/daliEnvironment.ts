import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Auto-detect the DALi installation prefix directory.
 *
 * Search order:
 *  1. VS Code setting `daliPreview.daliPrefix`
 *  2. Environment variable `DESKTOP_PREFIX`
 *  3. `setenv` file in workspace folders (parses DESKTOP_PREFIX= line)
 *  4. Common paths: ~/dali-env/opt, ~/tizen/{project}/dali-env/opt
 */
export async function findDaliPrefix(): Promise<string | null> {
    // 1. VS Code setting
    const config = vscode.workspace.getConfiguration('daliPreview');
    const settingValue = config.get<string>('daliPrefix', '');
    if (settingValue && settingValue.trim().length > 0) {
        return settingValue.trim();
    }

    // 2. Environment variable
    const envPrefix = process.env.DESKTOP_PREFIX;
    if (envPrefix && envPrefix.trim().length > 0) {
        return envPrefix.trim();
    }

    // 3. Look for setenv file in workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        for (const folder of workspaceFolders) {
            const setenvPath = path.join(folder.uri.fsPath, 'setenv');
            const prefix = parseSetenvFile(setenvPath);
            if (prefix) {
                return prefix;
            }
        }
    }

    // 4. Search common paths
    const home = process.env.HOME || '';
    if (!home) {
        return null;
    }

    // ~/dali-env/opt
    const directPath = path.join(home, 'dali-env', 'opt');
    if (fs.existsSync(directPath)) {
        return directPath;
    }

    // ~/tizen/*/dali-env/opt
    const tizenDir = path.join(home, 'tizen');
    if (fs.existsSync(tizenDir)) {
        try {
            const entries = fs.readdirSync(tizenDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const candidate = path.join(tizenDir, entry.name, 'dali-env', 'opt');
                    if (fs.existsSync(candidate)) {
                        return candidate;
                    }
                }
            }
        } catch {
            // Ignore read errors on tizen directory
        }
    }

    return null;
}

/**
 * Validate that a DALi prefix directory contains the expected core library.
 * Checks for `${prefix}/lib/libdali2-core.so` (regular file or symlink).
 */
export function validateDaliPrefix(prefix: string): boolean {
    const libPath = path.join(prefix, 'lib', 'libdali2-core.so');
    try {
        // lstatSync follows nothing; use existsSync which follows symlinks,
        // plus an explicit lstat check so we detect both real files and symlinks.
        if (fs.existsSync(libPath)) {
            return true;
        }
        // existsSync returns false for broken symlinks, so also check lstat
        const stat = fs.lstatSync(libPath);
        return stat.isSymbolicLink() || stat.isFile();
    } catch {
        return false;
    }
}

/**
 * Check whether common build dependencies are available on PATH.
 */
export async function checkDependencies(
    _daliPrefix: string
): Promise<{ gcc: boolean; xvfb: boolean; ccache: boolean }> {
    const [gcc, xvfb, ccache] = await Promise.all([
        isCommandAvailable('gcc'),
        isCommandAvailable('Xvfb'),
        isCommandAvailable('ccache'),
    ]);
    return { gcc, xvfb, ccache };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSetenvFile(filePath: string): string | null {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            // Match lines like: export DESKTOP_PREFIX=/some/path
            // or plain: DESKTOP_PREFIX=/some/path
            const match = trimmed.match(
                /^(?:export\s+)?DESKTOP_PREFIX\s*=\s*["']?([^"'\s#]+)["']?/
            );
            if (match && match[1]) {
                // Expand ~ to HOME if present
                let value = match[1];
                if (value.startsWith('~')) {
                    value = path.join(process.env.HOME || '', value.slice(1));
                }
                return value;
            }
        }
    } catch {
        // Ignore parse errors
    }
    return null;
}

async function isCommandAvailable(command: string): Promise<boolean> {
    try {
        await execAsync(`which ${command}`);
        return true;
    } catch {
        return false;
    }
}
