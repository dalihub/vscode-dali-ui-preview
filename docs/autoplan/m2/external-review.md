# M2 External Review — SliceBuilder (Rung 2)

Independent, execution-based review. I did NOT read architecture.md or adr/*. All
claims below are backed by actually running `buildSlice` and compiling its output
with `g++ -std=c++17 -fsyntax-only` against a faithful minimal dali-ui stand-in
(real symbols for everything the body legitimately uses, so the ONLY thing under
test is whether the slice itself forms a valid translation unit).

## Verdict: CONCERN

The module is honest about its scope, the stubs are bodied (Inv-2 holds), the unit
tests are real (not theatre), and all three same-file fixtures genuinely compile.
BUT on the one realistic preview target this milestone exists to serve
(`WalletScreen::Build()`), the slice it produces does **not compile** — and the
failure is silent: `buildSlice` returns `rung: 'heuristic'` with no error signal,
so a naive caller would hand a guaranteed-broken TU to the compiler. The boundary
the exec-validation doc describes as "factories become weak stubs" undersells the
reality: the stubs for `theme` and `mVm` are the *wrong kind of symbol* and break
compilation outright, not just render a blank card. That gap between "fixtures
pass" and "real app fails hard" is why this is CONCERN, not PASS.

## Findings

- **Finding 1 — Real-app slice does NOT compile (14 errors).** `sliceBuilder.ts`
  emits `__attribute__((weak)) unsigned int theme = 0x888888;` for `theme`, but the
  body uses `theme` as a *namespace* (`theme::GAP_ROW`, `theme::BG`, …). g++:
  `error: 'theme' is not a class, namespace, or enumeration` ×8. Likewise `mVm` is
  stubbed `static auto mVm = std::vector<int>{...}` but the body does `mVm.recent`
  and `mVm.balance.c_str()` → `'class std::vector<int>' has no member named
  'recent' / 'balance'`. Net: a hard compile failure, not a degraded render. **User
  sees:** the preview fails to build with confusing errors about wallet code they
  didn't write, OR (worse) errors `#line`-mapped back onto their source at offsets
  that don't correspond to a real mistake. (`src/sliceBuilder.ts:240` UiColor-scalar
  branch + `:232` vector branch + `:244` fallback all mis-fire here.)

- **Finding 2 — Locals and loop variables are stubbed as globals (scanRefs hole).**
  `scanRefs` (`src/sliceBuilder.ts:124`) has no notion of binding scope, so the
  body's own `auto txList = …` and `for (const auto& tx : …)` are captured as
  unresolved refs and emitted into globals: `unsigned int txList = 0;` and
  `unsigned int tx = 0;`. The local `txList` then shadows the global (so the global
  is dead) but `txList` is later placed in a `Children({…, txList})` list of `View`
  — type `int` vs `View` → `cannot convert '<brace-enclosed initializer list>' to
  'std::vector<Dali::Ui::View>'`. **User sees:** more spurious errors; at minimum,
  wasted/incorrect stubs. This is a correctness bug independent of the cross-file
  boundary — it would mis-fire on *any* function with a local that shares a name the
  scanner can't otherwise resolve.

- **Finding 3 — Silent failure / no compile-ability signal.** `buildSlice` returns
  the same `rung: 'heuristic'` shape whether the result is sound (fixtures) or
  guaranteed-broken (real app). There is no field saying "this slice references a
  member of a stubbed struct" or "a stub's kind is uncertain". The implementer
  deferred orchestrator wiring to M3 (documented), so nothing *currently* ships this
  to a user — but the module's contract gives the future caller no way to tell a
  good slice from a doomed one. The `unresolvedStubs` list reports *names*, not
  *risk*: `theme` and `MakeStatCard` look identical in it, yet one stub is harmless
  and the other is fatal.

- **Finding 4 — Inv-2 / RTLD_NOW: UPHELD.** I compiled all five `synthWeakStub`
  shapes standalone; every one carries a body/initializer (incl. the C-variadic
  `View Foo(...) { return …; }` form, which g++ accepts even with no named param).
  No path emits a bare `__attribute__((weak)) T x;` declaration. So dlopen(RTLD_NOW)
  would not crash on a *missing* symbol. Minor note: the container stub uses
  `static auto … = std::vector<int>{…}` (TU-local, bodied) rather than `weak` — fine
  for dlopen, but inconsistent with the "weak stub" framing and the unit test's
  `__attribute__((weak))` assertion does not cover it.

- **Finding 5 — Tests are real, but the member fixture dodges the dominant case.**
  The unit tests genuinely exercise slicing (assert collected def text, exact stub
  bodies, the negative "no bodyless weak decl" regex, scanRefs scope-member
  exclusion). They are NOT vacuous and would catch e.g. a dropped def or a bodyless
  stub. HOWEVER `member_field.cpp` uses **bare** `mName`/`mAccent`, even though its
  own comment claims `this->mX` is "the dominant real-world case." I verified that
  `this->mName` *is* caught by scanRefs (so it would still be stubbed as a free
  global), but the body's `this->` then fails in a non-member function:
  `error: invalid use of 'this' in non-member function`. So the fixture passes only
  because it avoids the shape the comment says matters most. The test suite has no
  fixture where a stubbed identifier is used as a *namespace* or as a *struct with
  members* — i.e. exactly the two shapes that break the real app go untested.

## Real-app boundary (flow-wallet)

Ran `buildSlice` on `samples/flow-wallet/screens/wallet_screen.cpp`
(`WalletScreen::Build()`). Result: `rung = heuristic`, and

```
unresolvedStubs = ["txList","theme","tx","mVm",
                   "MakeTransactionRow","MakeSectionHeader","MakeStatCard"]
```

How far Rung2 actually gets, symbol by symbol:

| ref | what Rung2 emits | correct? | effect |
|---|---|---|---|
| `MakeStatCard` / `MakeSectionHeader` / `MakeTransactionRow` | `weak View …(...) { return View::New(); }` | YES (cross-file in cards.cpp → correctly NOT collected, becomes weak stub) | compiles; renders an **empty View** (no card content) |
| `theme` | `weak unsigned int theme = 0x888888;` | **NO** — used as namespace `theme::BG` | **compile error** ×8 |
| `mVm` | `static auto mVm = std::vector<int>{0,0,0};` | **NO** — used as struct `mVm.recent`/`mVm.balance` | **compile error** ×2 |
| `txList` | `weak unsigned int txList = 0;` | **NO** — it's a local `auto txList` in the body | shadowed; then `int` in a `View` list → error |
| `tx` | `weak unsigned int tx = 0;` | **NO** — it's the for-loop variable | dead stub |

So: the cross-file factory question the prompt flags is handled **correctly** —
Rung2 does fail-to-collect `MakeStatCard` et al. and falls back to a weak stub
rather than fabricating a wrong def. If those were the *only* unresolved refs, the
slice would compile and render the screen scaffold with three blank/empty cards
(structure visible, no labels/values). **But the slice as a whole does not compile**
because `theme` and `mVm` are stubbed as the wrong *kind* of symbol, and the body's
own local/loop variables are stubbed as globals with mismatched types.

The `for (const auto& tx : mVm.recent)` loop is NOT handled: the container `mVm`
becomes a `vector<int>` whose element type can't satisfy `tx.merchant`/`tx.amount`,
and `mVm.recent` doesn't exist on the stub anyway (`mVm` IS the vector, not an
object with a `.recent` vector). The for-loop body never type-checks.

**What the user would SEE today:** nothing, because integration is deferred to M3.
**What the user would see once wired as-is:** a build failure with ~14 g++ errors
referencing `theme`, `mVm`, and a brace-init list — none of which point at a real
mistake in their code. That is strictly worse than the current "can't preview this"
behavior, because it looks like the preview is broken rather than unsupported.

(All of the above reproduced with `g++ -std=c++17 -fsyntax-only` on the assembled
3-slot TU using real dali-ui stand-in types; the three same-file fixtures
`helper_same_file` / `member_field` / `theme_const` each compile exit 0, confirming
the Gate B claim holds *for the fixtures*.)

## Could-be-stronger

1. **Distinguish stub KIND before emitting (the actual fix).** A weak `unsigned int`
   for an identifier used as `X::Member` or `X.member` is always wrong. Before
   stubbing, scan the body for `name::` (→ needs a namespace/struct stub with the
   referenced members) and `name.` (→ needs a struct stub, or at least DON'T pretend
   it's a scalar). Better still, since same-file resolution can't help here, surface
   a "needs-Rung1" signal on the result so the caller refuses rather than ships a
   doomed TU. As-is, the heuristic's confidence and its correctness are decoupled.

2. **Subtract body-local bindings in scanRefs.** Strip identifiers introduced by
   `auto NAME =`, `Type NAME =`, `for (… NAME :` / `for (…; NAME …` before computing
   unresolved refs, so locals and loop variables are never stubbed. Cheap (regex on
   the same cleaned body) and removes `txList`/`tx`-class false positives entirely.

3. **Add the two breaking shapes to the fixture set.** There is no test where a
   stubbed name is used as a namespace (`theme::X`) or as a struct member-owner
   (`mVm.recent`), nor one using `this->member`. Add those three; today they would
   all fail to compile, which is exactly the regression surface M3 will hit. (Also:
   the `member_field` comment advertising `this->mX` should either use that form or
   drop the claim — right now the fixture and its own documentation disagree.)
