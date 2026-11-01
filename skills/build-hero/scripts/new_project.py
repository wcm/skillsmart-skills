#!/usr/bin/env python3
"""Scaffold a Build Hero page: a website hero where one scroll builds the place, then the lights come on.

    python3 new_project.py <project-dir> <id> [--from plain|tidelight|misura|kebun|cerise]

<id>     a short name for the page (lowercase, e.g. "harbour"); its folder is site/<id>/
--from   the page to start from. plain (the default) is a small page on the shared scaffold, with slots to WRITE.
         The others are the four example pages: copy one when its layout and readout suit the brief, then replace its
         words, timing and signature. Their prompts are always copied, as tools/scenes/_<name>.json, to learn from.

Creates, or adds a page to an existing project:
    <project>/site/engine/      the engine (chantier.js, frames.js, chantier.css, hud.css)
    <project>/site/<id>/        index.html, main.js, style.css (frames/, frames-phone/ and img/ come from the tools)
    <project>/site/index.html   opens the first page
    <project>/tools/            pictures.mjs, film.mjs, frames.mjs, align.mjs, check.mjs, video.mjs, sheet.mjs, serve.py, …
    <project>/tools/scenes/<id>.json   the page's prompts, film segments and frame choices
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
NAMES = ["tidelight", "misura", "kebun", "cerise"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("id")
    ap.add_argument("--from", dest="source", default="plain", choices=["plain"] + NAMES)
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
    (tools / "scenes").mkdir(exist_ok=True)
    source = TEMPLATE / "starter" if a.source == "plain" else EXAMPLES / a.source
    page.mkdir(parents=True)
    for f in ["index.html", "main.js", "style.css"]:
        shutil.copy(source / f, page / f)
    # the starter's scene to write; the examples' to learn from
    shutil.copy(TEMPLATE / "starter" / "scene.json", tools / "scenes" / f"{a.id}.json")
    for name in NAMES:
        shutil.copy(EXAMPLES / name / "scene.json", tools / "scenes" / f"_{name}.json")
    home = project / "site" / "index.html"
    if not home.exists():
        home.write_text(f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url={a.id}/"><a href="{a.id}/">{a.id}</a>\n')
    ignore = project / ".gitignore"
    if not ignore.exists():
        ignore.write_text("tools/out/\ntools/node_modules/\n.DS_Store\n")
    print(f"site/{a.id}/ from {a.source}; write tools/scenes/{a.id}.json next")
    print(f"then: cd {tools} && npm install")


if __name__ == "__main__":
    main()
