/*
 * runtimeStatus.ts — user-facing "is the DALi runtime downloaded/installed, and if a
 * download would fail, WHY" report.
 *
 * The image is pulled by the Docker DAEMON, not the VS Code (Node) process. Those two
 * have different network paths on the Samsung corp network: VS Code reaches ghcr.io
 * through the corporate web proxy, but the daemon uses its OWN proxy config — and if the
 * daemon has none, direct egress to ghcr.io is throttled/blocked (intermittent i/o
 * timeout), which is fatal for a ~290 MB pull. The internal BART mirror needs no proxy.
 *
 * So this status probes the DAEMON's reality (daemon reachable? image already cached?
 * daemon proxy config? which registry is selected?) and gives a plain verdict + fix,
 * instead of a CLI-side manifest probe that would falsely report "reachable" because the
 * CLI has the proxy the daemon lacks.
 */
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DockerRuntime } from './dockerRuntime';
import { checkDockerAccess } from './dockerAccessCheck';
import { ConfigurationService } from './configurationService';
import { BART_PROXY_HOST, GHCR_HOST, describeRegistry } from './registry';

const execFileAsync = promisify(execFile);

export interface DaemonProxy {
    http: string;
    https: string;
    noProxy: string;
}

export interface RuntimeStatus {
    mode: string;
    daemonReachable: boolean;
    daemonVersion?: string;
    daemonDetail?: string;
    imageName: string;
    host: string;
    registryLabel: string;
    tag: string;
    installed: boolean;
    localVersion?: string;
    daemonProxy?: DaemonProxy; // undefined when daemon unreachable / info failed
    verdict: Verdict;
}

export interface Verdict {
    level: 'ok' | 'warn' | 'error';
    headline: string;
    detail: string;
}

/** True iff a NO_PROXY value keeps the internal `.samsung.net`/BART hosts direct. */
export function noProxyCoversInternal(noProxy: string): boolean {
    return /(^|,)\s*\.?samsung\.net/i.test(noProxy || '');
}

/**
 * Pure verdict logic — no docker/vscode — so it is unit-tested with a truth table.
 * Encodes the diagnosis: the daemon (not VS Code) pulls; a proxy-less daemon cannot
 * reliably reach ghcr.io, while the internal BART mirror needs no proxy.
 */
export function computeVerdict(s: {
    daemonReachable: boolean;
    installed: boolean;
    host: string;
    daemonHasProxy: boolean;
    noProxyCoversInternal: boolean;
}): Verdict {
    if (!s.daemonReachable) {
        return {
            level: 'error',
            headline: 'Docker daemon is not reachable',
            detail: 'Install/start Docker (that needs sudo — ask an admin), or switch to the native runtime ("daliPreview.runtimeMode": "local"), which needs no download.',
        };
    }
    if (s.installed) {
        return {
            level: 'ok',
            headline: 'Runtime image is installed — preview is ready',
            detail: 'The image is in the local Docker cache; preview uses it directly, no download needed.',
        };
    }
    const isBart = s.host === BART_PROXY_HOST;
    if (isBart) {
        if (s.daemonHasProxy && !s.noProxyCoversInternal) {
            return {
                level: 'warn',
                headline: 'Not downloaded — the daemon proxy may block the internal BART mirror',
                detail: 'The daemon has a proxy but its NO_PROXY does not cover ".samsung.net", so it may tunnel the internal mirror through the web proxy and fail. Add ".samsung.net" to the daemon NO_PROXY (/etc/systemd/system/docker.service.d/http-proxy.conf) and `sudo systemctl restart docker`, then download.',
            };
        }
        return {
            level: 'ok',
            headline: 'Not downloaded yet — will pull from the internal BART mirror (reliable)',
            detail: 'Run "DALi Preview: Download Runtime Image". BART is on the corp network and needs no proxy.',
        };
    }
    // Selected host is ghcr.io (external).
    if (!s.daemonHasProxy) {
        return {
            level: 'warn',
            headline: 'Not downloaded — pulling from ghcr.io will likely FAIL (daemon has no proxy)',
            detail: 'The Docker DAEMON (not VS Code) pulls the image, and it has no corporate proxy configured — so direct egress to ghcr.io is throttled/blocked (intermittent i/o timeout). Fix, easiest first: (1) connect to the Samsung corp network so the extension uses the internal BART mirror (needs no proxy); or (2) give the daemon the proxy — /etc/systemd/system/docker.service.d/http-proxy.conf with HTTP_PROXY/HTTPS_PROXY=<your corp proxy> and NO_PROXY=".samsung.net,localhost,127.0.0.1", then `sudo systemctl daemon-reload && sudo systemctl restart docker`.',
        };
    }
    return {
        level: 'ok',
        headline: 'Not downloaded yet — will pull from ghcr.io via the daemon proxy',
        detail: 'Run "DALi Preview: Download Runtime Image".',
    };
}

/** Read the DAEMON's proxy config (what actually pulls) — not the CLI/VS Code env. */
async function readDaemonProxy(): Promise<DaemonProxy | undefined> {
    try {
        const { stdout } = await execFileAsync(
            'docker',
            ['info', '--format', '{{.HTTPProxy}}|{{.HTTPSProxy}}|{{.NoProxy}}'],
            { timeout: 10_000 },
        );
        const [http = '', https = '', noProxy = ''] = stdout.trim().split('|');
        return { http, https, noProxy };
    } catch {
        return undefined;
    }
}

/** Gather the full runtime status (daemon reality). Never throws. */
export async function collectRuntimeStatus(runtime: DockerRuntime): Promise<RuntimeStatus> {
    const cfg = ConfigurationService.getInstance();
    const tag = cfg.daliVersionTag;
    const mode = cfg.runtimeMode;
    const imageName = runtime.getImageName();
    const { label: registryLabel, host } = describeRegistry(imageName);

    const access = await checkDockerAccess();
    const daemonReachable = access.state === 'ok';

    let installed = false;
    let localVersion: string | undefined;
    let daemonProxy: DaemonProxy | undefined;
    if (daemonReachable) {
        installed = await runtime.hasImage(tag);
        if (installed) {
            localVersion = await runtime.getImageVersionLabel(tag);
        }
        daemonProxy = await readDaemonProxy();
    }

    const daemonHasProxy = !!(daemonProxy && (daemonProxy.http || daemonProxy.https));
    const verdict = computeVerdict({
        daemonReachable,
        installed,
        host,
        daemonHasProxy,
        noProxyCoversInternal: noProxyCoversInternal(daemonProxy?.noProxy ?? ''),
    });

    return {
        mode,
        daemonReachable,
        daemonVersion: access.serverVersion,
        daemonDetail: access.detail,
        imageName,
        host,
        registryLabel,
        tag,
        installed,
        localVersion,
        daemonProxy,
        verdict,
    };
}

const ICON = { ok: '✅', warn: '⚠️', error: '❌' } as const;

/** Pure formatter → a copy-pasteable report. Unit-tested without docker/vscode. */
export function formatRuntimeStatus(s: RuntimeStatus): string {
    const yn = (b: boolean): string => (b ? '✅ yes' : '❌ no');
    const proxyLine = !s.daemonReachable
        ? '(daemon unreachable)'
        : s.daemonProxy && (s.daemonProxy.http || s.daemonProxy.https)
            ? `${s.daemonProxy.https || s.daemonProxy.http}  (NO_PROXY: ${s.daemonProxy.noProxy || '<none>'})`
            : 'NONE — the daemon pulls external registries directly';
    return [
        'DALi Preview — Runtime Status',
        '─────────────────────────────',
        `Runtime mode   : ${s.mode}`,
        `Docker daemon  : ${s.daemonReachable ? `✅ reachable${s.daemonVersion ? ` (Server ${s.daemonVersion})` : ''}` : `❌ not reachable${s.daemonDetail ? ` — ${s.daemonDetail}` : ''}`}`,
        `Runtime image  : ${s.imageName}`,
        `  ↳ registry   : ${s.registryLabel} (${s.host})`,
        `Version tag    : ${s.tag}`,
        `Installed      : ${yn(s.installed)}${s.installed && s.localVersion ? `  (DALi ${s.localVersion} cached locally)` : s.installed ? '  (cached locally)' : '  (not downloaded)'}`,
        `Daemon proxy   : ${proxyLine}`,
        '',
        `${ICON[s.verdict.level]} ${s.verdict.headline}`,
        `   ${s.verdict.detail}`,
        '',
        'Note: the Docker DAEMON downloads the image (not VS Code), so its network/proxy — shown above — is what matters. On the corp network the internal BART mirror is the reliable source and needs no proxy.',
    ].join('\n');
}

/** Command: "DALi Preview: Runtime Status". Shows the report + a headline toast. */
export async function runtimeStatusCommand(
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    const status = await collectRuntimeStatus(runtime);
    const report = formatRuntimeStatus(status);
    outputChannel.appendLine('');
    outputChannel.appendLine(report);
    outputChannel.show(true);

    const openLog = 'Open Log';
    const download = 'Download Runtime Image';
    const actions = status.verdict.level === 'ok' || status.installed ? [openLog] : [download, openLog];
    const show =
        status.verdict.level === 'error'
            ? vscode.window.showErrorMessage
            : status.verdict.level === 'warn'
                ? vscode.window.showWarningMessage
                : vscode.window.showInformationMessage;
    const picked = await show(`${ICON[status.verdict.level]} ${status.verdict.headline}`, ...actions);
    if (picked === openLog) {
        outputChannel.show(true);
    } else if (picked === download) {
        await vscode.commands.executeCommand('dali.pullRuntimeImage');
    }
}
