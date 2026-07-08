/**
 * Scene-metadata coordinate sanity check — the invariant behind click-to-code.
 *
 * The webview overlays each actor's exported screen rect on top of the rendered
 * PNG (scaled by the PNG's natural size). If the metadata coordinates don't match
 * where DALi actually drew the actor, the clickable regions land in the wrong
 * place. dali-ui v2.5.28 changed the default actor coordinate convention, which
 * silently broke the old hand-rolled parentOrigin/PIVOT math in the metadata
 * exporters (the render stayed correct) — a class of bug the pixel goldens cannot
 * see. This check runs against the exported metadata on the real runtime so an
 * off-screen / negative region fails the e2e suite instead of shipping.
 *
 * Intentionally vscode-free so both e2e runners (which cannot import the
 * vscode-dependent extension modules) can use it.
 */
export interface MetaNode {
    type?: string;
    name?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    visible?: boolean;
    opacity?: number;
    children?: MetaNode[];
}

export function checkMetadataOnScreen(
    metadata: { root?: MetaNode } | MetaNode,
    windowWidth: number,
    windowHeight: number,
): string | null {
    const root: MetaNode | undefined = (metadata as { root?: MetaNode }).root ?? (metadata as MetaNode);
    if (!root) {
        return 'metadata has no root node';
    }

    const NEG_TOL = 2; // a drawn actor should not sit at a negative screen coordinate
    const EDGE_TOL = 1; // ...nor be entirely off the left/top edge
    const offenders: string[] = [];

    const walk = (n: MetaNode | undefined): void => {
        if (!n) {
            return;
        }
        const w = n.w ?? 0;
        const h = n.h ?? 0;
        const visible = n.visible !== false;
        const opacity = typeof n.opacity === 'number' ? n.opacity : 1;
        // Only actors that are actually drawn (visible, non-transparent, sized) must
        // be on-screen. Off the RIGHT/BOTTOM (x >= W, y >= H) is allowed — previews
        // can legitimately carry scroll content below/right of the fold. A NEGATIVE
        // position or being entirely off the LEFT/TOP is the coordinate-bug signature.
        if (visible && opacity > 0.01 && w > 1 && h > 1) {
            const x = n.x ?? 0;
            const y = n.y ?? 0;
            const negative = x < -NEG_TOL || y < -NEG_TOL;
            const offLeftTop = x + w <= EDGE_TOL || y + h <= EDGE_TOL;
            if (negative || offLeftTop) {
                offenders.push(`${n.type ?? 'Actor'} "${n.name ?? ''}" @ (${x},${y},${w}x${h})`);
            }
        }
        (n.children ?? []).forEach(walk);
    };
    walk(root);

    if (offenders.length > 0) {
        return (
            `${offenders.length} visible actor(s) at negative/off-screen coords — click-to-code ` +
            `regions will not match the render (window ${windowWidth}x${windowHeight}): ` +
            offenders.slice(0, 5).join('; ')
        );
    }
    return null;
}

export interface ExpectedRect { name: string; x: number; y: number; w: number; h: number; }

/** Depth-first search for the first node matching `predicate`. */
export function findFirstNode(
    metadata: { root?: MetaNode } | MetaNode,
    predicate: (n: MetaNode) => boolean,
): MetaNode | undefined {
    const root: MetaNode | undefined = (metadata as { root?: MetaNode }).root ?? (metadata as MetaNode);
    const stack: MetaNode[] = root ? [root] : [];
    while (stack.length) {
        const n = stack.pop()!;
        if (predicate(n)) { return n; }
        (n.children ?? []).forEach((c) => stack.push(c));
    }
    return undefined;
}

/**
 * Positive-semantic click-to-code correctness: each named actor's exported
 * screen rect must equal its EXPECTED rect within `tol` px. Unlike
 * checkMetadataOnScreen (which only rejects negative/off-left-top coords and so
 * passes a wrong-but-on-screen drift), this pins the actual geometry — the
 * coordinate-regression class that must never silently ship.
 */
export function checkExpectedRects(
    metadata: { root?: MetaNode } | MetaNode,
    expected: ExpectedRect[],
    tol = 4,
): string | null {
    const offenders: string[] = [];
    for (const e of expected) {
        const node = findFirstNode(metadata, (n) => n.name === e.name);
        if (!node) {
            offenders.push(`"${e.name}" not found in metadata`);
            continue;
        }
        const dx = Math.abs((node.x ?? 0) - e.x);
        const dy = Math.abs((node.y ?? 0) - e.y);
        const dw = Math.abs((node.w ?? 0) - e.w);
        const dh = Math.abs((node.h ?? 0) - e.h);
        if (dx > tol || dy > tol || dw > tol || dh > tol) {
            offenders.push(
                `"${e.name}" @ (${node.x},${node.y},${node.w}x${node.h}) ` +
                `!= expected (${e.x},${e.y},${e.w}x${e.h}) [tol ${tol}px]`,
            );
        }
    }
    return offenders.length ? `click-to-code rect drift: ${offenders.join('; ')}` : null;
}
