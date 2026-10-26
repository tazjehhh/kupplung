#!/usr/bin/env python3
"""Baut public/sounds/ aus den Spieldaten von Hedgewars und Warmux.

Quellen (Ubuntu 24.04, Paketquelle "universe"):
    apt-get download hedgewars-data warmux-data
    dpkg-deb -x hedgewars-data_*.deb  <ziel>/hedgewars-data
    dpkg-deb -x warmux-data_*.deb     <ziel>/warmux-data

Aufruf:
    python3 scripts/build-sounds.py <ziel>

Benötigt ffmpeg (mit libmp3lame) und numpy. Jede Datei wird am Anfang von Stille
befreit, bei Bedarf gekürzt, auf eine einheitliche Lautheit gebracht (lautestes
300-ms-Fenster) und als Mono-MP3 gespeichert.
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
HW = os.path.join(ROOT, "hedgewars-data/usr/share/games/hedgewars/Data/Sounds")
WX = os.path.join(ROOT, "warmux-data/usr/share/games/warmux/sound/default")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sounds")

# Schlüssel → Liste von (Quelle, Datei, Ziel-Lautheit in dB, Optionen)
SFX = {
    "expl_s": [("wx", "weapons/cluzooka_hit.ogg", -12), ("wx", "weapons/explosion3.ogg", -12), ("wx", "weapons/explosion5.ogg", -12)],
    "expl_m": [("wx", "weapons/explosion1.ogg", -10), ("wx", "weapons/explosion9.ogg", -10), ("wx", "weapons/explosion4.ogg", -10), ("wx", "weapons/explosion6.ogg", -10)],
    "expl_l": [("wx", "weapons/dynamite_exp.ogg", -8), ("wx", "weapons/explosion2.ogg", -8), ("wx", "weapons/explosion7.ogg", -8)],
    "launch": [("wx", "weapons/cluzooka_shot.ogg", -12)],
    "whoosh": [("wx", "weapons/rocket_flying.ogg", -16, {"trim": 0.8})],
    "throw": [("hw", "throwrelease.ogg", -14)],
    "charge": [("hw", "throwpowerup.ogg", -18)],
    "bounce": [("hw", "grenadeimpact.ogg", -16)],
    "shotgun": [("hw", "shotgunfire.ogg", -11)],
    "reload": [("hw", "shotgunreload.ogg", -18)],
    "bat": [("hw", "baseballbat.ogg", -13)],
    "homerun": [("hw", "homerun.ogg", -16)],
    "holy": [("hw", "hogchant3.ogg", -15, {"trim": 2.6, "fade": 0.9})],
    "fuse": [("wx", "weapons/dynamite_fuze.ogg", -20)],
    "plane": [("hw", "plane.ogg", -15)],
    "ropeshot": [("hw", "ropeshot.ogg", -16)],
    "ropeattach": [("hw", "ropeattach.ogg", -16)],
    "roperelease": [("hw", "roperelease.ogg", -18)],
    "warp": [("hw", "warp.ogg", -14)],
    "jetlaunch": [("hw", "ufo.ogg", -16)],
    "jetloop": [("wx", "weapons/jetpack.ogg", -18)],
    "tick": [("hw", f"countdown{i}.ogg", -20) for i in range(1, 5)],
    "minetick": [("hw", "minetick.ogg", -20)],
    "fizzle": [("hw", "steam.ogg", -20)],
    "fire": [("hw", "molotov.ogg", -15)],
    "splash": [("hw", "splash.ogg", -13), ("wx", "misc/sink.ogg", -14)],
    "collect": [("hw", "CollectCrate.ogg", -18)],
    "parachute": [("hw", "parachute.ogg", -16)],
    "cratedrop": [("wx", "misc/box_hitting_ground.ogg", -15)],
    "bump": [("hw", "bump.ogg", -13)],
    "grave": [("hw", "graveimpact.ogg", -18)],
    "suddendeath": [("hw", "suddendeath.ogg", -14)],
    "skip": [("hw", "skip.ogg", -18)],
    "denied": [("hw", "denied.ogg", -18)],
    "placed": [("hw", "placed.ogg", -18)],
    "yoohoo": [("hw", "Yoohoo.ogg", -15)],
    "victory": [("wx", "misc/victory.ogg", -18, {"trim": 7, "fade": 2.5})],
    "click": [("wx", "misc/change_weapon.ogg", -22)],
}

VOICE_PACKS = ["Default", "Classic", "British", "Pirate", "Mobster", "Surfer", "Robot", "Singer", "Russian"]
VOICE_LINES = [
    "Hello", "Comeonthen", "Yessir", "Illgetyou", "Justyouwait", "Watchthis", "Thisoneismine", "Gonnagetyou",
    "Revenge", "Fire", "Grenade", "Takecover", "Runaway", "Incoming", "Ow1", "Ow2", "Ow3", "Ow4", "Ouch",
    "Ooff1", "Ooff2", "Ooff3", "Traitor", "Sameteam", "Stupid", "Oops", "Drat", "Bugger", "Byebye", "Solong",
    "Ohdear", "Nooo", "Uh-oh", "Missed", "Laugh", "Excellent", "Brilliant", "Amazing", "Enemydown", "Firstblood",
    "Hurry", "Victory", "Coward", "Boring", "Jump1", "Jump2", "Jump3", "Firepunch1", "Firepunch2", "Firepunch3",
    "Firepunch4", "Firepunch5", "Firepunch6", "Whatthe", "Leavemealone", "Youllregretthat", "Watchit",
]
VOICE_TARGET = -14
SR = 44100


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def loudest_window_db(x, seconds=0.3):
    n = max(1, int(SR * seconds))
    if len(x) <= n:
        return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    power = np.convolve(x ** 2, np.ones(n) / n, mode="valid")
    return 10 * np.log10(power.max() + 1e-12)


def process(src, dst, target, opts=None, quality=4):
    opts = opts or {}
    x = decode(src)
    # Stille am Anfang abschneiden (spart Latenz beim Abspielen)
    above = np.nonzero(np.abs(x) > 10 ** (-45 / 20))[0]
    if len(above):
        x = x[max(0, above[0] - int(SR * 0.005)):]
    if "trim" in opts:
        x = x[: int(SR * opts["trim"])]
    if "fade" in opts:
        n = min(len(x), int(SR * opts["fade"]))
        x[-n:] *= np.linspace(1, 0, n) ** 2
    # Kurzes Ausblenden am Ende gegen Knackser
    tail = min(len(x), int(SR * 0.01))
    x[-tail:] *= np.linspace(1, 0, tail)
    gain = 10 ** ((target - loudest_window_db(x)) / 20)
    x = x * gain
    peak = np.abs(x).max()
    if peak > 0.97:
        x *= 0.97 / peak  # nicht übersteuern
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-q:a", str(quality), dst], input=x.astype(np.float32).tobytes(), check=True)
    return len(x) / SR


def main():
    manifest = {"sfx": {}, "voices": {}}
    for key, entries in SFX.items():
        files = []
        for i, entry in enumerate(entries):
            where, name, target = entry[:3]
            opts = entry[3] if len(entry) > 3 else {}
            src = os.path.join(HW if where == "hw" else WX, name)
            rel = f"sfx/{key}{'' if len(entries) == 1 else i + 1}.mp3"
            dur = process(src, os.path.join(OUT, rel), target, opts)
            files.append(rel)
            print(f"{rel:28} {dur:5.2f}s  ← {where}:{name}")
        manifest["sfx"][key] = files
    for pack in VOICE_PACKS:
        lines = {}
        for line in VOICE_LINES:
            src = os.path.join(HW, "voices", pack, f"{line}.ogg")
            if not os.path.exists(src):
                continue
            rel = f"voices/{pack.lower()}/{line.lower()}.mp3"
            process(src, os.path.join(OUT, rel), VOICE_TARGET, quality=6)
            lines[line] = rel
        manifest["voices"][pack] = lines
        print(f"Stimme {pack}: {len(lines)} Sätze")
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)


if __name__ == "__main__":
    main()
