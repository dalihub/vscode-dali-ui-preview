/**
 * sliceBuilder.ts — Rung 2 (heuristic, same-file) slice extraction.
 *
 * Turns a preview-target function that references same-file helpers / namespace
 * constants / unresolved members into a SELF-CONTAINED translation unit, so the
 * dlopen compile path can build it.
 *
 *   Rung 3 (single-fn): the target references nothing project-local → passthrough,
 *                       empty slots → byte-identical to today (regression floor).
 *   Rung 2 (heuristic): collect same-file definitions into the globals slot,
 *                       auto-stub whatever stays unresolved (members/externs).
 *
 * Cross-file resolution (helpers in another .cpp) is Rung 1 (clangd) and is out
 * of scope here — those references fall through to weak stubs and are reported.
 *
 * Zero deps: regex + brace matching on the raw source. See ADR-003.
 */

export interface SliceResult {
    /** Hoisted #include lines (may be ''). Goes above globals. */
    includes: string;
    /** Collected helper/type/const defs + weak stubs, topo-ordered (may be ''). */
    globals: string;
    /** The preview-target function body (never empty). */
    body: string;
    /** Source files to attribute #line errors to. [0]=entry, then helper sources. */
    sourcePaths: string[];
    /** Identifiers filled by weak stubs (for diagnostics / the validation matrix). */
    unresolvedStubs: string[];
    /** Rung3 passthrough vs Rung2 heuristic slice. */
    rung: 'single-fn' | 'heuristic';
}

// dali-ui / std symbols that arrive via the template's #includes — never collected
// or stubbed. Builder methods (.SetX, .New) are filtered separately (preceded by '.').
const KNOWN_SYMBOLS = new Set([
    // widget / layout types
    'View', 'Label', 'TextLabel', 'ImageView', 'FlexLayout', 'StackLayout',
    'GridLayout', 'AbsoluteLayout', 'Actor', 'Layer', 'Window', 'Application',
    'StackLayoutParams', 'FlexLayoutParams', 'GridLayoutParams', 'AbsoluteLayoutParams',
    // value types
    'UiColor', 'Extents', 'Vector2', 'Vector3', 'Vector4', 'Color', 'Property',
    'Dali', 'Ui', 'String',
    // enums + constants
    'FlexDirection', 'FlexJustify', 'FlexAlign', 'FlexWrap', 'StackOrientation',
    'MATCH_PARENT', 'WRAP_CONTENT', 'COLUMN', 'ROW', 'CENTER',
    // std
    'std', 'string', 'vector', 'to_string', 'size_t', 'uint32_t', 'int32_t',
    // our injected helper
    '__tag',
]);

// C++ keywords that are never identifiers we resolve.
const KEYWORDS = new Set([
    'return', 'auto', 'const', 'constexpr', 'static', 'void', 'int', 'float',
    'double', 'bool', 'char', 'unsigned', 'signed', 'long', 'short', 'for',
    'while', 'if', 'else', 'do', 'switch', 'case', 'break', 'continue', 'true',
    'false', 'nullptr', 'new', 'delete', 'class', 'struct', 'namespace', 'using',
    'public', 'private', 'protected', 'this', 'sizeof', 'typename', 'template',
]);

/** Find the index of the '}' matching the '{' at openIdx, skipping strings/comments. */
function matchBrace(src: string, openIdx: number): number {
    let depth = 0;
    for (let i = openIdx; i < src.length; i++) {
        const c = src[i];
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { i++; } continue; }
        if (c === '/' && src[i + 1] === '*') { i += 2; while (i + 1 < src.length && !(src[i] === '*' && src[i + 1] === '/')) { i++; } i++; continue; }
        if (c === '"' || c === '\'') {
            const q = c; i++;
            while (i < src.length && src[i] !== q) { if (src[i] === '\\') { i++; } i++; }
            continue;
        }
        if (c === '{') { depth++; }
        else if (c === '}') { depth--; if (depth === 0) { return i; } }
    }
    return -1;
}

/** 0-based line number of a character offset. */
function lineOf(src: string, offset: number): number {
    let line = 0;
    for (let i = 0; i < offset && i < src.length; i++) { if (src[i] === '\n') { line++; } }
    return line;
}

interface PreviewFn {
    body: string;       // inside the outer braces (no surrounding { })
    bodyLine: number;   // 0-based line where the body starts
    fnName: string;
}

/**
 * Locate the preview target: the function whose body follows a `// @preview`
 * marker (or, lacking one, the first View/Actor-returning function). Returns the
 * body text between its outer braces. Member functions (Class::Build / a method
 * inside a class) are handled the same way — we only need the body.
 */
export function findPreviewFunction(src: string): PreviewFn | null {
    // Prefer a // @preview marker.
    let searchFrom = 0;
    const marker = src.search(/\/\/\s*@preview\b/);
    if (marker !== -1) { searchFrom = marker; }

    // From searchFrom, find the next function signature `... name(...) {`.
    // (returnType is anything ending in a type token; we just need the name + body.)
    const sigRe = /([A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?\{/g;
    sigRe.lastIndex = searchFrom;
    let m: RegExpExecArray | null;
    while ((m = sigRe.exec(src)) !== null) {
        const name = m[1];
        if (KEYWORDS.has(name)) { continue; }           // skip if(...) / for(...) etc.
        const braceIdx = src.indexOf('{', m.index + m[0].length - 1);
        if (braceIdx === -1) { continue; }
        const close = matchBrace(src, braceIdx);
        if (close === -1) { continue; }
        const body = src.slice(braceIdx + 1, close);
        return { body, bodyLine: lineOf(src, braceIdx + 1), fnName: name };
    }
    return null;
}

/** Collect candidate identifiers referenced in a body (calls, types, namespaces, vars). */
export function scanRefs(body: string): Set<string> {
    const refs = new Set<string>();
    // Strip strings + comments so identifiers inside them don't count.
    const cleaned = body
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    // Identifiers DECLARED locally in the body (`auto x = …`, range-for vars
    // `for (… & tx : …)`) are not external refs — they're defined right here, so
    // they must never be collected or stubbed (else `auto txList`/`tx` leak into
    // the globals slot as bogus stubs).
    const locals = new Set<string>();
    for (const lm of cleaned.matchAll(/\bauto\b[\s&*]+([A-Za-z_]\w*)/g)) { locals.add(lm[1]); }

    // Match identifiers NOT preceded by '.' (member access) or ':' (scope member).
    // For `Scope::Member` only the scope head is a resolvable ref — `::Member`
    // (Type::New, theme::ACCENT, FlexAlign::CENTER) is a static/enum/member that
    // resolves through the scope itself, never a free symbol to collect or stub.
    const idRe = /(^|[^.\w:])([A-Za-z_]\w*)/g;
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(cleaned)) !== null) {
        const id = m[2];
        if (KEYWORDS.has(id) || KNOWN_SYMBOLS.has(id) || locals.has(id)) { continue; }
        refs.add(id);
    }
    return refs;
}

interface CollectedDef {
    name: string;
    text: string;   // full definition text
    line: number;   // 0-based source line of the definition
}

/**
 * For each ref, find its definition in the SAME source and return the def text.
 * Handles: free/static functions, namespaces (`namespace X { ... }`), struct/class,
 * and single-line const/constexpr. Refs with no same-file definition are returned
 * as `unresolved` (members, cross-file helpers, external models).
 */
export function collectSameFileDefs(src: string, refs: Set<string>, excludeRange?: [number, number]):
    { collected: CollectedDef[]; unresolved: string[] } {
    const collected: CollectedDef[] = [];
    const unresolved: string[] = [];

    for (const name of refs) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let found: CollectedDef | null = null;

        // 1) namespace X { ... }
        const nsRe = new RegExp(`\\bnamespace\\s+${esc}\\s*\\{`, 'g');
        let nm = nsRe.exec(src);
        if (nm) {
            const brace = src.indexOf('{', nm.index);
            const close = matchBrace(src, brace);
            if (close !== -1) {
                found = { name, text: src.slice(nm.index, close + 1), line: lineOf(src, nm.index) };
            }
        }

        // 2) struct/class X { ... };
        if (!found) {
            const tyRe = new RegExp(`\\b(?:struct|class)\\s+${esc}\\b[^{;]*\\{`, 'g');
            const tm = tyRe.exec(src);
            if (tm) {
                const brace = src.indexOf('{', tm.index);
                const close = matchBrace(src, brace);
                if (close !== -1) {
                    // include trailing ';'
                    let end = close + 1;
                    if (src[end] === ';') { end++; }
                    found = { name, text: src.slice(tm.index, end), line: lineOf(src, tm.index) };
                }
            }
        }

        // 3) free/static function: `<ret> name(...) { ... }` (not a call site)
        if (!found) {
            const fnRe = new RegExp(`(?:^|\\n)([ \\t]*(?:static\\s+)?[A-Za-z_][\\w:<>,&* ]*?\\b${esc}\\s*\\([^;{}]*\\)\\s*(?:const\\s*)?\\{)`, 'g');
            const fm = fnRe.exec(src);
            if (fm) {
                const sigStart = fm.index + (fm[0].length - fm[1].length);
                const brace = src.indexOf('{', sigStart);
                const close = matchBrace(src, brace);
                if (close !== -1 && (!excludeRange || sigStart < excludeRange[0] || sigStart >= excludeRange[1])) {
                    found = { name, text: src.slice(sigStart, close + 1).trim(), line: lineOf(src, sigStart) };
                }
            }
        }

        // 4) single-line const/constexpr: `constexpr T name = ...;`  (handled via namespace usually)
        if (!found) {
            const cRe = new RegExp(`\\b(?:constexpr|const)\\s+[\\w:<>]+\\s+${esc}\\s*=\\s*[^;]+;`, 'g');
            const cm = cRe.exec(src);
            if (cm) {
                found = { name, text: cm[0], line: lineOf(src, cm.index) };
            }
        }

        if (found) { collected.push(found); }
        else { unresolved.push(name); }
    }
    return { collected, unresolved };
}

/** Heuristically synthesise a weak, bodied stub for an unresolved identifier. */
export function synthWeakStub(name: string, body: string): string {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // View-returning helper: called as `name(...)` and used where a View is expected.
    if (new RegExp(`\\b${esc}\\s*\\(`).test(body)) {
        return `__attribute__((weak)) Dali::Ui::View ${name}(...) { return Dali::Ui::View::New(); }`;
    }
    // Container iterated by a range-for: `for (... : name)`.
    if (new RegExp(`:\\s*${esc}\\b`).test(body) && /for\s*\(/.test(body)) {
        return `static auto ${name} = std::vector<int>{0, 0, 0}; // weak stub: 3 dummy elements`;
    }
    // String context: `.c_str()` on it, or passed where text is expected.
    if (new RegExp(`\\b${esc}\\s*\\.\\s*c_str\\s*\\(`).test(body) || new RegExp(`Label::New\\s*\\(\\s*${esc}\\b`).test(body)) {
        return `__attribute__((weak)) std::string ${name} = "Sample";`;
    }
    // Scalar context: used inside UiColor(name) / arithmetic → an unsigned int.
    if (new RegExp(`UiColor\\s*\\(\\s*${esc}\\b`).test(body)) {
        return `__attribute__((weak)) unsigned int ${name} = 0x888888;`;
    }
    // Fallback: a weak int that compiles anywhere it's read as a value.
    return `__attribute__((weak)) unsigned int ${name} = 0;`;
}

/** Topologically order collected defs (constants/types/namespaces before functions). */
function orderDefs(defs: CollectedDef[]): CollectedDef[] {
    // Simple ordering: source order is usually correct (defs precede the preview fn);
    // sort by original line so a helper that uses an earlier const stays after it.
    return [...defs].sort((a, b) => a.line - b.line);
}

/**
 * Build a self-contained slice from a full source file.
 *
 * @param src          full text of the source file
 * @param entrySrcPath path to the file (for #line / sourcePaths)
 */
export function buildSlice(src: string, entrySrcPath: string): SliceResult {
    const entry = findPreviewFunction(src);
    if (!entry) {
        // Nothing to slice — treat the whole input as the body (Rung3 passthrough).
        return { includes: '', globals: '', body: src, sourcePaths: [entrySrcPath], unresolvedStubs: [], rung: 'single-fn' };
    }

    const refs = scanRefs(entry.body);
    if (refs.size === 0) {
        return { includes: '', globals: '', body: entry.body, sourcePaths: [entrySrcPath], unresolvedStubs: [], rung: 'single-fn' };
    }

    const { collected, unresolved } = collectSameFileDefs(src, refs);
    const ordered = orderDefs(collected);

    // Hoist project-local #include lines (relative includes). System <...> are
    // already provided by the template; skip them.
    const includeLines = (src.match(/^[ \t]*#include\s+"[^"]+"/gm) ?? []);
    const includes = ''; // Rung2 inlines defs rather than mounting headers (ADR: avoid mount gap).

    const stubs = unresolved.map((u) => synthWeakStub(u, entry.body));
    const globalsParts = [
        ...ordered.map((d) => d.text),
        ...stubs,
    ];
    const globals = globalsParts.length ? '\n' + globalsParts.join('\n\n') + '\n' : '';

    const sourcePaths = [entrySrcPath];

    return {
        includes,
        globals,
        body: entry.body,
        sourcePaths,
        unresolvedStubs: unresolved,
        rung: 'heuristic',
    };
}
