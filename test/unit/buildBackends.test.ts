import { expect } from 'chai';
import * as path from 'path';
import { BuildBackend } from '../../src/buildBackend';
import { DockerBackend } from '../../src/backends/dockerBackend';
import { LocalBackend } from '../../src/backends/localBackend';

const fakeOutputChannel = { appendLine() {}, append() {}, show() {}, dispose() {} } as any;

describe('DockerBackend', () => {
    // outputPaths/kind don't touch the DockerRuntime, so a stub is fine.
    const backend = new DockerBackend({} as any, fakeOutputChannel);

    it('is a docker backend that supports the resident server', () => {
        expect(backend.kind).to.equal('docker');
        expect(backend.supportsResidentServer).to.equal(true);
    });

    it('bakes container /work paths but reads back from the host workDir', () => {
        const out = backend.outputPaths('/tmp/dali_preview_x');
        expect(out.pngEmbed).to.equal('/work/preview.png');
        expect(out.metadataEmbed).to.equal('/work/preview_metadata.json');
        expect(out.pngHost).to.equal(path.join('/tmp/dali_preview_x', 'preview.png'));
        expect(out.metadataHost).to.equal(path.join('/tmp/dali_preview_x', 'preview_metadata.json'));
    });
});

describe('LocalBackend', () => {
    const backend: BuildBackend = new LocalBackend(undefined);

    it('is a local backend that supports the resident server + dlopen compile', () => {
        expect(backend.kind).to.equal('local');
        expect(backend.supportsResidentServer).to.equal(true);
        // M2: native resident server → dlopen fast path is available.
        expect(backend.compilePlugin).to.be.a('function');
    });

    it('bakes the host paths (embed === host, no /work indirection)', () => {
        const out = backend.outputPaths('/tmp/dali_preview_x');
        expect(out.pngHost).to.equal(path.join('/tmp/dali_preview_x', 'preview.png'));
        expect(out.pngEmbed).to.equal(path.join('/tmp/dali_preview_x', 'preview.png'));
    });

    it('C++-escapes the embed path when the workDir contains a quote/backslash', () => {
        const out = backend.outputPaths('/tmp/wei"rd\\dir');
        // Host path stays raw (used by fs); the embedded path is escaped for a
        // C++ string literal so the harness still compiles.
        expect(out.pngHost).to.equal(path.join('/tmp/wei"rd\\dir', 'preview.png'));
        expect(out.pngEmbed).to.include('\\"');   // escaped double-quote
        expect(out.pngEmbed).to.include('\\\\');  // escaped backslash
    });
});
