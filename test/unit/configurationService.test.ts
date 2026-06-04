import { expect } from 'chai';
import { ConfigurationService } from '../../src/configurationService';

describe('ConfigurationService — runtimeUpdatePolicy', () => {
    it('defaults to "notify" (matching the package.json manifest)', () => {
        // The vscode mock's getConfiguration().get(key, default) returns the
        // supplied default, so this asserts the getter passes 'notify'.
        expect(ConfigurationService.getInstance().runtimeUpdatePolicy).to.equal('notify');
    });
});
