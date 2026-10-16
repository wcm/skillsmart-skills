#!/usr/bin/env python3
"""Scaffold a Puff Hero page: one poster whose hero is a word in overinflated, deformed 3D letters.

    python3 new_project.py <project-dir> --brand "Sour Records" --words "POP/STAR"
        [--id pop] [--bg "#b4ea4c"] [--ink "#0b0b0b"] [--backdrop "lime green"] [--ratio 3:2] [--description "…"]

--words   the letters, with "/" where a line breaks ("POP/STAR", "HELLO/COZY/SEASON"). Short lines puff best:
          2–6 letters a line, 1–3 lines.
--bg      the page colour; --backdrop the same colour in words, for the prompt ("lime green"). The still is shot on
          that backdrop so the cut-out's soft edges carry the page's own colour.
--ratio   the still's frame; by default chosen from the words' shape (1:1, 4:3, 3:2, 16:9, or 3:4 for three lines).

Creates:
    <project>/site/    index.html, style.css, main.js (the page), puff.js (the puffy layer), backgrounds.js (recipes),
                       img/<id>/ (filled by tools/video.mjs)
    <project>/tools/   pages.json (the prompt formula and this page), generate.mjs (stills), video.mjs (loop, matte,
                       encode), check.mjs (headless checks), gen.mjs (generation with Skillsmart credits), package.json
    <project>/.gitignore
Nothing is generated and no credits are spent.
"""
import argparse, json, re, shutil, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "assets" / "template"

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--brand", required=True, help="the site's name, top left")
ap.add_argument("--words", required=True, help='the puffy letters, "/" between lines, e.g. "POP/STAR"')
ap.add_argument("--id", help="a short id for the page (default: from the words)")
ap.add_argument("--bg", default="#eeebe5", help="the page colour (hex)")
ap.add_argument("--ink", default="#111111", help="the copy colour (hex)")
ap.add_argument("--backdrop", default="warm off-white", help="the page colour in words, for the prompt")
ap.add_argument("--ratio", help="the still's frame: 1:1, 4:3, 3:2, 16:9, 3:4")
ap.add_argument("--description", help="meta description")
a = ap.parse_args()

proj = Path(a.project).expanduser().resolve()
if proj.exists() and any(proj.iterdir()):
    sys.exit(f"{proj} exists and is not empty; pick a new folder")

lines = [l.strip() for l in a.words.split("/") if l.strip()]
if not lines:
    sys.exit("--words is empty")
spoken = " ".join(lines)
pid = a.id or re.sub(r"[^a-z0-9]+", "-", spoken.lower()).strip("-")[:24] or "hero"

if a.ratio:
    ratio = a.ratio
else:
    longest, n = max(len(l) for l in lines), len(lines)
    r = longest / n
    ratio = "3:4" if n >= 3 and r <= 2.2 else "1:1" if r <= 1.6 else "4:3" if r <= 2.2 else "3:2" if r <= 3.2 else "16:9"

q = lambda s: f'\\"{s}\\"'          # quoted inside a JSON string
if len(lines) == 1:
    words_prompt = f"the {'words' if ' ' in lines[0] else 'word'} {q(lines[0])}"
elif len(lines) == 2:
    words_prompt = f"the words {q(lines[0])} over {q(lines[1])} on two stacked lines"
else:
    count = {3: "three", 4: "four", 5: "five"}.get(len(lines), str(len(lines)))
    words_prompt = "the words " + ", ".join(q(l) for l in lines[:-1]) + f" and {q(lines[-1])} on {count} stacked lines"

shutil.copytree(TEMPLATE, proj, dirs_exist_ok=True)
fill = {
    "{{BRAND}}": a.brand, "{{ID}}": pid, "{{WORDS}}": spoken, "{{BG}}": a.bg, "{{INK}}": a.ink,
    "{{RATIO}}": ratio, "{{BACKDROP}}": a.backdrop, "{{WORDS_PROMPT}}": words_prompt,
    "{{DESCRIPTION}}": a.description or f"{a.brand}: {spoken}.",
}
for f in [proj / "site" / n for n in ("index.html", "style.css", "main.js")] + [proj / "tools" / "pages.json"]:
    s = f.read_text()
    for k, v in fill.items():
        s = s.replace(k, v)
    f.write_text(s)
json.loads((proj / "tools" / "pages.json").read_text())      # still valid JSON
(proj / "site" / "img" / pid).mkdir(parents=True, exist_ok=True)
(proj / ".gitignore").write_text(
    "node_modules/\n.DS_Store\n"
    "# 2K masters, raw Kling clips, masks, takes and review sheets: remake them with tools/*.mjs\n"
    "tools/out/\n")
print(f"created {proj}  (page id: {pid}, still ratio {ratio})")
print(f"next: fill in material, subject and shine in {proj / 'tools' / 'pages.json'}, then: cd {proj / 'tools'} && npm install")
