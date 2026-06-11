import { expect } from 'chai';
import { buildSlice, findPreviewFunction } from '../../src/sliceBuilder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * P5 — class member function with a struct member field (the dominant real-world
 * shape). A qualified `Class::Build()` referencing `this->mProfile` must: recognise
 * the member function, stub mProfile with its EXACT type (Profile), and collect the
 * Profile struct definition. Previously mProfile got a fuzzy vector<int> stub and
 * mProfile.name/.color failed to compile.
 */
describe('sliceBuilder member function (P5)', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'slice-member');
    const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

    it('recognises a qualified Class::Build() as the preview target', () => {
        const fn = findPreviewFunction(read('card.cpp'));
        expect(fn?.fnName).to.equal('Build');
    });

    it('stubs a struct member with its exact type + collects the struct def + sample data', () => {
        const slice = buildSlice(read('card.cpp'), 'card.cpp');
        expect(slice.rung).to.equal('heuristic');
        expect(slice.unresolvedStubs).to.deep.equal([]);                 // mProfile resolved (member)
        expect(slice.globals).to.include('struct Profile');               // struct def collected
        expect(slice.globals).to.include('Profile mProfile = Profile{');  // P6 sample init, not {}
        expect(slice.globals).to.include('"Sample"');                     // name field sampled
    });

    it('leaves scalar/string members to the context-based stub (no regression)', () => {
        const mf = fs.readFileSync(path.join(dir, '..', 'slice', 'member_field.cpp'), 'utf8');
        const slice = buildSlice(mf, 'member_field.cpp');
        // std::string mName / uint32_t mAccent are known scalar/string types, so they
        // stay weak (context) stubs rather than member-takeover.
        expect(slice.unresolvedStubs).to.include.members(['mName', 'mAccent']);
    });

    // The real flow-wallet app: member function (P5) reading mVm (P6) whose type
    // WalletViewModel lives two #include hops away (P11) and nests vector<Transaction>.
    it('flow-wallet: 2-hop transitive type + nested struct + sample data (P5+P6+P11)', () => {
        const app = path.join(__dirname, '..', '..', '..', 'samples', 'flow-wallet');
        // The orchestrator's resolveProjectIncludes BFS produces exactly these.
        const extra = ['screens/wallet_screen.h', 'theme/tokens.h', 'widgets/cards.h',
            'widgets/cards.cpp', 'model/wallet_vm.h']
            .map((f) => ({ path: f, text: fs.readFileSync(path.join(app, f), 'utf8') }));
        const src = fs.readFileSync(path.join(app, 'screens', 'wallet_screen.cpp'), 'utf8');
        const slice = buildSlice(src, 'wallet_screen.cpp', undefined, extra);
        expect(slice.unresolvedStubs).to.deep.equal([]);                 // everything resolved
        expect(slice.globals).to.include('struct WalletViewModel');       // 2-hop type collected
        expect(slice.globals).to.include('struct Transaction');           // nested struct collected
        expect(slice.globals).to.include('WalletViewModel mVm = WalletViewModel{');  // P6 sample
        expect(slice.globals).to.match(/Transaction\{"Sample"/);          // vector elements sampled
    });
});
