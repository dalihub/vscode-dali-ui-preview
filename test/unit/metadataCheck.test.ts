import { expect } from 'chai';
import { checkMetadataOnScreen } from '../e2e/metadataCheck';

/*
 * Guards click-to-code: the exported scene metadata's screen rects MUST line up
 * with where DALi actually draws the actors, or the webview overlay lands in the
 * wrong place. This is the invariant that dali-ui v2.5.28 broke — the hand-rolled
 * parentOrigin/PIVOT math put a full-window container at (-960,-540) and a label
 * fully off-screen at (-1920,...), while the render stayed correct — and which the
 * pixel goldens could not see. These fixtures are the REAL coordinates observed on
 * the 2.5.28 runtime before (broken) and after (fixed) the CalculateScreenExtents fix.
 */
describe('checkMetadataOnScreen', () => {
    const W = 1920, H = 1080;

    // Broken: 2.5.28 with the old parentOrigin/anchor math (container negative, label off-screen).
    const BROKEN = {
        root: {
            type: 'RootLayer', name: 'RootLayer', x: 0, y: 0, w: 1920, h: 1080, visible: true, opacity: 1,
            children: [
                {
                    type: 'FlexLayout', name: '__L5', x: -960, y: -540, w: 1920, h: 1080, visible: true, opacity: 1,
                    children: [
                        { type: 'Label', name: '__L11', x: -1920, y: -564, w: 1920, h: 48, visible: true, opacity: 1, children: [] },
                    ],
                },
            ],
        },
    };

    // Fixed: CalculateScreenExtents → correct on-screen coords.
    const GOOD = {
        root: {
            type: 'RootLayer', name: 'RootLayer', x: 0, y: 0, w: 1920, h: 1080, visible: true, opacity: 1,
            children: [
                {
                    type: 'FlexLayout', name: '__L5', x: 0, y: 0, w: 1920, h: 1080, visible: true, opacity: 1,
                    children: [
                        { type: 'Label', name: '__L11', x: 0, y: 0, w: 1920, h: 48, visible: true, opacity: 1, children: [] },
                    ],
                },
            ],
        },
    };

    it('flags a container placed at a negative screen position (the v2.5.28 regression)', () => {
        const err = checkMetadataOnScreen(BROKEN, W, H);
        expect(err, 'expected an error for off-screen metadata').to.be.a('string');
        expect(err).to.match(/off-screen|negative/i);
    });

    it('passes correct on-screen coordinates', () => {
        expect(checkMetadataOnScreen(GOOD, W, H)).to.equal(null);
    });

    it('ignores the zero-size CaptureDefaultCamera (w=0,h=0) at the window centre', () => {
        const withCamera = {
            root: {
                type: 'RootLayer', name: 'RootLayer', x: 0, y: 0, w: 1920, h: 1080, visible: true, opacity: 1,
                children: [
                    { type: 'CameraActor', name: 'CaptureDefaultCamera', x: 960, y: 540, w: 0, h: 0, visible: true, opacity: 1, children: [] },
                    { type: 'View', name: 'ok', x: 10, y: 10, w: 100, h: 100, visible: true, opacity: 1, children: [] },
                ],
            },
        };
        expect(checkMetadataOnScreen(withCamera, W, H)).to.equal(null);
    });

    it('ignores invisible / fully transparent actors (they are not drawn)', () => {
        const hidden = {
            root: {
                type: 'RootLayer', name: 'RootLayer', x: 0, y: 0, w: 1920, h: 1080, visible: true, opacity: 1,
                children: [
                    { type: 'View', name: 'hiddenNeg', x: -5000, y: -5000, w: 100, h: 100, visible: false, opacity: 1, children: [] },
                    { type: 'View', name: 'transparentNeg', x: -5000, y: -5000, w: 100, h: 100, visible: true, opacity: 0, children: [] },
                ],
            },
        };
        expect(checkMetadataOnScreen(hidden, W, H)).to.equal(null);
    });

    it('does NOT flag content that legitimately overflows the bottom/right (scroll content)', () => {
        const belowFold = {
            root: {
                type: 'RootLayer', name: 'RootLayer', x: 0, y: 0, w: 1920, h: 1080, visible: true, opacity: 1,
                children: [
                    { type: 'View', name: 'listItemBelow', x: 0, y: 1200, w: 400, h: 200, visible: true, opacity: 1, children: [] },
                ],
            },
        };
        expect(checkMetadataOnScreen(belowFold, W, H)).to.equal(null);
    });
});
