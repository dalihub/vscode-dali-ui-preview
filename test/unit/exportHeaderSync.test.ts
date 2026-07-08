/*
 * exportHeaderSync.test.ts — guard the single-source exporter header.
 *
 * The Family-1 scene-graph exporter lives in ONE canonical file,
 * `server/preview_export.h`. Two compile paths consume it:
 *   - the full-build harness (`server/preview_harness.cpp.template`) and the
 *     native preview_server compile find it via the bundled `server/` dir
 *     (staged next to the source / added with `-I <ext>/server`);
 *   - the BAKED docker server (`docker/preview_server.cpp`) is compiled inside
 *     the image, whose build context is `docker/` only — so it needs the header
 *     in that context. `docker/preview_export.h` is an EXACT byte-for-byte mirror
 *     of the canonical file (Dockerfile.runtime COPYs it next to preview_server.cpp).
 *
 * This test fails the moment the two diverge, so the mirror can never silently
 * drift from the source (edit ONLY server/preview_export.h, then re-copy it to
 * docker/preview_export.h). This preserves the M3b "one exporter, no drift"
 * guarantee across the context boundary.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const CANONICAL = path.join(REPO_ROOT, 'server', 'preview_export.h');
const DOCKER_MIRROR = path.join(REPO_ROOT, 'docker', 'preview_export.h');

describe('exportHeaderSync', () => {
    it('docker/preview_export.h is a byte-for-byte mirror of server/preview_export.h', () => {
        expect(fs.existsSync(CANONICAL), `missing canonical exporter header: ${CANONICAL}`).to.equal(true);
        expect(fs.existsSync(DOCKER_MIRROR), `missing docker mirror header: ${DOCKER_MIRROR}`).to.equal(true);

        const canonical = fs.readFileSync(CANONICAL);
        const mirror = fs.readFileSync(DOCKER_MIRROR);

        expect(
            mirror.equals(canonical),
            'docker/preview_export.h has drifted from server/preview_export.h — '
            + 're-copy the canonical header: cp server/preview_export.h docker/preview_export.h',
        ).to.equal(true);
    });
});
