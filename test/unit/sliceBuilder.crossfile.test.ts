import { expect } from 'chai';
import { buildSlice, findPreviewFunction, SourceFile } from '../../src/sliceBuilder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * WU-M4.2 — cross-file symbol collection lock (flow-wallet headline fixture).
 *
 * The §2 probe proved the cross-file path ALREADY works end-to-end for the real
 * multi-file app: slicing `WalletScreen::Build()` (a member function in
 * screens/wallet_screen.cpp) resolves — with NO rewrite and NO `-I` injection —
 * the theme constants (theme/tokens.h), the three cross-`.cpp` factories
 * (widgets/cards.cpp), and the injected view-model (model/wallet_vm.h), leaving
 * ZERO unresolved stubs. This unit LOCKS that result so a regression in the
 * BFS/collector/fixpoint can never silently degrade it to weak stubs (blank UI).
 */
describe('sliceBuilder cross-file lock — flow-wallet (WU-M4.2)', () => {
    const app = path.join(__dirname, '..', '..', '..', 'samples', 'flow-wallet');
    const read = (rel: string) => fs.readFileSync(path.join(app, rel), 'utf8');

    // The five sources the orchestrator's resolveProjectIncludes BFS reaches from
    // wallet_screen.cpp (#include "wallet_screen.h" → "../model/wallet_vm.h",
    // #include "../theme/tokens.h", #include "../widgets/cards.h" → same-stem
    // widgets/cards.cpp). Entry (wallet_screen.cpp) is the 6th source.
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

    it('finds the member-function preview target Build()', () => {
        const fn = findPreviewFunction(entrySrc());
        expect(fn?.fnName).to.equal('Build');
    });

    it('slices the real multi-file app with rung=heuristic and ZERO unresolved stubs', () => {
        const fn = findPreviewFunction(entrySrc())!;
        const slice = buildSlice(entrySrc(), ENTRY_PATH, fn.body, extraSources(), fn.params);

        expect(slice.rung).to.equal('heuristic');
        expect(slice.unresolvedStubs, 'no symbol falls through to a weak stub')
            .to.deep.equal([]);
    });

    it('surfaces the three cross-file View factories as helpers', () => {
        const fn = findPreviewFunction(entrySrc())!;
        const slice = buildSlice(entrySrc(), ENTRY_PATH, fn.body, extraSources(), fn.params);

        expect(slice.helpers).to.include.members([
            'MakeSectionHeader',
            'MakeStatCard',
            'MakeTransactionRow',
        ]);
    });

    it('inlines the cross-file factory definitions + theme constants into globals', () => {
        const fn = findPreviewFunction(entrySrc())!;
        const slice = buildSlice(entrySrc(), ENTRY_PATH, fn.body, extraSources(), fn.params);

        // The REAL definitions (from widgets/cards.cpp), not weak stubs.
        expect(slice.globals).to.include('MakeSectionHeader');
        expect(slice.globals).to.include('MakeStatCard');
        expect(slice.globals).to.include('MakeTransactionRow');
        // theme namespace constant pulled in (e.g. ACCENT brand teal).
        expect(slice.globals).to.include('ACCENT');
        // The view-model type collected so mVm can be synthesized with sample data.
        expect(slice.globals).to.include('struct WalletViewModel');
    });

    it('tracks the cross-file sources it pulled in (sourcePaths includes cards.cpp)', () => {
        const fn = findPreviewFunction(entrySrc())!;
        const slice = buildSlice(entrySrc(), ENTRY_PATH, fn.body, extraSources(), fn.params);
        const cardsCpp = path.join(app, 'widgets', 'cards.cpp');
        expect(slice.sourcePaths[0]).to.equal(ENTRY_PATH); // [0] is always the entry
        expect(slice.sourcePaths).to.include(cardsCpp);
    });
});
