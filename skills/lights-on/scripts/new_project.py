#!/usr/bin/env python3
"""Scaffold a Lights On page: the same photographed place by day and after dark, on one light engine.

    python3 new_project.py <project-dir> <id> --from noble-gas|lueur|pli|deux-temps [--examples]

<id>        a short name for the page (lowercase, e.g. "bakery"); its folder is site/<id>/
--from      the example to start from: its page, interaction, type and scene file. You then rewrite its words and
            prompts for the new subject.
              noble-gas   one switch: a sign or a product that glows (neon, light boxes, displays)
              lueur       click an object to light it (lamps, candles, anything with several lights)
              pli         pick a material, see it by morning and at night (curtains, blinds, glass, paint, fabric)
              deux-temps  scroll is the clock, 07:30 to 23:00 (a venue, a hotel, a street that changes by night)
--examples  keep the example as it is, with its pictures, words and prompts (to look at it), instead of starting anew

Creates, or adds a page to an existing project:
    <project>/site/engine/      the engine (jour-nuit.js, ui.js, ui.css, sound.js)
    <project>/site/<id>/        index.html, style.css, main.js and, with --examples, img/
    <project>/site/index.html   opens the first page
    <project>/tools/            shots.mjs, prep.py, check.mjs, video.mjs, serve.py, gen.mjs …
    <project>/tools/scenes/<id>.json   the shots and their prompts, to rewrite
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, json, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
REFS = ["noble-gas", "lueur", "pli", "deux-temps"]

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("id")
ap.add_argument("--from", dest="ref", required=True, choices=REFS, help="the example to start from")
ap.add_argument("--examples", action="store_true", help="keep the example as it is, pictures and all")
a = ap.parse_args()

if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", a.id):
    sys.exit("<id> must be lowercase letters, digits and dashes (e.g. bakery)")

proj = Path(a.project).expanduser().resolve()
tools, site = proj / "tools", proj / "site"
adding = (tools / "shots.mjs").exists()
if not adding and proj.exists() and any(p.name != ".git" for p in proj.iterdir()):
    sys.exit(f"{proj} exists and is not a Lights On project; pick a new folder")
if (site / a.id).exists():
    sys.exit(f"{site / a.id} exists already; pick another id")

if not adding:
    shutil.copytree(TEMPLATE, proj, dirs_exist_ok=True)
    (proj / ".gitignore").write_text(
        "node_modules/\n.DS_Store\ntools/.venv/\n"
        "# masters, takes, review sheets and videos: keep them, or remake them with the tools\n"
        "tools/out/\n")

ref = EXAMPLES / a.ref
dest = site / a.id
dest.mkdir(parents=True)
for f in ("index.html", "style.css", "main.js"):
    shutil.copy(ref / f, dest / f)
scene = json.loads((ref / "scene.json").read_text())
brand = scene.pop("brand")
if a.examples:
    shutil.copytree(ref / "img", dest / "img")
    if (ref / "audio").exists():
        shutil.copytree(ref / "audio", dest / "audio")
else:
    scene["example"] = brand  # check.mjs fails until the page no longer says it
    main = dest / "main.js"
    text = main.read_text()
    # Lueur's pictures have a strip of wall added on top for tall screens; a new page uses the plain 16:9 shots
    text = text.replace('shots({ day: "day-tall", dark: "dark-tall", night: "night-tall" })', "shots()")
    text = text.replace("-tall.png", ".png").replace("night-tall-1600", "night-1600")
    text = text.replace("const TALL = (v) => 0.1 + 0.9 * v;", "const TALL = (v) => v;")
    main.write_text(text)
    html = dest / "index.html"
    html.write_text(html.read_text().replace("-tall-", "-"))
(tools / "scenes").mkdir(parents=True, exist_ok=True)
(tools / "scenes" / f"{a.id}.json").write_text(json.dumps(scene, indent=2, ensure_ascii=False) + "\n")
if not (site / "index.html").exists():
    (site / "index.html").write_text(
        f'<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url={a.id}/">\n'
        f'<title>{a.id}</title>\n<a href="{a.id}/">{a.id}</a>\n')

print(f"{'added' if adding else 'created'} {proj}  (page {a.id}, from {a.ref}{', as it is' if a.examples else ''})")
if not a.examples:
    print(f"next: rewrite the prompts in {tools / 'scenes' / (a.id + '.json')} and the page in {dest} (SKILL.md, steps 1 and 3)")
if not adding:
    print(f"then: cd {tools} && npm install && python3 -m venv .venv && .venv/bin/pip install opencv-python-headless numpy")
