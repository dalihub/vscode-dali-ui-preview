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
        // mVm = WalletViewModel{"Sample" ... Transaction{...} x3 ...} — three rows so
        // the for-loop renders. The `s` flag lets `.` span the (single-line) init.
        expect(g).to.match(
            /mVm = WalletViewModel\{"Sample".*Transaction\{.*\}.*Transaction\{.*\}.*Transaction\{/s,
        );
    });

    it('is NOT the empty initializer (the blank-screen failure)', () => {
        const g = slice().globals;
        expect(g).to.not.include('mVm = WalletViewModel{}');
        expect(g).to.not.match(/mVm\s*=\s*WalletViewModel\{\s*\}/);
    });

    it('collects the nested Transaction struct so its fields are sampled as "Sample"', () => {
        const g = slice().globals;
        expect(g).to.include('struct Transaction');         // nested type pulled in via fixpoint
        expect(g).to.match(/Transaction\{"Sample"/);         // string fields sampled, not {}
    });

    it('the member field mVm does not fall through to a weak (wrong-type) stub', () => {
        const s = slice();
        expect(s.unresolvedStubs).to.not.include('mVm');
        expect(s.unresolvedStubs).to.deep.equal([]);
    });
});
