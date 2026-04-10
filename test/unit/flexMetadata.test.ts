import { expect } from 'chai';
import { enrichMetadataWithFlexProps, FlexProps } from '../../src/flexMetadata';
import { parseChainExpression } from '../../src/cppParser';

// ---------------------------------------------------------------------------
// Helper: build a minimal runtime metadata stub
// ---------------------------------------------------------------------------

function makeRuntimeNode(type: string, overrides: object = {}): object {
    return {
        name: '',
        type,
        x: 0, y: 0, w: 100, h: 100,
        visible: true,
        opacity: 1,
        properties: { color: [1, 1, 1, 1] },
        children: [],
        ...overrides,
    };
}

function makeMetadata(rootChild: object): { root: object } {
    return {
        root: {
            name: 'RootLayer',
            type: 'Layer',
            x: 0, y: 0, w: 1024, h: 600,
            children: [rootChild],
        },
    };
}

// ---------------------------------------------------------------------------
// enrichMetadataWithFlexProps()
// ---------------------------------------------------------------------------

describe('enrichMetadataWithFlexProps()', () => {
    it('returns metadata unchanged when scene is null', () => {
        const meta = makeMetadata(makeRuntimeNode('View'));
        const result = enrichMetadataWithFlexProps(meta, null);
        expect(result).to.equal(meta);
        const rootChild = (meta.root as any).children[0] as any;
        expect(rootChild.flexProps).to.be.undefined;
    });

    it('injects flexProps into a FlexLayout runtime node', () => {
        const scene = parseChainExpression(
            'return FlexLayout::New().Direction(FlexDirection::COLUMN);'
        );
        expect(scene).to.not.be.null;

        const meta = makeMetadata(makeRuntimeNode('FlexLayout'));
        enrichMetadataWithFlexProps(meta, scene!);

        const child = (meta.root as any).children[0] as any;
        expect(child.flexProps).to.deep.include({
            direction: 'COLUMN',
        });
    });

    it('normalises fully-qualified enum values', () => {
        const scene = parseChainExpression(
            'return FlexLayout::New()\n' +
            '    .Direction(FlexDirection::ROW_REVERSE)\n' +
            '    .AlignItems(FlexAlign::FLEX_END)\n' +
            '    .JustifyContent(FlexJustify::SPACE_BETWEEN)\n' +
            '    .Wrap(FlexWrap::WRAP);'
        );
        expect(scene).to.not.be.null;

        const meta = makeMetadata(makeRuntimeNode('FlexLayout'));
        enrichMetadataWithFlexProps(meta, scene!);

        const fp: FlexProps = (meta.root as any).children[0].flexProps;
        expect(fp.direction).to.equal('ROW_REVERSE');
        expect(fp.alignItems).to.equal('FLEX_END');
        expect(fp.justifyContent).to.equal('SPACE_BETWEEN');
        expect(fp.wrap).to.equal('WRAP');
    });

    it('does not inject flexProps into non-FlexLayout nodes', () => {
        const scene = parseChainExpression(
            'return View::New().SetBackgroundColor(UiColor(0xff0000));'
        );
        expect(scene).to.not.be.null;

        const meta = makeMetadata(makeRuntimeNode('View'));
        enrichMetadataWithFlexProps(meta, scene!);

        const child = (meta.root as any).children[0] as any;
        expect(child.flexProps).to.be.undefined;
    });

    it('merges flexProps into nested FlexLayout children', () => {
        const code =
            'return FlexLayout::New()\n' +
            '    .Direction(FlexDirection::ROW)\n' +
            '    .Children({\n' +
            '        FlexLayout::New().Direction(FlexDirection::COLUMN),\n' +
            '    });';
        const scene = parseChainExpression(code);
        expect(scene).to.not.be.null;

        const innerFlex = makeRuntimeNode('FlexLayout');
        const outerFlex = makeRuntimeNode('FlexLayout', { children: [innerFlex] });
        const meta = makeMetadata(outerFlex);
        enrichMetadataWithFlexProps(meta, scene!);

        const outer = (meta.root as any).children[0] as any;
        expect(outer.flexProps.direction).to.equal('ROW');

        const inner = outer.children[0] as any;
        expect(inner.flexProps.direction).to.equal('COLUMN');
    });

    it('provides defaults for FlexLayout without explicit calls', () => {
        const scene = parseChainExpression('return FlexLayout::New();');
        expect(scene).to.not.be.null;

        const meta = makeMetadata(makeRuntimeNode('FlexLayout'));
        enrichMetadataWithFlexProps(meta, scene!);

        const fp: FlexProps = (meta.root as any).children[0].flexProps;
        expect(fp).to.not.be.undefined;
        expect(fp.direction).to.equal('ROW');
        expect(fp.alignItems).to.equal('STRETCH');
        expect(fp.justifyContent).to.equal('FLEX_START');
        expect(fp.wrap).to.equal('NO_WRAP');
    });

    it('handles extra runtime children beyond parser children gracefully', () => {
        const scene = parseChainExpression(
            'return FlexLayout::New().Children({ View::New() });'
        );
        expect(scene).to.not.be.null;

        // Runtime has 2 children but parser only has 1
        const runtimeFlex = makeRuntimeNode('FlexLayout', {
            children: [
                makeRuntimeNode('View'),
                makeRuntimeNode('View'),  // extra framework node
            ],
        });
        const meta = makeMetadata(runtimeFlex);

        // Should not throw
        expect(() => enrichMetadataWithFlexProps(meta, scene!)).not.to.throw();
    });

    it('returns metadata unchanged if root has no children', () => {
        const scene = parseChainExpression('return FlexLayout::New();');
        const meta = { root: { name: 'RootLayer', children: [] } };
        const result = enrichMetadataWithFlexProps(meta, scene!);
        expect(result).to.equal(meta);
    });
});
