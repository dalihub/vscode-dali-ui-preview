import * as assert from 'assert';
import * as path from 'path';
import { loadRegistry, validateRegistry } from '../../src/graduationRegistry';

const REGISTRY = path.resolve(__dirname, '..', '..', '..', 'graduation-registry.json');
const FEATURES = [
    'render-at-all', 'image', 'click-to-code', 'focus', 'theme',
    'animation', 'layout', 'CJK', 'RTL', 'multifile',
];

describe('graduation registry', () => {
    it('loads and covers all 10 features', () => {
        const reg = loadRegistry(REGISTRY);
        const names = reg.features.map((f) => f.feature).sort();
        assert.deepStrictEqual(names, [...FEATURES].sort());
    });

    it('satisfies the invariant autoMergeEligible === unattended && positiveSemantic', () => {
        assert.deepStrictEqual(validateRegistry(loadRegistry(REGISTRY)), []);
    });

    it('derives autoMergeEligible === unattended && positiveSemantic for every row', () => {
        for (const f of loadRegistry(REGISTRY).features) {
            assert.strictEqual(
                f.autoMergeEligible, f.unattended && f.positiveSemantic,
                `${f.feature}: autoMergeEligible must equal unattended && positiveSemantic`,
            );
        }
    });

    it('flags exactly the 4 render features (gate.sh U3 now enforces them as BLOCKING)', () => {
        const eligible = loadRegistry(REGISTRY).features
            .filter((f) => f.autoMergeEligible)
            .map((f) => f.feature)
            .sort();
        assert.deepStrictEqual(eligible, ['click-to-code', 'focus', 'image', 'render-at-all']);
    });

    it('validateRegistry reports a violated invariant', () => {
        const bad = { schemaVersion: 1, features: [
            { feature: 'x', codeRegions: [], rootVerifyCheck: '', unattended: true, positiveSemantic: true, autoMergeEligible: false },
        ]};
        assert.ok(validateRegistry(bad).length > 0);
    });
});
