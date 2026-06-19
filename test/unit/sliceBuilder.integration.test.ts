import { expect } from 'chai';
import { buildSlice, findPreviewFunction } from '../../src/sliceBuilder';
import { instrumentCode } from '../../src/codeExtractor';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Orchestrator path coverage: runPreview passes the *instrumented* body (with
 * __tag wrappers) to buildSlice, not the raw body. This asserts that __tag
 * wrapping doesn't change which refs get resolved (so globals are identical),
 * and emits the full sliced .cpp for the out-of-band docker compile gate
 * (see docs/autoplan/m4/exec-validation.md).
 */
describe('slice orchestrator path (instrumented body)', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'slice');
    const tpl = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'server', 'preview_plugin.cpp.template'), 'utf8');

    function sliceInstrumented(fixture: string) {
        const src = fs.readFileSync(path.join(dir, fixture), 'utf8');
        const fn = findPreviewFunction(src);
        expect(fn, `${fixture}: preview function not found`).to.not.be.null;
        const instrumented = instrumentCode(fn!.body, 0);
        return { slice: buildSlice(src, fixture, instrumented) };
    }

    it('instrumented helper body still collects the same-file helper (heuristic)', () => {
        const { slice } = sliceInstrumented('helper_same_file.cpp');
        expect(slice.rung).to.equal('heuristic');
        expect(slice.globals).to.include('MakeChip');
    });

    it('instrumented member body still stubs unresolved members', () => {
        const { slice } = sliceInstrumented('member_field.cpp');
        expect(slice.unresolvedStubs).to.include.members(['mName', 'mAccent']);
    });

    it('every shipped .preview.dali.cpp sample stays on the single-fn path (byte-identical)', () => {
        // Regression guard (external-review M4): a self-contained sample must NOT
        // flip to the heuristic slice path, or it would no longer be byte-identical.
        const samplesDir = path.join(__dirname, '..', '..', '..', 'test', 'samples');
        const walk = (d: string): string[] =>
            fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
                e.isDirectory() ? walk(path.join(d, e.name))
                    : e.name.endsWith('.preview.dali.cpp') ? [path.join(d, e.name)] : []);
        const flipped: string[] = [];
        for (const f of walk(samplesDir)) {
            const slice = buildSlice(fs.readFileSync(f, 'utf8'), f);
            if (slice.rung !== 'single-fn') { flipped.push(`${path.basename(f)} → ${slice.unresolvedStubs.join(',')}`); }
        }
        expect(flipped, `samples flipped to heuristic: ${flipped.join(' | ')}`).to.deep.equal([]);
    });

    it('emits compilable slices for the docker gate', () => {
        fs.mkdirSync('/tmp/slicechk', { recursive: true });
        for (const f of ['helper_same_file', 'member_field', 'theme_const']) {
            const { slice } = sliceInstrumented(`${f}.cpp`);
            const cpp = tpl
                .replace(/\{\{USER_INCLUDES\}\}/g, slice.includes)
                .replace(/\{\{USER_GLOBALS\}\}/g, slice.globals)
                // M3 (ADR-004) install slots — empty on the slice path (byte-neutral).
                .replace(/\{\{PALETTE_DEFS\}\}/g, '')
                .replace(/\{\{UI_CONFIG_SETUP\}\}/g, '')
                .replace(/\{\{PRE_BUILD_INSTALL\}\}/g, '')
                .replace(/\{\{USER_CODE\}\}/g, slice.body);
            fs.writeFileSync(`/tmp/slicechk/instr_${f}.cpp`, cpp);
        }
        expect(fs.existsSync('/tmp/slicechk/instr_helper_same_file.cpp')).to.equal(true);
    });
});
