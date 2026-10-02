#!/usr/bin/env python3
"""Scaffold a character landing page project from the skill's template.

    python3 new_project.py <dest-dir> <character-id> <reference-image> [--name "Display Name"]

Creates:
    <dest>/site/                       the page (index.html, styles.css, js/), characters/index.json = [<id>]
    <dest>/site/characters/<id>/       empty; write character.json here next
    <dest>/tools/                      generate.mjs (fal pipeline), eyes.py, package.json
    <dest>/ref/reference.<ext>         copy of the reference image
    <dest>/.gitignore                  keeps intermediates, node_modules and the reference out of git
Nothing is generated and no API is called.
"""
import argparse, json, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"

ap = argparse.ArgumentParser()
ap.add_argument("dest")
ap.add_argument("id")
ap.add_argument("reference")
ap.add_argument("--name")
a = ap.parse_args()

if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", a.id):
    sys.exit("character id must be lowercase letters, digits and dashes, e.g. 'juno' or 'night-cat'")
ref = Path(a.reference).expanduser()
if not ref.is_file():
    sys.exit(f"reference image not found: {ref}")
dest = Path(a.dest).expanduser().resolve()
if dest.exists() and any(dest.iterdir()):
    sys.exit(f"{dest} exists and is not empty; pick a new folder")

shutil.copytree(TEMPLATE, dest, dirs_exist_ok=True)
(dest / "site" / "characters" / a.id).mkdir(parents=True, exist_ok=True)
(dest / "site" / "characters" / "index.json").write_text(json.dumps([a.id]) + "\n")
(dest / "ref").mkdir(exist_ok=True)
ref_dest = dest / "ref" / f"reference{ref.suffix.lower()}"
shutil.copy2(ref, ref_dest)

name = a.name or a.id.replace("-", " ").title()
html = dest / "site" / "index.html"
html.write_text(html.read_text().replace("<title>Character Landing</title>", f"<title>Meet {name}</title>"))

(dest / ".gitignore").write_text(
    "node_modules/\ntools/out/\n.DS_Store\n# reference images may be personal photos or third-party art\nref/\n"
)
print(f"scaffolded {dest}")
print(f"  reference → {ref_dest.relative_to(dest)}")
print(f"  next: write site/characters/{a.id}/character.json, then: cd {dest / 'tools'} && npm install")
