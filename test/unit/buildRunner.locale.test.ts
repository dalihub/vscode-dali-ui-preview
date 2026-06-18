import { expect } from 'chai';
import { BuildRunner } from '../../src/buildRunner';

// WU-M3.5 (locale RTL mirror) + WU-M3.6 (honest untranslated IDS_ override).
// String-level assertions on the emitted slot C++ — no compilation. Mirrors the
// existing "BuildRunner ADR-004 install slots" test style in buildRunner.test.ts.

describe('BuildRunner — locale RTL slot (WU-M3.5)', () => {
    describe('buildPostBuildLayoutDir()', () => {
        it('is empty by default and for an LTR locale — byte-neutral', () => {
            expect(BuildRunner.buildPostBuildLayoutDir()).to.equal('');
            expect(BuildRunner.buildPostBuildLayoutDir('en')).to.equal('');
            expect(BuildRunner.buildPostBuildLayoutDir('ko_KR')).to.equal('');
        });

        it('sets root LAYOUT_DIRECTION=RIGHT_TO_LEFT for an RTL locale', () => {
            const out = BuildRunner.buildPostBuildLayoutDir('ar');
            expect(out).to.include('root.SetProperty(Dali::Actor::Property::LAYOUT_DIRECTION, Dali::LayoutDirection::RIGHT_TO_LEFT);');
        });

        it('recognises the RTL set (ar/he/fa/ur) incl. region subtags', () => {
            for (const loc of ['ar', 'he', 'fa', 'ur', 'ar_EG', 'ar-EG', 'AR']) {
                expect(BuildRunner.buildPostBuildLayoutDir(loc), loc)
                    .to.include('RIGHT_TO_LEFT');
            }
        });
    });

    describe('buildPostBuild() composition', () => {
        it('is empty when neither RTL nor focus — byte-neutral', () => {
            expect(BuildRunner.buildPostBuild()).to.equal('');
            expect(BuildRunner.buildPostBuild('en', undefined)).to.equal('');
        });

        it('emits RTL before focus when both are present (mirror in effect at ring draw)', () => {
            const out = BuildRunner.buildPostBuild('ar', 'card');
            const rtlIdx = out.indexOf('RIGHT_TO_LEFT');
            const focusIdx = out.indexOf('SetCurrentFocusView');
            expect(rtlIdx).to.be.greaterThan(-1);
            expect(focusIdx).to.be.greaterThan(-1);
            expect(rtlIdx).to.be.lessThan(focusIdx);
        });

        it('emits only focus when LTR + focus', () => {
            const out = BuildRunner.buildPostBuild('en', 'card');
            expect(out).to.not.include('RIGHT_TO_LEFT');
            expect(out).to.include('SetCurrentFocusView');
        });
    });
});

describe('BuildRunner — honest untranslated override (WU-M3.6)', () => {
    describe('buildPaletteDefs() locale block', () => {
        it('does not emit a locale override when no locale is set', () => {
            expect(BuildRunner.buildPaletteDefs()).to.not.include('__LocaleOverride');
            expect(BuildRunner.buildPaletteDefs('dark')).to.not.include('__LocaleOverride');
        });

        it('emits a no-capture __LocaleOverride that returns false (raw key fallback)', () => {
            const out = BuildRunner.buildPaletteDefs(undefined, 'ar');
            expect(out).to.include('static bool __LocaleOverride(Dali::StringView resourceId, Dali::StringView domain, Dali::String& outString)');
            // Honest: returns false for every key → dgettext fallback → raw IDS_ key.
            expect(out).to.include('return false;');
            // No captures (plain function — required by LocalizedStringOverrideFunc).
            expect(out).to.not.include('[&]');
            expect(out).to.not.include('[=]');
        });

        it('emits BOTH the dark palette and the locale override for theme=dark + locale', () => {
            const out = BuildRunner.buildPaletteDefs('dark', 'ar');
            expect(out).to.include('__DarkPalette');
            expect(out).to.include('__LocaleOverride');
        });
    });

    describe('buildPreBuildInstall() locale install', () => {
        it('installs SetLocalizedStringOverride when a locale is set', () => {
            const out = BuildRunner.buildPreBuildInstall(undefined, undefined, false, 'ar');
            expect(out).to.include('Dali::Ui::UiLocalizationManager::Get().SetLocalizedStringOverride(&__LocaleOverride);');
        });

        it('does not install the locale override when no locale is set (byte-neutral)', () => {
            expect(BuildRunner.buildPreBuildInstall()).to.equal('');
            expect(BuildRunner.buildPreBuildInstall('dark')).to.not.include('__LocaleOverride');
        });

        it('installs locale override on both harness and plugin paths', () => {
            const harness = BuildRunner.buildPreBuildInstall(undefined, undefined, false, 'he');
            const plugin = BuildRunner.buildPreBuildInstall(undefined, undefined, true, 'he');
            expect(harness).to.include('SetLocalizedStringOverride');
            expect(plugin).to.include('SetLocalizedStringOverride');
        });
    });
});
