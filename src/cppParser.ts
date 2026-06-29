/**
 * cppParser.ts — TypeScript C++ builder-code parser
 *
 * Parses dali-ui builder-pattern C++ into a JSON SceneNode tree.
 * Returns null on any unsupported pattern so the caller can fall back
 * to the compile path (~500ms).
 *
 * Two builder shapes are supported, both producing the same SceneNode tree
 * (consumed verbatim by the C++ preview-server's renderJson scene builder):
 *
 *   1. Fluent single expression (legacy chaining API):
 *        return TypeName::New(args...)
 *            .Method(value)
 *            .Children({ TypeName::New(...), ... });
 *
 *   2. Imperative statement sequence (current dali-ui — fluent API removed
 *      2026-06, so setters return void and `Children` → `AddChildren`):
 *        FlexLayout root = FlexLayout::New();   // declare a named local
 *        root.SetDirection(FlexDirection::COLUMN);
 *        Label title = Label::New("Hi");
 *        root.AddChildren({ title });           // children by var reference
 *        return root;
 *      `auto root = ...` is accepted too. Declarations bind a name → SceneNode
 *      in a symbol table; `var.Setter(...)` mutates that node; `AddChildren`
 *      resolves bare identifiers against the table (or inline `Type::New(...)`).
 *
 * Argument values may themselves be scoped builder chains, e.g.
 *   .SetLayoutParams(StackLayoutParams::New().SetWeight(1.0f))
 *
 * Unsupported → null (caller falls back to compile path):
 *   Ternary operators, control flow keywords, preprocessor directives,
 *   bare user-defined function calls (model.GetTitle() must keep falling
 *   back to the compile path — only Scope::Call(...) bases may chain),
 *   and references to undeclared variables.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SceneNode {
    type: string;
    constructorArgs: string[];
    properties: Record<string, string[]>;
    children: SceneNode[];
    /**
     * Absolute source line of this node's `TypeName::New(...)` call.
     * When present, the C++ server tags the resulting actor with
     * `Actor::Property::NAME = "__L{sourceLine}"` so click-to-code
     * and the widget inspector can resolve clicks back to source.
     */
    sourceLine?: number;
}

// ---------------------------------------------------------------------------
// LRU cache (10 entries, keyed by code string)
// ---------------------------------------------------------------------------

const CACHE_SIZE = 10;
const _cache    = new Map<string, SceneNode | null>();
const _cacheOrder: string[] = [];

function _cacheGet(key: string): SceneNode | null | undefined {
    if (!_cache.has(key)) {
        return undefined;
    }
    // Refresh LRU order on hit
    const idx = _cacheOrder.indexOf(key);
    if (idx !== -1) {
        _cacheOrder.splice(idx, 1);
        _cacheOrder.push(key);
    }
    return _cache.get(key);
}

function _cacheSet(key: string, result: SceneNode | null): void {
    if (_cacheOrder.length >= CACHE_SIZE) {
        const oldest = _cacheOrder.shift()!;
        _cache.delete(oldest);
    }
    _cacheOrder.push(key);
    _cache.set(key, result);
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenKind =
    | 'IDENT' | 'NUMBER' | 'STRING'
    | 'SCOPE' | 'DOT' | 'COMMA' | 'SEMI' | 'EQ'
    | 'LPAREN' | 'RPAREN'
    | 'LBRACE' | 'RBRACE'
    | 'EOF';

interface Token {
    kind: TokenKind;
    text: string;
    /** 1-based line number within the tokenised source (before adding startLine). */
    line: number;
}

// Keywords that indicate unparseable code → triggers compile fallback
// `auto` is intentionally NOT here: it is a valid declaration specifier in the
// imperative builder form (`auto root = FlexLayout::New();`). Primitive type
// keywords (int/float/...) stay listed — they signal value computations, not UI
// nodes, so we want those to fall back to the compile path.
const FAIL_KEYWORDS = new Set([
    'if', 'for', 'while', 'do', 'switch', 'else', 'goto',
    'int', 'float', 'bool', 'char', 'double', 'void',
    'const', 'static', 'class', 'struct', 'namespace',
    'using', 'template', 'typename',
    'new', 'delete', 'throw', 'operator',
]);

/**
 * Tokenize a C++ chaining expression.
 * Returns null if any unsupported token (ternary `?`, `#`) is encountered.
 */
function tokenize(src: string): Token[] | null {
    const tokens: Token[] = [];
    let i = 0;
    let line = 1;

    while (i < src.length) {
        // Whitespace
        if (/\s/.test(src[i])) {
            if (src[i] === '\n') { line++; }
            i++;
            continue;
        }

        // Line comment
        if (src[i] === '/' && i + 1 < src.length && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') { i++; }
            continue;
        }

        // Block comment
        if (src[i] === '/' && i + 1 < src.length && src[i + 1] === '*') {
            i += 2;
            while (i + 1 < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
                if (src[i] === '\n') { line++; }
                i++;
            }
            i += 2;
            continue;
        }

        // Ternary / preprocessor → unsupported
        if (src[i] === '?' || src[i] === '#') { return null; }

        // Scope operator
        if (src[i] === ':' && i + 1 < src.length && src[i + 1] === ':') {
            tokens.push({ kind: 'SCOPE', text: '::', line });
            i += 2; continue;
        }

        // Assignment '=' (variable declarations in the imperative builder form).
        // A comparison '==' is a condition → unsupported, fall back to compile.
        if (src[i] === '=') {
            if (i + 1 < src.length && src[i + 1] === '=') { return null; }
            tokens.push({ kind: 'EQ', text: '=', line });
            i++; continue;
        }

        // Single-char punctuation
        switch (src[i]) {
            case '.': tokens.push({ kind: 'DOT',    text: '.', line }); i++; continue;
            case ',': tokens.push({ kind: 'COMMA',  text: ',', line }); i++; continue;
            case ';': tokens.push({ kind: 'SEMI',   text: ';', line }); i++; continue;
            case '(': tokens.push({ kind: 'LPAREN', text: '(', line }); i++; continue;
            case ')': tokens.push({ kind: 'RPAREN', text: ')', line }); i++; continue;
            case '{': tokens.push({ kind: 'LBRACE', text: '{', line }); i++; continue;
            case '}': tokens.push({ kind: 'RBRACE', text: '}', line }); i++; continue;
        }

        // Negative number: '-' followed immediately by a digit
        if (src[i] === '-' && i + 1 < src.length && /\d/.test(src[i + 1])) {
            let j = i + 1;
            while (j < src.length && /[\d.]/.test(src[j])) { j++; }
            if (j < src.length && src[j] === 'f') { j++; }
            tokens.push({ kind: 'NUMBER', text: src.slice(i, j), line });
            i = j; continue;
        }

        // Number (positive)
        if (/\d/.test(src[i])) {
            let j = i;
            if (src[j] === '0' && j + 1 < src.length && src[j + 1] === 'x') {
                // Hex literal
                j += 2;
                while (j < src.length && /[0-9a-fA-F]/.test(src[j])) { j++; }
            } else {
                while (j < src.length && /[\d.]/.test(src[j])) { j++; }
                if (j < src.length && src[j] === 'f') { j++; }
            }
            tokens.push({ kind: 'NUMBER', text: src.slice(i, j), line });
            i = j; continue;
        }

        // String literal
        if (src[i] === '"') {
            let j = i + 1;
            while (j < src.length && src[j] !== '"') {
                if (src[j] === '\\') { j++; } // skip escape
                j++;
            }
            j++; // closing "
            tokens.push({ kind: 'STRING', text: src.slice(i, j), line });
            i = j; continue;
        }

        // Identifier / keyword
        if (/[a-zA-Z_]/.test(src[i])) {
            let j = i;
            while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) { j++; }
            const text = src.slice(i, j);
            if (FAIL_KEYWORDS.has(text)) { return null; }
            tokens.push({ kind: 'IDENT', text, line });
            i = j; continue;
        }

        // Unknown character → unsupported
        return null;
    }

    tokens.push({ kind: 'EOF', text: '', line });
    return tokens;
}

// ---------------------------------------------------------------------------
// Recursive descent parser
// ---------------------------------------------------------------------------

class CppChainParser {
    private idx = 0;

    /**
     * Symbol table for the imperative builder form: maps a declared local name
     * (`FlexLayout root = ...`) to the SceneNode it builds. `var.Setter(...)`
     * mutates the bound node in place, and `AddChildren({ a, b })` resolves bare
     * identifiers through this table. Empty for the fluent single-expression
     * form, so that path behaves exactly as before.
     */
    private readonly symbols = new Map<string, SceneNode>();

    constructor(
        private readonly tokens: Token[],
        private readonly startLineOffset: number,
    ) {}

    // -----------------------------------------------------------------------

    private peek(): Token {
        return this.tokens[this.idx] ?? { kind: 'EOF', text: '' };
    }

    /** Lookahead `offset` tokens past the cursor (EOF past the end). */
    private peekAt(offset: number): Token {
        return this.tokens[this.idx + offset] ?? this.tokens[this.tokens.length - 1];
    }

    private consume(): Token {
        return this.tokens[this.idx++] ?? { kind: 'EOF', text: '' };
    }

    private expect(kind: TokenKind): Token | null {
        if (this.peek().kind !== kind) { return null; }
        return this.consume();
    }

    // -----------------------------------------------------------------------
    // Top-level entry
    // -----------------------------------------------------------------------

    parse(): SceneNode | null {
        // Root of a legacy single bare expression (`Type::New()...;` with no
        // `return`). The imperative form returns its root early via the `return`
        // branch below; this stays null until/unless a lone expression is seen.
        let bareRoot: SceneNode | null = null;

        while (this.peek().kind !== 'EOF') {
            const t = this.peek();

            // return <value> ;  → the value is the scene root; nothing valid
            // may follow (preserves the "trailing tokens → null" contract).
            if (t.kind === 'IDENT' && t.text === 'return') {
                this.consume();
                const value = this.parseValue();
                if (!value) { return null; }
                if (this.peek().kind === 'SEMI') { this.consume(); }
                if (this.peek().kind !== 'EOF') { return null; }
                return value;
            }

            // Declaration:  Type var = <value> ;   |   auto var = <value> ;
            if (t.kind === 'IDENT'
                && this.peekAt(1).kind === 'IDENT'
                && this.peekAt(2).kind === 'EQ') {
                this.consume();                  // type specifier (or `auto`)
                const varTok = this.consume();   // variable name
                this.consume();                  // '='
                const value = this.parseValue();
                if (!value) { return null; }
                if (!this.expect('SEMI')) { return null; }
                this.symbols.set(varTok.text, value);
                continue;
            }

            // Mutation on a declared local:  var.Method(...)... ;
            if (t.kind === 'IDENT' && this.peekAt(1).kind === 'DOT'
                && this.symbols.has(t.text)) {
                const target = this.symbols.get(t.text)!;
                this.consume();                  // variable name
                if (!this.applyChainedMethods(target)) { return null; }
                if (!this.expect('SEMI')) { return null; }
                continue;
            }

            // Legacy bare expression statement: a lone `Type::New()...;` is the
            // root. A second one (or anything else) is unsupported → null.
            if (!bareRoot && t.kind === 'IDENT' && this.peekAt(1).kind === 'SCOPE') {
                const node = this.parseNode();
                if (!node) { return null; }
                if (this.peek().kind === 'SEMI') { this.consume(); }
                bareRoot = node;
                continue;
            }

            // Unsupported token sequence → fall back to compile path.
            return null;
        }

        return bareRoot;
    }

    // -----------------------------------------------------------------------
    // A declaration RHS / return value: either a bare reference to an already
    // declared local, or a fresh `Type::New(...)...` chain expression.
    // -----------------------------------------------------------------------

    private parseValue(): SceneNode | null {
        // Bare identifier NOT followed by `::` → variable reference (e.g.
        // `return root;`). A `Foo::New(...)` or `Foo(...)`-shaped token stream
        // is a chain expression and goes to parseNode. An unknown bare name
        // (helper call like `MakeCard(...)`, undeclared var) resolves to null.
        if (this.peek().kind === 'IDENT' && this.peekAt(1).kind !== 'SCOPE') {
            const name = this.consume().text;
            return this.symbols.get(name) ?? null;
        }
        return this.parseNode();
    }

    // -----------------------------------------------------------------------
    // Node: TypeName::New(args).Method(args)...
    // -----------------------------------------------------------------------

    private parseNode(): SceneNode | null {
        // Type name
        const typeToken = this.expect('IDENT');
        if (!typeToken) { return null; }

        // ::New
        if (!this.expect('SCOPE')) { return null; }
        const newToken = this.expect('IDENT');
        if (!newToken || newToken.text !== 'New') { return null; }

        // Constructor args
        if (!this.expect('LPAREN')) { return null; }
        const constructorArgs = this.parseArgValueList();
        if (constructorArgs === null) { return null; }
        if (!this.expect('RPAREN')) { return null; }

        // typeToken.line is 1-based within the tokenised code. Convert to
        // a 0-based line index and add startLineOffset so consumers (the
        // C++ server + click-to-code handler) see absolute 0-based source lines
        // that match instrumentCode()'s __L{line} convention.
        const sourceLine = (typeToken.line - 1) + this.startLineOffset;

        const node: SceneNode = {
            type: typeToken.text,
            constructorArgs,
            properties: {},
            children: [],
            sourceLine,
        };

        // Chained method calls (`.Method(args)` / `.AddChildren({...})`).
        if (!this.applyChainedMethods(node)) { return null; }

        return node;
    }

    // -----------------------------------------------------------------------
    // Apply a run of `.Method(args)` calls to an existing node. Shared by the
    // fluent chain (parseNode, on a freshly-built node) and the imperative form
    // (a `var.Setter(...)` statement, on a node from the symbol table). Setter
    // args land in `properties`; `Children`/`AddChildren` append to `children`.
    // Returns false on any malformed call so the caller falls back.
    // -----------------------------------------------------------------------

    private applyChainedMethods(node: SceneNode): boolean {
        while (this.peek().kind === 'DOT') {
            this.consume(); // '.'

            const methodToken = this.expect('IDENT');
            if (!methodToken) { return false; }
            const method = methodToken.text;

            if (!this.expect('LPAREN')) { return false; }

            if (method === 'Children' || method === 'AddChildren') {
                // Children({ ... }) / AddChildren({ ... })
                if (!this.expect('LBRACE')) { return false; }
                const children = this.parseChildrenList();
                if (children === null) { return false; }
                if (!this.expect('RBRACE')) { return false; }
                // Append: AddChildren may be called more than once on a local.
                for (const c of children) { node.children.push(c); }
            } else {
                const args = this.parseArgValueList();
                if (args === null) { return false; }
                node.properties[method] = args;
            }

            if (!this.expect('RPAREN')) { return false; }
        }

        return true;
    }

    // -----------------------------------------------------------------------
    // Children list: child, child, ...  where each child is either a bare
    // reference to a declared local (imperative form) or an inline
    // `Type::New(...)...` expression (fluent form). A bare name unknown to the
    // symbol table → null (compile fallback). In the fluent path the symbol
    // table is empty, so every child takes the inline branch as before.
    // -----------------------------------------------------------------------

    private parseChildrenList(): SceneNode[] | null {
        const children: SceneNode[] = [];

        while (this.peek().kind !== 'RBRACE') {
            if (this.peek().kind === 'EOF') { return null; }

            let child: SceneNode | null;
            if (this.peek().kind === 'IDENT' && this.peekAt(1).kind !== 'SCOPE') {
                // Bare variable reference (e.g. `AddChildren({ title, row })`).
                const ref = this.symbols.get(this.consume().text);
                if (!ref) { return null; }
                child = ref;
            } else {
                child = this.parseNode();
            }
            if (!child) { return null; }
            children.push(child);

            // Optional comma after each child
            if (this.peek().kind === 'COMMA') {
                this.consume();
            }
        }

        return children;
    }

    // -----------------------------------------------------------------------
    // Argument value list: arg, arg, ...
    // -----------------------------------------------------------------------

    private parseArgValueList(): string[] | null {
        const args: string[] = [];

        // Empty arg list
        if (this.peek().kind === 'RPAREN' || this.peek().kind === 'RBRACE') {
            return args;
        }

        while (true) {
            const arg = this.parseArgValue();
            if (arg === null) { return null; }
            args.push(arg);

            if (this.peek().kind === 'COMMA') {
                this.consume();
                // Trailing comma before close
                if (this.peek().kind === 'RPAREN' || this.peek().kind === 'RBRACE') {
                    break;
                }
            } else {
                break;
            }
        }

        return args;
    }

    // -----------------------------------------------------------------------
    // Single argument value → raw string
    //
    // Handles:
    //   - Number:           200.0f, -3, 0x1e1e2e
    //   - String:           "Hello"
    //   - Constant:         MATCH_PARENT, WRAP_CONTENT
    //   - Enum:             FlexDirection::COLUMN
    //   - Constructor:      UiColor(0x...), Extents(a,b,c,d)
    // -----------------------------------------------------------------------

    private parseArgValue(): string | null {
        const t = this.peek();

        if (t.kind === 'NUMBER') {
            this.consume();
            return t.text;
        }

        if (t.kind === 'STRING') {
            this.consume();
            return t.text;
        }

        if (t.kind === 'IDENT') {
            this.consume();
            let result = t.text;
            let isCall = false;

            // Optional scope resolution: Enum::VALUE or Namespace::Constructor
            if (this.peek().kind === 'SCOPE') {
                this.consume();
                const next = this.expect('IDENT');
                if (!next) { return null; }
                result += '::' + next.text;
            }

            // Optional call parens: UiColor(0x...), Extents(a,b,c,d),
            // StackLayoutParams::New()
            if (this.peek().kind === 'LPAREN') {
                this.consume();
                const innerArgs = this.parseArgValueList();
                if (innerArgs === null) { return null; }
                if (!this.expect('RPAREN')) { return null; }
                result += '(' + innerArgs.join(', ') + ')';
                isCall = true;
            }

            // Optional nested builder chain on a call result:
            //   StackLayoutParams::New().SetWeight(1.0f).SetAlignment(...)
            //   FlexLayoutParams::New().SetFlexGrow(1.0f)
            // Gated on isCall so a bare member access like `model.GetTitle()`
            // (no preceding `(...)`) still falls through to null and the
            // compile path — only `Type::New(...)`-style results may chain.
            while (isCall && this.peek().kind === 'DOT') {
                this.consume(); // '.'
                const methodToken = this.expect('IDENT');
                if (!methodToken) { return null; }
                if (!this.expect('LPAREN')) { return null; }
                const methodArgs = this.parseArgValueList();
                if (methodArgs === null) { return null; }
                if (!this.expect('RPAREN')) { return null; }
                result += '.' + methodToken.text + '(' + methodArgs.join(', ') + ')';
            }

            return result;
        }

        return null;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a dali-ui C++ chaining expression into a SceneNode tree.
 *
 * @param code        The extracted preview code (may include leading `return`).
 * @param startLine   Absolute 0-based line index in the original source file
 *                    where `code` begins. Propagated into each SceneNode's
 *                    `sourceLine` so the C++ server can tag actors with
 *                    `__L{line}` for click-to-code. Defaults to 0.
 * @returns           SceneNode on success, null if unsupported pattern detected.
 */
export function parseChainExpression(code: string, startLine: number = 0): SceneNode | null {
    const cacheKey = `${startLine}:${code}`;
    const cached = _cacheGet(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    const tokens = tokenize(code);
    if (!tokens) {
        _cacheSet(cacheKey, null);
        return null;
    }

    const result = new CppChainParser(tokens, startLine).parse();
    _cacheSet(cacheKey, result);
    return result;
}

/** Clear the parse result cache (useful in tests). */
export function clearParserCache(): void {
    _cache.clear();
    _cacheOrder.length = 0;
}
