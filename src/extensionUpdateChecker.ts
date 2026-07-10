import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigurationService } from './configurationService';
import { getLogger } from './logger';

/**
 * Extension self-update checker.
 *
 * The extension is distributed as a `.vsix` via the one-line `install.sh`
 * (NOT the VS Code Marketplace), so VS Code's built-in extension auto-update
 * never runs for it. This module gives self-installed users a Marketplace-like
 * experience: on a once-a-day background check it compares the running version
 * against the latest GitHub release and, when a newer one exists, offers to
 * re-run the installer in an integrated terminal (approach C — the user sees
 * the command and presses Enter; we never install silently).
 *
 * Mirrors `checkUpdateCommand.ts` (which does the same for the Docker runtime
 * IMAGE). It is wired OUTSIDE the activation spine and is fully fail-silent, so
 * a network hiccup can never affect activation or the preview feature.
 */

/** Per-machine timestamp of the last auto extension-update check (NOT synced). */
export const LAST_EXT_UPDATE_CHECK_KEY = 'daliPreview.lastExtensionUpdateCheck.v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** The repo the extension is released from — the one `install.sh` pulls from. */
export const RELEASE_REPO = 'dalihub/vscode-dali-ui-preview';
const RELEASES_LATEST_URL = `https://github.com/${RELEASE_REPO}/releases/latest`;

/**
 * The one-line command that re-installs/updates the extension. Single source of
 * truth shared by the "Update now" terminal action AND the READMEs, so the docs
 * can never drift from what the button actually runs.
 */
export function buildUpdateCommand(): string {
    return `curl -fsSL https://raw.githubusercontent.com/${RELEASE_REPO}/main/install.sh | bash`;
}

/**
 * The `.vsix` asset URL for a release. The release CI publishes exactly one asset named
 * `dali-preview-v<version>.vsix` (see `.github/workflows/release.yml`), so the URL is
 * derivable from the version with no GitHub API call (which is rate-limited behind the
 * shared corp proxy — same reasoning as {@link fetchLatestVersion}). Pure/exported for testing.
 */
export function vsixDownloadUrl(version: string): string {
    const v = version.replace(/^v/i, '');
    return `https://github.com/${RELEASE_REPO}/releases/download/v${v}/dali-preview-v${v}.vsix`;
}

/** Download `url` to `dest`, following redirects (GitHub release assets 302 → a CDN URL).
 *  Resolves true on a 200 fully written, false on any error/timeout/non-200. Never throws. */
function downloadTo(url: string, dest: string, timeoutMs = 120000, redirects = 5): Promise<boolean> {
    return new Promise((resolve) => {
        const req = https.get(url, { headers: { 'User-Agent': 'dali-ui-preview-vscode' } }, (res) => {
            const code = res.statusCode ?? 0;
            if (code >= 300 && code < 400 && res.headers.location) {
                res.resume();
                if (redirects <= 0) { resolve(false); return; }
                resolve(downloadTo(res.headers.location, dest, timeoutMs, redirects - 1));
                return;
            }
            if (code !== 200) { res.resume(); resolve(false); return; }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve(true)));
            file.on('error', () => resolve(false));
        });
        req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
        req.on('error', () => resolve(false));
    });
}

/**
 * Download the release `.vsix` and install it IN-EDITOR via the built-in
 * `workbench.extensions.installExtension` (which accepts a local `.vsix` Uri) — no
 * terminal, no Marketplace. Returns true when installed (a window reload then activates
 * the new version — see {@link offerReload}). Fully fail-safe: any failure returns false
 * so the caller can fall back to the terminal installer.
 */
async function installVsix(version: string, outputChannel: vscode.OutputChannel): Promise<boolean> {
    const asset = `dali-preview-v${version.replace(/^v/i, '')}.vsix`;
    const dest = path.join(os.tmpdir(), asset);
    outputChannel.appendLine(`[Update] Downloading ${asset} …`);
    if (!(await downloadTo(vsixDownloadUrl(version), dest))) {
        outputChannel.appendLine(`[Update] Download failed: ${vsixDownloadUrl(version)}`);
        return false;
    }
    try {
        outputChannel.appendLine(`[Update] Installing ${asset} in-editor …`);
        await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(dest));
        outputChannel.appendLine('[Update] Installed — a window reload finishes the update.');
        return true;
    } catch (err) {
        outputChannel.appendLine(`[Update] In-editor install failed (${String(err)}) — will offer the terminal installer.`);
        return false;
    } finally {
        void fs.promises.unlink(dest).catch(() => { /* temp cleanup best-effort */ });
    }
}

/** After a successful in-editor install, offer the reload that activates the new version. */
async function offerReload(version: string): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
        `DALi Preview updated to ${version}. Reload the window to finish.`,
        'Reload Window',
        'Later',
    );
    if (choice === 'Reload Window') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}

/**
 * Parse the release tag from the URL that `releases/latest` redirects to.
 * e.g. `https://github.com/owner/repo/releases/tag/v0.52.0` -> `v0.52.0`.
 * Returns null when there is no `/tag/` segment (the repo has no releases) or
 * on empty input.
 */
export function parseTagFromLocation(location: string | undefined): string | null {
    if (!location) {
        return null;
    }
    const m = location.match(/\/tag\/([^/?#]+)/);
    return m ? m[1] : null;
}

/**
 * Compare two dotted numeric versions, ignoring a single leading `v`. Returns
 * true iff `latest` is strictly newer than `current`. Fail-safe: any input that
 * does not parse as a numeric version yields false, so a malformed tag can never
 * nag the user with a phantom "update available".
 */
export function isNewerVersion(latest: string, current: string): boolean {
    const parse = (v: string): number[] | null => {
        const cleaned = v.trim().replace(/^v/i, '');
        if (!/^\d+(\.\d+)*$/.test(cleaned)) {
            return null;
        }
        return cleaned.split('.').map((n) => parseInt(n, 10));
    };
    const a = parse(latest);
    const b = parse(current);
    if (!a || !b) {
        return false;
    }
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        if (x !== y) {
            return x > y;
        }
    }
    return false;
}

/**
 * Resolve the latest released version (tag minus a leading `v`), or null on any
 * failure. Deliberately uses github.com — NOT api.github.com — because the API
 * is rate-limited to 60 req/hour per IP and behind a shared corporate proxy that
 * quota is exhausted collectively, returning 403 to everyone (the same reasoning
 * as `install.sh`). The `releases/latest` page 302-redirects to `.../tag/<tag>`,
 * and reading that redirect target is not rate-limited and needs no token.
 */
export function fetchLatestVersion(timeoutMs = 10000): Promise<string | null> {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value: string | null) => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };
        try {
            const req = https.request(
                RELEASES_LATEST_URL,
                { method: 'HEAD', headers: { 'User-Agent': 'dali-ui-preview-vscode' } },
                (res) => {
                    // Do not follow the redirect — its target IS the answer.
                    const tag = parseTagFromLocation(res.headers.location);
                    res.resume(); // drain
                    done(tag ? tag.replace(/^v/i, '') : null);
                },
            );
            req.setTimeout(timeoutMs, () => {
                req.destroy();
                done(null);
            });
            req.on('error', () => done(null));
            req.end();
        } catch {
            done(null);
        }
    });
}

/** Dependencies, injectable so the orchestration is unit-testable without network. */
export interface ExtUpdateDeps {
    /** The currently-running extension version (from `package.json`). */
    currentVersion: string;
    /** Version resolver; defaults to the real github.com probe. */
    fetchLatest?: () => Promise<string | null>;
    /** In-editor .vsix installer; defaults to the real {@link installVsix}. Injectable so
     *  the orchestration is unit-tested without network or `installExtension`. Returns true
     *  when installed (caller then offers a reload), false to fall back to the terminal. */
    installUpdate?: (version: string, outputChannel: vscode.OutputChannel) => Promise<boolean>;
}

/**
 * Show the "update available" prompt and act on the choice. Shared by the manual
 * command and the activation auto-check.
 */
async function promptUpdate(
    latest: string,
    current: string,
    outputChannel: vscode.OutputChannel,
    install: (version: string, out: vscode.OutputChannel) => Promise<boolean> = installVsix,
): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
        `DALi Preview ${latest} is available (you have ${current}).`,
        'Update now',
        'View release',
        'Later',
    );
    if (choice === 'Update now') {
        // Preferred: download the release .vsix and install it IN-EDITOR (one click, no terminal).
        if (await install(latest, outputChannel)) {
            await offerReload(latest);
            return;
        }
        // Fallback (e.g. installExtension unavailable / download blocked): the terminal
        // installer. addNewLine=false leaves the command on the prompt so the user reviews
        // it and presses Enter.
        const terminal = vscode.window.createTerminal({
            name: 'DALi Preview · Update',
            message: 'Press Enter to re-run the installer and update to the latest release.',
        });
        terminal.show(false);
        terminal.sendText(buildUpdateCommand(), false);
    } else if (choice === 'View release') {
        await vscode.env.openExternal(vscode.Uri.parse(RELEASES_LATEST_URL));
    }
}

/**
 * Command: `dali.checkExtensionUpdate`
 *
 * Manual "check for updates" — always probes, always reports (including
 * "up to date" and a fetch failure), unlike the silent activation check.
 */
export async function checkExtensionUpdateCommand(
    deps: ExtUpdateDeps,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    const { currentVersion } = deps;
    const fetchLatest = deps.fetchLatest ?? fetchLatestVersion;

    outputChannel.appendLine(`[Update] Checking for a newer extension release (current ${currentVersion}) ...`);
    const latest = await fetchLatest();

    if (!latest) {
        await vscode.window.showWarningMessage(
            'Could not check for DALi Preview updates — the latest release could not be reached. ' +
            'Check your network/proxy and try again.',
        );
        return;
    }

    if (!isNewerVersion(latest, currentVersion)) {
        await vscode.window.showInformationMessage(`DALi Preview (${currentVersion}) is up to date.`);
        return;
    }

    await promptUpdate(latest, currentVersion, outputChannel, deps.installUpdate);
}

/**
 * Activation auto-check, gated by `daliPreview.extensionUpdatePolicy` and a
 * once-a-day globalState throttle. Fully silent on no-update / offline / error.
 *
 *   policy 'off'    → never checks
 *   policy 'notify' → notification with a one-click in-editor install (default)
 *   policy 'auto'   → download + install the new .vsix in-editor, then offer a reload
 *
 * 'auto' is possible because we install via `workbench.extensions.installExtension`
 * (a local .vsix Uri); the running extension is replaced on the next window reload,
 * which we OFFER rather than force (so we never yank the window out from under work).
 */
export async function maybeAutoCheckExtensionUpdate(
    context: vscode.ExtensionContext,
    deps: ExtUpdateDeps,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    try {
        const policy = ConfigurationService.getInstance().extensionUpdatePolicy;
        if (policy === 'off') {
            return;
        }

        const last = context.globalState.get<number>(LAST_EXT_UPDATE_CHECK_KEY, 0);
        if (Date.now() - last < ONE_DAY_MS) {
            return;
        }

        // Record the attempt BEFORE the network probe so a flaky/offline check
        // still backs off for a day (non-blocking, fail-silent).
        await context.globalState.update(LAST_EXT_UPDATE_CHECK_KEY, Date.now());

        const fetchLatest = deps.fetchLatest ?? fetchLatestVersion;
        const latest = await fetchLatest();
        if (!latest || !isNewerVersion(latest, deps.currentVersion)) {
            return;
        }

        outputChannel.appendLine(`[Update] Newer extension release ${latest} available (current ${deps.currentVersion}).`);
        const install = deps.installUpdate ?? installVsix;
        if (policy === 'auto') {
            outputChannel.appendLine(`[Update] extensionUpdatePolicy=auto — installing ${latest} in-editor …`);
            if (await install(latest, outputChannel)) {
                await offerReload(latest);
                return;
            }
            // Auto-install couldn't complete (download blocked / API unavailable) → fall back to notify.
        }
        await promptUpdate(latest, deps.currentVersion, outputChannel, deps.installUpdate);
    } catch (err) {
        getLogger().trace('Extension', 'auto extension-update check failed (ignored)', { error: String(err) });
    }
}
