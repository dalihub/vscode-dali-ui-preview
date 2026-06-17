import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigurationService } from './configurationService';
import { getLogger } from './logger';

const execAsync = promisify(exec);

/**
 * True iff `prefix` has the dali2-ui-foundation pkg-config file — the marker of
 * a usable DALi install. Used to skip a half-built dali-env (e.g. a bare
 * `dali_backend`) whose directory exists but has no `.pc` files, which would
 * otherwise win auto-detection and make every compile fail with
 * "No package 'dali2-ui-foundation'".
 */
function hasUiFoundationPc(prefix: string): boolean {
    return fs.existsSync(path.join(prefix, 'lib', 'pkgconfig', 'dali2-ui-foundation.pc'));
}

/**
 * Auto-detect the DALi installation prefix.
 *
 * Search order (explicit override → environment → shared system install):
 *  1. VS Code setting `daliPreview.daliPrefix` (a developer's deliberate override)
 *  2. Environment variable `DESKTOP_PREFIX` (what a dali-env `setenv` exports)
 *  3. `setenv` file in a workspace folder (parses the DESKTOP_PREFIX= line)
 *  4. A shared/system install: pkg-config's registered prefix, then common
 *     locations like /opt/dali
 *
 * Deliberately does NOT scan a developer's home/project dirs (~/dali-env/opt,
 * ~/tizen/<project>/dali-env/opt): this is a shared tool, so it must not
 * auto-select one person's project build. Developers using a home dali-env
 * simply `source setenv` (which exports DESKTOP_PREFIX, caught by step 2) or set
 * the prefix explicitly via the "Use Local DALi Runtime" command.
 */
export async function findDaliPrefix(): Promise<string | null> {
    const log = getLogger();

    // 1. Explicit setting override.
    const settingValue = ConfigurationService.getInstance().daliPrefix;
    if (settingValue && settingValue.trim().length > 0) {
        log.trace('Environment', 'findDaliPrefix: found in settings', { path: settingValue.trim() });
        return settingValue.trim();
    }

    // 2. DESKTOP_PREFIX environment variable.
    const envPrefix = process.env.DESKTOP_PREFIX;
    if (envPrefix && envPrefix.trim().length > 0) {
        log.trace('Environment', 'findDaliPrefix: found via DESKTOP_PREFIX env', { path: envPrefix.trim() });
        return envPrefix.trim();
    }

    // 3. setenv file in a workspace folder.
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        for (const folder of workspaceFolders) {
            const prefix = parseSetenvFile(path.join(folder.uri.fsPath, 'setenv'));
            if (prefix) {
                log.trace('Environment', 'findDaliPrefix: found in setenv', { path: prefix });
                return prefix;
            }
        }
    }

    // 4. Shared / system install.
    const systemPrefix = await findSystemDaliPrefix();
    if (systemPrefix) {
        log.trace('Environment', 'findDaliPrefix: found in system path', { path: systemPrefix });
        return systemPrefix;
    }

    log.trace('Environment', 'findDaliPrefix: not found');
    return null;
}

/**
 * Locate a shared/system DALi install: first ask pkg-config where a DALi
 * registered on the default search path lives (so any system-wide install is
 * found without hardcoding), then fall back to common shared locations. Returns
 * a validated prefix or null.
 */
async function findSystemDaliPrefix(): Promise<string | null> {
    try {
        const { stdout } = await execAsync('pkg-config --variable=prefix dali2-ui-foundation');
        const prefix = stdout.trim();
        if (prefix && validateDaliPrefix(prefix)) {
            return prefix;
        }
    } catch (err) {
        getLogger().trace('Environment', 'pkg-config prefix lookup failed', { error: String(err) });
    }
    for (const candidate of ['/opt/dali', '/opt/dali/opt', '/usr/local', '/usr']) {
        if (validateDaliPrefix(candidate)) {
            return candidate;
        }
    }
    return null;
}

/**
 * Validate that a DALi prefix directory contains the expected libraries.
 * Checks for libdali2-core.so AND the dali2-ui-foundation pkg-config
 * (needed for Dali::Ui::View and the preview harness/plugin templates).
 */
export function validateDaliPrefix(prefix: string): boolean {
    const log = getLogger();
    const coreLib = path.join(prefix, 'lib', 'libdali2-core.so');
    try {
        const valid = fs.existsSync(coreLib) && hasUiFoundationPc(prefix);
        log.trace('Environment', 'validateDaliPrefix', { prefix, valid });
        return valid;
    } catch (err) {
        log.trace('Environment', 'validateDaliPrefix error', { error: String(err) });
        return false;
    }
}

/**
 * Resolve the actual DALi prefix at or just below a folder the user picked.
 * Accepts the prefix directly, or a parent that contains the standard
 * `dali-env/opt` layout — so picking the project/home folder (e.g.
 * `~/tizen/<project>` instead of `~/tizen/<project>/dali-env/opt`) still works.
 * Returns the resolved prefix, or null if none is found.
 */
export function resolveDaliPrefix(candidate: string): string | null {
    // The pick itself, then the common dali-env layouts directly under it.
    for (const c of [candidate, path.join(candidate, 'dali-env', 'opt'), path.join(candidate, 'opt')]) {
        if (validateDaliPrefix(c)) {
            return c;
        }
    }
    // One directory level down (e.g. the user picked ~/tizen, which holds
    // <project>/dali-env/opt).
    try {
        for (const entry of fs.readdirSync(candidate, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            for (const sub of [
                path.join(candidate, entry.name, 'dali-env', 'opt'),
                path.join(candidate, entry.name, 'opt'),
            ]) {
                if (validateDaliPrefix(sub)) {
                    return sub;
                }
            }
        }
    } catch (err) {
        getLogger().trace('Environment', 'resolveDaliPrefix scan error', { error: String(err) });
    }
    return null;
}

/**
 * Check whether common build dependencies are available on PATH.
 */
export async function checkDependencies(): Promise<{ gcc: boolean; xvfb: boolean; ccache: boolean; pkgconfig: boolean }> {
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
 * Validate the local-runtime environment and return a list of actionable
 * issues. Empty array means the host can build+run a preview natively.
 *
 * @param daliPrefix  Resolved DALi prefix, or null if not found/invalid.
 * @param deps        Optional pre-resolved dependency flags — supply in tests
 *                    to avoid spawning real shell commands.
 */
export async function validateEnvironment(
    daliPrefix: string | null,
    deps?: { gcc: boolean; xvfb: boolean; ccache: boolean; pkgconfig: boolean },
): Promise<EnvironmentIssue[]> {
    const log = getLogger();
    const issues: EnvironmentIssue[] = [];

    const resolvedDeps = deps ?? await checkDependencies();

    if (!resolvedDeps.gcc) {
        log.debug('Environment', 'missing dependency: g++');
        issues.push({
            kind: 'missing_dep',
            message: 'g++ compiler not found on PATH.',
            action: 'Install build-essential: sudo apt-get install build-essential',
        });
    }
    if (!resolvedDeps.pkgconfig) {
        log.debug('Environment', 'missing dependency: pkg-config');
        issues.push({
            kind: 'missing_dep',
            message: 'pkg-config not found on PATH.',
            action: 'Install pkg-config: sudo apt-get install pkg-config',
        });
    }
    if (!resolvedDeps.xvfb) {
        log.debug('Environment', 'missing dependency: Xvfb');
        issues.push({
            kind: 'missing_dep',
            message: 'Xvfb not found on PATH (headless rendering unavailable).',
            action: 'Install Xvfb: sudo apt-get install xvfb',
        });
    }
    if (!daliPrefix || !validateDaliPrefix(daliPrefix)) {
        log.debug('Environment', 'DALi prefix not found/invalid', { daliPrefix });
        issues.push({
            kind: 'missing_dali',
            message: daliPrefix
                ? `DALi install not found at ${daliPrefix} (missing libdali2-core.so or dali2-ui-foundation.pc).`
                : 'DALi install folder not configured.',
            action: 'Run "DALi Preview: Use Local DALi Runtime" to select your DALi install folder.',
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
    } catch (err) {
        getLogger().trace('Environment', 'setenv parse error', { error: String(err) });
    }
    return null;
}

async function isCommandAvailable(command: string): Promise<boolean> {
    try {
        await execAsync(`which ${command}`);
        return true;
    } catch (err) {
        getLogger().trace('Environment', 'command not available', { command, error: String(err) });
        return false;
    }
}
