import * as assert from 'assert';
import { checkExpectedRects, findFirstNode, MetaNode } from '../e2e/metadataCheck';

// Subset of a real focus-grid metadata export (test/e2e/actual/focus-grid.metadata.json).
const focusGrid: { root: MetaNode } = {
    root: {
        name: 'RootLayer', x: 0, y: 0, w: 480, h: 320, children: [
            {
                name: '', type: 'FlexLayoutImpl', x: 0, y: 0, w: 480, h: 320, visible: true, opacity: 1, children: [
                    { name: '', type: 'ViewImpl', x: 7.5, y: 85, w: 150, h: 150, visible: true, opacity: 1 },
                    { name: 'card2', type: 'ViewImpl', x: 165, y: 85, w: 150, h: 150, visible: true, opacity: 1 },
                    { name: '', type: 'ViewImpl', x: 322.5, y: 85, w: 150, h: 150, visible: true, opacity: 1 },
                ],
            },
        ],
    },
};

describe('checkExpectedRects', () => {
    it('finds a node by name', () => {
        const n = findFirstNode(focusGrid, (m) => m.name === 'card2');
        assert.ok(n && n.x === 165);
    });

    it('passes when the actor sits at its expected rect', () => {
        const err = checkExpectedRects(focusGrid, [{ name: 'card2', x: 165, y: 85, w: 150, h: 150 }]);
        assert.strictEqual(err, null);
    });

    it('fails when the actor drifts on-screen (checkMetadataOnScreen would miss this)', () => {
        const err = checkExpectedRects(focusGrid, [{ name: 'card2', x: 215, y: 85, w: 150, h: 150 }]);
        assert.ok(err && /rect drift/.test(err), `expected drift failure, got: ${err}`);
    });

    it('fails when the named actor is absent', () => {
        const err = checkExpectedRects(focusGrid, [{ name: 'nope', x: 0, y: 0, w: 1, h: 1 }]);
        assert.ok(err && /not found/.test(err));
    });
});
