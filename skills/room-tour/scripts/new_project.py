#!/usr/bin/env python3
"""Scaffold a Room Tour page: a website you walk through as you scroll, stop by stop.

    python3 new_project.py <project-dir> <id> [--from plain|tembusu|teluk-senja|ondo|shedlight]

<id>     a short name for the page (lowercase, e.g. "villa"); its folder is site/<id>/
--from   the page to start from. plain (the default) is a three-stop walk on the shared engine, with slots to WRITE.
         The others are the four example pages: copy one when its layout and interaction suit the brief (a house you
         sell, a place people book, a room people shop, a show of exact works), then replace every word, number and
         picture. Their walk files (the prompts that made them) are always copied as tools/walks/_<name>.json.

Creates, or adds a page to an existing project:
    <project>/site/engine/            the engine (tour.js, stage.js, ui/, tour.css, …)
    <project>/site/<id>/              index.html, style.css, tour.json (+ an example's own .js and drawings);
                                      frames/ and img/ come from the tools
    <project>/site/index.html         opens the first page
    <project>/tools/                  pictures.mjs, moves.mjs, frames.mjs, stops.mjs, mask.mjs, check.mjs, video.mjs,
                                      serve.py, and the optional OpenCV tools track.py and panels.py
    <project>/tools/walks/<id>.json   the page's pictures, moves and frame choices
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
NAMES = ["tembusu", "teluk-senja", "ondo", "shedlight"]


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
    (tools / "walks").mkdir(exist_ok=True)

    source = TEMPLATE / "starter" if a.source == "plain" else EXAMPLES / a.source
    shutil.copytree(source, page, ignore=shutil.ignore_patterns("walk.json"))
    # the page's walk to write (an example's own, as a start); every example's to learn from
    shutil.copy(source / "walk.json", tools / "walks" / f"{a.id}.json")
    for name in NAMES:
        shutil.copy(EXAMPLES / name / "walk.json", tools / "walks" / f"_{name}.json")

    home = project / "site" / "index.html"
    if not home.exists():
        home.write_text(f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url={a.id}/"><a href="{a.id}/">{a.id}</a>\n')
    ignore = project / ".gitignore"
    if not ignore.exists():
        ignore.write_text("tools/out/\ntools/node_modules/\nsite/*/frames/*-rec/\n.DS_Store\n")
    print(f"site/{a.id}/ and tools/walks/{a.id}.json are ready in {project}")
    print(f"next: cd {project}/tools && npm install, then write tools/walks/{a.id}.json (SKILL.md, Step 2)")


if __name__ == "__main__":
    main()
