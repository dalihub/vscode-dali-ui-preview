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

    it('accepts ASCII quotes too', () => {
        assert.ok(isRuntimeApiSkew("'class Dali::Ui::View' has no member named 'AddChildren'"));
    });

    it('does NOT flag an unrelated compile error', () => {
        assert.strictEqual(isRuntimeApiSkew('error: expected ‘;’ before ‘}’ token'), false);
    });
});
