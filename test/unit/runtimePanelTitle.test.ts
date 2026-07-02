/*
 * runtimePanelTitle.test.ts — the preview panel tab title must reveal which
 * runtime is currently rendering (local vs docker), so a developer who switched
 * runtimes via "Select Runtime Version" can tell at a glance which one is live.
 */

import { expect } from 'chai';
import { runtimePanelTitle } from '../../src/previewManager';

describe('runtimePanelTitle', () => {
    it('labels local runtime', () => {
        expect(runtimePanelTitle('local', 'latest')).to.equal('DALi Preview — Local');
    });

    it('labels docker runtime with its version tag', () => {
        expect(runtimePanelTitle('docker', 'dali_2.5.26')).to.equal(
            'DALi Preview — Docker (dali_2.5.26)',
        );
    });

    it('ignores the version tag in local mode', () => {
        expect(runtimePanelTitle('local', 'dali_2.5.26')).to.equal('DALi Preview — Local');
    });
});
