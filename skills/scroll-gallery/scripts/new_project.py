#!/usr/bin/env python3
"""Scaffold a Scroll Gallery page: pictures that fly from one scene into the next as you scroll.

    python3 new_project.py <project-dir> <id> --from ardent|side-b|far-field|kit-of-parts
        [--brand "Ardent"] [--title "Ardent"] [--kicker "Autumn–Winter 2027"] [--count "20 looks"] [--examples]

<id>        a short name for the page (lowercase, e.g. "lookbook"); its folder is site/<id>/
--from      the example to start from: its scenes, cards, colours, fonts and scenery. You then rewrite its words and
            pictures for the new subject, and change its scenes as much as the brief needs.
              ardent        a fashion lookbook: table → runway of silk panels → tiles → lookbook
              side-b        a record shop: slabs → crate → turntable → jukebox
              far-field     landscape photographs: trail → arc → band → sphere
              kit-of-parts  design assets: board → sweep → ribbon → cube
--brand     the name top left; --title the big word on the first screen; --kicker and --count the line under it
--examples  keep the example as it is, with its pictures, words and prompts (to look at it, or rebuild it), instead
            of slots to write

Creates, or adds a page to an existing project:
    <project>/site/engine/      the engine (accrochage.js and its layouts, card.js, scenery.js, post.js, cloth/)
    <project>/site/<id>/        index.html (fonts, colours), page.json (words, scenes, pictures and their prompts),
                                scene/ (the example's scenery) and, with --examples, img/ and images.json
    <project>/site/index.html   opens the first page
    <project>/tools/            pictures.mjs, build.mjs, scene.mjs, check.mjs, video.mjs, serve.py, gen.mjs, …
                                and scenery.json (the scenery prompts, this page's under pages → <id>)
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, json, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
REFS = ["ardent", "side-b", "far-field", "kit-of-parts"]


def inline(v):
    return json.dumps(v, ensure_ascii=False, separators=(", ", ": "))


def page_json(page):
    """page.json in the layout every page keeps: one line per key, and one per scene and per picture"""
    rows = []
    for k, v in page.items():
        if k in ("sequence", "items") and isinstance(v, list):
            rows.append(f'  "{k}": [\n' + ",\n".join(f"    {inline(x)}" for x in v) + "\n  ]")
        else:
            rows.append(f'  "{k}": {inline(v)}')
    return "{\n" + ",\n".join(rows) + "\n}\n"


ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("id")
ap.add_argument("--from", dest="ref", required=True, choices=REFS, help="the example to start from")
ap.add_argument("--brand", help="the name top left")
ap.add_argument("--title", help="the big word on the first screen")
ap.add_argument("--kicker", help="the line under the title")
ap.add_argument("--count", help="what the pictures are, with their number (\"20 looks\")")
ap.add_argument("--examples", action="store_true", help="keep the example as it is, pictures and all")
a = ap.parse_args()

if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", a.id):
    sys.exit("<id> must be lowercase letters, digits and dashes (e.g. lookbook)")

proj = Path(a.project).expanduser().resolve()
tools, site = proj / "tools", proj / "site"
adding = (tools / "scenery.json").exists()
if not adding and proj.exists() and any(p.name != ".git" for p in proj.iterdir()):
    sys.exit(f"{proj} exists and is not a Scroll Gallery project; pick a new folder")
if (site / a.id).exists():
    sys.exit(f"{site / a.id} exists already; pick another id")

if not adding:
    shutil.copytree(TEMPLATE, proj, dirs_exist_ok=True)
    (proj / ".gitignore").write_text(
        "node_modules/\n.DS_Store\n"
        "# 2K masters, video frames, videos and review sheets: remake them with the tools\n"
        "tools/out/\n")

# the page: the example's index.html, page.json and scenery, and with --examples its pictures
ref = EXAMPLES / a.ref
dest = site / a.id
dest.mkdir(parents=True)
html = (ref / "index.html").read_text()
page = json.loads((ref / "page.json").read_text())
if (ref / "scene").exists():
    shutil.copytree(ref / "scene", dest / "scene")
if a.examples:
    shutil.copytree(ref / "img", dest / "img")
    shutil.copy(ref / "images.json", dest / "images.json")
else:
    W = "WRITE"
    page["brand"], page["title"] = W + ": the name top left", W + ": the big word on the first screen"
    page["kicker"], page["count"] = W + ": a short line under it", W + ": what the pictures are, with their number (20 looks)"
    page["nav"] = [{"label": W} for _ in page.get("nav", [])]
    page["style"] = W + ": the style line every picture's prompt ends with (references/pictures.md)"
    slots = []
    for it in page["items"]:
        s = {"id": it["id"], "title": W}
        if "sub" in it:
            s["sub"] = W
        s["meta"] = [W for _ in it.get("meta", [])]
        if "tracks" in it:
            s["tracks"] = [W for _ in it["tracks"]]
        s["text"] = W
        s["aspect"] = it.get("aspect", "4:5")
        s["prompt"] = W + f": picture {it['id']} (references/pictures.md)"
        slots.append(s)
    page["items"] = slots
for key in ("brand", "title", "kicker", "count"):
    if getattr(a, key):
        page[key] = getattr(a, key)
name = page["brand"] if not page["brand"].startswith("WRITE") else a.id
html = re.sub(r"<title>.*?</title>", f"<title>{name}</title>", html, count=1)
(dest / "index.html").write_text(html)
(dest / "page.json").write_text(page_json(page))
# the files the engine reads, empty until build.mjs and scene.mjs fill them
if not (dest / "images.json").exists():
    (dest / "images.json").write_text("{}\n")
(dest / "scene").mkdir(exist_ok=True)
if not (dest / "scene" / "scene.json").exists():
    (dest / "scene" / "scene.json").write_text("{}\n")
if not (site / "index.html").exists():
    (site / "index.html").write_text(
        f'<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url={a.id}/">\n'
        f'<title>{name}</title>\n<a href="{a.id}/">{name}</a>\n')

# the scenery's prompts: the example's, under this page's id
spec = json.loads((tools / "scenery.json").read_text())
example = json.loads((ref / "scenery.json").read_text()) if (ref / "scenery.json").exists() else {}
if example:
    spec.setdefault("pages", {})[a.id] = example
    (tools / "scenery.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n")

print(f"{'added' if adding else 'created'} {proj}  (page {a.id}, from {a.ref}{', as it is' if a.examples else ''})")
if not a.examples:
    print(f"next: write the WRITE slots in {dest / 'page.json'}, then make or bring the pictures (SKILL.md, step 2)")
if not adding:
    print(f"then: cd {tools} && npm install")
