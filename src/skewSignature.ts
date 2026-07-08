// Shared dali-ui runtime-API-skew signature. When a dali-ui release renames or
// removes a member, g++ emits: `'class Dali::Ui::X' has no member named 'Y'`.
// TWO hazards this regex is built around:
//  1. g++ quotes identifiers with Unicode curly quotes (U+2018/U+2019), NOT
//     ASCII — an ASCII-only class silently never matches real output.
//  2. Hardcoding the renamed member names (AddChildren, SetAlwaysShowFocus, ...)
//     means a NEW rename is missed until someone edits the list. So we match ANY
//     missing member on a `Dali::Ui::` type — the general skew signature.
export const RUNTIME_API_SKEW_RE =
    /Dali::Ui::\w+['‘’]?\s+has no member named\s+['‘’]?\w+/;

export function isRuntimeApiSkew(stderr: string): boolean {
    return RUNTIME_API_SKEW_RE.test(String(stderr ?? ''));
}
