/*
 * historicalBreaks.test.ts — regression guard + living documentation.
 *
 * The dali-ui code-sync agent's whole reason to exist is catching the kinds of
 * dali-ui API changes that have historically broken previews. This test pins,
 * in ONE place, every documented historical break and how the shared skew
 * detector (src/skewSignature.ts, used by the agent's gate + the live error
 * hint) classifies each. If someone weakens the detector, the relevant case
 * flips and this test fails.
 *
 * Two detection tiers (both BLOCK a publish — the gate goes RED on any compile
 * failure; the difference is only whether the user/agent also gets the
 * actionable "stale runtime — update the image" hint):
 *   - SKEW-CLASSIFIED  = a `'<Dali type>' has no member named '<X>'` error →
 *     isRuntimeApiSkew() true → stale-runtime hint. (rename/removed member class)
 *   - GENERIC-RED      = a different compile-error shape (void-chaining, overload
 *     mis-resolution) → isRuntimeApiSkew() false → still fails the compile so the
 *     gate blocks it, just without the skew-specific hint.
 *
 * g++ quotes identifiers with Unicode curly quotes (U+2018/U+2019) — the fixtures
 * below use the real curly-quote characters, as g++ actually emits them.
 */
import * as assert from 'assert';
import { isRuntimeApiSkew } from '../../src/skewSignature';

// Each historical event: the dali-ui change, a representative g++ stderr line,
// and whether the skew detector should classify it as a stale-runtime skew.
const HISTORICAL_BREAKS: ReadonlyArray<{
    event: string;
    date: string;
    daliUi: string;
    stderr: string;
    skewClassified: boolean;
    note: string;
}> = [
    {
        event: '#1 fluent-era setter/type rename',
        date: '2026-04-28',
        daliUi: 'pre-2.5.24',
        // Void setters: `.SetAlignItems(...)` returns void, so chaining `.X()` on it
        // is "member in non-class type void" — NOT a "has no member named" error.
        stderr: "error: request for member ‘SetAlignItems’ in ‘...’, which is of non-class type ‘void’",
        skewClassified: false,
        note: 'GENERIC-RED: void-chaining error shape; still fails compile → gate blocks.',
    },
    {
        event: '#2 signal.h SignalMixin — member Connect mis-resolves',
        date: '2026-06-04',
        daliUi: '2.5.19+',
        stderr: "error: no matching function for call to ‘Dali::Signal<void ()>::Connect(PreviewServer*, ...)’",
        skewClassified: false,
        note: 'GENERIC-RED: overload-resolution failure, not a missing member → gate blocks (no skew hint).',
    },
    {
        event: '#3 fluent removal — Children→AddChildren',
        date: '2026-06-23',
        daliUi: '2.5.26',
        stderr: "‘class Dali::Ui::FlexLayout’ has no member named ‘AddChildren’; did you mean ‘Children’?",
        skewClassified: true,
        note: 'SKEW: missing member on a Dali::Ui type.',
    },
    {
        event: '#4 focus API — SetAlwaysShowFocus removed (v2.5.28)',
        date: '2026-07-07',
        daliUi: '2.5.28',
        stderr: "‘class Dali::Ui::UiConfig’ has no member named ‘SetDefaultFocusIndicatorEnabled’",
        skewClassified: true,
        note: 'SKEW: missing member on Dali::Ui::UiConfig (reproduced live against the dali_2.5.26 image).',
    },
    {
        event: '#5 actor coordinate-convention — CalculateScreenExtents (dali-CORE)',
        date: '2026-07-07',
        daliUi: '2.5.28',
        // The member lives on Dali::Actor (dali-core), NOT Dali::Ui — this is exactly
        // why the detector must match ANY qualified Dali:: type, not just Dali::Ui::.
        stderr: "‘class Dali::Actor’ has no member named ‘CalculateScreenExtents’",
        skewClassified: true,
        note: 'SKEW: dali-CORE member — caught only because the regex matches Dali(::\\w+)+, not just Dali::Ui::.',
    },
    {
        event: '#6 dali-adaptor 2.5.29 Window API rename',
        date: '2026-07-07',
        daliUi: 'adaptor 2.5.29',
        stderr: "‘class Dali::Window’ has no member named ‘GetSize’",
        skewClassified: true,
        note: 'SKEW: dali-ADAPTOR member (Dali::Window) — likewise needs the broadened Dali:: match.',
    },
];

describe('historical dali-ui breaks — detection coverage (regression guard)', () => {
    for (const b of HISTORICAL_BREAKS) {
        it(`${b.event} (${b.daliUi}, ${b.date}) → ${b.skewClassified ? 'SKEW-classified' : 'generic RED'}`, () => {
            assert.strictEqual(
                isRuntimeApiSkew(b.stderr),
                b.skewClassified,
                `${b.event}: expected isRuntimeApiSkew=${b.skewClassified}. ${b.note}\n  stderr: ${b.stderr}`,
            );
        });
    }

    it('covers all 6 documented historical events', () => {
        assert.strictEqual(HISTORICAL_BREAKS.length, 6);
    });

    it('the "has no member" class (rename/removed) is always skew-classified — incl. dali-core/adaptor types', () => {
        // Guards the broadened regex: a break on Dali::Actor / Dali::Window (not just
        // Dali::Ui::) must still get the stale-runtime hint. A Dali::Ui::-only regex
        // would silently miss events #5 and #6.
        const memberBreaks = HISTORICAL_BREAKS.filter((b) => /has no member named/.test(b.stderr));
        for (const b of memberBreaks) {
            assert.ok(isRuntimeApiSkew(b.stderr), `${b.event} must be skew-classified`);
        }
        assert.ok(memberBreaks.length >= 4, 'at least #3/#4/#5/#6 are missing-member breaks');
    });

    it('does NOT skew-classify an ordinary (non-Dali) compile error', () => {
        assert.strictEqual(isRuntimeApiSkew("‘class std::vector<int>’ has no member named ‘pushback’"), false);
        assert.strictEqual(isRuntimeApiSkew('error: expected ‘;’ before ‘}’ token'), false);
    });
});
