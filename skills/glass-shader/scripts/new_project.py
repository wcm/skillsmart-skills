#!/usr/bin/env python3
"""Scaffold a Glass Shader project, or add another page to one, starting from one of the examples.

    python3 new_project.py <project-dir> --from <example> [--as <page>] [--examples]

<example> is one of: "reeded", "steam", "liquid", "tiles" (SKILL.md says what each one is).

The first call creates the project:
    <project>/site/index.html      the page, copied from the example so it runs straight away
    <project>/site/engine/         the shader engine (WebGL2, no libraries) and the page shell, page.css
    <project>/.gitignore
and, for looks over a photo, <project>/site/img/ (the examples' photos) and <project>/tools/ (photo.mjs, to
generate a photo with Skillsmart credits).
Later calls add a page beside it: site/<page>.html (<page> defaults to the example's name).
--examples also adds every other example as site/<example>.html (for a demo or a series).
Nothing is generated and no network is called; serve site/ to see it.
"""
import argparse, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
ASSETS = SKILL / "assets"
EXAMPLES = ["reeded", "steam", "liquid", "tiles"]
HAS_IMG = True
SKIP = shutil.ignore_patterns(".DS_Store")

ap = argparse.ArgumentParser(description="Scaffold a Glass Shader project from one of its example pages.")
ap.add_argument("project", help="the project folder, e.g. ./sorbet-hero")
ap.add_argument("--from", dest="src", required=True, choices=EXAMPLES, help="the example to start from")
ap.add_argument("--as", dest="page", help="the page's file name, without .html (the first page is index)")
ap.add_argument("--examples", action="store_true", help="also add every other example as its own page")
a = ap.parse_args()

proj = Path(a.project).expanduser().resolve()
site = proj / "site"
first = not (site / "engine" / "core.js").exists()
if first:
    if proj.exists() and any(p.name != ".DS_Store" for p in proj.iterdir()):
        sys.exit(f"{proj} exists, isn't empty and isn't a Glass Shader project; pick a new folder")
    site.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ASSETS / "engine", site / "engine", ignore=SKIP)
    if HAS_IMG:
        shutil.copytree(ASSETS / "img", site / "img", ignore=SKIP)
        shutil.copytree(ASSETS / "tools", proj / "tools", ignore=SKIP)
    (proj / ".gitignore").write_text(".DS_Store\n")


def add(src, page):
    if not re.fullmatch(r"[a-z][a-z0-9-]*", page):
        sys.exit("a page name uses lowercase letters, digits and dashes, e.g. 'launch' or 'night-sale'")
    dest = site / f"{page}.html"
    if dest.exists():
        sys.exit(f"{dest} exists; pick another name with --as")
    dest.write_text((ASSETS / "examples" / f"{src}.html").read_text())
    return dest


page = a.page or ("index" if not (site / "index.html").exists() else a.src)
made = [(add(a.src, page), a.src)]
if a.examples:
    for ex in EXAMPLES:
        if ex != a.src and not (site / f"{ex}.html").exists():
            made.append((add(ex, ex), ex))

print(f"{'created' if first else 'updated'} {proj}")
for dest, src in made:
    print(f"  site/{dest.name}   from the {src} example")
print(f"  preview: python3 -m http.server 8000 -d {site}   then open http://localhost:8000/{'' if made[0][0].name == 'index.html' else made[0][0].name}")
