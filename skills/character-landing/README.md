# Character Landing Page — a SkillsMart skill

Turn **one reference image** into an **animated landing page** starring that character:

- **The hero:** the character peeks up from the bottom of the screen, big, and its **eyes follow your cursor**.
- **Scrolling:** it zooms out and **strikes a new pose for every section** (sketching, skating, twirling…). The motion between poses scrubs with the scroll.
- **The look:** each section has its own vibrant gradient, with a font pairing and background style chosen to suit the character.

Works with photos of yourself (stylised into a Pixar-style or illustrated character), illustrations, drawings, or a plain text idea.

---

## Install

Get it from **[skillsmart.io/skills/character-landing](https://skillsmart.io/skills/character-landing)**: click **Get it**, copy the one-line prompt, and paste it into Claude (desktop app → Code tab), Cursor or Codex. Claude installs the skill and tells you what to try first.

Developers can also run `skillsmart add character-landing` with the [SkillsMart CLI](https://skillsmart.io/install.sh).

**What you need**

| | |
|---|---|
| A reference image | a photo, illustration or character art (PNG/JPG/WebP) |
| A **fal.ai API key** | create one at https://fal.ai/dashboard/keys. Generation costs roughly **$2–5 per character** (a few images plus three 5-second video clips). |
| Node.js 18+, ffmpeg, Python 3 | on macOS: `brew install node ffmpeg python`; on Windows: `winget install OpenJS.NodeJS Gyan.FFmpeg Python.Python.3.12` |

Then follow `SKILL.md` from Step 0. Claude stops for your approval after the rest still, after the pose stills, and before the video clips (the steps that cost money).

---

## What's inside

```
SKILL.md                      the workflow Claude follows (start here)
references/
  character-json.md           every field of character.json + how to write image/pose prompts
  themes.md                   picking fonts, title style and gradient when the user gives no instructions
  eyes.md                     calibrating the cursor-following eyes
  troubleshooting.md          known failure modes and fixes
scripts/new_project.py        scaffolds a new project folder from the template
assets/template/              the site (HTML/CSS/JS) and the generator (tools/generate.mjs, tools/eyes.py)
assets/examples/              one complete character.json, for structure only (every new character is written fresh)
```

### How a generated project is laid out

```
my-page/
  site/                       static site, open with: python3 -m http.server 5174 -d site
    characters/<id>/          character.json, hero.webp, seq/ (keyed animation frames)
  tools/generate.mjs          FAL_KEY=… node generate.mjs <id> --steps image | poses | clips | frames
  ref/                        your reference image (git-ignored)
```

The result is a plain static site: no build step and no framework. Deploy the `site/` folder to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

### Notes

- **Your images.** If you use someone else's artwork as the reference, get their permission or credit them before publishing. Photos of real people should be of you, or used with consent.
- **Trademarked characters** (e.g. famous cartoon mascots) are usually refused by the image model. The skill suggests an original character with the same energy instead.
- **Models used:** fal `nano-banana-pro` (stills and edits) and `kling-video/v3/pro/image-to-video` (pose-to-pose clips). Prices and availability are set by fal.

## Credits

Duplicated from [wcm/character-landing-skill](https://github.com/wcm/character-landing-skill).

## License

MIT — see [LICENSE](LICENSE). Images you generate with the skill are yours, subject to fal's terms and the rights in your reference image.
