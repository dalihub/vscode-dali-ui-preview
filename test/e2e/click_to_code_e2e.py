#!/usr/bin/env python3
"""
E2E regression test for click-to-code metadata tagging.

Covers BOTH code paths the extension uses:

  Path A — RELOAD (compile + dlopen):
    Compiles a plugin containing __tag() wrappers, sends RELOAD,
    asserts the post-render metadata has __L line tags.

  Path B — RENDER_JSON (parser-first fast path):
    Writes a scene JSON with sourceLine fields directly, sends
    RENDER_JSON, asserts the server set Actor::Property::NAME from
    sourceLine so click-to-code works without compile.

Both paths must produce __L-tagged metadata or the test fails.

Runs standalone — no vscode dependency. Exits 0 on pass, non-zero on failure.

Usage:
    python3 test/e2e/click_to_code_e2e.py
    DALI_PREFIX=/path/to/dali-env/opt python3 test/e2e/click_to_code_e2e.py
"""
import json
import os
import re
import subprocess
import sys
import threading
import time

REPO_ROOT  = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SERVER_SRC = os.path.join(REPO_ROOT, "docker", "preview_server.cpp")
TMP_DIR    = "/tmp/dali_preview"
SERVER_BIN = os.path.join(TMP_DIR, "preview_server")
DISPLAY    = os.environ.get("CLICK_TO_CODE_DISPLAY", ":98")

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
def strip_ansi(s: str) -> str:
    return ANSI_RE.sub("", s)

def detect_dali_prefix() -> str:
    """Return DALi install prefix. Mirrors daliEnvironment.ts priority."""
    env_prefix = os.environ.get("DALI_PREFIX") or os.environ.get("DESKTOP_PREFIX")
    if env_prefix:
        return env_prefix
    home = os.environ.get("HOME", "")
    # ~/dali-env/opt
    direct = os.path.join(home, "dali-env", "opt")
    if os.path.isdir(direct):
        return direct
    # ~/tizen/*/dali-env/opt — prefer one that has dali2-ui-foundation.pc
    tizen = os.path.join(home, "tizen")
    if os.path.isdir(tizen):
        candidates = []
        for entry in os.listdir(tizen):
            cand = os.path.join(tizen, entry, "dali-env", "opt")
            if os.path.isdir(cand):
                candidates.append(cand)
        # Prefer candidates that have dali2-ui-foundation.pc
        for cand in candidates:
            if os.path.exists(os.path.join(cand, "lib", "pkgconfig", "dali2-ui-foundation.pc")):
                return cand
        if candidates:
            return candidates[0]
    sys.stderr.write("ERROR: DALi install prefix not found. Set DALI_PREFIX env var.\n")
    sys.exit(10)

def build_server(dali_prefix: str) -> None:
    # The extension is docker-only (the native build_server.sh was removed), but
    # this click-to-code e2e still verifies the metadata export natively against a
    # local DALi prefix — compile the (shared) server source inline.
    if os.path.exists(SERVER_BIN):
        return
    print(f"[e2e] preview_server missing — building from {SERVER_SRC}")
    os.makedirs(TMP_DIR, exist_ok=True)
    env = os.environ.copy()
    env["PKG_CONFIG_PATH"] = f"{dali_prefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig"
    mods = "dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0"
    cmd = (
        'g++ -std=c++17 -O2 '
        f'$(pkg-config --cflags {mods}) "{SERVER_SRC}" '
        f'$(pkg-config --libs {mods}) '
        f'-L"{dali_prefix}/lib" -Wl,-rpath-link,"{dali_prefix}/lib" -ldl '
        f'-o "{SERVER_BIN}"'
    )
    r = subprocess.run(cmd, shell=True, executable="/bin/bash", env=env,
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(f"ERROR: preview_server compile failed:\n{r.stderr}\n")
        sys.exit(11)

def compile_plugin(dali_prefix: str, src_path: str, so_path: str) -> None:
    pkg_path = f"{dali_prefix}/lib/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig"
    env = os.environ.copy()
    env["PKG_CONFIG_PATH"] = pkg_path
    cmd = (
        'g++ -std=c++17 -O0 -shared -fPIC '
        '$(pkg-config --cflags dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0) '
        f'"{src_path}" '
        '$(pkg-config --libs dali2-core dali2-adaptor dali2-ui-foundation dali2-ui-components glib-2.0) '
        f'-L"{dali_prefix}/lib" -Wl,-rpath-link,"{dali_prefix}/lib" '
        f'-o "{so_path}"'
    )
    r = subprocess.run(cmd, shell=True, executable="/bin/bash", env=env,
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(f"ERROR: plugin compile failed:\n{r.stderr}\n")
        sys.exit(12)

def count_l_tags(node: dict) -> int:
    c = 1 if node.get("name", "").startswith("__L") else 0
    for child in node.get("children", []):
        c += count_l_tags(child)
    return c

class ServerSession:
    """Spawn preview_server and provide a simple send/wait interface."""
    def __init__(self, dali_prefix: str):
        self.dali_prefix = dali_prefix
        self.srv = None
        self.ready_event = threading.Event()
        self.ok_event = threading.Event()
        self.error_line = [None]

    def start(self) -> None:
        env = os.environ.copy()
        env["DISPLAY"] = DISPLAY
        env["LD_LIBRARY_PATH"] = f"{self.dali_prefix}/lib"
        self.srv = subprocess.Popen(
            [SERVER_BIN],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env=env, bufsize=0, text=True,
        )

        def reader():
            for raw in self.srv.stdout:
                line = strip_ansi(raw.rstrip())
                if line == ">>>READY":
                    self.ready_event.set()
                elif line.startswith(">>>OK:"):
                    self.ok_event.set()
                elif line.startswith(">>>ERROR:"):
                    self.error_line[0] = line
                    self.ok_event.set()

        threading.Thread(target=reader, daemon=True).start()

        if not self.ready_event.wait(timeout=15):
            raise RuntimeError("timeout waiting for server READY")

    def send_and_wait(self, cmd: str, timeout: float = 20.0) -> None:
        self.ok_event.clear()
        self.error_line[0] = None
        self.srv.stdin.write(cmd if cmd.endswith("\n") else cmd + "\n")
        self.srv.stdin.flush()
        if not self.ok_event.wait(timeout=timeout):
            raise RuntimeError(f"timeout waiting for response to: {cmd.strip()}")
        if self.error_line[0]:
            raise RuntimeError(f"server returned {self.error_line[0]}")

    def stop(self) -> None:
        if not self.srv:
            return
        try:
            self.srv.stdin.write("QUIT\n")
            self.srv.stdin.flush()
        except Exception:
            pass
        self.srv.terminate()
        try:
            self.srv.wait(timeout=3)
        except Exception:
            self.srv.kill()

def run_reload_phase(session: ServerSession, dali_prefix: str) -> bool:
    """Path A: compile a plugin with __tag(), RELOAD, assert __L tags."""
    plugin_src = os.path.join(TMP_DIR, "plugin_e2e_click.cpp")
    plugin_so  = os.path.join(TMP_DIR, "plugin_e2e_click.so")
    out_png    = os.path.join(TMP_DIR, "click_e2e.png")
    out_meta   = os.path.join(TMP_DIR, "click_e2e_metadata.json")

    with open(plugin_src, "w") as f:
        f.write('''
#include <dali/dali.h>
#include <dali-ui-foundation/dali-ui-foundation.h>

using namespace Dali;
using namespace Dali::Ui;

template<typename T>
T __tag(T obj, const char* name) {
    obj.SetProperty(Dali::Actor::Property::NAME, Dali::String(name));
    return obj;
}

extern "C" View CreatePreview() {
    View root = __tag(View::New(), "__L42");
    root.SetBackgroundColor(UiColor(0xFF0000));
    root.AddChildren({
        __tag(Label::New("hello"), "__L45"),
    });
    return root;
}
''')

    print("[e2e] Path A — compiling plugin with __tag() wrappers")
    compile_plugin(dali_prefix, plugin_src, plugin_so)

    print("[e2e] Path A — sending RELOAD")
    session.send_and_wait(f"RELOAD {plugin_so} {out_png} {out_meta} 1024 600 dark -")

    with open(out_meta) as f:
        meta = json.load(f)
    n = count_l_tags(meta["root"])
    print(f"[e2e] Path A — __L tag count: {n}")
    if n < 2:
        sys.stderr.write("FAIL (Path A): expected >= 2 __L tags in metadata JSON\n")
        sys.stderr.write(f"metadata: {json.dumps(meta, indent=2)}\n")
        return False
    return True

def run_render_json_phase(session: ServerSession) -> bool:
    """Path B: write a scene JSON with sourceLine fields, RENDER_JSON, assert __L tags."""
    scene_path = os.path.join(TMP_DIR, "scene_e2e_click.json")
    out_png    = os.path.join(TMP_DIR, "click_json_e2e.png")
    out_meta   = os.path.join(TMP_DIR, "click_json_e2e_metadata.json")

    # Mirrors what parseChainExpression(code, startLine) would produce for:
    #   return FlexLayout::New()             // line 10
    #       .Children({
    #           Label::New("hi"),            // line 12
    #       });
    scene = {
        "type": "FlexLayout",
        "constructorArgs": [],
        "properties": {},
        "children": [
            {
                "type": "Label",
                "constructorArgs": ['"hi"'],
                "properties": {},
                "children": [],
                "sourceLine": 12,
            }
        ],
        "sourceLine": 10,
    }
    with open(scene_path, "w") as f:
        json.dump(scene, f)

    print("[e2e] Path B — sending RENDER_JSON with sourceLine fields")
    session.send_and_wait(f"RENDER_JSON {scene_path} {out_png} {out_meta} 1024 600 dark -")

    with open(out_meta) as f:
        meta = json.load(f)
    n = count_l_tags(meta["root"])
    print(f"[e2e] Path B — __L tag count: {n}")

    # Assert specific line numbers made it through TS → JSON → C++ → metadata.
    found_tags = set()
    def collect(node):
        name = node.get("name", "")
        if name.startswith("__L"):
            found_tags.add(name)
        for c in node.get("children", []):
            collect(c)
    collect(meta["root"])

    expected = {"__L10", "__L12"}
    missing = expected - found_tags
    if missing:
        sys.stderr.write(f"FAIL (Path B): missing tags {missing}, found {found_tags}\n")
        sys.stderr.write(f"metadata: {json.dumps(meta, indent=2)}\n")
        return False
    return True

def main() -> int:
    os.makedirs(TMP_DIR, exist_ok=True)
    dali_prefix = detect_dali_prefix()
    print(f"[e2e] DALi prefix: {dali_prefix}")

    build_server(dali_prefix)

    print(f"[e2e] Starting Xvfb on {DISPLAY}")
    xvfb = subprocess.Popen(
        ["Xvfb", DISPLAY, "-screen", "0", "1920x1080x24", "-nolisten", "tcp"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(0.5)

    session = ServerSession(dali_prefix)
    try:
        print("[e2e] Starting preview_server")
        session.start()

        path_a_ok = run_reload_phase(session, dali_prefix)
        path_b_ok = run_render_json_phase(session)

        if path_a_ok and path_b_ok:
            print("[e2e] PASS: both compile-path and parser-first path tag correctly.")
            return 0
        return 5
    except Exception as e:
        sys.stderr.write(f"ERROR: {e}\n")
        return 2
    finally:
        session.stop()
        xvfb.terminate()
        try:
            xvfb.wait(timeout=3)
        except Exception:
            xvfb.kill()

if __name__ == "__main__":
    sys.exit(main())
