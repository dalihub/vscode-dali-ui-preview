import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

// Compiled location is out/test/unit/, so the repo root is three levels up.
const pkgPath = path.resolve(__dirname, '../../../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

// Commands that intentionally stay in the Command Palette. Everything else a
// user could discover by typing "preview" should be hidden (still registered,
// so walkthrough buttons / CodeLens / programmatic callers keep working).
const PALETTE_VISIBLE = [
    'dali.openPreview',
    'dali.toggleTheme',
    'dali.openSettings',
    'dali.addAgentGuide',
    'dali.reportIssue',
    'dali.openExamples',
    'dali.rerunSetup',
    'dali.useLocalRuntime',
    'dali.restartDaliRuntime',
    'dali.selectRuntimeVersion',
    'dali.checkExtensionUpdate',
    // Disk hygiene: users must be able to reclaim accumulated ~1.2 GB runtime images
    // (the README points here). Kept visible on purpose — see dockerMaintenance.
    'dali.cleanRuntimeImages',
    // Runtime download/install/connectivity status — a user-facing diagnostic they must
    // be able to invoke directly (esp. when a pull fails). Kept visible on purpose.
    'dali.runtimeStatus',
];

// Hidden from the palette: CodeLens-only (previewFunction needs args), the
// walkthrough-button commands, and the maintenance/runtime actions.
const PALETTE_HIDDEN = [
    'dali.previewFunction',
    'dali.verifyDocker',
    'dali.resetExtension',
    'dali.installDocker',
    'dali.installXvfb',
    'dali.pullRuntimeImage',
    'dali.checkRuntimeUpdate',
    'dali.showReadme',
];

describe('Command Palette visibility (package.json contributes.menus)', () => {
    const declaredCommands: string[] = pkg.contributes.commands.map((c: any) => c.command);
    const paletteMenu: Array<{ command: string; when?: string }> =
        pkg.contributes.menus?.commandPalette ?? [];
    const hiddenInMenu = new Set(
        paletteMenu.filter((m) => m.when === 'false').map((m) => m.command),
    );

    it('hides exactly the internal/walkthrough commands with when:false', () => {
        for (const cmd of PALETTE_HIDDEN) {
            expect(hiddenInMenu.has(cmd), `${cmd} should be hidden (when:false)`).to.equal(true);
        }
    });

    it('keeps the core user-facing commands visible (no hiding entry)', () => {
        for (const cmd of PALETTE_VISIBLE) {
            expect(hiddenInMenu.has(cmd), `${cmd} should stay visible in the palette`).to.equal(false);
        }
    });

    it('every commandPalette entry references a declared command (no orphans/typos)', () => {
        for (const entry of paletteMenu) {
            expect(declaredCommands, `${entry.command} is not a declared command`).to.include(entry.command);
        }
    });

    it('every declared command is consciously visible or hidden (keeps the palette curated)', () => {
        // Forcing function: a newly-added command must be added to PALETTE_VISIBLE
        // or PALETTE_HIDDEN, so nobody silently pollutes the palette again.
        const categorized = new Set([...PALETTE_VISIBLE, ...PALETTE_HIDDEN]);
        const uncategorized = declaredCommands.filter((c) => !categorized.has(c));
        expect(uncategorized, `uncategorized commands: ${uncategorized.join(', ')}`).to.deep.equal([]);
    });

    it('the primary Open Preview command uses the consistent "DALi Preview" category', () => {
        const openPreview = pkg.contributes.commands.find((c: any) => c.command === 'dali.openPreview');
        expect(openPreview?.category).to.equal('DALi Preview');
    });
});
