import { expect } from 'chai';
import { buildSlice, findPreviewFunction, SourceFile } from '../../src/sliceBuilder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * WU-M4.4 — member-screen object synthesis lock (blank-screen regression guard).
 *
 * `WalletScreen::Build()` reads the injected view-model `mVm` (P6). In the real app
 * that's populated from a repository/network; in preview it MUST be auto-stubbed
 * with SAMPLE data — and crucially, NOT an empty `WalletViewModel{}` (which renders
 * a blank screen: empty balance, zero transaction rows). The fixpoint collector
 * pulls in the nested `vector<Transaction>` type two #include hops away, and
 * synthSampleInit fills three sample Transaction rows so the P2 for-loop produces
 * visible rows. This unit locks that NON-EMPTY synthesis.
 */
describe('sliceBuilder member synthesis lock — mVm sample data (WU-M4.4)', () => {
    const app = path.join(__dirname, '..', '..', '..', 'samples', 'flow-wallet');
    const read = (rel: string) => fs.readFileSync(path.join(app, rel), 'utf8');

    const EXTRA_RELS = [
        'screens/wallet_screen.h',
        'theme/tokens.h',
        'widgets/cards.h',
        'widgets/cards.cpp',
        'model/wallet_vm.h',
    ];
    const extraSources = (): SourceFile[] =>
        EXTRA_RELS.map((rel) => ({ path: path.join(app, rel), text: read(rel) }));

    const ENTRY_PATH = path.join(app, 'screens', 'wallet_screen.cpp');
    const entrySrc = () => read('screens/wallet_screen.cpp');

    const slice = () => {
        const fn = findPreviewFunction(entrySrc())!;
        return buildSlice(entrySrc(), ENTRY_PATH, fn.body, extraSources(), fn.params);
    };

    it('synthesizes mVm with a NON-EMPTY WalletViewModel + exactly three Transaction rows', () => {
        const g = slice().globals;
        // mVm = WalletViewModel{"Balance" ... Transaction{...} x3 ...} — string fields
        // are named after themselves (balance → "Balance"); three rows so the for-loop
        // renders. The `s` flag lets `.` span the (single-line) init.
        expect(g).to.match(
            /mVm = WalletViewModel\{"Balance".*Transaction\{.*\}.*Transaction\{.*\}.*Transaction\{/s,
        );
    });

    it('is NOT the empty initializer (the blank-screen failure)', () => {
        const g = slice().globals;
        expect(g).to.not.include('mVm = WalletViewModel{}');
        expect(g).to.not.match(/mVm\s*=\s*WalletViewModel\{\s*\}/);
    });

    it('collects the nested Transaction struct so its fields are sampled by field name', () => {
        const g = slice().globals;
        expect(g).to.include('struct Transaction');         // nested type pulled in via fixpoint
        expect(g).to.match(/Transaction\{"Merchant"/);       // string fields sampled (merchant → "Merchant"), not {}
    });

    it('the member field mVm does not fall through to a weak (wrong-type) stub', () => {
        const s = slice();
        expect(s.unresolvedStubs).to.not.include('mVm');
        expect(s.unresolvedStubs).to.deep.equal([]);
    });
});

/**
 * P5 — class member function with a struct member field (the dominant real-world
 * shape), exercised on a MINIMAL fixture (slice-member/card.cpp). A qualified
 * `Class::Build()` referencing `this->mProfile` must: recognise the member
 * function, stub mProfile with its EXACT type (Profile), and collect the Profile
 * struct definition. Previously mProfile got a fuzzy vector<int> stub and
 * mProfile.name/.color failed to compile. (The flow-wallet block above is the
 * real-app synthesis lock; this is the minimal-fixture mechanics.)
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
        expect(slice.globals).to.include('"Name"');                       // name field sampled (named after itself)
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
        expect(slice.globals).to.match(/Transaction\{"Merchant"/);        // vector elements sampled (merchant → "Merchant")
    });
});
