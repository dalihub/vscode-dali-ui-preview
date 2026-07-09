import * as assert from 'assert';
import { isRuntimeApiSkew } from '../../src/skewSignature';

describe('isRuntimeApiSkew', () => {
    it('flags the AddChildren rename (curly quotes, as g++ emits)', () => {
        assert.ok(isRuntimeApiSkew(
            '‘class Dali::Ui::FlexLayout’ has no member named ‘AddChildren’; did you mean ‘Children’?'));
    });

    it('flags the removed focus API (SetAlwaysShowFocus)', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Ui::UiConfig’ has no member named ‘SetAlwaysShowFocus’"));
    });

    it('flags SetDefaultFocusIndicatorEnabled skew', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Ui::UiConfig’ has no member named ‘SetDefaultFocusIndicatorEnabled’"));
    });

    it('flags a FUTURE rename with no hardcoded name (any missing member on a Dali::Ui type)', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Ui::View’ has no member named ‘SomeNewApi2027’"));
    });

    it('flags dali-CORE skew (Dali::Actor, not just Dali::Ui::) — curly quotes', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Actor’ has no member named ‘CalculateScreenExtents’"));
    });

    it('flags dali-ADAPTOR skew (Dali::Window) — curly quotes', () => {
        assert.ok(isRuntimeApiSkew("‘class Dali::Window’ has no member named ‘GetSize’"));
    });

    it('accepts ASCII quotes too', () => {
        assert.ok(isRuntimeApiSkew("'class Dali::Ui::View' has no member named 'AddChildren'"));
        assert.ok(isRuntimeApiSkew("'class Dali::Actor' has no member named 'CalculateScreenExtents'"));
    });

    it('does NOT flag an unrelated compile error', () => {
        assert.strictEqual(isRuntimeApiSkew('error: expected ‘;’ before ‘}’ token'), false);
    });

    it('does NOT flag a missing member on a NON-Dali type (no false positive)', () => {
        assert.strictEqual(isRuntimeApiSkew("‘class std::vector<int>’ has no member named ‘push’"), false);
    });
});
