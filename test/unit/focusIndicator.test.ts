import * as assert from 'assert';
import { checkFocusIndicator, MetaNode } from '../e2e/metadataCheck';

const focused: MetaNode = {
    name: 'card2', type: 'ViewImpl', x: 165, y: 85, w: 150, h: 150, visible: true, opacity: 1,
    children: [{ name: '', type: 'ImageViewImpl', x: 165, y: 85, w: 150, h: 150, visible: true, opacity: 1 }],
};
const notFocused: MetaNode = { ...focused, children: [] };

describe('checkFocusIndicator', () => {
    it('passes when the focused view owns a focus-ring (ImageView child)', () => {
        assert.strictEqual(checkFocusIndicator({ root: { name: 'r', children: [focused] } }, 'card2'), null);
    });

    it('fails when the focused view has no ring child (indicator not drawn)', () => {
        const err = checkFocusIndicator({ root: { name: 'r', children: [notFocused] } }, 'card2');
        assert.ok(err && /no focus-ring child/.test(err), `expected failure, got: ${err}`);
    });

    it('fails when the focus target is absent', () => {
        const err = checkFocusIndicator({ root: { name: 'r', children: [] } }, 'card2');
        assert.ok(err && /not found/.test(err));
    });
});
