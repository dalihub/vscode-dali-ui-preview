import { expect } from 'chai';
import { shouldPromptRuntimeModeReload } from '../../src/localRuntimeCommand';

/*
 * Hole (task 2): a user who edits daliPreview.runtimeMode directly in the Settings UI /
 * settings.json got NO feedback — the backend is frozen at activation, so the change was
 * a silent no-op. The activate() config listener must prompt a reload in that case, but
 * must NOT double-prompt when one of the extension's own runtime-switch commands made the
 * change (those already show their own reload prompt). shouldPromptRuntimeModeReload is the
 * pure decision behind that listener.
 */
describe('shouldPromptRuntimeModeReload', () => {
    it('prompts when an EXTERNAL edit changes the resolved mode away from the active one', () => {
        // affectsRuntimeMode, wasRecentSelfWrite=false (external), new !== active
        expect(shouldPromptRuntimeModeReload(true, false, 'local', 'docker')).to.equal(true);
        expect(shouldPromptRuntimeModeReload(true, false, 'docker', 'local')).to.equal(true);
    });

    it('does NOT prompt when the extension itself just wrote runtimeMode (avoids a double reload prompt)', () => {
        expect(shouldPromptRuntimeModeReload(true, true, 'local', 'docker')).to.equal(false);
    });

    it('does NOT prompt when the event is unrelated to runtimeMode', () => {
        expect(shouldPromptRuntimeModeReload(false, false, 'local', 'docker')).to.equal(false);
    });

    it('does NOT prompt when the resolved mode still equals the active mode (no effective change)', () => {
        // e.g. an external edit to a shadowed scope that does not change the winning value
        expect(shouldPromptRuntimeModeReload(true, false, 'docker', 'docker')).to.equal(false);
    });
});
