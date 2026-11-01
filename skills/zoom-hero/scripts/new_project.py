#!/usr/bin/env python3
"""Scaffold a Zoom Hero page: one wide scene you dive into, level after level.

    python3 new_project.py <project-dir> <id> --from pruine|understory|surface-theory|wheres-pip [--brand "Maison Vale"] [--examples]

<id>        a short name for the page (lowercase, e.g. "estate"); its folder is site/<id>/
--from      the example to start from: its layout, interface, type and colours. You then rewrite its words and tree
            for the new subject, and change its look as much as the brief needs.
              pruine          natural wine: warm and editorial, a giant serif name, dark glass
              understory      a rainforest trust: field notes, thin wide type veiled in mist, acid lime
              surface-theory  skincare: a light frosted interface, measurements on the picture, cobalt
              wheres-pip      a picture book: a riso print, sticker chips, a clue game
--brand     the name, written into the tree
--examples  keep the example as it is, with its pictures, words and prompts, to look at it

Creates, or adds a page to an existing project:
    <project>/site/engine/          the engine (loupe.js, ui.js, ui.css)
    <project>/site/<id>/            index.html, style.css, main.js and, with --examples, img/
    <project>/site/index.html       opens the first page
    <project>/tools/                pictures.mjs, takes.mjs, look.mjs, align.mjs, sheet.mjs, publish.mjs, check.mjs, …
    <project>/tools/trees/<id>.json the tree of levels: prompts, areas, sizes
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, json, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
REFS = ["pruine", "understory", "surface-theory", "wheres-pip"]

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("id")
ap.add_argument("--from", dest="ref", required=True, choices=REFS, help="the example to start from")
ap.add_argument("--brand", help="the name")
ap.add_argument("--examples", action="store_true", help="keep the example as it is, pictures and all")
a = ap.parse_args()

if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", a.id):
    sys.exit("<id> must be lowercase letters, digits and dashes (e.g. estate)")

proj = Path(a.project).expanduser().resolve()
tools, site = proj / "tools", proj / "site"
adding = (tools / "pictures.mjs").exists()
if not adding and proj.exists() and any(p.name != ".git" for p in proj.iterdir()):
    sys.exit(f"{proj} exists and is not a Zoom Hero project; pick a new folder")
if (site / a.id).exists():
    sys.exit(f"{site / a.id} exists already; pick another id")

if not adding:
    shutil.copytree(TEMPLATE, proj, dirs_exist_ok=True)
    (proj / ".gitignore").write_text(
        "node_modules/\n.DS_Store\n"
        "# full-size pictures, takes, video frames and review sheets: remake them with the tools\n"
        "tools/out/\n")
(tools / "trees").mkdir(parents=True, exist_ok=True)

ref = EXAMPLES / a.ref
dest = site / a.id
dest.mkdir(parents=True)
for f in ("index.html", "style.css", "main.js"):
    shutil.copy(ref / f, dest / f)
tree = json.loads((ref / "tree.json").read_text())
if a.examples:
    shutil.copytree(ref / "img", dest / "img")
else:
    W = "WRITE"
    tree["brand"] = a.brand or W + ": the business, and what is hidden in it"
    tree["style"] = W + ": the one place, light and colour every prompt ends with"
    tree["titleBand"] = W + ": where the title sits on the first level, e.g. top 30% (the sky): no spots above y = 0.32"
    for n in tree["nodes"].values():
        n["prompt"] = W + ": what this level shows (references/pictures.md); rename the levels as your story needs"
        n.pop("focus", None)
        if n.get("parent"):
            n["rect"] = None
(tools / "trees" / f"{a.id}.json").write_text(json.dumps(tree, indent=2, ensure_ascii=False) + "\n")
if not (site / "index.html").exists():
    (site / "index.html").write_text(
        f'<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url={a.id}/">\n'
        f'<title>{a.id}</title>\n<a href="{a.id}/">{a.id}</a>\n')

print(f"{'added' if adding else 'created'} {proj}  (page {a.id}, from {a.ref}{', as it is' if a.examples else ''})")
if not a.examples:
    print(f"next: write the tree in {tools / 'trees' / (a.id + '.json')} (SKILL.md, step 2)")
if not adding:
    print(f"then: cd {tools} && npm install")
