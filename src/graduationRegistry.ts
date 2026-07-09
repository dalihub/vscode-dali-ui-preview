import * as fs from 'fs';

export interface GraduationRow {
    feature: string;
    codeRegions: string[];
    rootVerifyCheck: string;
    /** Does the check run in an unattended gate (cloud CI / required status)? */
    unattended: boolean;
    /** Does the check assert correctness, not just absence-of-error? (철칙 2) */
    positiveSemantic: boolean;
    /** Derived and stored: must equal unattended && positiveSemantic. */
    autoMergeEligible: boolean;
}

export interface GraduationRegistry {
    schemaVersion: number;
    features: GraduationRow[];
}

export function loadRegistry(jsonPath: string): GraduationRegistry {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as GraduationRegistry;
}

/**
 * Returns a list of invariant violations (empty = valid). The core invariant:
 * a feature is auto-merge-eligible IFF its check is both unattended AND
 * positive-semantic. This is the machine-checkable form of 철칙 1 + 철칙 2.
 */
export function validateRegistry(reg: GraduationRegistry): string[] {
    const problems: string[] = [];
    for (const f of reg.features) {
        const expected = f.unattended && f.positiveSemantic;
        if (f.autoMergeEligible !== expected) {
            problems.push(
                `${f.feature}: autoMergeEligible=${f.autoMergeEligible} but ` +
                `unattended && positiveSemantic=${expected}`,
            );
        }
    }
    return problems;
}
