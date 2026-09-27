#!/usr/bin/env python3
"""Native layout probe: does a long provider label overflow the chip row?

Why this exists
---------------
The provider chips in Settings -> AI Model are constrained with
`min-w-0 max-w-full shrink` so a long label shrinks/wraps instead of running off
the row. A browser cannot prove that fix: Yoga (native) and the web CSS engine do
not resolve those utilities identically, and this repo has already shipped a
layout bug that was invisible on web (see AGENTS.md, `space-*` on native).

So this drives the real app on a real emulator and measures the chip geometry.

How it seeds
------------
Seeding the label through the UI is not viable on an emulator: the stock
"Try out your stylus" handwriting IME hijacks `adb shell input text` and then
sits modally over the app swallowing every gesture. Instead we write the label
straight into AsyncStorage's SQLite store and restart the app.

Pitfalls this encodes (each one cost real time)
-----------------------------------------------
1. `adb shell cat <binary>` CORRUPTS the file (LF/CRLF translation). The DB
   reads back with `integrity_check` failures and 0 rows. Use `adb exec-out`.
2. `saveSettings` refuses to persist when a profile has no `selectedModelId`
   ("Fetch and select a model first."). A seeded profile needs a model, or the
   label silently never lands -- that is a guard, not a bug.
3. `uiautomator` only dumps nodes inside the window bounds, so a missing node
   means "off-screen", not "not rendered". Confirm with a screenshot before
   calling it a layout bug.
4. Chip chrome lives on an inner View; NativeWind drops `className` on
   pressables, so measure the `provider-chip-*` node, not its pressable parent.

Usage
-----
    python3 scripts/e2e/native-chip-stress.py
    python3 scripts/e2e/native-chip-stress.py --label "Some other long label"

Exits non-zero if the chip row overflows or no chips are found (a probe that
matches nothing must fail loudly, never pass vacuously).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET

SDK = os.environ.get(
    "ANDROID_SDK",
    "/mnt/c/Users/sigmu/AppData/Local/Android/Sdk",
)
ADB = os.path.join(SDK, "platform-tools", "adb.exe")
PKG = "com.blackrosejournal"
VW = 1080  # emulator width in device px; the dump reports device px
LONG_LABEL = "Home gateway primary production account"
MODEL_ID = "merge/deepseek/deepseek-v4-flash-0731"

BOUNDS_RE = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")


def sh(*args: str, timeout: int = 120) -> str:
    proc = subprocess.run([ADB, *args], capture_output=True, timeout=timeout)
    return proc.stdout.decode("utf-8", "replace")


def sh_bytes(*args: str, timeout: int = 120) -> bytes:
    return subprocess.run([ADB, *args], capture_output=True, timeout=timeout).stdout


def parse_bounds(bounds: str) -> tuple[int, int, int, int]:
    m = BOUNDS_RE.match(bounds)
    if not m:
        raise ValueError(f"unparsable bounds: {bounds!r}")
    return tuple(int(v) for v in m.groups())  # type: ignore[return-value]


def dump(tag: str) -> str:
    sh("shell", "uiautomator", "dump", f"/sdcard/{tag}.xml")
    return sh("shell", "cat", f"/sdcard/{tag}.xml")


def chips_in(xml: str) -> list[dict]:
    """Chip geometry, with the label read off the pressable parent.

    The chip's own node carries no `content-desc`; the accessible name
    ("Use provider <label>") lives on the wrapping pressable.
    """
    root = ET.fromstring(xml)
    parents = {child: parent for parent in root.iter() for child in parent}
    out = []
    for n in root.iter("node"):
        rid = n.get("resource-id") or ""
        bounds = n.get("bounds") or ""
        if not rid.startswith("provider-chip-") or not bounds:
            continue
        x0, y0, x1, y1 = parse_bounds(bounds)
        parent = parents.get(n)
        desc = (parent.get("content-desc") if parent is not None else "") or ""
        label = desc.replace("Use provider ", "") or (n.get("text") or "")
        out.append({
            "rid": rid,
            "label": label,
            "x0": x0, "y0": y0, "x1": x1, "y1": y1,
            "w": x1 - x0,
        })
    return out


# --------------------------------------------------------------------------
# seeding
# --------------------------------------------------------------------------
def pull_storage(dest: str) -> None:
    """Binary-safe pull of AsyncStorage's SQLite store."""
    data = sh_bytes("exec-out", "run-as", PKG, "cat", "databases/RKStorage")
    if len(data) < 1024:
        raise SystemExit(
            f"pulled only {len(data)} bytes -- is the app installed and debuggable?"
        )
    with open(dest, "wb") as fh:
        fh.write(data)


def find_provider_key(con: sqlite3.Connection) -> str:
    rows = con.execute("select key from catalystLocalStorage").fetchall()
    for (key,) in rows:
        if "custom_ai_provider" in key:
            return key
    raise SystemExit("no blackrose_custom_ai_provider key found in storage")


def seed_label(src: str, dest: str, label: str) -> None:
    shutil.copy(src, dest)
    con = sqlite3.connect(dest)
    key = find_provider_key(con)
    cfg = json.loads(con.execute(
        "select value from catalystLocalStorage where key=?", (key,)).fetchone()[0])

    profiles = cfg.get("profiles") or []
    if not profiles:
        raise SystemExit("provider settings contain no profiles to seed")
    target = profiles[-1]
    target["label"] = label
    # Without a model, saveSettings refuses to persist anything.
    target["selectedModelId"] = target.get("selectedModelId") or MODEL_ID

    con.execute("update catalystLocalStorage set value=? where key=?",
                (json.dumps(cfg), key))
    con.commit()
    con.close()
    print(f"seeded label on profile {target['id']!r}")


def push_storage(src: str) -> None:
    remote_tmp = "/data/local/tmp/rkstorage.seed"
    sh("push", src, remote_tmp)
    sh("shell", f"run-as {PKG} cp {remote_tmp} databases/RKStorage")
    sh("shell", "rm", "-f", remote_tmp)


# --------------------------------------------------------------------------
# driving
# --------------------------------------------------------------------------
def tap(x: int, y: int, settle: float = 4.0) -> None:
    sh("shell", "input", "tap", str(x), str(y))
    time.sleep(settle)


def launch_and_open_settings() -> str:
    sh("shell", "am", "force-stop", PKG)
    sh("reverse", "tcp:8081", "tcp:8081")
    time.sleep(1)
    sh("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    print("launched; waiting for the Metro bundle...")
    time.sleep(28)
    tap(958, 197)   # "Open settings" in the Today header
    tap(540, 1097)  # the AI Model band
    return dump("chipstress")


def report(xml: str) -> bool:
    chips = chips_in(xml)
    if not chips:
        print("!! no provider chips found -- probe is vacuous, counting as FAILURE")
        return False

    print("\n=== provider chips (native) ===")
    for c in chips:
        inside = c["x1"] <= VW
        print(f"  {c['rid']}")
        print(f"    label   = {c['label']!r}")
        print(f"    bounds  = [{c['x0']},{c['y0']}][{c['x1']},{c['y1']}]  w={c['w']}")
        print(f"    right={c['x1']}  viewport={VW}  inside={inside}"
              f"  overflow={max(0, c['x1'] - VW)}px")

    row_right = max(c["x1"] for c in chips)
    rows = len({c["y0"] for c in chips})
    print(f"\n  chips={len(chips)}  row spans {min(c['x0'] for c in chips)} -> {row_right}")
    print(f"  lines used       : {rows}")
    print(f"  within viewport  : {row_right <= VW}")

    ok = row_right <= VW
    if not ok:
        print("  FAIL: chip row overflows the viewport")
    else:
        print("  PASS: every chip stays inside the viewport "
              "(long labels shrink/wrap rather than overflow)")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default=LONG_LABEL)
    ap.add_argument("--measure-only", action="store_true",
                    help="skip seeding; just launch and measure current state")
    args = ap.parse_args()

    if not args.measure_only:
        with tempfile.TemporaryDirectory() as tmp:
            pulled = os.path.join(tmp, "RKStorage")
            seeded = os.path.join(tmp, "RKStorage.seed")
            print("pulling AsyncStorage (binary-safe)...")
            pull_storage(pulled)
            seed_label(pulled, seeded, args.label)
            print("pushing seeded store back...")
            push_storage(seeded)

    xml = launch_and_open_settings()
    ok = report(xml)
    print("\nRESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
