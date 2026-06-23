# Flow Wallet — realistic dali-ui sample app

A deliberately *realistic* mini commercial app, used to test how far the
zero-annotation auto-extract previewer can go on production-shaped code (not the
idealized self-contained `*.preview.dali.cpp` samples).

## Why it exists

The existing `test/samples/*.preview.dali.cpp` files are all **self-contained
preview bodies** — build a `SomeLayout::New()` tree with sequential setters and
`return` it, with no helpers, no member state, no project headers. Real apps
don't look like that. Flow Wallet
packs the six dominant real-world patterns into one screen so we can measure
which the previewer handles, and where it needs the next tier.

## File map (and which pattern each carries)

| File | Pattern | What it forces the previewer to do |
|---|---|---|
| `theme/tokens.h` | **P4** theme constants | resolve `theme::ACCENT` → `0x00d4a8` |
| `model/wallet_vm.h` | **P6** MVVM model | auto-stub a `WalletViewModel` instance |
| `widgets/cards.h` / `.cpp` | **P1/P14** helper & factory funcs | collect `MakeStatCard` etc. — **defined in another file** |
| `screens/wallet_screen.h` / `.cpp` | **P5** class member builder | preview a `WalletScreen::Build()` member, not a free function |
| (inside `Build()`) | **P2** for-loop data binding | loop `mVm.recent` → rows |
| (includes in `.cpp`) | **P11** project headers | hoist `#include "../theme/tokens.h"` etc. |
| `app_main.cpp` | — (entry point) | proves it's a runnable `Dali::Application`, not a snippet |

## Preview target

`WalletScreen::Build()` in `screens/wallet_screen.cpp`. Marked `// @preview`.

## Two resolution cases (deliberate)

- **Cross-file (realistic):** the factories live in `widgets/cards.cpp`, a
  different translation unit. Resolving them needs **Rung 1** (clangd cross-file
  lookup). Rung 2 (same-file regex) can't reach them — and the validation report
  records exactly that boundary.
- For the Rung 2 path we use `test/fixtures/slice/*.cpp`, where helper/member/
  const all live in the **same file** — collectable without clangd.

## Boundary

Everything here stays inside the **dali-ui** API surface (`dali-ui-foundation`).
No `dali-toolkit`, no Tizen capi — so the docker runtime image can compile it
without a Tizen sysroot (see ADR-006).
