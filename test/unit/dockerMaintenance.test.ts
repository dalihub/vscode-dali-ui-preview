import { expect } from 'chai';
import { clearFirstRunFlags } from '../../src/dockerMaintenance';
import { DOCKER_ONBOARDING_KEY } from '../../src/dockerOnboarding';
import { FIRST_LAUNCH_KEY } from '../../src/walkthroughController';

/** Minimal in-memory stand-in for vscode.Memento. */
function fakeMemento(initial: Record<string, any> = {}) {
    const store = new Map<string, any>(Object.entries(initial));
    return {
        get: (k: string) => store.get(k),
        update: (k: string, v: any) => {
            if (v === undefined) store.delete(k);
            else store.set(k, v);
            return Promise.resolve();
        },
        keys: () => [...store.keys()],
    } as any;
}

describe('clearFirstRunFlags', () => {
    it('removes both first-run flags so onboarding re-arms', async () => {
        const gs = fakeMemento({
            [DOCKER_ONBOARDING_KEY]: true,
            [FIRST_LAUNCH_KEY]: true,
            'daliPreview.lastUpdateCheck.v1': 123, // unrelated key must survive
        });
        await clearFirstRunFlags(gs);
        expect(gs.get(DOCKER_ONBOARDING_KEY)).to.equal(undefined);
        expect(gs.get(FIRST_LAUNCH_KEY)).to.equal(undefined);
        expect(gs.get('daliPreview.lastUpdateCheck.v1')).to.equal(123);
    });

    it('is safe when the flags are already absent', async () => {
        const gs = fakeMemento({});
        await clearFirstRunFlags(gs);
        expect(gs.get(DOCKER_ONBOARDING_KEY)).to.equal(undefined);
        expect(gs.keys()).to.deep.equal([]);
    });
});
