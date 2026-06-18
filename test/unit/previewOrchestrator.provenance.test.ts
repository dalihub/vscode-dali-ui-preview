import { expect } from 'chai';
import {
    buildUntranslatedProvenance,
    mergeProvenance,
    buildImagePlaceholderProvenance,
    buildFocusMulticonfigProvenance,
} from '../../src/previewOrchestrator';

// WU-M3.6 — honest untranslated provenance (ADR-007 channel). The host detects
// locale + IDS_ keys at build time and merges an `untranslated` entry into the
// metadata; the visible badge chip is M5. These assert the host-merge only.

describe('previewOrchestrator — buildUntranslatedProvenance() (WU-M3.6)', () => {
    it('returns [] when no locale is set (no badge)', () => {
        expect(buildUntranslatedProvenance(undefined, 'label.SetTranslatableText("IDS_TITLE");')).to.deep.equal([]);
    });

    it('returns [] when a locale is set but no IDS_ keys are used', () => {
        expect(buildUntranslatedProvenance('ar', 'return Label::New("hello");')).to.deep.equal([]);
    });

    it('records one untranslated entry naming the IDS_ keys when locale + IDS_', () => {
        const out = buildUntranslatedProvenance('ar', 'label.SetTranslatableText("IDS_TITLE");');
        expect(out).to.have.length(1);
        expect(out[0].kind).to.equal('untranslated');
        expect(out[0].detail).to.include('IDS_TITLE');
        expect(out[0].detail).to.include('ar');
    });

    it('de-duplicates and caps the listed keys', () => {
        const code = [
            '"IDS_A"', '"IDS_A"', '"IDS_B"', '"IDS_C"', '"IDS_D"',
        ].join(' ');
        const out = buildUntranslatedProvenance('he', code);
        expect(out).to.have.length(1);
        // First 3 listed, then an ellipsis (4 distinct keys present).
        expect(out[0].detail).to.include('IDS_A');
        expect(out[0].detail).to.include('IDS_B');
        expect(out[0].detail).to.include('IDS_C');
        expect(out[0].detail).to.include('…');
    });

    it('does NOT fabricate a translation — detail names the raw key as shown', () => {
        const out = buildUntranslatedProvenance('fa', 'x.SetTranslatableText("IDS_GREETING");');
        expect(out[0].detail).to.match(/IDS_GREETING shown as key/);
    });
});

describe('previewOrchestrator — mergeProvenance() (ADR-007 host-merge)', () => {
    it('is a no-op when provenance is empty (metadata unchanged)', () => {
        const meta = { root: { name: 'RootLayer' } };
        expect(mergeProvenance(meta, [])).to.equal(meta);
        expect((meta as any).provenance).to.equal(undefined);
    });

    it('adds a top-level provenance array, preserving existing metadata', () => {
        const meta: any = { root: { name: 'RootLayer' } };
        const out: any = mergeProvenance(meta, [{ kind: 'untranslated', detail: 'IDS_X shown as key' }]);
        expect(out.root.name).to.equal('RootLayer'); // existing field intact
        expect(out.provenance).to.have.length(1);
        expect(out.provenance[0].kind).to.equal('untranslated');
    });

    it('appends to a pre-existing provenance array (does not clobber)', () => {
        const meta: any = { provenance: [{ kind: 'focus-approx', detail: 'foo' }] };
        const out: any = mergeProvenance(meta, [{ kind: 'untranslated', detail: 'bar' }]);
        expect(out.provenance).to.have.length(2);
        expect(out.provenance[0].kind).to.equal('focus-approx');
        expect(out.provenance[1].kind).to.equal('untranslated');
    });

    it('creates a fresh metadata object when metadata was null but provenance exists', () => {
        const out: any = mergeProvenance(null, [{ kind: 'untranslated', detail: 'baz' }]);
        expect(out).to.not.equal(null);
        expect(out.provenance).to.have.length(1);
    });
});

// WU-M5.1 — image-placeholder provenance. The host detects remote/unreachable
// ImageView URLs at build time; the harness renders the bundled gray placeholder
// for them, so a badge tells the user those pixels are a stand-in.
describe('previewOrchestrator — buildImagePlaceholderProvenance() (WU-M5.1)', () => {
    it('returns [] when no ImageView URL is present (no badge)', () => {
        expect(buildImagePlaceholderProvenance('return Label::New("hi");')).to.deep.equal([]);
    });

    it('returns [] for a plain local path (may resolve — do not over-claim)', () => {
        // Local filename / path → not flagged (no scheme).
        expect(buildImagePlaceholderProvenance('ImageView::New("assets/album.jpg")')).to.deep.equal([]);
        expect(buildImagePlaceholderProvenance('ImageView::New("/abs/poster.png")')).to.deep.equal([]);
    });

    it('records one image-placeholder entry for a remote (http/https) URL', () => {
        const out = buildImagePlaceholderProvenance('ImageView::New("https://cdn.example.com/poster.jpg")');
        expect(out).to.have.length(1);
        expect(out[0].kind).to.equal('image-placeholder');
        expect(out[0].detail).to.include('https://cdn.example.com/poster.jpg');
        expect(out[0].detail).to.match(/placeholder/i);
    });

    it('flags a custom/unknown scheme URL (does not resolve offline)', () => {
        const out = buildImagePlaceholderProvenance('ImageView::New("does-not-exist://unreachable/p.jpg")');
        expect(out).to.have.length(1);
        expect(out[0].kind).to.equal('image-placeholder');
    });

    it('also matches the method-form .SetResourceUrl(...)', () => {
        const out = buildImagePlaceholderProvenance('iv.SetResourceUrl("http://x/y.png");');
        expect(out).to.have.length(1);
        expect(out[0].detail).to.include('http://x/y.png');
    });

    it('de-duplicates and caps the listed URLs (one entry total)', () => {
        const code = [
            'ImageView::New("https://a/1.jpg")',
            'ImageView::New("https://a/1.jpg")', // dup
            'ImageView::New("https://a/2.jpg")',
            'ImageView::New("https://a/3.jpg")',
        ].join('\n');
        const out = buildImagePlaceholderProvenance(code);
        expect(out).to.have.length(1);
        expect(out[0].detail).to.include('https://a/1.jpg');
        expect(out[0].detail).to.include('https://a/2.jpg');
        expect(out[0].detail).to.include('…'); // 3 distinct → ellipsis after first 2
    });
});

// WU-M5.5 — focus-multiconfig provenance. A `// @preview-state: focus=` dropped
// in a multi-config (gallery) preview becomes a visible badge instead of a
// warn-log only.
describe('previewOrchestrator — buildFocusMulticonfigProvenance() (WU-M5.5)', () => {
    it('returns [] when there is no dropped focus (no badge)', () => {
        expect(buildFocusMulticonfigProvenance(undefined)).to.deep.equal([]);
    });

    it('records one focus-multiconfig entry naming the dropped focus id', () => {
        const out = buildFocusMulticonfigProvenance('card');
        expect(out).to.have.length(1);
        expect(out[0].kind).to.equal('focus-multiconfig');
        expect(out[0].detail).to.include('card');
        expect(out[0].detail).to.match(/multi-config/);
    });
});
