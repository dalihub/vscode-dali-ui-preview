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
 * Validate that a DALi prefix directory contains the expected libraries.
 * Checks for libdali2-core.so AND the dali2-ui-foundation pkg-config
 * (needed for Dali::Ui::View and the preview plugin template).
 */
export function validateDaliPrefix(prefix: string): boolean {
    const coreLib = path.join(prefix, 'lib', 'libdali2-core.so');
    const uiFoundationPc = path.join(prefix, 'lib', 'pkgconfig', 'dali2-ui-foundation.pc');
    try {
        return fs.existsSync(coreLib) && fs.existsSync(uiFoundationPc);
    } catch {
        return false;
    }
}

/**
 * Check whether common build dependencies are available on PATH.
 */
export async function checkDependencies(
    _daliPrefix: string
): Promise<{ gcc: boolean; xvfb: boolean; ccache: boolean; pkgconfig: boolean }> {
    const [gcc, xvfb, ccache, pkgconfig] = await Promise.all([
        isCommandAvailable('g++'),
        isCommandAvailable('Xvfb'),
        isCommandAvailable('ccache'),
        isCommandAvailable('pkg-config'),
    ]);
    return { gcc, xvfb, ccache, pkgconfig };
}

export interface EnvironmentIssue {
    kind: 'missing_dep' | 'missing_dali';
    message: string;
    action: string;
}

/**
 * Validates the runtime environment and returns a list of issues found.
 * Returns an empty array when everything is in order.
 *
 * @param daliPrefix  Resolved DALi SDK prefix, or null if not found.
 * @param deps        Optional pre-resolved dependency flags — supply in tests
 *                    to avoid spawning real shell commands.
 */
export async function validateEnvironment(
    daliPrefix: string | null,
    deps?: { gcc: boolean; xvfb: boolean; ccache: boolean; pkgconfig: boolean },
): Promise<EnvironmentIssue[]> {
    const issues: EnvironmentIssue[] = [];

    const resolvedDeps = deps ?? await checkDependencies(daliPrefix ?? '');

    if (!resolvedDeps.gcc) {
        issues.push({
            kind: 'missing_dep',
            message: 'g++ compiler not found on PATH.',
            action: 'Install build-essential: sudo apt-get install build-essential',
        });
    }
    if (!resolvedDeps.pkgconfig) {
        issues.push({
            kind: 'missing_dep',
            message: 'pkg-config not found on PATH.',
            action: 'Install pkg-config: sudo apt-get install pkg-config',
        });
    }
    if (!resolvedDeps.xvfb) {
        issues.push({
            kind: 'missing_dep',
            message: 'Xvfb not found on PATH (headless rendering unavailable).',
            action: 'Install Xvfb: sudo apt-get install xvfb',
        });
    }
    if (!daliPrefix) {
        issues.push({
            kind: 'missing_dali',
            message: 'DALi SDK not found.',
            action: 'Run "DALi: Open Preview" and configure the DALi prefix path in settings.',
        });
    }

    return issues;
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
