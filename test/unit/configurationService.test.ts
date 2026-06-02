import { expect } from 'chai';
import { ConfigurationService } from '../../src/configurationService';

describe('ConfigurationService — autoCheckRuntimeUpdate', () => {
    it('defaults to true (matching the package.json manifest)', () => {
        // The vscode mock's getConfiguration().get(key, default) returns the
        // supplied default, so this asserts the getter passes `true`.
        expect(ConfigurationService.getInstance().autoCheckRuntimeUpdate).to.equal(true);
    });
});
