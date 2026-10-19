#!/usr/bin/env python3
"""Scaffold a Pixel Game project, or add another game to one, from the starter or one of the examples.

    python3 new_project.py <project-dir> --from hop|roadster|kombat|metagear [--as <game>] [--title "<Title>"] [--examples]

--from      what to start from:
              hop        Pixel Hop, the starter: a one-button runner, the smallest complete game
              roadster   Flappy Roadster: four one-tap games around one car (a Flappy Bird, a traffic
                         jumper, a gravity flip, a drag race), with a predictive autopilot
              kombat     Model Kombat: a best-of-three fighter on an on-screen pad, with a CPU, supers,
                         a finisher and caricature portraits
              metagear   Meta Gear Solid: hold to sneak, let go to hide; guests with view cones on patterns
                         of the clock; a planner autopilot ("ghost mode")
--as        the new game's short name (lowercase letters, digits and dashes, e.g. slop-invaders): its page
            is <game>.html, its scripts games/<game>/, its tools tools/games/<game>/, and its saves get their
            own namespace. Without --as the game is copied under its own name, unchanged.
--title     the page's <title> with --as (default: the name in words)
--examples  also add the starter and the three examples unchanged, with the arcade's front page
            (index.html) and its thumbnails: a demo of everything the skill ships

The first call creates the project:
    <project>/<game>.html        the page: the 9:16 game canvas in the middle, help panels either side
    <project>/engine/            the engine every game shares: core, screen, audio, ui, app
    <project>/games/<game>/      the game: sim, art, view, sfx, ui, main (more files for roadster)
    <project>/tools/             checks, screenshots, demo videos, sprite sheets (npm install, once)
    <project>/.gitignore
Later calls add another game beside the first, sharing the engine and the tools.
Nothing is downloaded or generated; serve the folder to play.
"""
import argparse, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
A = SKILL / "assets"
GAMES = {
    "hop": "pixel-hop.html",
    "roadster": "flappy-roadster.html",
    "kombat": "model-kombat.html",
    "metagear": "meta-gear-solid.html",
}
SKIP = shutil.ignore_patterns(".DS_Store", "node_modules", "out")

ap = argparse.ArgumentParser(description="Scaffold a Pixel Game project from the starter or an example.")
ap.add_argument("project", help="the project folder, e.g. ./slop-invaders")
ap.add_argument("--from", dest="src", required=True, choices=list(GAMES), help="the game to start from")
ap.add_argument("--as", dest="name", help="the new game's short name, e.g. slop-invaders")
ap.add_argument("--title", help="the page's title, e.g. 'Slop Invaders'")
ap.add_argument("--examples", action="store_true", help="also add the starter and every example unchanged, with the front page")
a = ap.parse_args()

if a.name and not re.fullmatch(r"[a-z][a-z0-9-]{0,31}", a.name):
    sys.exit("--as takes lowercase letters, digits and dashes, e.g. slop-invaders")
if a.name in GAMES and a.name != a.src:
    sys.exit(f"'{a.name}' is one of the examples' names; pick another")

proj = Path(a.project).expanduser().resolve()
first = not (proj / "engine" / "core.js").exists()
if first:
    if proj.exists() and any(p.name != ".DS_Store" for p in proj.iterdir()):
        sys.exit(f"{proj} exists, isn't empty and isn't a Pixel Game project; pick a new folder")
    proj.mkdir(parents=True, exist_ok=True)
    shutil.copytree(A / "engine", proj / "engine", ignore=SKIP)
    tools = proj / "tools"
    (tools / "games").mkdir(parents=True)
    for f in (A / "tools").iterdir():
        if f.is_file() and f.name != ".DS_Store":
            shutil.copy2(f, tools / f.name)
    (proj / ".gitignore").write_text(".DS_Store\ntools/node_modules/\ntools/out/\n")
slug = re.sub(r"[^a-z0-9]+", "-", proj.name.lower()).strip("-") or "pixel-game"


def add(src, name):
    """Copy a game (scripts, page, tools) under `name`; the same name keeps it exactly as it is."""
    same = name == src
    page = GAMES[src] if same else f"{name}.html"
    for p in (proj / "games" / name, proj / page, proj / "tools" / "games" / name):
        if p.exists():
            sys.exit(f"{p} exists; pick another name with --as")
    shutil.copytree(A / "games" / src, proj / "games" / name, ignore=SKIP)
    shutil.copytree(A / "tools" / "games" / src, proj / "tools" / "games" / name, ignore=SKIP)
    html = (A / "pages" / GAMES[src]).read_text()
    if not same:
        title = a.title or name.replace("-", " ").title()
        html = html.replace(f"games/{src}/", f"games/{name}/")
        html = re.sub(r"<title>[^<]*</title>", f"<title>{title}</title>", html, count=1)
        # The link back to the arcade's front page, which a new project doesn't have.
        html = re.sub(r'\n[ \t]*<p><a href="index.html">[^<]*</a></p>', "", html)
        for f in (proj / "tools" / "games" / name).iterdir():
            if f.suffix in (".mjs", ".html"):
                t = f.read_text().replace(f"games/{src}/", f"games/{name}/")
                if f.name == "demo.mjs" and src == "hop":
                    t = t.replace("  hop: {", f"  '{name}': {{")
                f.write_text(t)
        main = proj / "games" / name / "main.js"
        m = main.read_text()
        m = m.replace(f"R.store.ns = 'pixel-arcade:{src}:';", f"R.store.ns = '{slug}:{name}:';")
        main.write_text(m)
    (proj / page).write_text(html)
    return page


made = [(add(a.src, a.name or a.src), a.src)]
if a.examples:
    for ex in GAMES:
        if not (proj / "games" / ex).exists():
            made.append((add(ex, ex), ex))
    if not (proj / "index.html").exists():
        shutil.copy2(A / "pages" / "index.html", proj / "index.html")
        shutil.copytree(A / "thumbs", proj / "thumbs", ignore=SKIP, dirs_exist_ok=True)
        made.append(("index.html", "the arcade's front page"))

print(f"{'created' if first else 'updated'} {proj}")
for page, src in made:
    print(f"  {page:24} {'from ' + src if src in GAMES else src}")
game = a.name or a.src
print(f"  play:   python3 -m http.server 8000 -d {proj}   then open http://localhost:8000/{made[0][0]}")
print(f"  checks: cd {proj / 'tools'} && npm install   (once), then node sim.mjs {game} and node screens.mjs {game}")
