# Welcome to DALi Preview

DALi Preview shows you a live image of your DALi C++ UI code — no
device, no emulator, no cross-compile. Just save and see.

## How it works

You write DALi code in `.preview.dali.cpp` files. The extension extracts
the layout, compiles it against the DALi runtime, renders one frame, and
shows the resulting PNG in a webview side-panel. After the first render,
text changes update in **under 200 ms**.

## Two ways to get DALi

| Mode | Setup | Best for |
|---|---|---|
| **Docker (recommended)** | One-time install of Docker. The DALi runtime ships as a pre-built container image. | First-time users, anyone without DALi already installed. |
| **Native** | You install DALi to `/opt/dali` yourself (manual build, ~30 min). | Power users who already have a DALi dev environment. |

This walkthrough sets up Docker mode in three steps. If you already have a
native DALi install and prefer to use it, skip ahead to step 4.
