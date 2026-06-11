import { expect } from 'chai';
import { transformVectorChildren } from '../../src/codeExtractor';

/**
 * P13 — View::Children only has an initializer_list overload, so `.Children(vec)`
 * (a std::vector<View>) won't compile. The source transform rewrites it into an
 * IIFE that .Add()s each element; an `{ init-list }` argument is left alone.
 */
describe('transformVectorChildren (P13: vector → .Add)', () => {
    it('rewrites .Children(vector) into an .Add loop', () => {
        const body = 'return StackLayout::New(StackOrientation::VERTICAL).SetSpacing(20).Children(rows);';
        const out = transformVectorChildren(body);
        expect(out).to.include('for (auto& __ce : rows)');
        expect(out).to.include('__cw.Add(__ce)');
        expect(out).to.not.match(/\.Children\(rows\)/);   // original call gone
    });

    it('leaves an { initializer-list } .Children untouched', () => {
        const body = 'return StackLayout::New().Children({ Label::New("a"), Label::New("b") });';
        expect(transformVectorChildren(body)).to.equal(body);
    });
});
