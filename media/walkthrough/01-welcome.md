# Welcome to DALi Preview

DALi Preview shows you a live image of your DALi C++ UI code — no
device, no emulator, no cross-compile. Just save and see.

## How it works

You write DALi code in `.preview.dali.cpp` files. The extension extracts
the layout, compiles it against the DALi runtime, renders one frame, and
shows the resulting PNG in a webview side-panel. After the first render,
text changes update in **under 200 ms**.

## Two ways to get DALi

This walkthrough sets you up either way:

- **Docker (Recommended)** — one-time install of Docker, no DALi build
  on your host. Works out of the box for everyone, even with no DALi
  expertise.
- **Native** — point the extension at an existing DALi build on your
  host (typically `/opt/dali`). Faster (uses host GPU), but requires
  you to build DALi yourself.

Click **Open Documentation** below to read the full README, or jump
straight to step 2 to pick your runtime.
