/*
 * packaging.test.ts — guard that the full-build harness header actually SHIPS in the VSIX.
 *
 * The full-build preview harness (server/preview_harness.cpp.template) #includes
 * server/preview_export.h. If packaging ever drops that header (e.g. a new
 * `.vscodeignore` pattern excludes `server/`), a user's fresh compile fails with a
 * missing-header error — but nothing today catches that: exportHeaderSync.test.ts
 * only checks the header's CONTENT matches the docker mirror, not that it is
 * present-in-the-package. This test asserts the header (a) exists on disk and (b) is
 * not excluded by any `.vscodeignore` pattern (and that `server/` is not
 * blanket-ignored).
 *
 * Pure fs/string test — no vsce, no packaging step, no network — so it runs anywhere
 * CI runs. The glob matcher below approximates gitignore/vsce ignore semantics; it is
 * intentionally conservative (leans toward "excluded") so a future `server/**` gets caught.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const HEADER_REL = 'server/preview_export.h';
const HEADER_ABS = path.join(REPO_ROOT, HEADER_REL);
const VSCODEIGNORE = path.join(REPO_ROOT, '.vscodeignore');

// glob → RegExp with gitignore-ish semantics: `**` = any chars (incl. `/`),
// `*` = any chars except `/`, `?` = one non-`/`; every other char is literal.
function globToRegExp(glob: string): RegExp {
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
            if (glob[i + 1] === '*') {
                re += '.*';
                i++; // consume the second '*'
            } else {
                re += '[^/]*';
            }
        } else if (c === '?') {
            re += '[^/]';
        } else if ('.+^${}()|[]\\/'.includes(c)) {
            re += '\\' + c;
        } else {
            re += c;
        }
    }
    return new RegExp('^' + re + '$');
}

// A `.vscodeignore` glob "matches" `rel` if the path itself, a dir-prefix, or an
// any-depth variant of the pattern matches — approximating how vsce excludes files.
function patternMatches(rel: string, pattern: string): boolean {
    const p = pattern.replace(/\/+$/, '');
    const variants = [p, `${p}/**`, `**/${p}`, `**/${p}/**`];
    return variants.some((v) => globToRegExp(v).test(rel));
}

interface ParsedIgnore { ignores: string[]; negations: string[]; }

function parseVscodeignore(text: string): ParsedIgnore {
    const ignores: string[] = [];
    const negations: string[] = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        if (line.startsWith('!')) {
            negations.push(line.slice(1));
        } else {
            ignores.push(line);
        }
    }
    return { ignores, negations };
}

// True if `rel` would be excluded from the VSIX under these patterns (an ignore
// matches and no later `!negation` re-includes it).
function isExcluded(rel: string, parsed: ParsedIgnore): boolean {
    const matched = parsed.ignores.some((p) => patternMatches(rel, p));
    if (!matched) {
        return false;
    }
    return !parsed.negations.some((p) => patternMatches(rel, p));
}

describe('packaging (VSIX ships the full-build harness header)', () => {
    it('server/preview_export.h exists on disk', () => {
        expect(
            fs.existsSync(HEADER_ABS),
            `missing full-build harness header: ${HEADER_ABS}`,
        ).to.equal(true);
    });

    it('.vscodeignore does NOT exclude server/preview_export.h from the package', () => {
        expect(fs.existsSync(VSCODEIGNORE), 'missing .vscodeignore').to.equal(true);
        const parsed = parseVscodeignore(fs.readFileSync(VSCODEIGNORE, 'utf8'));
        expect(
            isExcluded(HEADER_REL, parsed),
            `.vscodeignore excludes ${HEADER_REL} — the full-build harness compile would fail `
                + 'with a missing header. Remove or adjust the offending pattern.',
        ).to.equal(false);
    });

    it('server/ is not blanket-ignored in .vscodeignore', () => {
        const parsed = parseVscodeignore(fs.readFileSync(VSCODEIGNORE, 'utf8'));
        const blanket = parsed.ignores
            .map((p) => p.replace(/\/+$/, ''))
            .some((p) => p === 'server' || p === 'server/*' || p === 'server/**');
        expect(
            blanket,
            'server/ is blanket-ignored in .vscodeignore — server/*.h would not ship.',
        ).to.equal(false);
    });

    // Sensitivity check: the matcher MUST flag a hypothetical `server/**` ignore, so
    // this guard cannot silently rot into a no-op if the semantics ever regress.
    it('matcher is sensitive: a hypothetical server/** pattern WOULD be detected', () => {
        expect(isExcluded(HEADER_REL, { ignores: ['server/**'], negations: [] })).to.equal(true);
        expect(isExcluded(HEADER_REL, { ignores: ['server'], negations: [] })).to.equal(true);
    });
});
