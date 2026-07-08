/*
 * exportHandshake.test.ts — M3bc Task 4: mode-aware exporter-version handshake.
 *
 * The scene exporter (server/preview_export.h) stamps `exportVersion` into the
 * metadata JSON. In DOCKER mode the baked server can lag the extension's
 * compiled-in exporter contract → a stale image mis-renders silently; the
 * handshake must then surface an actionable hint. In LOCAL mode server + harness
 * are compiled from the same checkout, so the check must be a genuine NO-OP.
 *
 * These tests exercise the REAL compare + gate function (exportVersionHint) and
 * drive the docker-vs-local boolean straight from the real PreviewServer.isDockerMode
 * seam (constructed docker vs local), so the mode gate is tested end-to-end. The
 * metadata "read" is stubbed with parsed-JSON objects (what the orchestrator
 * feeds after JSON.parse of the render's metadata file).
 */
import { expect } from 'chai';
import {
    exportVersionHint,
    extractExportVersion,
    EXPECTED_EXPORT_VERSION,
    EXPORT_VERSION_SKEW_HINT,
} from '../../src/exportHandshake';
import { PreviewServer, LocalServerConfig } from '../../src/previewServer';

const fakeOutputChannel = {
    appendLine: () => {},
    append: () => {},
    show: () => {},
    dispose: () => {},
} as any;

const fakeDockerRuntime = {
    imageRef: (tag: string) => `ghcr.io/test/dali-preview-runtime:${tag}`,
    setActiveServerContainer: () => {},
} as any;

const fakeLocalConfig: LocalServerConfig = {
    daliPrefix: '/opt/dali',
    display: ':99',
    serverSrcPath: '/ext/docker/preview_server.cpp',
    serverBinPath: '/tmp/preview_server',
};

/** A real docker-mode PreviewServer (no localConfig → isDockerMode true). */
function dockerServer(): PreviewServer {
    return new PreviewServer('/ext', fakeOutputChannel, '/tmp/dali_preview', fakeDockerRuntime, 'test-tag');
}

/** A real local-mode PreviewServer (localConfig set → isDockerMode false). */
function localServer(): PreviewServer {
    return new PreviewServer('/ext', fakeOutputChannel, '/tmp/dali_preview', undefined, undefined, [], fakeLocalConfig);
}

/** Mirror the orchestrator's parsed-metadata shape (JSON.parse of the render file). */
function metaWith(version: string | undefined): object {
    const meta: any = { root: { name: 'RootLayer', x: 0, y: 0, w: 100, h: 100, children: [] } };
    if (version !== undefined) {
        meta.exportVersion = version;
    }
    return meta;
}

describe('exportHandshake — mode-aware exporter-version gate', () => {
    it('the mode seam is wired to PreviewServer.isDockerMode (docker=true, local=false)', () => {
        // Guards the boolean the orchestrator passes: previewServer.isDockerMode.
        expect(dockerServer().isDockerMode).to.equal(true);
        expect(localServer().isDockerMode).to.equal(false);
    });

    describe('(a) DOCKER mode', () => {
        it('mismatched exportVersion → produces the stale-runtime hint', () => {
            const hint = exportVersionHint(dockerServer().isDockerMode, metaWith('m3b-0-OLD'));
            expect(hint).to.equal(EXPORT_VERSION_SKEW_HINT);
        });

        it('missing exportVersion (pre-handshake stale image) → produces the hint', () => {
            const hint = exportVersionHint(dockerServer().isDockerMode, metaWith(undefined));
            expect(hint).to.equal(EXPORT_VERSION_SKEW_HINT);
        });

        it('matching exportVersion → no hint (up-to-date image)', () => {
            const hint = exportVersionHint(dockerServer().isDockerMode, metaWith(EXPECTED_EXPORT_VERSION));
            expect(hint).to.equal(undefined);
        });

        it('no metadata (null) → no hint (a different failure, do not nag)', () => {
            expect(exportVersionHint(dockerServer().isDockerMode, null)).to.equal(undefined);
        });
    });

    describe('(b) LOCAL mode — genuine no-op regardless of version', () => {
        it('mismatched exportVersion → NO check, no hint', () => {
            expect(exportVersionHint(localServer().isDockerMode, metaWith('m3b-0-OLD'))).to.equal(undefined);
        });

        it('missing exportVersion → NO check, no hint', () => {
            expect(exportVersionHint(localServer().isDockerMode, metaWith(undefined))).to.equal(undefined);
        });

        it('matching exportVersion → no hint', () => {
            expect(exportVersionHint(localServer().isDockerMode, metaWith(EXPECTED_EXPORT_VERSION))).to.equal(undefined);
        });

        it('does not even inspect the metadata (no-op even with a throwing getter)', () => {
            // Local mode returns before touching metadata — a property access that
            // would throw proves the metadata is never read.
            const booby = {} as any;
            Object.defineProperty(booby, 'exportVersion', {
                get() { throw new Error('metadata must not be inspected in local mode'); },
            });
            expect(() => exportVersionHint(localServer().isDockerMode, booby)).to.not.throw();
            expect(exportVersionHint(localServer().isDockerMode, booby)).to.equal(undefined);
        });
    });

    describe('extractExportVersion', () => {
        it('reads a string exportVersion key', () => {
            expect(extractExportVersion(metaWith('m3b-9'))).to.equal('m3b-9');
        });
        it('returns undefined for null / non-object / non-string key', () => {
            expect(extractExportVersion(null)).to.equal(undefined);
            expect(extractExportVersion('nope')).to.equal(undefined);
            expect(extractExportVersion({ exportVersion: 42 })).to.equal(undefined);
            expect(extractExportVersion(metaWith(undefined))).to.equal(undefined);
        });
    });

    it('the extension constant tracks the header (documents the coupling)', () => {
        // server/preview_export.h currently returns "m3b-1"; if that C++ constant is
        // bumped, this TS constant MUST be bumped in lockstep or the handshake would
        // false-positive on a correctly-matched image.
        expect(EXPECTED_EXPORT_VERSION).to.equal('m3b-1');
    });
});
