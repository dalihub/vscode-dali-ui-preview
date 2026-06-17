import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    BuildBackend, CaptureRequest, CaptureResult,
    CompilePluginRequest, CompilePluginResult, BackendIssue, OutputPaths,
} from '../buildBackend';
import { DockerRuntime } from '../dockerRuntime';
import { ConfigurationService } from '../configurationService';
import { ensureRuntimeImage } from '../pullImageCommand';
import { getLogger } from '../logger';

/**
 * Docker runtime backend — compiles + renders inside the DALi runtime
 * container. This is the default; it needs no host DALi install.
 *
 * Wraps the existing DockerRuntime, keeping the container/host path duality
 * (the harness writes to `/work/...`, the host reads from `tmpDir/...`) and
 * the image-availability checks inside this backend so BuildRunner's
 * templating stays backend-agnostic.
 */
export class DockerBackend implements BuildBackend {
    readonly kind = 'docker' as const;
    readonly supportsResidentServer = true;

    constructor(
        private readonly dockerRuntime: DockerRuntime,
        private readonly outputChannel: vscode.OutputChannel,
    ) {}

    outputPaths(workDir: string): OutputPaths {
        // The container sees the host workDir bind-mounted at /work, so the
        // harness writes container paths while the host reads from workDir.
        // Neither path needs C++ escaping (no special chars).
        return {
            pngEmbed: '/work/preview.png',
            metadataEmbed: '/work/preview_metadata.json',
            pngHost: path.join(workDir, 'preview.png'),
            metadataHost: path.join(workDir, 'preview_metadata.json'),
        };
    }

    async validate(): Promise<BackendIssue[]> {
        if (await this.dockerRuntime.isAvailable()) {
            return [];
        }
        return [{
            kind: 'docker',
            message: 'Docker is not available.',
            action: 'Run "DALi: Install Docker via Terminal" from the Command Palette — no reboot needed.',
        }];
    }

    async capture(req: CaptureRequest): Promise<CaptureResult> {
        const log = getLogger();
        if (!(await this.dockerRuntime.isAvailable())) {
            return {
                success: false,
                error: 'Docker is not available. Run "DALi: Install Docker via Terminal" from the Command Palette to set it up — no reboot needed.',
            };
        }

        const imageTag = ConfigurationService.getInstance().daliVersionTag;
        const imageRef = this.dockerRuntime.imageRef(imageTag);

        // Auto-pull (with progress) instead of telling the user to do it
        // manually — consistent with the preview-server path.
        if (!(await ensureRuntimeImage(this.dockerRuntime, this.outputChannel))) {
            return {
                success: false,
                error: `DALi runtime image not available: ${imageRef}. ` +
                    `Download it with "DALi Preview: Download Runtime Image".`,
            };
        }

        log.debug('Build', 'docker buildAndCapture start', { imageRef, width: req.width, height: req.height });
        const result = await this.dockerRuntime.buildAndCapture({
            source: req.source,
            workDir: req.workDir,
            imageTag,
            width: req.width,
            height: req.height,
            timeoutMs: req.timeoutMs ?? 60_000,
        });

        if (!result.success) {
            return {
                success: false,
                error: `Docker render failed (exit ${result.exitCode}):\n${result.output}`,
                output: result.output,
            };
        }

        if (!fs.existsSync(req.pngPathHost)) {
            return {
                success: false,
                error: `Container exited 0 but PNG not found at ${req.pngPathHost}.\nContainer output:\n${result.output}`,
                output: result.output,
            };
        }

        log.debug('Build', 'docker buildAndCapture done', { pngPathHost: req.pngPathHost, elapsedMs: result.elapsedMs });
        return {
            success: true,
            pngPath: req.pngPathHost,
            metadataPath: fs.existsSync(req.metadataPathHost) ? req.metadataPathHost : undefined,
        };
    }

    async compilePlugin(req: CompilePluginRequest): Promise<CompilePluginResult> {
        const log = getLogger();
        if (!(await this.dockerRuntime.isAvailable())) {
            return { success: false, error: 'Docker is not available.' };
        }
        const imageTag = ConfigurationService.getInstance().daliVersionTag;
        const result = await this.dockerRuntime.compilePlugin({
            source: req.source,
            workDir: req.workDir,
            srcPath: req.srcPath,
            soPath: req.soPath,
            imageTag,
            timeoutMs: req.timeoutMs ?? 30_000,
        });
        if (!result.success) {
            log.debug('Build', 'docker compilePlugin failed', { elapsedMs: result.elapsedMs });
            return { success: false, error: `Plugin compile failed (docker, ${result.elapsedMs}ms):\n${result.output}` };
        }
        log.debug('Build', 'docker compilePlugin done', { soPath: req.soPath, elapsedMs: result.elapsedMs });
        return { success: true, soPath: req.soPath };
    }
}
