#!/usr/bin/env python3
"""Scaffold a Particle Hero page: a hero whose subjects are made of dust that gathers into each one in turn.

    python3 new_project.py <project-dir> <id> [--from plain|fauna|herbier|afterglow|stride] [--look dust|ink|neon|print]

<id>     a short name for the page (lowercase, e.g. "shoes"); its folder is site/<id>/
--from   the page to start from. plain (the default) is a three-subject hero with words to WRITE, in the look you pick
         with --look. The others are the four example pages, with their own pictures so they work at once: copy one
         when its layout and look suit the brief, then replace every word and subject. Fauna (dust on black, trackers,
         a museum), Herbier (ink on paper, perfume), Afterglow (neon with lights and the name behind, a festival
         lineup), Stride (a light orange print with callouts, sneakers melting into each other).
--look   for --from plain: dust (default), ink, neon or print

Creates, or adds a page to an existing project:
    <project>/site/engine/                 the engine (nuee.js, stage.js, hud.js, looks.js, match-worker.js)
    <project>/site/<id>/                   index.html, main.js, style.css (+ an example's img/)
    <project>/site/index.html              opens the first page
    <project>/tools/                       pictures.mjs, depth.mjs, check.mjs, gen.mjs, serve.py, …
    <project>/tools/pictures/<id>.json     the page's subjects (prompts or your own photos)
    <project>/tools/pictures/_<name>.json  each example's subjects, to learn from
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
NAMES = ["fauna", "herbier", "afterglow", "stride"]
LOOKS = ["dust", "ink", "neon", "print"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("id")
    ap.add_argument("--from", dest="source", default="plain", choices=["plain"] + NAMES)
    ap.add_argument("--look", default="dust", choices=LOOKS)
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
    (tools / "pictures").mkdir(exist_ok=True)

    if a.source == "plain":
        shutil.copytree(TEMPLATE / "starter", page, ignore=shutil.ignore_patterns("pictures.json"))
        main_js = page / "main.js"
        main_js.write_text(re.sub(r'const LOOK = "\w+";', f'const LOOK = "{a.look}";', main_js.read_text()))
        html = page / "index.html"
        html.write_text(html.read_text().replace('data-look="dust"', f'data-look="{a.look}"'))
        spec = (TEMPLATE / "starter" / "pictures.json").read_text()
        if a.look in ("ink", "print"):
            spec = spec.replace('"background": "black"', '"background": "white"')
        (tools / "pictures" / f"{a.id}.json").write_text(spec)
    else:
        shutil.copytree(EXAMPLES / a.source, page, ignore=shutil.ignore_patterns("pictures.json"))
        shutil.copy(EXAMPLES / a.source / "pictures.json", tools / "pictures" / f"{a.id}.json")
    for name in NAMES:
        shutil.copy(EXAMPLES / name / "pictures.json", tools / "pictures" / f"_{name}.json")

    home = project / "site" / "index.html"
    if not home.exists():
        home.write_text(f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url={a.id}/"><title>{a.id}</title><a href="{a.id}/">{a.id}</a>\n')
    ignore = project / ".gitignore"
    if not ignore.exists():
        ignore.write_text("tools/out/\ntools/node_modules/\n.DS_Store\n")

    print(f"""Created {page.relative_to(project)} in {project}

Next:
  1. Write the subjects in tools/pictures/{a.id}.json (references/pictures.md)
  2. cd {project}/tools && npm install
  3. node pictures.mjs {a.id} --dry        what it costs
     node pictures.mjs {a.id}              make them (credits), cut them out, depth maps (free, on this computer)
  4. Write the page: site/{a.id}/index.html, main.js, style.css (references/looks.md)
  5. node check.mjs {a.id}                 headless check, contact sheets in tools/out/{a.id}/
     python3 serve.py                      then open http://localhost:5206/{a.id}/""")


if __name__ == "__main__":
    main()
