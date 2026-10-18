#!/usr/bin/env python3
"""Scaffold an Exploded View page: one product in a real place, taken apart by scroll, then whole again somewhere new.

    python3 new_project.py <project-dir> <id> --from burger|headphones|sneaker|cabin
        [--brand "Kissa"] [--noun "headphones"] [--backdrop "#e9e5de"] [--backdrop-name "pale warm grey"] [--examples]

<id>             a short name for the page (lowercase, e.g. "moka"); its folder is site/<id>/
--from           the reference page to start from: its lab (burger: ticket, headphones: sound, sneaker: motion,
                 cabin: energy), layout, fonts and colours. You then rewrite its words, parts and look for the product.
--noun           what the product is called in the prompts ("moka pot", "cabin and its deck")
--backdrop       the plain colour the product is cut out on and the lab's background (hex); --backdrop-name the same
                 in words for the prompts ("pale warm grey"). Light products on a dark backdrop or dark on light.
--examples       copy the reference's prompts as they are (to rebuild that page), instead of slots to write

Creates, or adds a page to an existing project:
    <project>/site/engine/      the engine: explode.js, labs.js, frames.js, explode.css
    <project>/site/<id>/        index.html (fonts, colours) and page.json (words, parts, lab), from the reference
    <project>/site/index.html   opens the first page
    <project>/tools/            build.mjs, anchors.mjs, check.mjs, gen.mjs, package.json, subjects.json (this page's prompts)
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, json, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"
EXAMPLES = SKILL / "assets" / "examples"
REFS = ["burger", "headphones", "sneaker", "cabin"]

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("id")
ap.add_argument("--from", dest="ref", required=True, choices=REFS, help="the reference page to start from")
ap.add_argument("--brand", help="the brand, top left")
ap.add_argument("--noun", help="the product's name in the prompts")
ap.add_argument("--backdrop", help="the cut-out backdrop and lab colour (hex)")
ap.add_argument("--backdrop-name", help="the backdrop colour in words")
ap.add_argument("--examples", action="store_true", help="keep the reference's prompts as they are")
a = ap.parse_args()

if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", a.id):
    sys.exit("<id> must be lowercase letters, digits and dashes (e.g. moka)")
if a.backdrop and not re.fullmatch(r"#[0-9a-fA-F]{6}", a.backdrop):
    sys.exit("--backdrop must be a hex colour like #e9e5de")

proj = Path(a.project).expanduser().resolve()
tools, site = proj / "tools", proj / "site"
adding = (tools / "subjects.json").exists()
if not adding and proj.exists() and any(proj.iterdir()):
    sys.exit(f"{proj} exists and is not an Exploded View project; pick a new folder")
if (site / a.id).exists():
    sys.exit(f"{site / a.id} exists already; pick another id")

if not adding:
    shutil.copytree(TEMPLATE, proj, dirs_exist_ok=True)
    (proj / ".gitignore").write_text(
        "node_modules/\n.DS_Store\n"
        "# 2K masters, masks, raw clips, takes and review sheets: remake them with tools/build.mjs\n"
        "tools/out/\n")

# the page: the reference's index.html and page.json
ref = EXAMPLES / a.ref
(site / a.id).mkdir(parents=True)
html = (ref / "index.html").read_text()
page = json.loads((ref / "page.json").read_text())
if a.brand:
    page["brand"] = a.brand
    html = re.sub(r"<title>.*?</title>", f"<title>{a.brand}</title>", html, count=1)
if a.backdrop:
    html = re.sub(r"--lab-bg: #[0-9a-fA-F]{3,8}", f"--lab-bg: {a.backdrop.lower()}", html, count=1)
(site / a.id / "index.html").write_text(html)
(site / a.id / "page.json").write_text(json.dumps(page, indent=2, ensure_ascii=False) + "\n")
if not (site / "index.html").exists():
    (site / "index.html").write_text(
        f'<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url={a.id}/">\n'
        f'<title>{a.brand or a.id}</title>\n<a href="{a.id}/">{a.brand or a.id}</a>\n')

# the prompts: the reference's entry, or slots to write with the reference beside them
example = json.loads((EXAMPLES / "subjects.json").read_text())["subjects"][a.ref]
entry = dict(example) if a.examples else {
    "noun": a.noun or "WRITE: what the product is called, as the prompts say it",
    "backdrop": a.backdrop or example["backdrop"],
    "backdropName": a.backdrop_name or ("WRITE: the backdrop colour in words" if a.backdrop else example["backdropName"]),
    "fit": example["fit"],
    "place1": "WRITE: the product in its first place (references/prompts.md → place1)",
    "place2": "WRITE: the same product whole again, at a new angle in its second place (→ place2)",
    "exploded": "WRITE: how it comes apart and the parts, top to bottom or outside in (→ exploded)",
    "detach1": "",
    "detach2": "",
    "remove1": "WRITE: remove the product from place 1, saying what stays (→ plates)",
    "remove2": "WRITE: remove the product from place 2, saying what stays (→ plates)",
    "explode": "WRITE: one motion, the product coming apart into the exploded view (→ clips)",
    "rebuild": "WRITE: one motion, the parts closing into the whole product as it turns to its new angle (→ clips)",
    "_example": example,
}
if a.noun:
    entry["noun"] = a.noun
if a.backdrop:
    entry["backdrop"] = a.backdrop
if a.backdrop_name:
    entry["backdropName"] = a.backdrop_name
spec = json.loads((tools / "subjects.json").read_text())
spec["subjects"][a.id] = entry
(tools / "subjects.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n")

print(f"{'added' if adding else 'created'} {proj}  (page {a.id}, from {a.ref})")
todo = [k for k, v in entry.items() if isinstance(v, str) and v.startswith("WRITE")]
if todo:
    print(f"next: write {', '.join(todo)} in {tools / 'subjects.json'} → subjects → {a.id}")
if not adding:
    print(f"then: cd {tools} && npm install")
