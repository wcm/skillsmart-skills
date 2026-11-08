#!/usr/bin/env python3
"""Scaffold a Turntable page: a gallery of subjects, and a page per subject where the subject turns on the spot as the
pages snap past behind it.

    python3 new_project.py <project-dir> <id> [--from starter|in-the-round|lacquer|sip-club|torque]

<id>     a short name for the page (lowercase, e.g. "shoes"); its folder is site/<id>/
--from   the page to start from. starter (the default) is a three-subject page with words to WRITE: a row gallery, a
         straight line between pages. The others are the four example pages, without their frames (those are made
         with credits, or seen live on demos.skillsmart.io/turntable): copy one when its layout suits the brief, then
         replace every word, colour and subject.
           in-the-round  an art gallery: plinths in a row, plaster rooms, a straight line, a fluted pedestal on stage
           lacquer       a restaurant: dishes on a turning ring, a lacquer table, a round line with a gold rim
           sip-club      fashion: one model in five looks, receipts and swatches behind her, a torn-paper line
           torque        a sneaker drop: colour tiles, a slanted line, giant names, flick to spin
         Every example's subjects file (the prompts that made it) is copied as tools/subjects/_<name>.json to learn from.

Creates, or adds a page to an existing project:
    <project>/site/engine/              the engine (turntable.js, frames.js, turntable.css)
    <project>/site/<id>/                index.html, style.css (+ an example's img/); frames/ come from the tools
    <project>/site/index.html           opens the first page
    <project>/tools/                    subjects.mjs, frames.mjs, prop.mjs, plate.mjs, check.mjs, video.mjs, serve.py, …
    <project>/tools/subjects/<id>.json  the page's subjects: prompts (or your photos), the turn, the stage
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
NAMES = ["in-the-round", "lacquer", "sip-club", "torque"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("id")
    ap.add_argument("--from", dest="source", default="starter", choices=["starter"] + NAMES)
    a = ap.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", a.id):
        sys.exit("<id> must be lowercase letters, digits and hyphens")
    project = Path(a.project).expanduser().resolve()
    page = project / "site" / a.id
    if page.exists():
        sys.exit(f"{page} already exists")
    (project / "site").mkdir(parents=True, exist_ok=True)
    if not (project / "site" / "engine").exists():
        shutil.copytree(TEMPLATE / "site" / "engine", project / "site" / "engine")
    tools = project / "tools"
    if not tools.exists():
        shutil.copytree(TEMPLATE / "tools", tools)
    (tools / "subjects").mkdir(exist_ok=True)

    source = TEMPLATE / "starter" if a.source == "starter" else EXAMPLES / a.source
    shutil.copytree(source, page, ignore=shutil.ignore_patterns("subjects.json", "README.md"))
    shutil.copy(source / "subjects.json", tools / "subjects" / f"{a.id}.json")
    for name in NAMES:
        shutil.copy(EXAMPLES / name / "subjects.json", tools / "subjects" / f"_{name}.json")

    home = project / "site" / "index.html"
    if not home.exists():
        home.write_text(f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url={a.id}/"><title>{a.id}</title><a href="{a.id}/">{a.id}</a>\n')
    ignore = project / ".gitignore"
    if not ignore.exists():
        ignore.write_text("tools/out/\ntools/node_modules/\n.DS_Store\n")

    print(f"""Created {page.relative_to(project)} in {project}

Next:
  1. Write the subjects in tools/subjects/{a.id}.json (references/subjects.md)
  2. cd {project}/tools && npm install
  3. node subjects.mjs {a.id} --dry       what it costs
     node subjects.mjs {a.id}             photos, turns and cut-outs (credits)
     node frames.mjs {a.id}               the page's frames, every subject on one stage (free)
  4. Write the page: site/{a.id}/index.html and style.css (references/design.md)
  5. node check.mjs {a.id}                headless check, contact sheets in tools/out/{a.id}/
     python3 serve.py                     then open http://localhost:5207/{a.id}/""")


if __name__ == "__main__":
    main()
