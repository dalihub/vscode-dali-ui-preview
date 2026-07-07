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
