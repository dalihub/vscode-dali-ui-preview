// Shared dali-ui runtime-API-skew signature. When a dali-ui release renames or
// removes a member, g++ emits: `'class Dali::Ui::X' has no member named 'Y'`.
// THREE hazards this regex is built around:
//  1. g++ quotes identifiers with Unicode curly quotes (U+2018/U+2019), NOT
//     ASCII — an ASCII-only class silently never matches real output.
//  2. Hardcoding the renamed member names (AddChildren, SetAlwaysShowFocus, ...)
//     means a NEW rename is missed until someone edits the list. So we match ANY
//     missing member — the general skew signature.
//  3. Skew is NOT confined to Dali::Ui:: — dali-CORE/ADAPTOR members skew too
//     (e.g. `Dali::Actor` has no member named `CalculateScreenExtents`,
//     `Dali::Window` has no member named `GetSize`). Match ANY qualified `Dali::`
//     type (Dali::Actor, Dali::Window, Dali::Ui::UiConfig, …) so a break confined
//     to core/adaptor is not mis-classified as a generic failure.
export const RUNTIME_API_SKEW_RE =
    /Dali(::\w+)+['‘’]?\s+has no member named\s+['‘’]?\w+/;

export function isRuntimeApiSkew(stderr: string): boolean {
    return RUNTIME_API_SKEW_RE.test(String(stderr ?? ''));
}
