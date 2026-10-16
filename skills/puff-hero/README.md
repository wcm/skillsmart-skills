# Puff Hero — a Skillsmart skill

Build a **loud, poster-like landing page whose hero is a word in overinflated, wildly deformed 3D letters** —
satin vinyl, glossy bubblegum, squishy matte rubber, faux fur — floating over fashionable type and a still,
code-drawn pattern:

- **Letters that feel touchable.** They lean toward your cursor, pop with a springy swell when you reach them, and
  jiggle through a seamless loop while you stay on them, always settling back where they started.
- **Generated, not modelled.** A still from a tested prompt formula, a video loop that starts and ends on it, and a
  frame-by-frame cut-out so the letters float on the page with real transparency (WebM for Chrome, Firefox and Edge;
  HEVC for Safari). Your agent makes them with your Skillsmart credits.
- **A real page around them.** Brand, nav, headline, label and call to action in HTML, a background drawn in code for
  the brand (outlined type, a twisted grid, a soft-serve swirl, crayon clouds), and layouts for desktop and phone.

Four reference pages ship in `assets/examples/`: *Hug* (hot-pink satin over outlined type), *Pop* (bubblegum on a
twisted lime grid), *Soft* (matte rubber over a soft-serve swirl) and *Cozy* (faux fur among crayon clouds).

Works with any agent that supports skills: Claude Code (and the Claude desktop app's Code tab), Codex, Cursor,
Gemini CLI, OpenCode and others.

---

## Install

Get it from **[skillsmart.io/skills/puff-hero](https://skillsmart.io/skills/puff-hero)**: click **Get skill**, copy
the one-line prompt, and paste it into your AI agent. Or run it yourself:

```bash
npx skillsmart@latest add puff-hero
```

The installer puts the skill where your agent looks for it (`~/.claude/skills` for Claude Code, `~/.agents/skills` for
Codex, Cursor, Gemini CLI and OpenCode).

## Use

Say the words and what the page is for:

| Agent | Say |
|---|---|
| Claude Code | `/puff-hero A launch page for our single POP STAR, glossy bubblegum-pink letters on lime green` |
| Codex | `$puff-hero HELLO COZY SEASON in faux fur for a homeware winter edit` |
| Any agent | "Make a puffy-letter hero that says SOFT SERVE for my ice-cream shop" |

The agent picks the material, colours, background and type, scaffolds the page, generates three stills and two loops
for you to choose from, cuts the chosen loop out, builds the page and checks it in a headless browser.

**What you need**

| | |
|---|---|
| Skillsmart credits | a still is 20, a loop 15 a second, the cut-out 2 a second: about **190 credits** a page. Every account starts with 300; buy more on [your account page](https://skillsmart.io/account). Prefer your own fal.ai key? Set `FAL_KEY` and no credits are used |
| Node.js 18+, ffmpeg, Python 3 | the tools, encoding and the scaffold; on macOS `brew install node ffmpeg python` |
| A Mac, for Safari | Safari's transparent video (HEVC with alpha) is encoded with Apple's VideoToolbox; elsewhere Safari shows the still and the pop without the loop |
| Chrome or Edge | for the headless check; fonts load from Google Fonts |

---

## What's inside

```
SKILL.md                         the workflow the agent follows (start here)
references/
  prompt-formula.md              the still's prompt formula, tested materials, what didn't work
  motion.md                      the loop, reading the takes, the cut-out and the encode
  page.md                        composition, type, colour, the puffy layer's options
  backgrounds.md                 the four background recipes and how to write one
  troubleshooting.md             what has gone wrong before and the fixes
scripts/new_project.py           scaffolds a project for your words and colours
assets/template/site/            index.html, style.css, main.js, puff.js (the puffy layer), backgrounds.js
assets/template/tools/           pages.json (prompts), generate.mjs (stills), video.mjs (loop, cut-out, encode),
                                 check.mjs (headless checks), gen.mjs (generation with credits)
assets/examples/                 the four reference pages' prompt entries
```

### How a generated project is laid out

```
puff-pop-star/
  site/                          serve this folder (python3 -m http.server 5183 -d site)
    index.html style.css main.js puff.js backgrounds.js
    img/pop-star/                puff.webm (Chrome, Firefox, Edge), puff.mov (Safari), puff.webp (the first frame)
  tools/
    pages.json                   the prompt formula and this page's slots
    generate.mjs video.mjs       node generate.mjs pop-star --takes 3 · node video.mjs pop-star --takes 2
    check.mjs gen.mjs
    out/                         2K stills, takes, raw loops, masks and review sheets (gitignored)
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host.
