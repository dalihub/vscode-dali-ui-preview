# M5 — exec validation (Rung1 heuristic cross-file)

## What M5 did
When the preview target references a helper/type/const defined in ANOTHER file,
the extension now reads the document's `#include "..."` sources (header + same-stem
.cpp, 1 hop, workspace-contained) and SliceBuilder collects the definitions from
them, inlining into the globals slot. Without this they became weak stubs.

## Gate A (static)
- `npm run compile`: exit 0
- full suite: **594 passing** (592 + 2 cross-file) — no regression

## Gate B (execution)
- buildSlice cross-file: with extraSources → `MakeBanner` collected from widgets.cpp
  (real def `Label::New(text)`, stubs=[], sourcePaths includes widgets.cpp); without
  → weak stub. (unit asserts both.)
- docker compile of the cross-file slice: **PASS**.
- **Real render**: cross-file slice → .so → preview_server → PNG = teal **"Welcome"**
  banner (Docs/auto_extract_xfile_preview.png). The helper from another file rendered.

## External-review (CONCERN → addressed)
Independent reviewer compiled clean and ran node against real sources:
1. **Security (FIXED):** `resolveProjectIncludes` had no workspace containment —
   `#include "/etc/passwd"` was empirically read. Added a containment guard: only
   paths inside the workspace root (or the doc's dir if no workspace) are read;
   escapes are skipped. Blast radius was low (read-only, inlined into a
   user-triggered compile, never written/exfiltrated) but now closed.
2. **Regression floor: CONFIRMED solid** — 41 self-contained samples → empty
   extraSources → single-fn → byte-identical; perf ~0.026ms/call; decl-vs-def
   precedence correct (header declaration ignored, .cpp body collected).
3. **flow-wallet reality (HONEST LIMIT, recorded):** 1-hop correctly inlines
   `theme::*` + all 3 card factories, but `mVm` (a member model in model/wallet_vm.h,
   2-hop, behind wallet_screen.h) stays a `std::vector<int>` stub while the body
   calls `mVm.recent`/`.balance` → compile fails → Rung3 blank fallback. Still NOT
   covered: **member functions, injected models, transitive 2-hop includes, and
   file-scope deps of collected helpers.** These are the next frontier.

## Inv audit
- Inv-1 (single-fn byte-identical): UPHELD (594 + sample-sweep).
- Inv-2 (bodied stubs): UPHELD.
- Inv-4 (no regression): 594 pass.
- Inv-5 (server/image unchanged): UPHELD.

## Verdict: M5 PASS — cross-file helper resolved + rendered (Welcome banner);
security containment added; regression floor solid; flow-wallet's member-function
+ model + 2-hop gaps honestly recorded as the next step.
