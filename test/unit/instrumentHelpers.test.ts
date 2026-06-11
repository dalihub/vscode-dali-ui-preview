import { expect } from 'chai';
import { instrumentCode } from '../../src/codeExtractor';

/**
 * Click-to-code for cross-file helper factories: a call like MakeSectionHeader(...)
 * isn't an Actor `Type::New(` so it wasn't tagged. SliceBuilder now surfaces
 * View-returning helper names; instrumentCode tags THOSE calls too — but still not
 * arbitrary function calls (UiColor, SetFontSize, ...).
 */
describe('instrumentCode — helper call tagging', () => {
    it('tags a View-returning helper call as well as Type::New', () => {
        const body = 'return StackLayout::New().Children({ MakeSectionHeader("My Wallet"), Label::New("x").SetFontSize(10) });';
        const instr = instrumentCode(body, 10, new Set(['MakeSectionHeader']));
        expect(instr).to.match(/__tag\(MakeSectionHeader\("My Wallet"\), "__L\d+"\)/);  // helper tagged
        expect(instr).to.match(/__tag\(StackLayout::New\(\)/);   // ::New still tagged
        expect(instr).to.match(/__tag\(Label::New\("x"\)/);      // ::New still tagged
        expect(instr).to.not.match(/__tag\(SetFontSize/);        // a method, not tagged
    });

    it('does NOT tag a plain call that is not a known View helper', () => {
        const body = 'return Label::New(UiColor(0x00ff00));';
        const instr = instrumentCode(body, 1, new Set());        // no helpers
        expect(instr).to.not.match(/__tag\(UiColor/);            // UiColor is not a View helper
        expect(instr).to.match(/__tag\(Label::New/);             // but the Actor ::New is tagged
    });
});
