import { ExpectedRect } from './metadataCheck';

// Expected screen rects for click-to-code correctness (positive-semantic).
// Values are the known, fixed geometry of a sample rendered at the default
// 480x320 preview size. A coordinate regression that keeps actors on-screen
// but moves them (the class checkMetadataOnScreen cannot see) fails here.
// focus-grid: three 150x150 cards, SPACE_EVENLY in a 480-wide row; the middle
// card 'card2' sits at x=165,y=85 (see test/e2e/actual/focus-grid.metadata.json).
export const EXPECTED_RECTS: Record<string, ExpectedRect[]> = {
    'focus-grid': [
        { name: 'card2', x: 165, y: 85, w: 150, h: 150 },
    ],
};
