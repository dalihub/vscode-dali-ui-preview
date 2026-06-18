import { expect } from 'chai';
import {
    parseGccErrors,
    diagnoseGccErrors,
    formatErrorsForDisplay,
} from '../../src/errorParser';

/**
 * WU-M4.5 — cross-file error-line mapping via `#line` + dynamic sourcePaths.
 *
 * After the slice prefixes each inlined def with a `#line <origLine> "<origPath>"`
 * directive, g++ reports a broken symbol (e.g. `theme::ACCENT` → `ACCENTX`) against
 * the user's REAL file:line — `widgets/cards.cpp:38` (an inlined factory, which the
 * old single-offset arithmetic could never map back because globals sit ABOVE the
 * {{USER_CODE}} slot) and `screens/wallet_screen.cpp:28` (the preview body). The old
 * errorParser filename gate only passed `preview_harness`/`preview_plugin`, silently
 * dropping these original-file errors. With `sourcePaths` it must pass them through
 * with their (file, line) as-is — no offset math — and NOT drop them.
 */
describe('errorParser cross-file #line mapping (WU-M4.5)', () => {
    const ENTRY = '/abs/samples/flow-wallet/screens/wallet_screen.cpp';
    const CARDS = '/abs/samples/flow-wallet/widgets/cards.cpp';
    const HARNESS_OFFSET = 30; // irrelevant for the passthrough rows; pinned anyway

    // The g++ stderr AFTER `#line` relabeling: both errors point at the user's real
    // files (1-based lines), exactly the §2(c) form the spec quotes.
    const stderr = [
        `${CARDS}:38:89: error: 'ACCENTX' is not a member of 'wallet::theme'`,
        `${ENTRY}:28:84: error: 'ACCENTX' is not a member of 'wallet::theme'`,
    ].join('\n');

    it('passes through both original-file errors with file:line as-is (no offset math)', () => {
        const errors = parseGccErrors(stderr, HARNESS_OFFSET, false, false, [ENTRY, CARDS]);

        // Both errors survive (NOT dropped by the harness-only filename gate).
        expect(errors).to.have.length(2);

        const byFile = new Map(errors.map((e) => [e.file, e]));
        // cards.cpp:38 → 0-based line 37, attributed to cards.cpp, no harness offset.
        const cardsErr = byFile.get(CARDS)!;
        expect(cardsErr, 'cards.cpp error present').to.not.equal(undefined);
        expect(cardsErr.line).to.equal(37);          // 38 (1-based) - 1, NOT 38 - offset
        expect(cardsErr.column).to.equal(89);
        expect(cardsErr.message).to.include('ACCENTX');
        // wallet_screen.cpp:28 → 0-based line 27, attributed to the entry file.
        const entryErr = byFile.get(ENTRY)!;
        expect(entryErr, 'wallet_screen.cpp error present').to.not.equal(undefined);
        expect(entryErr.line).to.equal(27);          // 28 (1-based) - 1
        expect(entryErr.column).to.equal(84);
    });

    it('the displayed line is the original 1-based line (37→"Line 38", 27→"Line 28")', () => {
        const errors = parseGccErrors(stderr, HARNESS_OFFSET, false, false, [ENTRY, CARDS]);
        const display = formatErrorsForDisplay(errors);
        expect(display).to.include('Line 38'); // cards.cpp original line
        expect(display).to.include('Line 28'); // wallet_screen.cpp original line
    });

    it('diagnoseGccErrors threads sourcePaths and does not drop the cross-file errors', () => {
        // A doc large enough that the entry-file line (27) is in range; the foreign
        // cards.cpp line (37) clamps gracefully — the mapping (file/line) is the point.
        const fakeDoc = {
            uri: { fsPath: ENTRY },
            lineCount: 200,
            lineAt: (_n: number) => ({ text: 'placeholder line content' }),
        } as any;
        const result = diagnoseGccErrors(stderr, HARNESS_OFFSET, fakeDoc, 0, false, false, [ENTRY, CARDS]);
        expect(result).to.not.equal(null);
        expect(result!.diagnostics.length).to.equal(2);
        expect(result!.displayMessage).to.include('Line 38');
        expect(result!.displayMessage).to.include('Line 28');
    });

    // -----------------------------------------------------------------
    // Control: WITHOUT sourcePaths, behavior is byte-identical to today —
    // original-file errors are dropped (only harness/plugin errors pass).
    // -----------------------------------------------------------------
    it('control: no sourcePaths → original-file errors are dropped (existing behavior)', () => {
        const errors = parseGccErrors(stderr, HARNESS_OFFSET, false, false);
        expect(errors).to.have.length(0); // neither is a preview_harness/plugin file
    });

    it('control: an empty sourcePaths array is the same as omitting it', () => {
        expect(parseGccErrors(stderr, HARNESS_OFFSET, false, false, [])).to.have.length(0);
    });

    it('control: harness errors still map via the offset when sourcePaths is set', () => {
        // A genuine harness error must STILL be offset-mapped; sourcePaths only
        // adds the passthrough, it must not disturb the harness path.
        const mixed = [
            `${CARDS}:38:89: error: 'ACCENTX' is not a member of 'wallet::theme'`,
            '/tmp/dali_preview/preview_harness.cpp:45:3: error: harness-relative error',
        ].join('\n');
        const errors = parseGccErrors(mixed, HARNESS_OFFSET, false, false, [ENTRY, CARDS]);
        expect(errors).to.have.length(2);
        const harnessErr = errors.find((e) => e.file === undefined)!;
        expect(harnessErr, 'harness error present').to.not.equal(undefined);
        expect(harnessErr.line).to.equal(45 - HARNESS_OFFSET); // offset arithmetic preserved
        const cardsErr = errors.find((e) => e.file === CARDS)!;
        expect(cardsErr.line).to.equal(37); // passthrough, no offset
    });

    it('tolerates g++ normalizing the path to a basename-equal relative form', () => {
        // If g++ echoes a normalized path whose basename matches the sourcePath, it
        // still maps (basename + suffix agreement), never to an unrelated file.
        const rel = [
            `widgets/cards.cpp:38:89: error: 'ACCENTX' is not a member of 'wallet::theme'`,
        ].join('\n');
        const errors = parseGccErrors(rel, HARNESS_OFFSET, false, false, [CARDS]);
        expect(errors).to.have.length(1);
        expect(errors[0].file).to.equal(CARDS);
        expect(errors[0].line).to.equal(37);
    });
});
